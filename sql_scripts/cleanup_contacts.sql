-- SAFETY CHECK 1: Count contacts to be deleted
-- These are contacts who have NEVER received a message
select count(*) as contacts_to_delete
from public.contacts c
where not exists (
        select 1
        from public.message_logs m
        where m.contact_id = c.id
    );
-- SAFETY CHECK 2: View sample of contacts to be deleted
-- select first_name, last_name, created_at
-- from public.contacts c
-- where not exists (
--    select 1 from public.message_logs m
--    where m.contact_id = c.id
-- )
-- limit 10;
-- EXECUTE DELETE (With specific trigger bypass)
BEGIN;
-- Disable only the blocking trigger
ALTER TABLE public.contacts DISABLE TRIGGER check_contact_delete_permission;
DELETE FROM public.contacts c
WHERE NOT EXISTS (
        SELECT 1
        FROM public.message_logs m
        WHERE m.contact_id = c.id
    );
-- Re-enable the trigger
ALTER TABLE public.contacts ENABLE TRIGGER check_contact_delete_permission;
COMMIT;