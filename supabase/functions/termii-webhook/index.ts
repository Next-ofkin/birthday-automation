import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // 1. Handle CORS and Verification Pings (GET)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method === 'GET') {
    // Termii (or others) might check if the URL is alive via GET
    return new Response(JSON.stringify({ message: "Webhook is active" }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });
  }

  try {
    let payload;
    const text = await req.text();

    // Handle empty body gracefully
    if (!text) {
      return new Response(JSON.stringify({ message: "Empty body ignored" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    try {
      payload = JSON.parse(text);
    } catch (e) {
      console.warn('⚠️ Invalid JSON received:', text);
      // Return 200 to acknowledge receipt even if format is weird, so we don't block sender verification
      return new Response(JSON.stringify({ message: "Invalid JSON format" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    console.log('🔔 Received Termii Webhook:', JSON.stringify(payload));

    /* 
       Termii Webhook Sample Payload:
       {
           "id": "Standard-30177089...",
           "message_id": "30177089...",
           "status": "Delivered",
           "phone": "234...",
           "cost": 0.4,
           ...
       }
    */

    const { message_id, status } = payload;

    if (!message_id) {
      console.error('❌ No message_id in webhook');
      return new Response(JSON.stringify({ message: "Ignored: No message_id" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 // Return 200 so Termii doesn't retry
      });
    }

    // 2. Initialize Supabase Admin Client
    // We need SERVICE_ROLE_KEY because this request comes from Termii (unauthenticated), 
    // so we need sudo privileges to search and update the logs.
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 3. Find the message log by querying the JSONB column
    // provider_response ->> 'message_id'
    const { data: logs, error: searchError } = await supabase
      .from('message_logs')
      .select('id, status')
      // This is the PostgreSQL JSON arrow operator
      .eq('provider_response->>message_id', message_id)
      .limit(1);

    if (searchError) {
      console.error('❌ Error searching logs:', searchError);
      throw searchError;
    }

    if (!logs || logs.length === 0) {
      console.warn(`⚠️ Message log not found for ID: ${message_id}`);
      // Return 200 so Termii doesn't keep retrying for a message we don't have
      return new Response(JSON.stringify({ message: "Message not found locally" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const logEntry = logs[0];
    console.log(`✅ Found Message Log ID: ${logEntry.id}. Current Status: ${logEntry.status}`);

    // 4. Update the status
    // Map Termii status to our status if needed, or just store it lowercase
    const newStatus = status.toLowerCase();

    if (logEntry.status === newStatus) {
      console.log('ℹ️ Status already up to date.');
      return new Response(JSON.stringify({ message: "Status already up to date" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }

    const { error: updateError } = await supabase
      .from('message_logs')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', logEntry.id);

    if (updateError) {
      console.error('❌ Error updating status:', updateError);
      throw updateError;
    }

    console.log(`🚀 Updated status to '${newStatus}'`);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    });

  } catch (error) {
    console.error('💥 Webhook Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});
