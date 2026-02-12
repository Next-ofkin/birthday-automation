import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 1. Authorize Request (Service Role Key)
        const authHeader = req.headers.get('Authorization')
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        if (authHeader !== `Bearer ${serviceKey}`) {
            console.error('❌ Unauthorized request')
            return new Response(
                JSON.stringify({ error: 'Unauthorized' }),
                { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            serviceKey
        )

        // 2. Parse incoming contact data
        const { contact, source, row } = await req.json()

        console.log(`📥 Received from ${source}, row ${row}:`, contact.first_name, contact.last_name)

        // 3. Validate required fields
        if (!contact.first_name || !contact.last_name || !contact.phone || !contact.birthday) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        // 4. Normalize phone number (add +234 prefix for Nigerian numbers)
        let phone = contact.phone.toString().replace(/\s/g, '').replace(/[\(\)\-]/g, '')

        // Handle '8012345678' -> +2348012345678 (no leading 0)
        // Handle '08012345678' -> +2348012345678 (leading 0)
        if (phone.length === 10 && /^[789][01]\d{8}$/.test(phone)) {
            phone = '+234' + phone;
        } else if (phone.startsWith('0')) {
            phone = '+234' + phone.substring(1)
        } else if (phone.startsWith('234')) {
            phone = '+' + phone
        } else if (!phone.startsWith('+')) {
            // Assuming it's a local number without 0, e.g. 8012345678 -> +2348012345678
            if (phone.length === 10) {
                phone = '+234' + phone
            } else {
                phone = '+' + phone
            }
        }

        // 5. Prepare contact data
        const contactData = {
            first_name: contact.first_name.toString().trim(),
            last_name: contact.last_name.toString().trim(),
            email: contact.email ? contact.email.toString().trim() : null,
            phone: phone,
            birthday: contact.birthday,
            notes: contact.notes ? contact.notes.toString().trim() : null,
            is_active: true
        }

        // 6. Upsert contact (update if exists, insert if new)
        const { data, error } = await supabaseClient
            .from('contacts')
            .upsert(contactData, {
                onConflict: 'phone',
                ignoreDuplicates: false
            })
            .select()

        if (error) {
            console.error('❌ Database error:', error)
            return new Response(
                JSON.stringify({ error: error.message }),
                { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        console.log('✅ Successfully upserted:', phone)

        return new Response(
            JSON.stringify({
                success: true,
                contact: data?.[0],
                message: 'Contact synced successfully'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('❌ Webhook error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
