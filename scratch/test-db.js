const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envText = fs.readFileSync('.env.local', 'utf-8') + '\n' + fs.readFileSync('.env', 'utf-8');
const SUPABASE_URL = envText.match(/NEXT_PUBLIC_SUPABASE_URL="(.*?)"/)?.[1] || envText.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim().replace(/"/g, '');
const SUPABASE_KEY = envText.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY="(.*?)"/)?.[1] || envText.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim().replace(/"/g, '');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: teachers, error: err } = await supabase.from('teachers').select('*');
  console.log('--- Teachers ---');
  console.log('Error:', err);
  if (teachers) {
    teachers.forEach(t => {
      console.log(`ID: ${t.id}, Name: ${t.name}, Role: ${t.role}, Phone: ${t.phone}`);
    });
  }
}

run().catch(console.error);
