const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Extract supabase url and key from .env
const envFile = fs.readFileSync('.env', 'utf-8');
const lines = envFile.split('\n');
let url = '', key = '';
for (const line of lines) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);

async function test() {
  const { data, error } = await supabase.from('profiles').select('*');
  console.log('Profiles:', data, error);
}

test();
