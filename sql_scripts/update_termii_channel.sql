-- This SQL script is SAFE to run on your live database.
-- It checks if 'termii_channel' exists and updates it, or inserts a new row if it's missing.
DO $$ BEGIN -- 1. Check if the setting already exists
IF EXISTS (
    SELECT 1
    FROM public.system_settings
    WHERE setting_key = 'termii_channel'
) THEN -- UPDATE existing setting and update 'updated_at'
UPDATE public.system_settings
SET setting_value = 'dnd',
    description = 'Termii SMS Channel (generic/dnd/whatsapp)',
    updated_at = now()
WHERE setting_key = 'termii_channel';
ELSE -- INSERT new setting with description
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES (
        'termii_channel',
        'dnd',
        'Termii SMS Channel (generic/dnd/whatsapp)'
    );
END IF;
END $$;