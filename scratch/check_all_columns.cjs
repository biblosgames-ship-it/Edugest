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
  const columns = [
    'slogan',
    'center_code',
    'email',
    'director_sex',
    'director_name',
    'secretary_sex',
    'secretary_name',
    'district_director_sex',
    'district_director_name',
    'certification_officer_sex',
    'certification_officer_name',
    'municipality'
  ];

  console.log('Testing column existence for all centers table columns...');
  for (const col of columns) {
    const { error } = await supabase.from('centers').select(col).limit(1);
    if (error) {
      console.log(`Column "${col}": MISSING or error:`, error.message);
    } else {
      console.log(`Column "${col}": EXISTS`);
    }
  }
}

test();
