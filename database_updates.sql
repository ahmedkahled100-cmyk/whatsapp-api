-- Add subscription fields to assistants_profiles table
ALTER TABLE assistants_profiles
ADD COLUMN IF NOT EXISTS sub_start BIGINT,
ADD COLUMN IF NOT EXISTS sub_expiry BIGINT,
ADD COLUMN IF NOT EXISTS is_paused_by_admin BOOLEAN DEFAULT false;

-- Add subscription fields to teacher_assistant_links table
ALTER TABLE teacher_assistant_links
ADD COLUMN IF NOT EXISTS sub_start BIGINT,
ADD COLUMN IF NOT EXISTS sub_expiry BIGINT;

-- Add title and group_id to attendance_sessions
ALTER TABLE attendance_sessions
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS group_id TEXT;

-- Add cancel_reason to teachers table for suspension reasons
ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- Add online presence fields to teachers table
ALTER TABLE public.teachers
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS last_active BIGINT;

-- Create promo_codes table in Supabase PostgreSQL
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'percentage',
    discount_value NUMERIC NOT NULL DEFAULT 0,
    max_uses INTEGER NOT NULL DEFAULT 0,
    used_count INTEGER NOT NULL DEFAULT 0,
    target_role TEXT NOT NULL DEFAULT 'all',
    expiry_date BIGINT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at BIGINT NOT NULL DEFAULT (extract(epoch from now()) * 1000)::bigint
);

-- Enable RLS and grant access policies for public/authenticated users
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access on promo_codes" ON public.promo_codes;
CREATE POLICY "Allow public read access on promo_codes" 
ON public.promo_codes FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Allow all access on promo_codes for public" ON public.promo_codes;
CREATE POLICY "Allow all access on promo_codes for public" 
ON public.promo_codes FOR ALL 
USING (true) 
WITH CHECK (true);

-- Ensure all optional columns exist on REGISTRATION_REQUESTS table
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS sub_price DOUBLE PRECISION;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS existing_code TEXT;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS promo_code TEXT;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS discount_amount DOUBLE PRECISION;
