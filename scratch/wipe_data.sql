-- ============================================================================
-- SQL Script: Safe Platform Data Wipe
-- AN-Academy - Developed for Supabase
-- Copy and execute this in the Supabase SQL Editor to wipe all data safely.
-- ============================================================================

-- Disable triggers and row-level security temporarily to ensure clean truncate
SET session_replication_role = 'replica';

-- Truncate all tables safely resetting autoincrement ids, cascading deletes
TRUNCATE TABLE public.attendance_records RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.attendance_sessions RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assignment_submissions RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assignments RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.attempts RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.calendar_events RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.conversations RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.educational_games RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.exams RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.game_results RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.groups RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.materials RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.messages RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.notification_logs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.notifications RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.question_bank RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.registration_requests RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.settings RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.students RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.teachers RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.transactions RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assistants_profiles RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.teacher_assistant_links RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assistant_jobs RESTART IDENTITY CASCADE;
TRUNCATE TABLE public.assistant_job_applications RESTART IDENTITY CASCADE;

-- Re-enable normal database operations
SET session_replication_role = 'origin';

-- Re-insert a clean default Super Admin (admin / admin123)
-- This ensures the user is not locked out of the dashboard after truncation.
INSERT INTO public.teachers (
    id, 
    name, 
    username, 
    password, 
    role, 
    is_active, 
    created_at
)
VALUES (
    '00000000-0000-0000-0000-000000000000', 
    'المدير العام', 
    'admin', 
    'admin123', 
    'super_admin', 
    true, 
    1773574884000 -- Epoch milliseconds for current date
);

-- Initialize default settings for Super Admin
INSERT INTO public.settings (
    id,
    teacher_id,
    acad_name,
    teacher_name,
    primary_color,
    sec_tab_switch,
    sec_copy_paste,
    sec_fullscreen,
    sec_shuffle_options
)
VALUES (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000000',
    'A-N Academy',
    'المدير العام',
    '#F5C518',
    true,
    true,
    false,
    true
);
