-- 1. Create a function to handle new user signups
create or replace function public.handle_new_user() returns trigger language plpgsql security definer as $$
declare -- ⚠️ REPLACE THIS WITH YOUR ACTUAL SERVICE ROLE KEY FROM DASHBOARD -> PROJECT SETTINGS -> API ⚠️
    service_role_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imlzc3dsY2xseXRpbHRnamJ5c2p2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU3NDUxMywiZXhwIjoyMDc5MTUwNTEzfQ.oo37eBEyZX1jd8GyZnREwjg4YqYRqQqX7oCdo-zd5RM';
function_url text := 'https://isswlcllytiltgjbysjv.supabase.co/functions/v1/notify-new-user';
project_url text := 'https://isswlcllytiltgjbysjv.supabase.co';
payload jsonb;
request_id uuid;
begin -- Construct payload matching what the function expects
payload := jsonb_build_object(
    'userId',
    new.id,
    'userEmail',
    new.email,
    'userFullName',
    new.raw_user_meta_data->>'full_name'
);
-- Send POST request to Edge Function using pg_net
-- Note: This requires the pg_net extension to be enabled in your dashboard
select net.http_post(
        url := function_url,
        headers := jsonb_build_object(
            'Content-Type',
            'application/json',
            'Authorization',
            'Bearer ' || service_role_key
        ),
        body := payload
    ) into request_id;
return new;
exception
when others then -- Log error but don't fail the transaction
raise warning 'Failed to trigger notify-new-user webhook: %',
SQLERRM;
return new;
end;
$$;
-- 2. Create the Trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after
insert on auth.users for each row execute procedure public.handle_new_user();
-- 3. Verify net extension is enabled (Optional check)
create extension if not exists "pg_net" with schema extensions;