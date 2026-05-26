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
