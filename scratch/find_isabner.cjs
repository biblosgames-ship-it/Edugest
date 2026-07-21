const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: students, error: err1 } = await supabase.from('students').select('id, names, first_surname, second_surname').limit(500);
  if (err1) {
    console.error('Error fetching students:', err1);
    return;
  }
  
  console.log('Students in DB:', students.map(s => `${s.names} ${s.first_surname} ${s.second_surname}`));
}
run();
