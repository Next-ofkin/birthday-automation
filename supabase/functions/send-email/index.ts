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
    const { contactId, templateId, userId } = body;

    console.log('📥 Received request:', { contactId, templateId, userId });

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

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch contact
    console.log('👤 Fetching contact...');
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('first_name, last_name, email, birthday')
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

    if (!contact.email) {
      console.error('❌ Contact has no email');
      return new Response(JSON.stringify({
        success: false,
        error: 'Contact has no email address'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('✅ Contact found:', contact.first_name, contact.last_name, '-', contact.email);

    // Fetch template
    console.log('📄 Fetching template...');
    const { data: template, error: templateError } = await supabase
      .from('message_templates')
      .select('name, content, subject, type')
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

    // Check if template is email type
    if (template.type !== 'email') {
      console.error('❌ Template is not email type:', template.type);
      return new Response(JSON.stringify({
        success: false,
        error: `Template is type '${template.type}', not 'email'`
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

    // Replace placeholders in subject
    let emailSubject = template.subject || 'Happy Birthday!';
    emailSubject = emailSubject
      .replace(/\[FirstName\]/gi, contact.first_name)
      .replace(/\[LastName\]/gi, contact.last_name)
      .replace(/\[Name\]/gi, `${contact.first_name} ${contact.last_name}`)
      .replace(/\[Age\]/gi, age.toString())
      .replace(/\{first_name\}/gi, contact.first_name)
      .replace(/\{firstname\}/gi, contact.first_name)
      .replace(/\{last_name\}/gi, contact.last_name)
      .replace(/\{lastname\}/gi, contact.last_name)
      .replace(/\{name\}/gi, `${contact.first_name} ${contact.last_name}`)
      .replace(/\{age\}/gi, age.toString());

    // Replace placeholders in content (HTML)
    let emailContent = template.content
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

    console.log('✍️ Email subject:', emailSubject);

    // Fetch settings
    console.log('⚙️ Fetching settings...');
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['resend_api_key', 'from_email', 'from_name', 'enable_email']);

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
      has_api_key: !!settings.resend_api_key,
      from_email: settings.from_email,
      email_enabled: settings.enable_email
    });

    if (settings.enable_email !== 'true') {
      console.error('❌ Email is disabled');
      return new Response(JSON.stringify({
        success: false,
        error: 'Email is disabled in system settings'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!settings.resend_api_key) {
      console.error('❌ Resend API key not configured');
      return new Response(JSON.stringify({
        success: false,
        error: 'Resend API key not configured'
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const fromEmail = settings.from_email || 'birthday@push.noltfinance.com';
    const fromName = settings.from_name || 'NOLT Birthday Team';
    const fromAddress = `${fromName} <${fromEmail}>`;

    // Send Email via Resend
    console.log('📤 Sending email via Resend...');
    console.log('📧 To:', contact.email);
    console.log('📧 From:', fromAddress);
    console.log('📧 Subject:', emailSubject);

    const resendPayload = {
      from: fromAddress,
      to: [contact.email],
      subject: emailSubject,
      html: emailContent
    };

    console.log('📦 Resend payload:', { ...resendPayload, html: '***hidden***' });

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.resend_api_key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(resendPayload)
    });

    const resendData = await resendResponse.json();
    console.log('📡 Resend Response Status:', resendResponse.status);
    console.log('📡 Resend Response Data:', JSON.stringify(resendData, null, 2));

    // 🔥 CRITICAL: Check ACTUAL Resend response
    let status = 'failed';
    let errorMessage = null;
    let isSuccess = false;

    if (resendResponse.ok && resendData.id) {
      // Success: Has email ID
      console.log('✅ SUCCESS: Email sent with id:', resendData.id);
      status = 'sent';
      isSuccess = true;
    } else if (resendData.message) {
      // Resend error message
      console.log('❌ FAILED: Resend error -', resendData.message);
      status = 'failed';
      errorMessage = resendData.message;
    } else if (resendData.error) {
      // Alternative error format
      console.log('❌ FAILED: Resend error -', resendData.error);
      status = 'failed';
      errorMessage = typeof resendData.error === 'string' ? resendData.error : JSON.stringify(resendData.error);
    } else if (!resendResponse.ok) {
      // HTTP error
      console.log('❌ FAILED: HTTP error', resendResponse.status);
      status = 'failed';
      errorMessage = `HTTP ${resendResponse.status}: ${JSON.stringify(resendData)}`;
    } else {
      // Unknown error
      console.log('❌ FAILED: Unknown error');
      status = 'failed';
      errorMessage = 'Unknown error from Resend (no id received)';
    }

    console.log('🎯 Final Status:', status);
    console.log('🎯 Is Success:', isSuccess);

    // Log to message_logs
    console.log('💾 Saving to message_logs...');
    const { error: logError } = await supabase.from('message_logs').insert({
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
          title: 'Email Sent Successfully',
          message: `Birthday email sent to ${contact.first_name} ${contact.last_name} (${contact.email})`,
          type: 'success',
          is_read: false,
          link: `/contacts/${contactId}`,
          metadata: {
            contact_id: contactId,
            contact_name: `${contact.first_name} ${contact.last_name}`,
            email: contact.email,
            action: 'email_sent',
            message_id: resendData.id
          }
        });
      } else {
        await supabase.from('notifications').insert({
          user_id: userId,
          title: 'Email Failed',
          message: `Failed to send email to ${contact.first_name} ${contact.last_name}: ${errorMessage}`,
          type: 'error',
          is_read: false,
          link: `/contacts/${contactId}`,
          metadata: {
            contact_id: contactId,
            contact_name: `${contact.first_name} ${contact.last_name}`,
            email: contact.email,
            action: 'email_failed',
            error: errorMessage,
            details: resendData
          }
        });
      }
      console.log('✅ Notification created');
    }

    // Return response
    const response = {
      success: isSuccess,
      message: isSuccess ? 'Email sent successfully' : (errorMessage || 'Failed to send email'),
      error: isSuccess ? null : errorMessage,
      details: resendData,
      emailId: resendData.id || null,
      recipient: contact.email,
      contact: `${contact.first_name} ${contact.last_name}`,
      subject: emailSubject
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