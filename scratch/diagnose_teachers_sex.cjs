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
    const [cRes, stRes, pRes, tLegacy, aRes] = await Promise.all([
      supabase.from('centers').select('*').limit(1),
      supabase.from('staff').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('teachers').select('*'),
      supabase.from('assignments').select('*')
    ]);

    const centerId = cRes.data[0]?.id;
    console.log('Center ID:', centerId);
    console.log(`Staff count: ${stRes.data?.length}`);
    console.log(`Profiles count: ${pRes.data?.length}`);
    console.log(`Teachers (legacy) count: ${tLegacy.data?.length}`);
    console.log(`Assignments count: ${aRes.data?.length}`);

    // Let's print staff names, gender/sex, and roles
    console.log('\n--- Staff Records ---');
    stRes.data?.forEach(s => {
      console.log(`ID: ${s.id} | Name: ${s.name || s.full_name} | Sex: ${s.sex} | Gender: ${s.gender} | Role: ${s.role || s.team}`);
    });

    console.log('\n--- Profiles Records ---');
    pRes.data?.forEach(p => {
      console.log(`ID: ${p.id} | Name: ${p.full_name} | Sex: ${p.sex} | Gender: ${p.gender} | Role: ${p.role}`);
    });

    console.log('\n--- Teachers Legacy Records ---');
    tLegacy.data?.forEach(t => {
      console.log(`ID: ${t.id} | Name: ${t.name} | Sex: ${t.sex} | Gender: ${t.gender}`);
    });

    console.log('\n--- Assignments ---');
    aRes.data?.forEach(a => {
      console.log(`Assignment ID: ${a.id} | Teacher ID: ${a.teacher_id} | Subject ID: ${a.subject_id}`);
    });
  } catch (err) {
    console.error(err);
  }
}

diagnose();
