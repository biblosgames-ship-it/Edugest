const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
const lines = envFile.split('\n');
let url = '', key = '';
for (const line of lines) {
  if (line.trim().startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.trim().startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);

async function run() {
  const sql = `
    SELECT id, name, slogan, center_code FROM public.centers;
  `;

  console.log('Running SQL query via exec_sql...');
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error('Query failed:', error);
  } else {
    console.log('Query result:', data);
  }
}

run();
