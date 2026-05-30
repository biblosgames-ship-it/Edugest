import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDb() {
  const { data: subjects, error: sErr } = await supabase.from('subjects').select('id, name');
  const lecto = subjects.find(s => s.name.toLowerCase().includes('lecto'));
  if (!lecto) return console.log('No lecto found');
  console.log('Lecto subject:', lecto);
  
  const { data: entries, error: eErr } = await supabase.from('schedule_entries').select('*').eq('subject_id', lecto.id);
  console.log('Entries for lecto:', entries);
}

checkDb();
