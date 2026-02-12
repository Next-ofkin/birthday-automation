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
    // 1. Authorize Request (Must be Service Role or have Shared Secret)
    const authHeader = req.headers.get('Authorization');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Check if Authorization header matches Service Role Key
    if (authHeader !== `Bearer ${serviceKey}`) {
      console.error('❌ Unauthorized request to notify-new-user');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { userId, userEmail, userFullName } = body;

    console.log('🔔 New user signup detected:', userEmail);

    if (!userId || !userEmail) {
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

    // Get all admin and developer users
    const { data: adminUsers, error: adminError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .in('role', ['admin', 'developer']);

    if (adminError) {
      console.error('❌ Error fetching admin users:', adminError);
      throw adminError;
    }

    console.log(`📬 Found ${adminUsers?.length || 0} admin/developer users to notify`);

    if (!adminUsers || adminUsers.length === 0) {
      console.log('⚠️ No admin/developer users found to notify');
      return new Response(JSON.stringify({
        success: true,
        message: 'No admin/developer users to notify',
        notified: 0
      }), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // Get email settings
    const { data: settingsData, error: settingsError } = await supabase
      .from('system_settings')
      .select('setting_key, setting_value')
      .in('setting_key', ['resend_api_key', 'from_email', 'from_name', 'enable_email']);

    if (settingsError || !settingsData) {
      console.error('❌ Error fetching settings:', settingsError);
      throw new Error('Email settings not found');
    }

    const settings: any = {};
    settingsData.forEach((item) => {
      settings[item.setting_key] = item.setting_value;
    });

    if (settings.enable_email !== 'true') {
      console.log('⚠️ Email is disabled');
      return new Response(JSON.stringify({
        success: false,
        error: 'Email is disabled'
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
      throw new Error('Resend API key not configured');
    }

    const fromEmail = settings.from_email || 'birthday@push.noltfinance.com';
    const fromName = settings.from_name || 'NOLT Birthday Team';
    const fromAddress = `${fromName} <${fromEmail}>`;

    let emailsSent = 0;
    let emailsFailed = 0;

    // Send email to each admin/developer
    for (const admin of adminUsers) {
      if (!admin.email) {
        console.log(`⏭️ Skipping ${admin.full_name || 'user'} - no email`);
        continue;
      }

      // Create HTML email content
      const emailSubject = `New User Registration - ${userFullName || userEmail}`;

      const emailHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New User Registration</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-radius: 8px;">
          
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold; text-align: center;">
                👤 New User Registration
              </h1>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                Dear <strong>${admin.full_name || admin.email}</strong>,
              </p>

              <p style="margin: 0 0 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                A new user has successfully registered on the Birthday Automation System.
              </p>

              <!-- User Details Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px; margin-bottom: 30px;">
                <tr>
                  <td style="padding: 25px;">
                    <table role="presentation" style="width: 100%; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #667eea; font-size: 14px;">Name:</strong>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <span style="color: #333333; font-size: 16px;">${userFullName || 'Not provided'}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #667eea; font-size: 14px;">Email:</strong>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <span style="color: #333333; font-size: 16px;">${userEmail}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <strong style="color: #667eea; font-size: 14px;">Registration Date:</strong>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <span style="color: #333333; font-size: 16px;">${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="margin: 0 0 30px; color: #333333; font-size: 16px; line-height: 1.6;">
                Please check your dashboard to assign a role to them based on your preference.
              </p>

              <!-- Call to Action Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                <tr>
                  <td align="center">
                    <a href="${supabaseUrl.replace('/rest/v1', '')}/users" 
                       style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">
                      Go to Dashboard
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 0; color: #333333; font-size: 16px; line-height: 1.6;">
                Thank you,<br>
                <strong>NOLT Birthday Automation System</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 8px 8px; text-align: center;">
              <p style="margin: 0; color: #6c757d; font-size: 14px;">
                This is an automated notification from Birthday-Bot
              </p>
              <p style="margin: 10px 0 0; color: #6c757d; font-size: 12px;">
                © ${new Date().getFullYear()} NOLT Finance. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
      `.trim();

      try {
        console.log(`📧 Sending email to ${admin.email}...`);

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${settings.resend_api_key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [admin.email],
            subject: emailSubject,
            html: emailHTML
          })
        });

        const resendData = await resendResponse.json();
        console.log('📡 Resend Response:', resendData);

        if (resendResponse.ok && resendData.id) {
          console.log(`✅ Email sent successfully to ${admin.email}`);
          emailsSent++;

          // Also create in-app notification
          await supabase.from('notifications').insert({
            user_id: admin.id,
            title: 'New User Signed Up',
            message: `${userFullName || userEmail} (${userEmail}) has joined Birthday-Bot`,
            type: 'info',
            is_read: false,
            link: '/users',
            metadata: {
              new_user_id: userId,
              new_user_email: userEmail,
              new_user_name: userFullName,
              action: 'user_signup',
              notified_at: new Date().toISOString()
            }
          });
        } else {
          console.error(`❌ Failed to send email to ${admin.email}:`, resendData);
          emailsFailed++;
        }
      } catch (error) {
        console.error(`💥 Error sending email to ${admin.email}:`, error);
        emailsFailed++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Log activity
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action_type: 'signup',
      action_description: `New user signed up: ${userEmail}`,
      entity_type: 'user',
      entity_id: userId
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Notifications sent to admins and developers',
      notified: emailsSent,
      failed: emailsFailed,
      recipients: adminUsers.map(u => u.email)
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