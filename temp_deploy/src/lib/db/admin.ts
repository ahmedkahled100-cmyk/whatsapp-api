// src/lib/db/admin.ts
import { supabase } from '@/lib/supabase';
import { 
  TEACHERS, EXAMS, STUDENTS, ATTEMPTS, GROUPS, QBANK,
  NOTIFICATIONS, ASSIGNMENTS, ASSIGN_SUBS, EVENTS,
  REG_REQUESTS, MATERIALS, NOTIFICATION_LOGS, GAME_RESULTS 
} from './constants';

export const wipeAllData = async () => {
  const tablesToWipe = [
    TEACHERS, EXAMS, STUDENTS, ATTEMPTS, GROUPS, QBANK,
    NOTIFICATIONS, ASSIGNMENTS, ASSIGN_SUBS, EVENTS,
    REG_REQUESTS, MATERIALS, NOTIFICATION_LOGS
  ];

  for (const tableName of tablesToWipe) {
    const { error } = await supabase
      .from(tableName)
      .delete()
      .filter('id', 'neq', '00000000-0000-0000-0000-000000000000'); // Delete all rows
    
    if (error) {
      console.error(`Error wiping table ${tableName}:`, error);
    }
  }
};

export const wipeStudentInteraction = async (studentId: string) => {
  // Clear attempts
  await supabase.from(ATTEMPTS).delete().eq('student_id', studentId);
  // Clear assignment submissions
  await supabase.from(ASSIGN_SUBS).delete().eq('student_id', studentId);
  // Clear game results
  await supabase.from(GAME_RESULTS).delete().eq('student_id', studentId);
};
