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

async function test() {
  const columns = [
    'birth_certificate_folio',
    'birth_certificate_number',
    'birth_certificate_acta',
    'acta_numero',
    'acta_nacimiento_numero'
  ];

  console.log('Testing column existence for student birth certificate columns...');
  for (const col of columns) {
    const { error } = await supabase.from('students').select(col).limit(1);
    if (error) {
      console.log(`Column "${col}": ERROR - ${error.message}`);
    } else {
      console.log(`Column "${col}": EXISTS (no error)`);
    }
  }
}

test();
