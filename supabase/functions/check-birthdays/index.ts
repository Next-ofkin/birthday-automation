import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("🚀 Birthday Cron Started");

    // Read optional override date
    let overrideDate = null;
    try {
      const body = await req.json();
      if (body?.date) overrideDate = new Date(body.date);
    } catch (_) {}

    const today = overrideDate || new Date();
    const month = today.getUTCMonth() + 1;
    const day = today.getUTCDate();
    console.log("📅 Checking birthdays for:", { month, day });

    // Supabase auth
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, serviceKey);

    // Load settings
    const { data: settingsData } = await supabase
      .from("system_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "enable_sms",
        "enable_email",
        "default_sms_template_id",
        "default_email_template_id"
      ]);

    const settings: any = {};
    settingsData.forEach((s) => (settings[s.setting_key] = s.setting_value));

    const smsEnabled = settings.enable_sms === "true";
    const emailEnabled = settings.enable_email === "true";
    const smsTemplateId = settings.default_sms_template_id;
    const emailTemplateId = settings.default_email_template_id;

    // Contacts
    const { data: contacts } = await supabase
      .from("contacts")
      .select("*")
      .eq("is_active", true);

    const birthdayContacts = contacts.filter((c) => {
      if (!c.birthday) return false;
      const b = new Date(c.birthday);
      return b.getUTCMonth() + 1 === month && b.getUTCDate() === day;
    });

    console.log("🎉 Birthday contacts today:", birthdayContacts.length);

    let smsSent = 0, smsFailed = 0, emailSent = 0, emailFailed = 0;

    // Helper to call send-sms and send-email
    async function call(fn: string, payload: any) {
      const res = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, data };
    }

    // PROCESS CONTACTS
    for (const c of birthdayContacts) {
      console.log("➤ Processing:", c.first_name, c.last_name);

      // SMS
      if (smsEnabled && smsTemplateId && c.phone) {
        const result = await call("send-sms", {
          contactId: c.id,
          templateId: smsTemplateId,
          phoneNumber: c.phone,
          userId: null
        });

        if (result.ok && result.data?.success) smsSent++;
        else smsFailed++;
      }

      // EMAIL
      if (emailEnabled && emailTemplateId && c.email) {
        const result = await call("send-email", {
          contactId: c.id,
          templateId: emailTemplateId,
          userId: null
        });

        if (result.ok && result.data?.success) emailSent++;
        else emailFailed++;
      }
    }

    // Final summary
    return new Response(
      JSON.stringify({
        success: true,
        message: "Birthday cron complete",
        birthdaysToday: birthdayContacts.length,
        smsSent,
        smsFailed,
        emailSent,
        emailFailed
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (err) {
    console.error("💥 Error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 200,
      headers: corsHeaders
    });
  }
});
