const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const lines = envFile.split('\n');
let url = '', key = '';
for (const line of lines) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);

async function check() {
  try {
    const { data: centers, error } = await supabase.from('centers').select('*').limit(1);
    if (error) {
      console.error('Error fetching centers:', error);
      return;
    }
    console.log('Centers columns:', centers);
  } catch (err) {
    console.error(err);
  }
}

check();
