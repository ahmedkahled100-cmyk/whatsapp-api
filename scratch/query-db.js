// scratch/query-db.js
const https = require('https');

const host = '104.18.38.10';
const hostname = 'frltgnhyvqkjpsdkiove.supabase.co';
const apiKey = 'sb_publishable_PCfsZVI9NNRIE2STA-XS8Q_A74W08DJ';

const makePostRequest = (path, body) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      port: 443,
      path: path,
      method: 'POST',
      servername: hostname,
      headers: {
        'Host': hostname,
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
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
    req.write(JSON.stringify(body));
    req.end();
  });
};

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
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
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

async function main() {
  try {
    console.log('Testing calendar_events insert...');
    const calEvent = {
      id: '272b56a2-72be-4fab-b244-b62ff2007603', // random uuid
      teacher_id: '9b2b56a2-72be-4fab-b244-b62ff2007603',
      title: 'test',
      description: 'test',
      date: '2026-07-09',
      type: 'fixed_class',
      reference_id: 'ref123',
      is_recurring: true,
      recurring_days: [0],
      start_time: '08:00',
      end_time: '10:00',
      created_at: new Date().toISOString()
    };
    
    console.log('Testing assignments columns...');
    const assignCols = ['id', 'teacher_id', 'title', 'description', 'due_date', 'max_score', 'target_group', 'created_at', 'file_url'];
    
    for (const col of assignCols) {
      const res = await makeRequest(`/rest/v1/assignments?select=${col}&limit=1`);
      console.log(`Column ${col}: ${res.status === 400 ? 'MISSING' : 'EXISTS'}`);
    }

    console.log('\nTesting calendar_events columns...');
    const calCols = ['id', 'teacher_id', 'title', 'description', 'date', 'type', 'reference_id', 'is_recurring', 'recurring_days', 'start_time', 'end_time', 'created_at'];
    for (const col of calCols) {
      const res = await makeRequest(`/rest/v1/calendar_events?select=${col}&limit=1`);
      console.log(`Column ${col}: ${res.status === 400 ? 'MISSING' : 'EXISTS'}`);
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

main();
