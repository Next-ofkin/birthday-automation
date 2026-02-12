-- Add UNIQUE constraint to phone number to allow UPSERT operations
-- This is required for the Google Sheets sync to update existing contacts instead of failing
ALTER TABLE public.contacts
ADD CONSTRAINT contacts_phone_key UNIQUE (phone);