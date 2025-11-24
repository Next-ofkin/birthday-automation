import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    const body = await req.json();
    const { contactId, templateId, phoneNumber, userId } = body;

    console.log('📥 Received request:', { contactId, templateId, phoneNumber, userId });

    if (!contactId || !templateId || !phoneNumber) {
      console.error('❌ Missing required fields');
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: contactId, templateId, or phoneNumber'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch contact
    console.log('👤 Fetching contact...');
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('first_name, last_name, birthday')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      console.error('❌ Contact not found:', contactError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Contact not found'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('✅ Contact found:', contact.first_name, contact.last_name);

    // Fetch template
    console.log('📄 Fetching template...');
    const { data: template, error: templateError } = await supabase
      .from('message_templates')
      .select('name, content, type')
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      console.error('❌ Template not found:', templateError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Template not found'
      }), {
        status: 200,
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
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('✅ Template found:', template.name);

    // Calculate age
    const birthDate = new Date(contact.birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    console.log('🎂 Calculated age:', age);

    // Replace placeholders
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

    console.log('✍️ Message content:', messageContent);

    // Fetch settings
    console.log('⚙️ Fetching settings...');
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['termii_api_key', 'termii_sender_id', 'enable_sms']);

    if (settingsError || !settingsData) {
      console.error('❌ Settings not found:', settingsError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Settings not found'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const settings: any = {};
    settingsData.forEach((item) => {
      settings[item.setting_key] = item.setting_value;
    });

    console.log('⚙️ Settings loaded:', {
      has_api_key: !!settings.termii_api_key,
      sender_id: settings.termii_sender_id,
      sms_enabled: settings.enable_sms
    });

    if (settings.enable_sms !== 'true') {
      console.error('❌ SMS is disabled');
      return new Response(JSON.stringify({
        success: false,
        error: 'SMS is disabled in system settings'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!settings.termii_api_key) {
      console.error('❌ Termii API key not configured');
      return new Response(JSON.stringify({
        success: false,
        error: 'Termii API key not configured'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Send SMS via Termii
    console.log('📤 Sending SMS to Termii...');
    console.log('📱 Phone:', phoneNumber);
    console.log('💬 Message:', messageContent);

    const termiiPayload = {
      to: phoneNumber,
      from: settings.termii_sender_id || 'BirthdayBot',
      sms: messageContent,
      type: 'plain',
      channel: 'generic',
      api_key: settings.termii_api_key
    };

    console.log('📦 Termii payload:', { ...termiiPayload, api_key: '***hidden***' });

    const termiiResponse = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(termiiPayload)
    });

    const termiiData = await termiiResponse.json();
    console.log('📡 Termii Response Status:', termiiResponse.status);
    console.log('📡 Termii Response Data:', JSON.stringify(termiiData, null, 2));

    // 🔥 CRITICAL: Check ACTUAL Termii response
    let status = 'failed';
    let errorMessage = null;
    let isSuccess = false;

    if (termiiResponse.ok && termiiData.message_id) {
      // Success: Has message_id
      console.log('✅ SUCCESS: SMS sent with message_id:', termiiData.message_id);
      status = 'sent';
      isSuccess = true;
    } else if (termiiData.balance === '0' || termiiData.balance === 0) {
      // No credit
      console.log('❌ FAILED: Insufficient SMS credit');
      status = 'failed';
      errorMessage = 'Insufficient SMS credit (balance: 0)';
    } else if (termiiData.message) {
      // Termii error message
      console.log('❌ FAILED: Termii error -', termiiData.message);
      status = 'failed';
      errorMessage = termiiData.message;
    } else if (termiiData.error) {
      // Alternative error format
      console.log('❌ FAILED: Termii error -', termiiData.error);
      status = 'failed';
      errorMessage = typeof termiiData.error === 'string' ? termiiData.error : JSON.stringify(termiiData.error);
    } else if (!termiiResponse.ok) {
      // HTTP error
      console.log('❌ FAILED: HTTP error', termiiResponse.status);
      status = 'failed';
      errorMessage = `HTTP ${termiiResponse.status}: ${JSON.stringify(termiiData)}`;
    } else {
      // Unknown error
      console.log('❌ FAILED: Unknown error');
      status = 'failed';
      errorMessage = 'Unknown error from Termii (no message_id received)';
    }

    console.log('🎯 Final Status:', status);
    console.log('🎯 Is Success:', isSuccess);

    // Log to message_logs
    console.log('💾 Saving to message_logs...');
    const { error: logError } = await supabase.from('message_logs').insert({
      contact_id: contactId,
      template_id: templateId,
      message_type: 'sms',
      recipient: phoneNumber,
      content: messageContent,
      status: status,
      provider_response: termiiData,
      sent_at: isSuccess ? new Date().toISOString() : null
    });

    if (logError) {
      console.error('⚠️ Failed to save message log:', logError);
    } else {
      console.log('✅ Message log saved');
    }

    // 🔔 Create notification (only if userId is provided)
    if (userId) {
      console.log('🔔 Creating notification for user:', userId);
      if (isSuccess) {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: 'SMS Sent Successfully',
          message: `Birthday SMS sent to ${contact.first_name} ${contact.last_name} (${phoneNumber})`,
          type: 'success',
          is_read: false,
          link: `/contacts/${contactId}`,
          metadata: {
            contact_id: contactId,
            contact_name: `${contact.first_name} ${contact.last_name}`,
            phone: phoneNumber,
            action: 'sms_sent',
            message_id: termiiData.message_id
          }
        });
      } else {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: 'SMS Failed',
          message: `Failed to send SMS to ${contact.first_name} ${contact.last_name}: ${errorMessage}`,
          type: 'error',
          is_read: false,
          link: `/contacts/${contactId}`,
          metadata: {
            contact_id: contactId,
            contact_name: `${contact.first_name} ${contact.last_name}`,
            phone: phoneNumber,
            action: 'sms_failed',
            error: errorMessage,
            details: termiiData
          }
        });
      }
      console.log('✅ Notification created');
    }

    // Return response
    const response = {
      success: isSuccess,
      message: isSuccess ? 'SMS sent successfully' : (errorMessage || 'Failed to send SMS'),
      error: isSuccess ? null : errorMessage,
      details: termiiData,
      messageId: termiiData.message_id || null,
      recipient: phoneNumber,
      contact: `${contact.first_name} ${contact.last_name}`,
      messageContent: messageContent
    };

    console.log('📤 Returning response:', response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('💥 Fatal Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});