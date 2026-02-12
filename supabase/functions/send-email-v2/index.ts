import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// Helper: Mask sensitive PII in logs
const maskPII = (val: string | undefined | null) => {
    if (!val) return 'null';
    if (val.length < 5) return '***';
    return val.substring(0, 2) + '****' + val.substring(val.length - 2);
};

// Helper: Escape HTML characters to prevent injection
const escapeHtml = (unsafe: string) => {
    if (!unsafe) return "";
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', {
            headers: corsHeaders
        });
    }

    try {
        const contentType = req.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            return new Response(JSON.stringify({ error: 'Invalid Content-Type' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const body = await req.json().catch(() => ({}));
        const { contactId, templateId } = body;
        // Ignore userId from body to prevent spoofing

        console.log('📥 Received Email Request - V2');

        if (!contactId || !templateId) {
            console.error('❌ Missing required fields');
            return new Response(JSON.stringify({
                success: false,
                error: 'Missing required fields'
            }), {
                status: 400,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        // Authenticate User
        // Authenticate User or Service Role
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            console.error('❌ Missing Authorization header');
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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

            if (!body.userId) {
                console.warn('⚠️ Service Role request missing userId in body');
            }
            userId = body.userId;

            // Create client with Service Key (Bypasses RLS)
            userClient = createClient(supabaseUrl, supabaseServiceKey);
        } else {
            userClient = createClient(supabaseUrl, supabaseAnonKey, {
                global: { headers: { Authorization: authHeader } }
            });

            const { data: { user }, error: userError } = await userClient.auth.getUser();

            if (userError || !user) {
                console.error('❌ Invalid Token:', userError);
                return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
            }

            userId = user.id;
            console.log('👤 Authenticated User:', userId);
        }

        // Fetch contact (User Context)
        console.log('👤 Fetching contact...');
        const { data: contact, error: contactError } = await userClient
            .from('contacts')
            .select('first_name, last_name, email, birthday')
            .eq('id', contactId)
            .single();

        if (contactError || !contact) {
            console.error('❌ Contact error:', contactError);
            return new Response(JSON.stringify({
                success: false,
                error: 'Contact not found'
            }), {
                status: 404,
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

        if (!contact.email) {
            console.error('❌ Contact has no email');
            return new Response(JSON.stringify({
                success: false,
                error: 'Contact has no email address'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Fetch template (User Context)
        console.log('📄 Fetching template...');
        const { data: template, error: templateError } = await userClient
            .from('message_templates')
            .select('name, content, subject, type')
            .eq('id', templateId)
            .single();

        if (templateError || !template) {
            console.error('❌ Template error:', templateError);
            return new Response(JSON.stringify({
                success: false,
                error: 'Template not found'
            }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        if (template.type !== 'email') {
            console.error('❌ Template type mismatch');
            return new Response(JSON.stringify({
                success: false,
                error: 'Template is not email type'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // Calculate Age
        const birthDate = new Date(contact.birthday);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }

        // Prepare Safe Variables (Escaped for HTML)
        const safeFirstName = escapeHtml(contact.first_name);
        const safeLastName = escapeHtml(contact.last_name);
        const safeFullName = `${safeFirstName} ${safeLastName}`;
        const safeAge = age.toString();

        // Replace Placeholders in Subject (Subject is usually plain text, but good practice to be careful)
        let emailSubject = template.subject || 'Happy Birthday!';
        // Subjects don't render HTML generally, but let's just replace.
        emailSubject = emailSubject
            .replace(/\[FirstName\]/gi, safeFirstName)
            .replace(/\[LastName\]/gi, safeLastName)
            .replace(/\[Name\]/gi, safeFullName)
            .replace(/\[Age\]/gi, safeAge)
            .replace(/\{first_name\}/gi, safeFirstName)
            .replace(/\{firstname\}/gi, safeFirstName)
            .replace(/\{last_name\}/gi, safeLastName)
            .replace(/\{lastname\}/gi, safeLastName)
            .replace(/\{name\}/gi, safeFullName)
            .replace(/\{age\}/gi, safeAge);

        // Replace Placeholders in Content (HTML) - CRITICAL: Use ESCAPED variables
        let emailContent = template.content
            .replace(/\[FirstName\]/gi, safeFirstName)
            .replace(/\[LastName\]/gi, safeLastName)
            .replace(/\[Name\]/gi, safeFullName)
            .replace(/\[Age\]/gi, safeAge)
            .replace(/\{first_name\}/gi, safeFirstName)
            .replace(/\{firstname\}/gi, safeFirstName)
            .replace(/\{last_name\}/gi, safeLastName)
            .replace(/\{lastname\}/gi, safeLastName)
            .replace(/\{name\}/gi, safeFullName)
            .replace(/\{full_name\}/gi, safeFullName)
            .replace(/\{fullname\}/gi, safeFullName)
            .replace(/\{age\}/gi, safeAge);

        console.log('✍️ Prepared Email Content (REDACTED). Length:', emailContent.length);

        // Fetch Settings (Admin Context for Secrets)
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const adminClient = createClient(supabaseUrl, supabaseServiceKey);

        console.log('⚙️ Fetching settings...');
        const { data: settingsData, error: settingsError } = await adminClient
            .from('system_settings')
            .select('setting_key, setting_value')
            .in('setting_key', ['resend_api_key', 'from_email', 'from_name', 'enable_email']);

        if (settingsError || !settingsData) {
            console.error('❌ Settings error:', settingsError);
            return new Response(JSON.stringify({
                success: false,
                error: 'Internal Configuration Error'
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const settings: any = {};
        settingsData.forEach((item: any) => {
            settings[item.setting_key] = item.setting_value;
        });

        if (settings.enable_email !== 'true') {
            console.error('❌ Email disabled');
            return new Response(JSON.stringify({ success: false, error: 'Email functionality disabled' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        if (!settings.resend_api_key) {
            console.error('❌ Resend API Key missing');
            return new Response(JSON.stringify({ success: false, error: 'Email Service not configured' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        const fromEmail = settings.from_email || 'birthday@push.noltfinance.com';
        const fromName = settings.from_name || 'NOLT Birthday Team';
        const fromAddress = `${fromName} <${fromEmail}>`;

        // Send Email
        console.log('📤 Sending email via Resend...');
        console.log('📧 To (Masked):', maskPII(contact.email));

        const resendPayload = {
            from: fromAddress,
            to: [contact.email],
            subject: emailSubject,
            html: emailContent
        };

        const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${settings.resend_api_key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(resendPayload)
        });

        const resendData = await resendResponse.json();
        console.log('📡 Resend Status:', resendResponse.status);

        let status = 'failed';
        let errorMessage = null;
        let isSuccess = false;

        if (resendResponse.ok && resendData.id) {
            console.log('✅ SUCCESS: Email sent. ID:', resendData.id);
            status = 'sent';
            isSuccess = true;
        } else {
            console.error('❌ FAILED: Resend Error:', JSON.stringify(resendData));
            status = 'failed';
            errorMessage = resendData.message || (typeof resendData.error === 'string' ? resendData.error : 'Provider Error');
        }

        // Log to DB (User Context)
        console.log('💾 Saving to message_logs...');
        const { error: logError } = await userClient.from('message_logs').insert({
            contact_id: contactId,
            template_id: templateId,
            message_type: 'email',
            recipient: contact.email,
            content: emailContent,
            status: status,
            provider_response: resendData,
            sent_at: isSuccess ? new Date().toISOString() : null
        });

        if (logError) {
            console.error('⚠️ Failed to save log (DB):', logError);
        }

        // Notification (User Context)
        if (isSuccess) {
            await userClient.from('notifications').insert({
                user_id: userId,
                title: 'Email Sent Successfully',
                message: `Birthday email sent to ${contact.first_name}`,
                type: 'success',
                is_read: false,
                link: `/contacts/${contactId}`,
                metadata: {
                    contact_id: contactId,
                    action: 'email_sent',
                    message_id: resendData.id
                }
            });
        } else {
            await userClient.from('notifications').insert({
                user_id: userId,
                title: 'Email Failed',
                message: `Failed to send email to ${contact.first_name}. Check logs.`,
                type: 'error',
                is_read: false,
                link: `/contacts/${contactId}`,
                metadata: {
                    contact_id: contactId,
                    action: 'email_failed',
                    error: errorMessage
                }
            });
        }

        return new Response(JSON.stringify({
            success: isSuccess,
            message: isSuccess ? 'Email sent successfully' : 'Failed to send email',
            error: isSuccess ? null : (errorMessage || 'Internal Error'),
            // Minimal details returned to client
        }), {
            status: isSuccess ? 200 : 400,
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
