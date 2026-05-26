-- SQL script to create missing tables in Supabase.
-- Copy and run this in your Supabase SQL Editor.

-- 1. Create attendance_sessions table
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    group_id TEXT,
    date TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at BIGINT NOT NULL
);

-- Enable RLS for attendance_sessions
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on attendance_sessions" ON public.attendance_sessions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on attendance_sessions" ON public.attendance_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on attendance_sessions" ON public.attendance_sessions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on attendance_sessions" ON public.attendance_sessions FOR DELETE USING (true);


-- 2. Create attendance_records table
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    status TEXT NOT NULL,
    time TEXT NOT NULL,
    notes TEXT
);

-- Enable RLS for attendance_records
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on attendance_records" ON public.attendance_records FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on attendance_records" ON public.attendance_records FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on attendance_records" ON public.attendance_records FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on attendance_records" ON public.attendance_records FOR DELETE USING (true);


-- 3. Create transactions table
CREATE TABLE IF NOT EXISTS public.transactions (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    student_id TEXT,
    created_at BIGINT NOT NULL
);

-- Enable RLS for transactions
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on transactions" ON public.transactions FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on transactions" ON public.transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on transactions" ON public.transactions FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on transactions" ON public.transactions FOR DELETE USING (true);


-- 4. Create assistants table
CREATE TABLE IF NOT EXISTS public.assistants (
    id TEXT PRIMARY KEY,
    teacher_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL,
    permissions TEXT[], -- Text array for permissions
    salary_type TEXT NOT NULL,
    salary_value DOUBLE PRECISION NOT NULL,
    created_at BIGINT NOT NULL
);

-- Enable RLS for assistants
ALTER TABLE public.assistants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access on assistants" ON public.assistants FOR SELECT USING (true);
CREATE POLICY "Allow public insert access on assistants" ON public.assistants FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access on assistants" ON public.assistants FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access on assistants" ON public.assistants FOR DELETE USING (true);
