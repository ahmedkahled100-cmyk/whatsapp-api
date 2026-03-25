// src/lib/db/supabase/materials.ts
import { supabase } from '@/lib/supabase';
import { MATERIALS } from '../constants';
import type { CourseMaterial } from '@/types';

export const getMaterials = async (teacherId: string): Promise<CourseMaterial[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const { data, error } = await supabase
    .from(MATERIALS)
    .select('*')
    .eq('teacherId', teacherId)
    .order('sequence', { ascending: true })
    .order('createdAt', { ascending: false });
  
  if (error) throw error;
  return data as CourseMaterial[];
};

export const saveMaterial = async (material: Omit<CourseMaterial, 'id'> & { id?: string }): Promise<string> => {
  if (material.id) {
    const { error } = await supabase.from(MATERIALS).update(material).eq('id', material.id);
    if (error) throw error;
    return material.id;
  } else {
    const { data, error } = await supabase
      .from(MATERIALS)
      .insert([{ ...material, createdAt: Date.now() }])
      .select()
      .single();
    if (error) throw error;
    return data.id;
  }
};

export const deleteMaterial = async (id: string) => {
  const { error } = await supabase.from(MATERIALS).delete().eq('id', id);
  if (error) throw error;
};

export const subscribeToMaterials = (teacherId: string, callback: (m: CourseMaterial[]) => void) => {
  const channel = supabase
    .channel(`materials:${teacherId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: MATERIALS, filter: `teacherId=eq.${teacherId}` },
      async () => {
        const materials = await getMaterials(teacherId);
        callback(materials);
      }
    )
    .subscribe();

  getMaterials(teacherId).then(callback);
  return () => supabase.removeChannel(channel);
};
