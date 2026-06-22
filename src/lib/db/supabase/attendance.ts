// src/lib/db/supabase/attendance.ts
import { supabase } from '@/lib/supabase';
import { ATTENDANCE_SESSIONS, ATTENDANCE_RECORDS } from '../constants';
import type { AttendanceSession, AttendanceRecord } from '@/types';
import { toDB, manyFromDB } from './dbUtils';

export const getAttendanceSessions = async (teacherId: string, limit: number = 30): Promise<AttendanceSession[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const { data, error } = await supabase
    .from(ATTENDANCE_SESSIONS)
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false })
    .limit(limit);
    
  if (error) {
    console.error('Error fetching attendance sessions:', error);
    return []; // Return empty array if table doesn't exist yet
  }
  return manyFromDB<AttendanceSession>(data);
};

export const createAttendanceSession = async (session: Omit<AttendanceSession, 'id'>): Promise<string> => {
  const newId = crypto.randomUUID();
  const payload = toDB({ ...session, id: newId, createdAt: Date.now() });
  
  const { error } = await supabase
    .from(ATTENDANCE_SESSIONS)
    .insert([payload]);
    
  if (error) {
    console.error('Error creating attendance session:', error);
    throw error;
  }
  
  return newId;
};

export const updateAttendanceSessionStatus = async (sessionId: string, status: 'open' | 'closed'): Promise<void> => {
  const { error } = await supabase
    .from(ATTENDANCE_SESSIONS)
    .update({ status })
    .eq('id', sessionId);
    
  if (error) throw error;
};

export const deleteAttendanceSession = async (sessionId: string): Promise<void> => {
  // First, delete related records
  const { error: recordsError } = await supabase
    .from(ATTENDANCE_RECORDS)
    .delete()
    .eq('session_id', sessionId);
    
  if (recordsError) throw recordsError;

  // Then delete the session
  const { error } = await supabase
    .from(ATTENDANCE_SESSIONS)
    .delete()
    .eq('id', sessionId);
    
  if (error) throw error;
};

export const getAttendanceRecords = async (sessionId: string): Promise<AttendanceRecord[]> => {
  if (!sessionId) return [];
  const { data, error } = await supabase
    .from(ATTENDANCE_RECORDS)
    .select('*')
    .eq('session_id', sessionId);
    
  if (error) {
    console.error('Error fetching attendance records:', error);
    return [];
  }
  return manyFromDB<AttendanceRecord>(data);
};

export const saveAttendanceRecord = async (record: Omit<AttendanceRecord, 'id'> & { id?: string }): Promise<string> => {
  const newId = record.id || crypto.randomUUID();
  const payload = toDB({ ...record, id: newId });
  
  const { error } = await supabase
    .from(ATTENDANCE_RECORDS)
    .upsert([payload], { onConflict: 'id' });
    
  if (error) {
    console.error('Error saving attendance record:', error);
    throw error;
  }
  
  return newId;
};

export const getStudentAttendanceHistory = async (studentId: string): Promise<AttendanceRecord[]> => {
  if (!studentId) return [];
  const { data, error } = await supabase
    .from(ATTENDANCE_RECORDS)
    .select('*')
    .eq('student_id', studentId)
    .order('time', { ascending: false });
    
  if (error) return [];
  return manyFromDB<AttendanceRecord>(data);
};
