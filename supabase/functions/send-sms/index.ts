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

    if (!contactId || !templateId || !phoneNumber) {
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

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch contact
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('first_name, last_name, birthday')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
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

    // Fetch template
    const { data: template, error: templateError } = await supabase
      .from('message_templates')
      .select('name, content, type')
      .eq('id', templateId)
      .eq('type', 'sms')
      .single();

    if (templateError || !template) {
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

    // Calculate age
    const birthDate = new Date(contact.birthday);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

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

    // Fetch settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['termii_api_key', 'termii_sender_id', 'enable_sms']);

    if (settingsError || !settingsData) {
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

    if (settings.enable_sms !== 'true') {
      return new Response(JSON.stringify({
        success: false,
        error: 'SMS is disabled'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!settings.termii_api_key) {
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
    console.log('🔥 Sending SMS to Termii...');
    console.log('Phone:', phoneNumber);
    console.log('Message:', messageContent);

    const termiiResponse = await fetch('https://api.ng.termii.com/api/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: phoneNumber,
        from: settings.termii_sender_id || 'BirthdayBot',
        sms: messageContent,
        type: 'plain',
        channel: 'generic',
        api_key: settings.termii_api_key
      })
    });

    const termiiData = await termiiResponse.json();
    console.log('📡 Termii Response:', termiiData);

    // 🔥 CRITICAL FIX: Check ACTUAL Termii response, not just HTTP status
    let status = 'failed';
    let errorMessage = null;
    let isSuccess = false;

    if (termiiResponse.ok && termiiData.message_id) {
      // Success: Has message_id
      status = 'sent';
      isSuccess = true;
    } else if (termiiData.code === 'ok' && termiiData.balance === '0') {
      // No credit
      status = 'failed';
      errorMessage = 'Insufficient SMS credit';
    } else if (termiiData.message) {
      // Termii error message
      status = 'failed';
      errorMessage = termiiData.message;
    } else {
      // Unknown error
      status = 'failed';
      errorMessage = 'Unknown error from Termii';
    }

    console.log('✅ Final Status:', status);
    console.log('✅ Is Success:', isSuccess);

    // Log to message_logs
    await supabase.from('message_logs').insert({
      contact_id: contactId,
      template_id: templateId,
      message_type: 'sms',
      recipient: phoneNumber,
      content: messageContent,
      status: status,
      provider_response: termiiData,
      sent_at: isSuccess ? new Date().toISOString() : null
    });

    // 🔔 Create notification
    if (userId) {
      if (isSuccess) {
        // Success notification
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
        // Failed notification
        await supabase.from('notifications').insert({
          user_id: userId,
          title: 'SMS Failed',
          message: `Failed to send SMS to ${contact.first_name} ${contact.last_name}: ${errorMessage || 'Unknown error'}`,
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
    }

    // Return response
    return new Response(JSON.stringify({
      success: isSuccess,
      message: isSuccess ? 'SMS sent successfully' : (errorMessage || 'Failed to send SMS'),
      error: isSuccess ? null : errorMessage,
      details: termiiData,
      messageId: termiiData.message_id || null,
      recipient: phoneNumber,
      contact: `${contact.first_name} ${contact.last_name}`,
      messageContent: messageContent
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('💥 Error:', error);
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