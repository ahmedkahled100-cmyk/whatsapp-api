const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf-8') + '\n' + fs.readFileSync('.env', 'utf-8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/"/g, '');
const SUPABASE_KEY = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/"/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const userId = '29e3f95b-8aab-414e-a105-206fa1d3c201';
  
  const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .contains('participants', JSON.stringify([userId]))
      .order('updated_at', { ascending: false });
      
  console.log('Error:', error);
  console.log('Data count:', data?.length);
}
run().catch(console.error);
