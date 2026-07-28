// scratch/find-id.js
const https = require('https');

const host = '104.18.38.10';
const hostname = 'frltgnhyvqkjpsdkiove.supabase.co';
const apiKey = 'sb_publishable_PCfsZVI9NNRIE2STA-XS8Q_A74W08DJ';

const makeRequest = (path) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      port: 443,
      path: path,
      method: 'GET',
      servername: hostname,
      headers: {
        'Host': hostname,
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    
    req.on('error', (e) => reject(e));
    req.end();
  });
};

const tables = [
  'teachers',
  'exams',
  'students',
  'attempts',
  'groups',
  'question_bank',
  'notifications',
  'settings',
  'assignments',
  'assignment_submissions',
  'calendar_events',
  'registration_requests',
  'materials',
  'notification_logs',
  'upload_logs',
  'messages',
  'conversations',
  'app_home',
  'educational_games',
  'game_results',
  'attendance_sessions',
  'attendance_records'
];

async function main() {
  const target = 'af12-7fdb0c357904';
  console.log(`Searching for ID "${target}" in all tables...`);
  
  for (const table of tables) {
    try {
      const res = await makeRequest(`/rest/v1/${table}?select=*`);
      if (res.status === 200 && Array.isArray(res.body)) {
        // Search inside rows
        const matched = res.body.filter(row => {
          const str = JSON.stringify(row);
          return str.includes(target);
        });
        
        if (matched.length > 0) {
          console.log(`🔍 Found match in table "${table}":`);
          console.log(JSON.stringify(matched, null, 2));
        }
      } else {
        // Some tables might fail if they don't exist or require schema, skip silently
      }
    } catch (err) {
      // Ignore
    }
  }
  console.log('Search finished.');
}

main();
