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
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        console.log('🔄 Starting Google Sheets sync...')

        // 1. Get the Google Sheets URL from system_settings
        const { data: settings, error: settingsError } = await supabaseClient
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'google_sheet_url')
            .single()

        if (settingsError || !settings?.setting_value) {
            console.error('❌ Google Sheets URL not configured')
            return new Response(
                JSON.stringify({ error: 'Google Sheets URL not configured in system_settings' }),
                { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }

        const sheetUrl = settings.setting_value
        console.log('📊 Fetching from:', sheetUrl)

        // 2. Convert Google Sheets URL to CSV export URL
        let csvUrl = sheetUrl
        if (sheetUrl.includes('docs.google.com/spreadsheets')) {
            const sheetIdMatch = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)
            if (sheetIdMatch) {
                const sheetId = sheetIdMatch[1]
                const gidMatch = sheetUrl.match(/[#&]gid=([0-9]+)/)
                const gid = gidMatch ? gidMatch[1] : '0'
                csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`
            }
        }

        // 3. Fetch the CSV data
        const response = await fetch(csvUrl)
        if (!response.ok) {
            throw new Error(`Failed to fetch sheet: ${response.status}`)
        }

        const csvText = await response.text()
        console.log('✅ Downloaded CSV:', csvText.substring(0, 100) + '...')

        // 4. Parse CSV (simple parser - expects header row)
        const lines = csvText.split('\n').filter(line => line.trim())
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase())

        const contacts = []
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',')
            const contact: any = {}

            headers.forEach((header, index) => {
                contact[header] = values[index]?.trim() || ''
            })

            // Validate required fields
            if (contact.first_name && contact.last_name && contact.phone && contact.birthday) {
                contacts.push({
                    first_name: contact.first_name,
                    last_name: contact.last_name,
                    email: contact.email || null,
                    phone: contact.phone,
                    birthday: contact.birthday,
                    notes: contact.notes || null,
                    is_active: true
                })
            }
        }

        console.log(`📋 Parsed ${contacts.length} valid contacts`)

        // 5. Upsert contacts (update if exists, insert if new)
        // We'll use phone as the unique key
        let successCount = 0
        let errorCount = 0

        for (const contact of contacts) {
            const { error } = await supabaseClient
                .from('contacts')
                .upsert(contact, {
                    onConflict: 'phone',
                    ignoreDuplicates: false
                })

            if (error) {
                console.error('Error upserting contact:', contact.phone, error)
                errorCount++
            } else {
                successCount++
            }
        }

        // 6. Update last sync time
        await supabaseClient
            .from('system_settings')
            .upsert({
                setting_key: 'last_google_sheets_sync',
                setting_value: new Date().toISOString(),
                description: 'Last successful Google Sheets sync timestamp'
            }, { onConflict: 'setting_key' })

        console.log(`✅ Sync complete: ${successCount} succeeded, ${errorCount} failed`)

        return new Response(
            JSON.stringify({
                success: true,
                synced: successCount,
                failed: errorCount,
                timestamp: new Date().toISOString()
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )

    } catch (error) {
        console.error('❌ Sync error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})
