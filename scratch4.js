import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDb() {
  const { data, error } = await supabase.from('schedule_entries').select('course_id, subject_id, teacher_id, day, start_time').limit(3);
  console.log('Entries:', JSON.stringify(data, null, 2));
}

checkDb();
