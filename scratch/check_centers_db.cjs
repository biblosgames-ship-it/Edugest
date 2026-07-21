const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Extract supabase url and key from .env
const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
const lines = envFile.split('\n');
let url = '', key = '';
for (const line of lines) {
  if (line.trim().startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.trim().startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

console.log('Using URL:', url);
const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.from('centers').select('*');
  if (error) {
    console.error('Error fetching centers:', error);
  } else {
    console.log('Centers found:', data.length);
    if (data.length > 0) {
      console.log('Fields on first center:', Object.keys(data[0]));
      console.log('Centers data:', JSON.stringify(data, null, 2));
    }
  }
}

test();
