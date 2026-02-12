-- Remove duplicate phone numbers, keeping only the most recently updated one
-- This is necessary to add the UNIQUE constraint
-- 1. Disable only the blocking trigger (User defined)
ALTER TABLE public.contacts DISABLE TRIGGER check_contact_delete_permission;
-- 2. Delete duplicates
-- This finds all contacts where the same phone exists on a contact with a higher ID
-- It keeps the highest ID (usually the newest one)
DELETE FROM public.contacts c1 USING public.contacts c2
WHERE c1.phone = c2.phone
    AND c1.id < c2.id;
-- 3. Re-enable triggers
ALTER TABLE public.contacts ENABLE TRIGGER check_contact_delete_permission;
-- 4. Now add the constraint (this should work now!)
ALTER TABLE public.contacts
ADD CONSTRAINT contacts_phone_key UNIQUE (phone);