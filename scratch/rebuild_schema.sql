-- ============================================================================
-- SQL Script: Rebuild Database Schema and Messaging Indexes
-- AN-Academy - Developed for Supabase
-- Copy and execute this in the Supabase SQL Editor.
-- ============================================================================

-- 1. Modernize TEACHERS table
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS total_paid DOUBLE PRECISION;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS payment_history JSONB;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS cancel_reason TEXT;

-- 2. Modernize STUDENTS table
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS sub_start BIGINT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS total_paid DOUBLE PRECISION;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS payment_history JSONB;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS level INTEGER DEFAULT 1;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS badges JSONB;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS qr_code_id TEXT;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS behavioral_notes TEXT;

-- 3. Modernize REGISTRATION_REQUESTS table
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS sub_price DOUBLE PRECISION;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE public.registration_requests ADD COLUMN IF NOT EXISTS existing_code TEXT;

-- 4. Modernize SETTINGS table
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS whatsapp_template TEXT;

-- 5. MESSAGING SYSTEM INDEXES OPTIMIZATION
-- Create composite index on conversation_id and timestamp to speed up paginated message loading
CREATE INDEX IF NOT EXISTS idx_messages_conv_timestamp 
ON public.messages (conversation_id, timestamp DESC);

-- Create partial index on receiver_id where is_read is false for instant unread count badges
CREATE INDEX IF NOT EXISTS idx_messages_unread 
ON public.messages (receiver_id) 
WHERE is_read = false;

-- Create GIN index on participants list JSONB to speed up conversation room queries
CREATE INDEX IF NOT EXISTS idx_conversations_participants 
ON public.conversations USING GIN (participants);
