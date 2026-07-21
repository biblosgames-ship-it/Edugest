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
  // We try to insert a dummy center with all the properties used in CenterSettingsForm
  console.log('Testing insert on centers with slogan...');
  const { data, error } = await supabase.from('centers').insert({
    name: 'Test Center Scratch',
    slogan: 'Test Slogan',
    center_code: '12345',
    email: 'test@example.com',
    director_name: 'Director Test',
    director_sex: 'M',
    secretary_name: 'Secretary Test',
    secretary_sex: 'F'
  }).select();

  console.log('Insert Result:');
  console.log('Data:', data);
  console.log('Error:', error);
}

test();
