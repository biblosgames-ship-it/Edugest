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

async function search() {
  // 1. Search for students with name "Juan Marcos"
  const { data: juanMarcosStudents, error: err1 } = await supabase
    .from('students')
    .select('id, names, first_surname, second_surname, family_id, school_year, course_id')
    .ilike('names', '%Juan%');

  console.log('--- Students containing "Juan" ---');
  console.log(juanMarcosStudents);

  // 2. Search for students with name containing "Amanda"
  const { data: amandaStudents, error: err2 } = await supabase
    .from('students')
    .select('id, names, first_surname, second_surname, family_id, school_year, course_id')
    .ilike('names', '%Amanda%');

  console.log('--- Students containing "Amanda" ---');
  console.log(amandaStudents);

  // 3. Search for any students sharing the family_id of any found students
  const familyIds = Array.from(new Set([
    ...(juanMarcosStudents || []).map(s => s.family_id),
    ...(amandaStudents || []).map(s => s.family_id)
  ].filter(Boolean)));

  if (familyIds.length > 0) {
    const { data: sharedFamily, error: err3 } = await supabase
      .from('students')
      .select('id, names, first_surname, second_surname, family_id, school_year, course_id')
      .in('family_id', familyIds);

    console.log('--- Students sharing family_id ---');
    console.log(sharedFamily);
  }
}

search();
