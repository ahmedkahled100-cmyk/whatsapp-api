// src/lib/db/supabase/students.ts
import { supabase } from '@/lib/supabase';
import { STUDENTS, ATTEMPTS, GROUPS, REG_REQUESTS } from '../constants';
import { fromDB, toDB, manyFromDB } from './dbUtils';
import type { Student, Group, RegistrationRequest } from '@/types';
import { normalizePhone, generateCode } from '@/lib/utils';

const decode = (str: string) => {
  try {
    return typeof window !== 'undefined' && typeof atob !== 'undefined'
      ? decodeURIComponent(escape(atob(str))) 
      : Buffer.from(str, 'base64').toString('utf-8');
  } catch {
    return str;
  }
};

const encode = (str: string) => {
  try {
    return typeof window !== 'undefined' && typeof btoa !== 'undefined'
      ? btoa(unescape(encodeURIComponent(str)))
      : Buffer.from(str, 'utf-8').toString('base64');
  } catch {
    return str;
  }
};

export const getStudents = async (teacherId: string): Promise<Student[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const { data, error } = await supabase
    .from(STUDENTS)
    .select('*')
    .eq('teacher_id', teacherId);
  if (error) throw error;
  
  return manyFromDB<Student>(data).map(student => {
    // UI CLEANING: Strip shadow sub-codes (-T...)
    if (student.code) student.code = student.code.replace(/-T[a-zA-Z0-9]+$/, '');
  
    if (student.notes) {
      // Extract subStart
      const stMatch = student.notes.match(/\[ST:(\d+)\]/);
      if (stMatch) student.subStart = parseInt(stMatch[1]);
      
      // Extract Total Paid
      const tpMatch = student.notes.match(/\[TP:(\d+)\]/);
      if (tpMatch) student.totalPaid = parseInt(tpMatch[1]);
  
      // Extract subPrice (Shadow)
      const prcMatch = student.notes.match(/\[PRC:(\d+)\]/);
      if (prcMatch) student.subPrice = parseInt(prcMatch[1]);
  
      // Extract History
      const histMatch = student.notes.match(/\[HIST:(.*?)\]/);
      if (histMatch) {
         try { student.paymentHistory = JSON.parse(decode(histMatch[1])); } catch {}
      }
  
      // Extract imageUrl if not in column
      if (!student.imageUrl) {
        const imgMatch = student.notes.match(/\[IMG:(.*?)\]/);
        if (imgMatch) student.imageUrl = imgMatch[1];
      }

      const qrMatch = student.notes.match(/\[QR:(.*?)\]/);
      if (qrMatch) student.qrCodeId = qrMatch[1];

      const bnMatch = student.notes.match(/\[BN:(.*?)\]/);
      if (bnMatch) {
        try { student.behavioralNotes = decode(bnMatch[1]); } catch { student.behavioralNotes = bnMatch[1]; }
      }

      // Extract cancelReason from notes if not in dedicated column
      if (!student.cancelReason) {
        const crMatch = student.notes.match(/\[CR:(.*?)\]/);
        if (crMatch) {
          try { student.cancelReason = decode(crMatch[1]); } catch { student.cancelReason = crMatch[1]; }
        }
      }

      const ptsMatch = student.notes.match(/\[PTS:(\d+)\]/);
      if (ptsMatch) student.points = parseInt(ptsMatch[1]);

      const lvlMatch = student.notes.match(/\[LVL:(\d+)\]/);
      if (lvlMatch) student.level = parseInt(lvlMatch[1]);

      const bdgMatch = student.notes.match(/\[BDG:(.*?)\]/);
      if (bdgMatch) {
         try { student.badges = JSON.parse(decode(bdgMatch[1])); } catch {}
      }
  
      // CLEAN the notes field for the UI
      student.notes = student.notes
        .replace(/\[ST:\d+\]/g, '')
        .replace(/\[IMG:.*?\]/g, '')
        .replace(/\[TP:\d+\]/g, '')
        .replace(/\[PRC:\d+\]/g, '')
        .replace(/\[HIST:.*?\]/g, '')
        .replace(/\[CR:.*?\]/g, '')
        .replace(/\[QR:.*?\]/g, '')
        .replace(/\[BN:.*?\]/g, '')
        .replace(/\[PTS:\d+\]/g, '')
        .replace(/\[LVL:\d+\]/g, '')
        .replace(/\[BDG:.*?\]/g, '')
        .trim();
    }
    return student;
  });
};

export const getAllStudents = async (): Promise<Student[]> => {
  const { data, error } = await supabase.from(STUDENTS).select('*');
  if (error) throw error;
  return manyFromDB<Student>(data).map(student => {
    if (student.notes) {
      const stMatch = student.notes.match(/\[ST:(\d+)\]/);
      if (stMatch) student.subStart = parseInt(stMatch[1]);
      
      const tpMatch = student.notes.match(/\[TP:(\d+)\]/);
      if (tpMatch) student.totalPaid = parseInt(tpMatch[1]);

      const prcMatch = student.notes.match(/\[PRC:(\d+)\]/);
      if (prcMatch) student.subPrice = parseInt(prcMatch[1]);

      const histMatch = student.notes.match(/\[HIST:(.*?)\]/);
      if (histMatch) {
         try { student.paymentHistory = JSON.parse(decode(histMatch[1])); } catch {}
      }

      if (!student.imageUrl) {
        const imgMatch = student.notes.match(/\[IMG:(.*?)\]/);
        if (imgMatch) student.imageUrl = imgMatch[1];
      }

      const qrMatch = student.notes.match(/\[QR:(.*?)\]/);
      if (qrMatch) student.qrCodeId = qrMatch[1];

      const bnMatch = student.notes.match(/\[BN:(.*?)\]/);
      if (bnMatch) {
        try { student.behavioralNotes = decode(bnMatch[1]); } catch { student.behavioralNotes = bnMatch[1]; }
      }

      const ptsMatch = student.notes.match(/\[PTS:(\d+)\]/);
      if (ptsMatch) student.points = parseInt(ptsMatch[1]);

      const lvlMatch = student.notes.match(/\[LVL:(\d+)\]/);
      if (lvlMatch) student.level = parseInt(lvlMatch[1]);

      const bdgMatch = student.notes.match(/\[BDG:(.*?)\]/);
      if (bdgMatch) {
         try { student.badges = JSON.parse(decode(bdgMatch[1])); } catch {}
      }

      student.notes = student.notes
        .replace(/\[ST:\d+\]/g, '')
        .replace(/\[IMG:.*?\]/g, '')
        .replace(/\[TP:\d+\]/g, '')
        .replace(/\[PRC:\d+\]/g, '')
        .replace(/\[HIST:.*?\]/g, '')
        .replace(/\[QR:.*?\]/g, '')
        .replace(/\[BN:.*?\]/g, '')
        .replace(/\[PTS:\d+\]/g, '')
        .replace(/\[LVL:\d+\]/g, '')
        .replace(/\[BDG:.*?\]/g, '')
        .trim();
    }
    return student;
  });
};

export const getStudentByCode = async (code: string): Promise<Student[]> => {
  const cleanCode = code.trim().toUpperCase();
  const { data, error } = await supabase
    .from(STUDENTS)
    .select('*')
    .or(`code.eq.${cleanCode},code.ilike.${cleanCode}-T%`);
  if (error) throw error;
  
  const results = manyFromDB<Student>(data).map(s => {
    // Strip shadow sub-codes (-T...)
    if (s.code) s.code = s.code.replace(/-T[a-zA-Z0-9]+$/, '');
    // Decode cancelReason from notes fallback if not in dedicated column
    if (!s.cancelReason && s.notes) {
      const crMatch = s.notes.match(/\[CR:(.*?)\]/);
      if (crMatch) {
        try { s.cancelReason = decode(crMatch[1]); } catch { s.cancelReason = crMatch[1]; }
      }
    }
    return s;
  });
  return results;
};

/**
 * Subscribe to real-time changes for a specific student by ID.
 * Fires callback immediately with current data, then on every DB change.
 * Returns an unsubscribe function.
 */
export const subscribeToStudent = (studentId: string, teacherId: string, callback: (student: Student) => void) => {
  const channel = supabase
    .channel(`student:${studentId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: STUDENTS,
        filter: `id=eq.${studentId}`,
      },
      async (payload) => {
        // Re-fetch full data from getStudents to apply all deserialization (notes decoding, etc.)
        try {
          const freshList = await getStudents(teacherId);
          const fresh = freshList.find(s => s.id === studentId);
          if (fresh) {
            console.log('⚡ Student status updated via Supabase Realtime');
            callback(fresh);
          }
        } catch (err) {
          console.warn('subscribeToStudent re-fetch failed:', err);
          // Fallback: convert raw payload
          const raw = fromDB<Student>(payload.new);
          if (raw.code) raw.code = raw.code.replace(/-T[a-zA-Z0-9]+$/, '');
          callback(raw);
        }
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
};

export const getStudentByParentPhone = async (parentPhone: string): Promise<Student | null> => {
  const { data, error } = await supabase
    .from(STUDENTS)
    .select('*')
    .eq('parent_phone', parentPhone.trim())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const student = fromDB<Student>(data);
  if (student.notes && !student.imageUrl) {
    const imgMatch = student.notes.match(/\[IMG:(.*?)\]/);
    if (imgMatch) student.imageUrl = imgMatch[1];
  }
  if (student.code) {
    student.code = student.code.replace(/-T[a-zA-Z0-9]+$/, '');
  }
  return student;
};

export const getStudentByPhoneAnywhere = async (phone: string): Promise<Student | null> => {
  if (!phone) return null;
  const normalized = normalizePhone(phone);
  const { data, error } = await supabase
    .from(STUDENTS)
    .select('*')
    .eq('phone', normalized)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  
  const student = fromDB<Student>(data);
  if (student.notes && !student.imageUrl) {
    const imgMatch = student.notes.match(/\[IMG:(.*?)\]/);
    if (imgMatch) student.imageUrl = imgMatch[1];
  }
  if (student.code) {
    student.code = student.code.replace(/-T[a-zA-Z0-9]+$/, '');
  }
  return student;
};

/** البحث عن كافة طلبات التسجيل (الحالية والسابقة) لرقم هاتف */
export const getRegistrationRequestsByPhone = async (phone: string): Promise<RegistrationRequest[]> => {
  if (!phone) return [];
  const normalized = normalizePhone(phone);
  const { data, error } = await supabase
    .from(REG_REQUESTS)
    .select('*')
    .eq('phone', normalized);
  if (error) throw error;
  return manyFromDB<RegistrationRequest>(data);
};

export const getEnrollmentsByParentPhone = async (parentPhone: string): Promise<Student[]> => {
  if (!parentPhone) return [];
  const { data, error } = await supabase
    .from(STUDENTS)
    .select('*')
    .eq('parent_phone', parentPhone.trim());
  if (error) throw error;
  return manyFromDB<Student>(data).map(s => {
    if (s.notes && !s.imageUrl) {
      const imgMatch = s.notes.match(/\[IMG:(.*?)\]/);
      if (imgMatch) s.imageUrl = imgMatch[1];
    }
    // UI CLEANING: Strip shadow sub-codes (-T...)
    if (s.code) s.code = s.code.replace(/-T[a-zA-Z0-9]+$/, '');
    return s;
  });
};

export const getEnrollmentsByPhone = async (phone: string): Promise<Student[]> => {
  if (!phone) return [];
  const normalized = normalizePhone(phone);
  const { data, error } = await supabase
    .from(STUDENTS)
    .select('*')
    .eq('phone', normalized);
  if (error) throw error;
  return manyFromDB<Student>(data).map(student => {
    // UI CLEANING: Strip shadow sub-codes (-T...)
    if (student.code) student.code = student.code.replace(/-T[a-zA-Z0-9]+$/, '');

    if (student.notes && !student.imageUrl) {
      const imgMatch = student.notes.match(/\[IMG:(.*?)\]/);
      if (imgMatch) student.imageUrl = imgMatch[1];
    }
    
    if (student.notes) {
      const qrMatch = student.notes.match(/\[QR:(.*?)\]/);
      if (qrMatch) student.qrCodeId = qrMatch[1];

      const bnMatch = student.notes.match(/\[BN:(.*?)\]/);
      if (bnMatch) {
        try { student.behavioralNotes = decode(bnMatch[1]); } catch { student.behavioralNotes = bnMatch[1]; }
      }
    }

    if (student.notes) {
      const stMatch = student.notes.match(/\[ST:(\d+)\]/);
      if (stMatch) student.subStart = parseInt(stMatch[1]);

      const tpMatch = student.notes.match(/\[TP:(\d+)\]/);
      if (tpMatch) student.totalPaid = parseInt(tpMatch[1]);

      const prcMatch = student.notes.match(/\[PRC:(\d+)\]/);
      if (prcMatch) student.subPrice = parseInt(prcMatch[1]);

      const ptsMatch = student.notes.match(/\[PTS:(\d+)\]/);
      if (ptsMatch) student.points = parseInt(ptsMatch[1]);

      const lvlMatch = student.notes.match(/\[LVL:(\d+)\]/);
      if (lvlMatch) student.level = parseInt(lvlMatch[1]);

      const bdgMatch = student.notes.match(/\[BDG:(.*?)\]/);
      if (bdgMatch) {
         try { student.badges = JSON.parse(decode(bdgMatch[1])); } catch {}
      }

      student.notes = student.notes
        .replace(/\[ST:\d+\]/g, '')
        .replace(/\[IMG:.*?\]/g, '')
        .replace(/\[TP:\d+\]/g, '')
        .replace(/\[PRC:\d+\]/g, '')
        .replace(/\[QR:.*?\]/g, '')
        .replace(/\[BN:.*?\]/g, '')
        .replace(/\[PTS:\d+\]/g, '')
        .replace(/\[LVL:\d+\]/g, '')
        .replace(/\[BDG:.*?\]/g, '')
        .trim();
    }
    return student;
  });
};

export const saveStudent = async (student: Omit<Student, 'id'> & { id?: string }): Promise<string> => {
  const payload = toDB({ ...student, createdAt: student.id ? undefined : Date.now() });
  // Remove undefined values
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  
  delete payload.teacher_code;
  delete payload.teacher_name;

  // Serialize everything into notes to prevent DB schema errors
  let cleanNotes = (payload.notes || '')
    .replace(/\[ST:\d+\]/g, '')
    .replace(/\[IMG:.*?\]/g, '')
    .replace(/\[TP:\d+\]/g, '')
    .replace(/\[PRC:\d+\]/g, '')
    .replace(/\[HIST:.*?\]/g, '')
    .replace(/\[QR:.*?\]/g, '')
    .replace(/\[BN:.*?\]/g, '')
    .replace(/\[PTS:\d+\]/g, '')
    .replace(/\[LVL:\d+\]/g, '')
    .replace(/\[BDG:.*?\]/g, '')
    .trim();
  
  if (payload.sub_start !== undefined) {
    if (payload.sub_start !== null) {
      cleanNotes = `${cleanNotes} [ST:${payload.sub_start}]`.trim();
    }
    delete payload.sub_start;
  }

  if (payload.sub_price !== undefined) {
    cleanNotes = `${cleanNotes} [PRC:${payload.sub_price || 0}]`.trim();
    // We keep sub_price in payload too if column exists
  }

  if (payload.total_paid !== undefined) {
    cleanNotes = `${cleanNotes} [TP:${payload.total_paid || 0}]`.trim();
    delete payload.total_paid;
  }

  if (payload.payment_history !== undefined) {
    const histStr = encode(JSON.stringify(payload.payment_history || []));
    cleanNotes = `${cleanNotes} [HIST:${histStr}]`.trim();
    delete payload.payment_history;
  }

  // Serialize imageUrl into notes to prevent DB schema errors if column is missing
  if (payload.image_url !== undefined && payload.image_url !== null) {
    cleanNotes = `${cleanNotes} [IMG:${payload.image_url}]`.trim();
    // We keep image_url in payload too, in case the column exists
  }
  
  if (payload.registered_at && typeof payload.registered_at === 'string') {
    const parsed = new Date(payload.registered_at);
    if (!isNaN(parsed.getTime())) {
      cleanNotes = `${cleanNotes} [REG:${parsed.toISOString()}]`.trim();
    }
    delete payload.registered_at;
  }

  // Preserve created_at in notes as well
  const createdAtToUse = payload.created_at || Date.now();
  cleanNotes = `${cleanNotes} [CAT:${createdAtToUse}]`.trim();
  delete payload.created_at;

  // Serialize cancelReason into notes as [CR:...] to ensure it always persists (must be BEFORE payload.notes assignment)
  const cancelReason = (student as any).cancelReason;
  if (cancelReason !== undefined) {
    cleanNotes = cleanNotes.replace(/\[CR:.*?\]/g, '').trim();
    if (cancelReason) {
      // Using base64 encoding to handle Arabic text and special characters safely
      cleanNotes = `${cleanNotes} [CR:${encode(cancelReason)}]`.trim();
    }
  }

  const qrCodeId = (student as any).qrCodeId;
  if (qrCodeId !== undefined) {
    cleanNotes = cleanNotes.replace(/\[QR:.*?\]/g, '').trim();
    if (qrCodeId) {
      cleanNotes = `${cleanNotes} [QR:${qrCodeId}]`.trim();
    }
  }

  const behavioralNotes = (student as any).behavioralNotes;
  if (behavioralNotes !== undefined) {
    cleanNotes = cleanNotes.replace(/\[BN:.*?\]/g, '').trim();
    if (behavioralNotes) {
      cleanNotes = `${cleanNotes} [BN:${encode(behavioralNotes)}]`.trim();
    }
  }

  if (payload.points !== undefined) {
    cleanNotes = `${cleanNotes} [PTS:${payload.points}]`.trim();
    delete payload.points;
  }
  if (payload.level !== undefined) {
    cleanNotes = `${cleanNotes} [LVL:${payload.level}]`.trim();
    delete payload.level;
  }
  if (payload.badges !== undefined) {
    const bdgStr = encode(JSON.stringify(payload.badges || []));
    cleanNotes = `${cleanNotes} [BDG:${bdgStr}]`.trim();
    delete payload.badges;
  }

  payload.notes = cleanNotes || undefined;

  if (payload.code) payload.code = String(payload.code).trim().toUpperCase();
  
  // Normalize phone numbers radically to ensure 01xxxxxxxxx format
  if (payload.phone) payload.phone = normalizePhone(payload.phone);
  if (payload.parent_phone) payload.parent_phone = normalizePhone(payload.parent_phone);

  // RADICAL ENFORCEMENT: Force code unification by searching anywhere for this phone
  const existingForCode = await getStudentByPhoneAnywhere(payload.phone);
  if (existingForCode && existingForCode.code) {
    // If we found an existing code, we MUST use it to maintain unified identity
    payload.code = existingForCode.code;
  } else if (!payload.code) {
    // Fallback if no code provided and no existing student found
    payload.code = generateCode();
  }

  // CONFLICT PREVENTION: Check if THIS teacher already has this student record (by phone)
  let idToUse = student.id;
  if (!idToUse && payload.phone && payload.teacher_id) {
    try {
      const enrollments = await getEnrollmentsByPhone(payload.phone);
      const match = enrollments.find(e => e.teacherId === payload.teacher_id);
      if (match) {
        idToUse = match.id;
      }
    } catch (e) {
      console.warn('Conflict check lookup failed:', e);
    }
  }

  if (!idToUse) idToUse = crypto.randomUUID();

  // FIELD FILTERING: Only send columns highly likely to be standard in the database
  const finalSafePayload: any = {
    id: idToUse,
    teacher_id: payload.teacher_id,
    name: payload.name,
    phone: payload.phone,
    parent_phone: payload.parent_phone,
    grade: payload.grade,
    code: payload.code,
    sub_type: payload.sub_type,
    sub_expiry: payload.sub_expiry,
    sub_price: payload.sub_price,
    notes: payload.notes
  };


  // Use upsert to handle both new and existing students correctly
  let { error } = await supabase
    .from(STUDENTS)
    .upsert([finalSafePayload], { onConflict: 'id' });

  // RADICAL FIX: If 409/23505 Conflict occurs on Code, use a Shadow Code Suffix
  if (error && (error.code === '23505' || (error as any).status === 409)) {
      console.warn('Conflict detected, applying Shadow Code Fix...');
      const shadowCode = `${finalSafePayload.code}-T${payload.teacher_id.slice(0, 4)}`.toUpperCase();
      finalSafePayload.code = shadowCode;
      const retryResponse = await supabase
        .from(STUDENTS)
        .upsert([finalSafePayload], { onConflict: 'id' });
      error = retryResponse.error;
  }

  if (error) {
    if (error.code === '23505') throw new Error('DUPLICATE_CODE_OR_PHONE');
    throw error;
  }
  
  return idToUse;
};

export const deleteStudent = async (id: string) => {
  const { error: attemptErr } = await supabase.from(ATTEMPTS).delete().eq('student_id', id);
  if (attemptErr) console.error('deleteStudent attempts error:', attemptErr);
  const { error: studentErr } = await supabase.from(STUDENTS).delete().eq('id', id);
  if (studentErr) throw studentErr;
};

export const wipeStudentInteraction = async (studentId: string) => {
    // 1. Delete Attempts
    await supabase.from(ATTEMPTS).delete().eq('student_id', studentId);
    
    // 2. Delete Game Results
    await supabase.from('game_results').delete().eq('student_id', studentId);
    
    // 3. Delete Assignment Submissions
    await supabase.from('assignment_submissions').delete().eq('student_id', studentId);
};

export const subscribeToStudents = (teacherId: string, callback: (students: Student[]) => void) => {
  if (!teacherId || teacherId === 'unknown_teacher') {
    callback([]);
    return () => {};
  }
  
  // Cache of current students for instant patching
  let currentStudents: Student[] = [];
  
  const channel = supabase
    .channel(`students:${teacherId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: STUDENTS, filter: `teacher_id=eq.${teacherId}` },
      async (payload) => {
        if (payload.eventType === 'INSERT') {
          // Full re-fetch for inserts (need full deserialization)
          const students = await getStudents(teacherId);
          currentStudents = students;
          callback(students);
        } else if (payload.eventType === 'DELETE') {
          // Instant local removal, then confirm with re-fetch
          const deletedId = (payload.old as any).id;
          const instant = currentStudents.filter(s => s.id !== deletedId);
          currentStudents = instant;
          callback(instant);
          // Background confirm
          getStudents(teacherId).then(fresh => { currentStudents = fresh; callback(fresh); }).catch(() => {});
        } else if (payload.eventType === 'UPDATE') {
          const n = payload.new as any;
          const o = payload.old as any;
          const subChanged = n.sub_type !== o.sub_type || n.sub_expiry !== o.sub_expiry || n.notes !== o.notes;
          const profileChanged = n.name !== o.name || n.grade !== o.grade || n.code !== o.code || n.phone !== o.phone;
          if (subChanged || profileChanged) {
            // \u26a1 Instant patch: apply raw payload immediately so UI doesn't wait for re-fetch
            const patchedStudent = fromDB<Student>(n);
            // Strip shadow code from instant patch too
            if (patchedStudent.code) patchedStudent.code = patchedStudent.code.replace(/-T[a-zA-Z0-9]+$/, '');
            const instant = currentStudents.map(s => s.id === patchedStudent.id ? { ...s, ...patchedStudent } : s);
            currentStudents = instant;
            callback(instant);
            // Background full re-fetch for correct notes deserialization
            getStudents(teacherId).then(fresh => { currentStudents = fresh; callback(fresh); }).catch(() => {});
          }
        }
      }
    )
    .subscribe();

  getStudents(teacherId).then(data => { currentStudents = data; callback(data); });
  return () => supabase.removeChannel(channel);
};

export const subscribeToAllStudents = (callback: (students: Student[]) => void) => {
  const channel = supabase
    .channel('all_students')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: STUDENTS },
      async (payload) => {
        // Simplify and fetch on any change to guarantee admin dashboard accuracy
        const students = await getAllStudents();
        callback(students);
      }
    )
    .subscribe();
  getAllStudents().then(callback);
  return () => supabase.removeChannel(channel);
};

// Groups
export const getGroups = async (teacherId: string): Promise<Group[]> => {
  const { data, error } = await supabase
    .from(GROUPS)
    .select('*')
    .eq('teacher_id', teacherId);
  if (error) throw error;
  return manyFromDB<Group>(data).map(g => ({ ...g, desc: (g as any).description }));
};

export const saveGroup = async (group: Omit<Group, 'id'> & { id?: string }): Promise<string> => {
  const payload = toDB({ ...group });
  
  // Map desc -> description
  if (payload.desc) {
    payload.description = payload.desc;
    delete payload.desc;
  }

  // Sanitize
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  if (group.id) {
    const { error } = await supabase.from(GROUPS).update(payload).eq('id', group.id);
    if (error) throw error;
    return group.id;
  } else {
    const { data, error } = await supabase
      .from(GROUPS)
      .insert([{ ...payload, created_at: new Date().toISOString() }])
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }
};

export const deleteGroup = async (id: string) => {
  const { error } = await supabase.from(GROUPS).delete().eq('id', id);
  if (error) throw error;
};

export const subscribeToGroups = (teacherId: string, callback: (groups: Group[]) => void) => {
  const channel = supabase
    .channel(`groups:${teacherId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: GROUPS, filter: `teacher_id=eq.${teacherId}` },
      async () => {
        const groups = await getGroups(teacherId);
        callback(groups);
      }
    )
    .subscribe();
  getGroups(teacherId).then(callback);
  return () => supabase.removeChannel(channel);
};

export const getRegistrationRequests = async (teacherId: string): Promise<RegistrationRequest[]> => {
  const { data, error } = await supabase
    .from(REG_REQUESTS)
    .select('*')
    .eq('teacher_id', teacherId);
  if (error) throw error;
  
  const requests = manyFromDB<RegistrationRequest>(data);
  
  // Deserialize extras from payment_ref if present
  return requests.map(req => {
    if (req.paymentRef && req.paymentRef.includes('|EXT:')) {
      try {
        const match = req.paymentRef.match(/\|EXT:(.*?)\|/);
        if (match && match[1]) {
          const extras = JSON.parse(match[1]);
          // Re-hydrate the request object and convert snake_case to camelCase
          Object.assign(req, fromDB(extras));

          // Clean up paymentRef text for display
          req.paymentRef = req.paymentRef.replace(/\|EXT:.*?\|/, '').trim();
        }
      } catch (e) {
        console.error('Failed to parse registration request extras', e);
      }
    }
    return req;
  });
};

export const saveRegistrationRequest = async (req: Omit<RegistrationRequest, 'id'> & { id?: string }): Promise<string> => {
  const payload = toDB({ ...req });
  
  // Serialize extras into a structured string in payment_ref to prevent data loss 
  // since these columns might be missing in the 'registration_requests' table.
  const extraPayload: any = {};
  const possibleExtras = ['notes', 'subject', 'sub_price', 'image_url', 'student_id', 'existing_code'];
  
  possibleExtras.forEach(key => {
    if ((payload as any)[key] !== undefined) {
      extraPayload[key] = (payload as any)[key];
    }
  });

  if (Object.keys(extraPayload).length > 0) {
    const serialized = `|EXT:${JSON.stringify(extraPayload)}|`;
    payload.payment_ref = payload.payment_ref 
      ? `${payload.payment_ref} ${serialized}` 
      : serialized;
  }

  // Remove fields that strictly don't exist in the legacy DB schema to prevent 400 errors
  const fieldsToRemove = [
    'notes', 'teacher_code', 'teacher_name', 'student_id', 
    'subject', 'sub_price', 'image_url', 'existing_code'
  ];
  fieldsToRemove.forEach(f => delete payload[f]);

  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);

  if (req.id) {
    const { error } = await supabase.from(REG_REQUESTS).update(payload).eq('id', req.id);
    if (error) throw error;
    return req.id;
  } else {
    const newId = crypto.randomUUID();
    const { data, error } = await supabase
      .from(REG_REQUESTS)
      .insert([{ ...payload, id: newId, created_at: Date.now() }])
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }
};

export const deleteRegistrationRequest = async (id: string) => {
  const { error } = await supabase.from(REG_REQUESTS).delete().eq('id', id);
  if (error) throw error;
};

export const subscribeToRegistrationRequests = (teacherId: string, callback: (requests: RegistrationRequest[]) => void) => {
  const channel = supabase
    .channel(`reg_reqs:${teacherId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: REG_REQUESTS, filter: `teacher_id=eq.${teacherId}` },
      async () => {
        const reqs = await getRegistrationRequests(teacherId);
        callback(reqs);
      }
    )
    .subscribe();
  getRegistrationRequests(teacherId).then(callback);
  return () => supabase.removeChannel(channel);
};

/**
 * \u2693 Subscribe to new student records by phone number.
 * Fires whenever a teacher approves a new student with this phone \u2014 new enrollment detected instantly.
 */
export const subscribeToStudentByPhone = (
  phone: string,
  onNewEnrollment: (students: Student[]) => void
) => {
  if (!phone) return () => {};
  const normalized = normalizePhone(phone);
  const channel = supabase
    .channel(`student_phone:${normalized}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: STUDENTS },
      async (payload) => {
        const newRow = payload.new as any;
        const rowPhone = newRow.phone ? normalizePhone(newRow.phone) : '';
        if (rowPhone === normalized) {
          // New enrollment detected \u2014 fetch all enrollments for this phone
          try {
            const all = await getEnrollmentsByPhone(normalized);
            onNewEnrollment(all);
          } catch (e) {
            console.warn('subscribeToStudentByPhone fetch failed:', e);
          }
        }
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
};

/**
 * Subscribe to registration requests for a phone number.
 * Fires when a pending request gets approved or deleted (rejected).
 */
export const subscribeToRegistrationRequestByPhone = (
  phone: string,
  onUpdate: (requests: RegistrationRequest[]) => void
) => {
  if (!phone) return () => {};
  const normalized = normalizePhone(phone);
  const channel = supabase
    .channel(`reg_req_phone:${normalized}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: REG_REQUESTS },
      async (payload) => {
        const row = (payload.new as any) || (payload.old as any);
        const rowPhone = row?.phone ? normalizePhone(row.phone) : '';
        if (rowPhone === normalized) {
          const reqs = await getRegistrationRequestsByPhone(normalized);
          onUpdate(reqs);
        }
      }
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
};

export const getTopStudents = async (teacherId: string, limit: number = 10): Promise<Student[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  try {
    const students = await getStudents(teacherId);
    return students.sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, limit);
  } catch (error) {
    console.error('Error fetching top students:', error);
    return [];
  }
};

