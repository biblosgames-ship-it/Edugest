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

async function diagnose() {
  try {
    const { data: profiles } = await supabase.from('profiles').select('*');
    const centerId = profiles[0]?.center_id;
    if (!centerId) return;

    const { data: schoolYears } = await supabase.from('school_years').select('*').eq('center_id', centerId);
    console.log('\n--- School Years ---');
    console.log(schoolYears);

    const { data: schedule } = await supabase.from('schedule_entries').select('*').eq('center_id', centerId);
    const yearsWithEntries = [...new Set(schedule.map(s => s.school_year))];
    console.log('\n--- Years with schedule entries ---');
    console.log(yearsWithEntries);

  } catch (err) {
    console.error(err);
  }
}

diagnose();
