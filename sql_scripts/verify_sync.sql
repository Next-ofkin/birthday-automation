-- Verify if the test contact was synced
SELECT id,
    first_name,
    last_name,
    phone,
    birthday,
    created_at,
    updated_at
FROM public.contacts
WHERE phone = '+2348012345678' -- The phone number used in testWebhook
ORDER BY updated_at DESC
LIMIT 1;