# Google Sheets Auto-Sync Setup Instructions

## Step 1: Prepare Your Google Sheet

1. Open your Google Sheet with contact data
2. Ensure it has these **exact column names** in the first row:
   - `first_name`
   - `last_name`
   - `email` (optional)
   - `phone` (required)
   - `birthday` (required, format: YYYY-MM-DD or DD/MM/YYYY)
   - `notes` (optional)

3. **Publish the sheet to web**:
   - Go to **File → Share → Publish to web**
   - Choose **Entire Document** or specific sheet
   - Format: **Link**
   - Click **Publish**
   - Copy the URL (looks like: `https://docs.google.com/spreadsheets/d/ABC123...`)

## Step 2: Configure the System

1. Open `setup_google_sheets_sync.sql`
2. Replace `'YOUR_GOOGLE_SHEET_URL'` with the published URL you copied
3. Run the SQL in **Supabase SQL Editor**

## Step 3: Test the Sync

Run manually first to verify it works:

```bash
curl -X POST https://isswlcllytiltgjbysjv.supabase.co/functions/v1/sync-google-sheets \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

Check the logs in **Supabase Dashboard → Edge Functions → sync-google-sheets**

## Step 4: Schedule Automatic Sync (Optional)

To run the sync every night at 2 AM:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the sync
SELECT cron.schedule(
  'google-sheets-sync',
  '0 2 * * *',  -- 2 AM daily
  $$
  SELECT net.http_post(
      url:='https://isswlcllytiltgjbysjv.supabase.co/functions/v1/sync-google-sheets',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  ) AS request_id;
  $$
);

-- Verify the schedule
SELECT * FROM cron.job;
```

**Important**: Replace `YOUR_SERVICE_ROLE_KEY` with your actual key from **Supabase → Settings → API**.

## How It Works

1. Every night (or when manually triggered), the function:
   - Fetches your Google Sheet as CSV
   - Parses the contact data
   - **Upserts** contacts (updates if phone exists, inserts if new)
   - Records the sync timestamp

2. You maintain contacts in Google Sheets, and the database stays in sync automatically!

## Troubleshooting

- **"Error: Google Sheets URL not configured"**: Run `setup_google_sheets_sync.sql` first
- **"Failed to fetch sheet"**: Make sure the sheet is **published to web**
- **"No contacts synced"**: Check column names match exactly (lowercase, underscores)
