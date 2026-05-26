// src/lib/db/supabase/finances.ts
import { supabase } from '@/lib/supabase';
import type { Transaction } from '@/types';
import { toDB, manyFromDB } from './dbUtils';

export const TRANSACTIONS = 'transactions'; // Supabase table name

export const getTransactions = async (teacherId: string, limit: number = 100): Promise<Transaction[]> => {
  if (!teacherId || teacherId === 'unknown_teacher') return [];
  const { data, error } = await supabase
    .from(TRANSACTIONS)
    .select('*')
    .eq('teacher_id', teacherId)
    .order('date', { ascending: false })
    .limit(limit);
    
  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }
  return manyFromDB<Transaction>(data);
};

export const saveTransaction = async (transaction: Omit<Transaction, 'id'> & { id?: string }): Promise<string> => {
  const newId = transaction.id || crypto.randomUUID();
  const payload = toDB({ ...transaction, id: newId });
  
  const { error } = await supabase
    .from(TRANSACTIONS)
    .upsert([payload], { onConflict: 'id' });
    
  if (error) {
    console.error('Error saving transaction:', error);
    throw error;
  }
  
  return newId;
};

export const deleteTransaction = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from(TRANSACTIONS)
    .delete()
    .eq('id', id);
    
  if (error) {
    console.error('Error deleting transaction:', error);
    throw error;
  }
};
