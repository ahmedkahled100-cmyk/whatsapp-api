import { supabase } from '@/lib/supabase';
import type { Assistant, AssistantProfile, TeacherAssistantLink, TeacherUser, AssistantJob, AssistantJobApplication } from '@/types';
import { toDB, manyFromDB, fromDB } from './dbUtils';
import { checkUserUniqueness } from './validation';

export const ASSISTANTS_PROFILES = 'assistants_profiles';
export const TEACHER_ASSISTANT_LINKS = 'teacher_assistant_links';

// 1. Fetch all assistants working for a teacher
export const getAssistants = async (teacherId: string): Promise<Assistant[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];

  // Fetch links first
  const { data: linksData, error: linksError } = await supabase
    .from(TEACHER_ASSISTANT_LINKS)
    .select('*')
    .eq('teacher_id', teacherId);

  if (linksError) {
    console.error('Error fetching teacher assistant links:', linksError);
    return [];
  }

  const links = manyFromDB<TeacherAssistantLink>(linksData);
  if (links.length === 0) return [];

  // Fetch profiles for these links
  const assistantIds = links.map(l => l.assistantId);
  const { data: profilesData, error: profilesError } = await supabase
    .from(ASSISTANTS_PROFILES)
    .select('*')
    .in('id', assistantIds);

  if (profilesError) {
    console.error('Error fetching assistant profiles:', profilesError);
    return [];
  }

  const profiles = manyFromDB<AssistantProfile>(profilesData);
  const profilesMap = new Map(profiles.map(p => [p.id, p]));

  // Merge link information with profile information to conform to Assistant type
  return links.map(link => {
    const profile = profilesMap.get(link.assistantId);
    return {
      id: link.id, // Contract/Link ID is used as primary key in UI actions
      teacherId: link.teacherId,
      name: profile?.name || 'مساعد غير معروف',
      phone: profile?.phone || '',
      role: link.role,
      permissions: link.permissions,
      salaryType: link.salaryType,
      salaryValue: link.salaryValue,
      status: link.status,
      subStart: link.subStart,
      subExpiry: link.subExpiry,
      createdAt: link.createdAt,
      imageUrl: profile?.imageUrl,
      code: profile?.code,
      assistantId: link.assistantId // Keep reference to central ID
    } as any;
  });
};

// 2. Save a contract/link between a teacher and an assistant
export const saveAssistantLink = async (link: Omit<TeacherAssistantLink, 'id'> & { id?: string }): Promise<string> => {
  const newId = link.id || crypto.randomUUID();
  const payload = toDB({ ...link, id: newId, status: link.status || 'active', createdAt: link.createdAt || Date.now() });

  const { error } = await supabase
    .from(TEACHER_ASSISTANT_LINKS)
    .upsert([payload], { onConflict: 'id' });

  if (error) {
    console.error('Error saving teacher assistant link:', error);
    throw error;
  }

  return newId;
};

// 3. Delete a contract/link between a teacher and an assistant
export const deleteAssistantLink = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from(TEACHER_ASSISTANT_LINKS)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting teacher assistant link:', error);
    throw error;
  }
};

// Update link status
export const updateAssistantLinkStatus = async (linkId: string, status: 'active' | 'inactive' | 'pending' | 'rejected'): Promise<void> => {
  const { error } = await supabase
    .from(TEACHER_ASSISTANT_LINKS)
    .update({ status })
    .eq('id', linkId);

  if (error) throw error;
};

// 4. Save a legacy assistant (forward compatibility for legacy code)
export const saveAssistant = async (assistant: Omit<Assistant, 'id'> & { id?: string; subStart?: number; subExpiry?: number }): Promise<string> => {
  // If assistantId is present, we are saving a link/contract
  const ast = assistant as any;
  if (ast.assistantId) {
    return saveAssistantLink({
      id: ast.id,
      teacherId: ast.teacherId,
      assistantId: ast.assistantId,
      role: ast.role,
      permissions: ast.permissions,
      salaryType: ast.salaryType,
      salaryValue: ast.salaryValue,
      status: ast.status || 'active',
      subStart: ast.subStart,
      subExpiry: ast.subExpiry,
      createdAt: ast.createdAt || Date.now()
    });
  }

  // Otherwise check if this assistant exists in central profiles by phone or name
  let profileId = crypto.randomUUID();
  const { data: existing } = await supabase
    .from(ASSISTANTS_PROFILES)
    .select('id')
    .eq('phone', assistant.phone)
    .maybeSingle();

  if (existing) {
    profileId = existing.id;
  } else {
    // Generate username & password randomly for compatibility
    const username = `ast_${assistant.phone.slice(-6)}`;
    await saveAssistantProfile({
      id: profileId,
      name: assistant.name,
      username,
      password: `pass_${assistant.phone.slice(-4)}`,
      phone: assistant.phone,
      code: `AST-${Math.floor(100000 + Math.random() * 900000)}`,
      status: 'approved',
      roleTitle: assistant.role,
      createdAt: Date.now()
    });
  }

  return saveAssistantLink({
    id: assistant.id,
    teacherId: assistant.teacherId,
    assistantId: profileId,
    role: assistant.role,
    permissions: assistant.permissions,
    salaryType: assistant.salaryType,
    salaryValue: assistant.salaryValue,
    status: assistant.status || 'active',
    subStart: assistant.subStart,
    subExpiry: assistant.subExpiry,
    createdAt: assistant.createdAt || Date.now()
  });
};

// 5. Delete an assistant (forward compatibility for legacy code)
export const deleteAssistant = async (id: string): Promise<void> => {
  return deleteAssistantLink(id);
};

// 6. Save/update an assistant profile (central registry)
export const saveAssistantProfile = async (profile: Omit<AssistantProfile, 'id'> & { id?: string }): Promise<string> => {
  const newId = profile.id || crypto.randomUUID();
  const payload = toDB({ ...profile, id: newId, status: profile.status || 'pending', createdAt: profile.createdAt || Date.now() });

  await checkUserUniqueness(profile.code, profile.username, profile.id, profile.phone);

  const { error } = await supabase
    .from(ASSISTANTS_PROFILES)
    .upsert([payload], { onConflict: 'id' });

  if (error) {
    console.error('Error saving assistant profile:', error);
    throw error;
  }

  return newId;
};

// 7. Get an assistant profile by code
export const getAssistantProfileByCode = async (code: string): Promise<AssistantProfile | null> => {
  const cleanCode = code.trim().toUpperCase();
  const { data, error } = await supabase
    .from(ASSISTANTS_PROFILES)
    .select('*')
    .eq('code', cleanCode)
    .maybeSingle();

  if (error) {
    console.error('Error fetching assistant by code:', error);
    return null;
  }

  return data ? fromDB<AssistantProfile>(data) : null;
};

// 8. Get an assistant profile by username
export const getAssistantProfileByUsername = async (username: string): Promise<AssistantProfile | null> => {
  const cleanUsername = username.trim().toLowerCase();
  const { data, error } = await supabase
    .from(ASSISTANTS_PROFILES)
    .select('*')
    .eq('username', cleanUsername)
    .maybeSingle();

  if (error) {
    console.error('Error fetching assistant by username:', error);
    return null;
  }

  return data ? fromDB<AssistantProfile>(data) : null;
};

// 9. Get all assistant profiles (for admin approval and general team list)
export const getAllAssistantProfiles = async (): Promise<AssistantProfile[]> => {
  const { data, error } = await supabase
    .from(ASSISTANTS_PROFILES)
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching all assistant profiles:', error);
    return [];
  }

  return manyFromDB<AssistantProfile>(data);
};

// 10. Fetch all teachers linked to an assistant
export const getTeachersForAssistant = async (assistantId: string): Promise<{ link: TeacherAssistantLink; teacher: TeacherUser }[]> => {
  if (!assistantId) return [];

  const { data: linksData, error: linksError } = await supabase
    .from(TEACHER_ASSISTANT_LINKS)
    .select('*')
    .eq('assistant_id', assistantId);

  if (linksError) {
    console.error('Error fetching assistant teacher links:', linksError);
    return [];
  }

  const links = manyFromDB<TeacherAssistantLink>(linksData);
  if (links.length === 0) return [];

  // Fetch corresponding teachers
  const teacherIds = links.map(l => l.teacherId);
  const { data: teachersData, error: teachersError } = await supabase
    .from('teachers') // Direct table query
    .select('*')
    .in('id', teacherIds);

  if (teachersError) {
    console.error('Error fetching linked teachers:', teachersError);
    return [];
  }

  const teachers = manyFromDB<TeacherUser>(teachersData);
  const teachersMap = new Map(teachers.map(t => [t.id, t]));

  const results: { link: TeacherAssistantLink; teacher: TeacherUser }[] = [];
  links.forEach(link => {
    const teacher = teachersMap.get(link.teacherId);
    if (teacher) {
      results.push({ link, teacher });
    }
  });

  return results;
};

export const ASSISTANT_JOBS = 'assistant_jobs';
export const ASSISTANT_JOB_APPLICATIONS = 'assistant_job_applications';

// 11. Save/update a job posting
export const saveAssistantJob = async (job: Omit<AssistantJob, 'id'> & { id?: string }): Promise<string> => {
  const newId = job.id || crypto.randomUUID();
  const payload = toDB({
    ...job,
    id: newId,
    status: job.status || 'open',
    teacherPhone: job.teacherPhone,
    createdAt: job.createdAt || Date.now()
  });

  const { error } = await supabase
    .from(ASSISTANT_JOBS)
    .upsert([payload], { onConflict: 'id' });

  if (error) {
    console.error('Error saving assistant job:', error);
    throw error;
  }
  return newId;
};

export const deleteAssistantJob = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from(ASSISTANT_JOBS)
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting assistant job:', error);
    throw error;
  }
};

// 12. Get all open job postings (for assistants to browse)
export const getAssistantJobs = async (): Promise<AssistantJob[]> => {
  const { data, error } = await supabase
    .from(ASSISTANT_JOBS)
    .select('*')
    .eq('status', 'open')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching assistant jobs:', error);
    return [];
  }
  return manyFromDB<AssistantJob>(data);
};

// 13. Get all jobs posted by a specific teacher
export const getJobsByTeacher = async (teacherId: string): Promise<AssistantJob[]> => {
  const { data, error } = await supabase
    .from(ASSISTANT_JOBS)
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching jobs by teacher:', error);
    return [];
  }
  return manyFromDB<AssistantJob>(data);
};

// 14. Save/update a job application
export const saveJobApplication = async (app: Omit<AssistantJobApplication, 'id'> & { id?: string }): Promise<string> => {
  const newId = app.id || crypto.randomUUID();
  const payload = toDB({
    ...app,
    id: newId,
    status: app.status || 'pending',
    createdAt: app.createdAt || Date.now()
  });

  const { error } = await supabase
    .from(ASSISTANT_JOB_APPLICATIONS)
    .upsert([payload], { onConflict: 'id' });

  if (error) {
    console.error('Error saving job application:', error);
    throw error;
  }
  return newId;
};

// 15. Get all applications for a specific job (with assistant profiles)
export const getApplicationsForJob = async (jobId: string): Promise<AssistantJobApplication[]> => {
  const { data, error } = await supabase
    .from(ASSISTANT_JOB_APPLICATIONS)
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching applications for job:', error);
    return [];
  }

  const apps = manyFromDB<AssistantJobApplication>(data);
  if (apps.length === 0) return [];

  // Fetch assistant profiles
  const astIds = apps.map(a => a.assistantId);
  const { data: profilesData, error: profilesError } = await supabase
    .from(ASSISTANTS_PROFILES)
    .select('*')
    .in('id', astIds);

  if (profilesError) {
    console.error('Error fetching assistant profiles for applications:', profilesError);
    return apps;
  }

  const profiles = manyFromDB<AssistantProfile>(profilesData);
  const profilesMap = new Map(profiles.map(p => [p.id, p]));

  return apps.map(app => ({
    ...app,
    assistant: profilesMap.get(app.assistantId)
  }));
};

// 16. Get all applications submitted by an assistant (with job details)
export const getApplicationsForAssistant = async (assistantId: string): Promise<AssistantJobApplication[]> => {
  const { data, error } = await supabase
    .from(ASSISTANT_JOB_APPLICATIONS)
    .select('*')
    .eq('assistant_id', assistantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching applications for assistant:', error);
    return [];
  }

  const apps = manyFromDB<AssistantJobApplication>(data);
  if (apps.length === 0) return [];

  // Fetch jobs
  const jobIds = apps.map(a => a.jobId);
  const { data: jobsData, error: jobsError } = await supabase
    .from(ASSISTANT_JOBS)
    .select('*')
    .in('id', jobIds);

  if (jobsError) {
    console.error('Error fetching jobs for applications:', jobsError);
    return apps;
  }

  const jobs = manyFromDB<AssistantJob>(jobsData);
  const jobsMap = new Map(jobs.map(j => [j.id, j]));

  return apps.map(app => ({
    ...app,
    job: jobsMap.get(app.jobId)
  }));
};

// 17. Update application status
export const updateApplicationStatus = async (id: string, status: 'pending' | 'accepted' | 'rejected'): Promise<void> => {
  const { error } = await supabase
    .from(ASSISTANT_JOB_APPLICATIONS)
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('Error updating application status:', error);
    throw error;
  }
};

// 18. Update assistant profile safely (partial fields)
export const updateAssistantProfile = async (id: string, updates: Partial<AssistantProfile>): Promise<void> => {
  if (updates.code || updates.username) {
    // Only fetch phone if needed, but we don't have it here. excludeId is sufficient.
    await checkUserUniqueness(updates.code, updates.username, id);
  }
  const payload = toDB(updates);
  const { error } = await supabase
    .from(ASSISTANTS_PROFILES)
    .update(payload)
    .eq('id', id);

  if (error) {
    console.error('Error updating assistant profile:', error);
    throw error;
  }
};
