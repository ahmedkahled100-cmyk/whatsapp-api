-- SQL script to add new columns to assistants_profiles table in Supabase.
-- Copy and run this in your Supabase SQL Editor.

ALTER TABLE public.assistants_profiles ADD COLUMN IF NOT EXISTS salary_payment_method TEXT DEFAULT 'fixed';
ALTER TABLE public.assistants_profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE;
ALTER TABLE public.assistants_profiles ADD COLUMN IF NOT EXISTS suspension_reason TEXT;
