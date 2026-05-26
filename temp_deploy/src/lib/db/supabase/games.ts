import { supabase } from '@/lib/supabase';
import type { EducationalGame, GameResult } from '@/types';
import { EDUCATIONAL_GAMES, GAME_RESULTS } from '../constants';

export const saveGame = async (game: Omit<EducationalGame, 'id'>): Promise<string> => {
  const { data, error } = await supabase
    .from(EDUCATIONAL_GAMES)
    .insert([{
        teacher_id: game.teacherId,
        title: game.title,
        type: game.type,
        content: game.content,
        target_group: game.targetGroup,
        created_at: game.createdAt
    }])
    .select()
    .single();
  if (error) throw error;
  return data.id;
};

export const getGamesByTeacher = async (teacherId: string): Promise<EducationalGame[]> => {
  const { data, error } = await supabase
    .from(EDUCATIONAL_GAMES)
    .select('*')
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  
  return (data || []).map((d: any) => ({
    id: d.id,
    teacherId: d.teacher_id,
    title: d.title,
    type: d.type,
    content: d.content,
    targetGroup: d.target_group,
    createdAt: d.created_at
  }));
};

export const getGamesForStudent = async (teacherId: string, groupId?: string): Promise<EducationalGame[]> => {
  let query = supabase
    .from(EDUCATIONAL_GAMES)
    .select('*')
    .eq('teacher_id', teacherId);
    
  if (groupId) {
    query = query.or(`target_group.is.null,target_group.eq.${groupId}`);
  } else {
    query = query.is('target_group', null);
  }
  
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;

  return (data || []).map((d: any) => ({
    id: d.id,
    teacherId: d.teacher_id,
    title: d.title,
    type: d.type,
    content: d.content,
    targetGroup: d.target_group,
    createdAt: d.created_at
  }));
};

export const saveGameResult = async (result: Omit<GameResult, 'id'>): Promise<void> => {
  const { error } = await supabase
    .from(GAME_RESULTS)
    .insert([{
        game_id: result.gameId,
        student_id: result.studentId,
        student_name: result.studentName,
        score: result.score,
        total: result.total,
        completed_at: result.completedAt
    }]);
  if (error) throw error;
};

export const getGameResultsByGame = async (gameId: string): Promise<GameResult[]> => {
  const { data, error } = await supabase
    .from(GAME_RESULTS)
    .select('*')
    .eq('game_id', gameId)
    .order('completed_at', { ascending: false });
  if (error) throw error;

  return (data || []).map((d: any) => ({
    id: d.id,
    gameId: d.game_id,
    studentId: d.student_id,
    studentName: d.student_name,
    score: d.score,
    total: d.total,
    completedAt: d.completed_at
  }));
};

export const getGameById = async (id: string): Promise<EducationalGame | null> => {
  const { data, error } = await supabase
    .from(EDUCATIONAL_GAMES)
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;

  return {
    id: data.id,
    teacherId: data.teacher_id,
    title: data.title,
    type: data.type,
    content: data.content,
    targetGroup: data.target_group,
    createdAt: data.created_at
  };
};

export const deleteGame = async (gameId: string): Promise<void> => {
  // First delete results
  await supabase.from(GAME_RESULTS).delete().eq('game_id', gameId);
  // Then delete game
  const { error } = await supabase.from(EDUCATIONAL_GAMES).delete().eq('id', gameId);
  if (error) throw error;
};
export const getGameResultsByTeacher = async (teacherId: string): Promise<GameResult[]> => {
  const { data: games } = await supabase
    .from(EDUCATIONAL_GAMES)
    .select('id')
    .eq('teacher_id', teacherId);
  
  const gameIds = (games || []).map(g => g.id);
  if (gameIds.length === 0) return [];

  const { data, error } = await supabase
    .from(GAME_RESULTS)
    .select('*')
    .in('game_id', gameIds)
    .order('completed_at', { ascending: false });
  
  if (error) throw error;

  return (data || []).map((d: any) => ({
    id: d.id,
    gameId: d.game_id,
    studentId: d.student_id,
    studentName: d.student_name,
    score: d.score,
    total: d.total,
    completedAt: d.completed_at
  }));
};
