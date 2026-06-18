import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim().replace(/"/g, '');
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim().replace(/"/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const userId = '29e3f95b-8aab-414e-a105-206fa1d3c201';
  
  const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .contains('participants', [userId])
      .order('updated_at', { ascending: false });
      
  console.log('Error:', error);
  console.log('Data using supabase-js:', JSON.stringify(data, null, 2));
}
run();
