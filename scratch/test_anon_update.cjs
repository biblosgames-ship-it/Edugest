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

const supabase = createClient(url, key);

async function test() {
  console.log('Attempting anonymous update on centers table...');
  const { data, error } = await supabase
    .from('centers')
    .update({ name: 'Test Anon Update Name' })
    .eq('id', '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1')
    .select();
  
  console.log('Data:', data);
  console.log('Error:', error);
}

test();
