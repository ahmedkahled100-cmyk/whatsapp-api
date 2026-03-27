// src/lib/db/supabase/materials.ts
import { supabase } from '@/lib/supabase';
import { MATERIALS } from '../constants';
import { fromDB, toDB, manyFromDB } from './dbUtils';
import type { CourseMaterial } from '@/types';

export const getMaterials = async (teacherId: string): Promise<CourseMaterial[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const { data, error } = await supabase
    .from(MATERIALS)
    .select('*')
    .eq('teacher_id', teacherId)
    .order('sequence', { ascending: true })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return manyFromDB<CourseMaterial>(data);
};

export const saveMaterial = async (material: Omit<CourseMaterial, 'id'> & { id?: string }): Promise<string> => {
  const payload = toDB({ ...material });
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k]);
  if (material.id) {
    const { error } = await supabase.from(MATERIALS).update(payload).eq('id', material.id);
    if (error) throw error;
    return material.id;
  } else {
    const newId = crypto.randomUUID();
    const { data, error } = await supabase.from(MATERIALS).insert([{ ...payload, id: newId, created_at: Date.now() }]).select().single();
    if (error) throw error;
    return data.id;
  }
};

export const deleteMaterial = async (id: string) => {
  const { error } = await supabase.from(MATERIALS).delete().eq('id', id);
  if (error) throw error;
};

export const subscribeToMaterials = (teacherId: string, callback: (m: CourseMaterial[]) => void) => {
  if (!teacherId || teacherId === 'unknown_teacher') { callback([]); return () => {}; }
  const fetch = async () => {
    const materials = await getMaterials(teacherId);
    callback(materials);
  };
  const channel = supabase
    .channel(`materials:${teacherId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: MATERIALS, filter: `teacher_id=eq.${teacherId}` }, fetch)
    .subscribe();
  fetch();
  return () => supabase.removeChannel(channel);
};
