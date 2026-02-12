import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Helper: Mask sensitivity PII in logs
const maskPII = (val: string | undefined | null) => {
    if (!val) return 'null';
    if (val.length < 8) return '***'; // too short, hide all
    return val.substring(0, 3) + '****' + val.substring(val.length - 3);
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: corsHeaders
        });
    }

    try {
        // 1. Validate Content-Type
        const contentType = req.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            return new Response(JSON.stringify({ error: 'Invalid Content-Type' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const body = await req.json().catch(() => ({}));
        const { contactId, templateId } = body;
        // Notice: We IGNORE body.userId to prevent spoofing.

        console.log('📥 Received request - V2');

        // 2. Validate Inputs
        if (!contactId || !templateId) {
            console.error('❌ Missing required fields');
            return new Response(JSON.stringify({
                success: false,
                error: 'Missing required fields: contactId or templateId'
            }), {
                status: 400,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        // 3. Authenticate User (JWT) or Service Role (Cron)
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error('❌ Missing Authorization header');
            return new Response(JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

        let userId: string;
        let userClient;

        // Check if caller is using Service Role Key (Trusted)
        if (authHeader === `Bearer ${supabaseServiceKey}`) {
            console.log('🤖 Request from Service Role (Cron/System)');

            // For Service Role, we expect userId in body to know who to attribute this to
            if (!body.userId) {
                console.warn('⚠️ Service Role request missing userId in body');
                // We could fail, or maybe proceed with a system ID? 
                // For now, let's require it for notifications/logs context.
                // check-birthdays might not have passed it yet, but we will update it.
            }
            userId = body.userId;

            // Create client with Service Key (Bypasses RLS)
            userClient = createClient(supabaseUrl, supabaseServiceKey);
        } else {
            // Standard User (Untrusted Payload, Trusted Token)
            userClient = createClient(supabaseUrl, supabaseAnonKey, {
                global: { headers: { Authorization: authHeader } }
            });

            const { data: { user }, error: userError } = await userClient.auth.getUser();

            if (userError || !user) {
                console.error('❌ Invalid Token:', userError);
                return new Response(JSON.stringify({ error: 'Unauthorized: Invalid Token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            userId = user.id; // Trusted User ID from Token
            console.log('👤 Authenticated User ID:', userId);
        }


        // 4. Fetch Data (Using User Context - Enforces RLS)
        // Fetch contact
        console.log('👤 Fetching contact...');
        const { data: contact, error: contactError } = await userClient
            .from('contacts')
            .select('first_name, last_name, birthday, phone')
            .eq('id', contactId)
            .single();

        if (contactError || !contact) {
            console.error('❌ Contact not found or access denied:', contactError);
            return new Response(JSON.stringify({
                success: false,
                error: 'Contact not found or access denied'
            }), {
                status: 404, // Use 404/403 to avoid leaking info
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        // Fetch template (User Context)
        console.log('📄 Fetching template...');
        const { data: template, error: templateError } = await userClient
            .from('message_templates')
            .select('name, content, type')
            .eq('id', templateId)
            .single();

        if (templateError || !template) {
            console.error('❌ Template not found or access denied:', templateError);
            return new Response(JSON.stringify({
                success: false,
                error: 'Template not found or access denied'
            }), {
                status: 404,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        // Check if template is SMS type
        if (template.type !== 'sms') {
            console.error('❌ Template is not SMS type:', template.type);
            return new Response(JSON.stringify({
                success: false,
                error: `Template is type '${template.type}', not 'sms'`
            }), {
                status: 400,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        // 5. Fetch System Settings (Privileged Operation)
        // We use Service Role ONLY for this part if normal users can't read settings
        // Although typically system_settings containing API keys should NOT be readable by anon/authenticated unless specific RLS allows.
        // Assuming backend needs access.

        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);

        console.log('⚙️ Fetching settings (Admin Context)...');
        const { data: settingsData, error: settingsError } = await adminClient
            .from('system_settings')
            .select('setting_key, setting_value')
            .in('setting_key', ['termii_api_key', 'termii_sender_id', 'termii_channel', 'enable_sms']);

        if (settingsError || !settingsData) {
            console.error('❌ Settings error (Admin):', settingsError);
            return new Response(JSON.stringify({
                success: false,
                error: 'Internal Configuration Error'
            }), {
                status: 500,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        const settings: any = {};
        settingsData.forEach((item: any) => {
            settings[item.setting_key] = item.setting_value;
        });

        if (settings.enable_sms !== 'true') {
            console.error('❌ SMS disabled in settings');
            return new Response(JSON.stringify({
                success: false,
                error: 'SMS functionality is disabled'
            }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (!settings.termii_api_key) {
            console.error('❌ Termii API key missing');
            // Do not leak detailed config error to client
            return new Response(JSON.stringify({
                success: false,
                error: 'SMS Service not configured'
            }), {
                status: 503,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 6. Logic (Age Calc / Replacement)
        const birthDate = new Date(contact.birthday);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        // Replace placeholders
        // SMS content is plain text, so no HTML escaping needed usually (unless for specific chars to save bytes)
        let messageContent = template.content
            .replace(/\[FirstName\]/gi, contact.first_name)
            .replace(/\[LastName\]/gi, contact.last_name)
            .replace(/\[Name\]/gi, `${contact.first_name} ${contact.last_name}`)
            .replace(/\[Age\]/gi, age.toString())
            .replace(/\{first_name\}/gi, contact.first_name)
            .replace(/\{firstname\}/gi, contact.first_name)
            .replace(/\{last_name\}/gi, contact.last_name)
            .replace(/\{lastname\}/gi, contact.last_name)
            .replace(/\{name\}/gi, `${contact.first_name} ${contact.last_name}`)
            .replace(/\{full_name\}/gi, `${contact.first_name} ${contact.last_name}`)
            .replace(/\{fullname\}/gi, `${contact.first_name} ${contact.last_name}`)
            .replace(/\{age\}/gi, age.toString());

        // Redact Message Content in logs (it might be sensitive)
        // We log it only partially if debugging needed or just successful event
        console.log('✍️  Prepared SMS Content (REDACTED). Length:', messageContent.length);


        // 7. Send SMS
        let phoneNumber = contact.phone.replace(/\s+/g, ''); // Remove spaces

        // Normalize Nigerian phone numbers
        // 080... -> 23480...
        if (phoneNumber.startsWith('0') && phoneNumber.length === 11) {
            phoneNumber = '234' + phoneNumber.substring(1);
        }
        // +234... -> 234...
        if (phoneNumber.startsWith('+234')) {
            phoneNumber = phoneNumber.substring(1);
        }

        console.log('📤 Sending SMS to Termii...');
        console.log('📱 Phone (Masked):', maskPII(phoneNumber));

        // Use configured channel or default to 'generic'
        const channel = settings.termii_channel || 'generic';
        console.log('📡 Termii Channel:', channel);

        const termiiPayload = {
            to: phoneNumber,
            from: settings.termii_sender_id || 'BirthdayBot',
            sms: messageContent,
            type: 'plain',
            channel: channel,
            api_key: settings.termii_api_key
        };

        const termiiResponse = await fetch('https://api.ng.termii.com/api/sms/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(termiiPayload)
        });

        const termiiData = await termiiResponse.json();

        // Log response status but be careful with Data
        console.log('📡 Termii Response Status:', termiiResponse.status);

        let status = 'failed';
        let errorMessage = null;
        let isSuccess = false;

        if (termiiResponse.ok && termiiData.message_id) {
            console.log('✅ SUCCESS: SMS sent. Message ID:', termiiData.message_id);
            status = 'sent';
            isSuccess = true;
        } else {
            // Log detailed error internally
            console.error('❌ FAILED: Termii Error:', JSON.stringify(termiiData));
            status = 'failed';
            errorMessage = termiiData.message || (typeof termiiData.error === 'string' ? termiiData.error : 'Provider Error');
        }

        // 8. Log to DB (Using Admin Client? Or User Client?)
        // User probably has permission to insert into 'message_logs' via RLS
        // Use User Client to stay safe.

        console.log('💾 Saving to message_logs...');
        const { error: logError } = await userClient.from('message_logs').insert({
            contact_id: contactId,
            template_id: templateId,
            message_type: 'sms',
            // recipient was duplicated using maskPII before. 
            // We use the normalized phoneNumber as the actual recipient.
            recipient: phoneNumber,
            content: messageContent,
            status: status,
            provider_response: termiiData, // This might contain PII? depends on provider.
            sent_at: isSuccess ? new Date().toISOString() : null
        });

        if (logError) {
            console.error('⚠️ Failed to save message log (DB):', logError);
        }

        // 9. Notification (User Client)
        if (isSuccess) {
            await userClient.from('notifications').insert({
                user_id: userId,
                title: 'SMS Sent Successfully',
                message: `Birthday SMS sent to ${contact.first_name} ${contact.last_name}`,
                type: 'success',
                is_read: false,
                link: `/contacts/${contactId}`,
                metadata: {
                    contact_id: contactId,
                    action: 'sms_sent',
                    message_id: termiiData.message_id
                }
            });
        } else {
            await userClient.from('notifications').insert({
                user_id: userId,
                title: 'SMS Failed',
                message: `Failed to send SMS to ${contact.first_name}. Check logs.`,
                type: 'error',
                is_read: false,
                link: `/contacts/${contactId}`,
                metadata: {
                    contact_id: contactId,
                    action: 'sms_failed',
                    error: errorMessage
                }
            });
        }

        return new Response(JSON.stringify({
            success: isSuccess,
            message: isSuccess ? 'SMS sent successfully' : 'Failed to send SMS',
            // Expose detailed error for debugging
            error: isSuccess ? null : errorMessage,
            details: termiiData // Include full details for debugging
        }), {
            status: 200, // Return 200 even if SMS failed (business logic failure), so frontend receives the JSON body
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('💥 Fatal Error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: 'Internal Server Error'
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
