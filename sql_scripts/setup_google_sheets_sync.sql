-- Add Google Sheets URL to system_settings
-- IMPORTANT: Replace 'YOUR_GOOGLE_SHEET_URL' with your actual published Google Sheet URL
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
        'google_sheet_url',
        'YOUR_GOOGLE_SHEET_URL',
        'URL of the Google Sheet containing contact data (must be published to web)'
    ) ON CONFLICT (setting_key) DO
UPDATE
SET setting_value = EXCLUDED.setting_value,
    updated_at = NOW();
-- Verify the setting was added
SELECT *
FROM public.system_settings
WHERE setting_key = 'google_sheet_url';