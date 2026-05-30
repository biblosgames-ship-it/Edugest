import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDb() {
  const { data: entries } = await supabase
    .from('schedule_entries')
    .select('day, start_time, subject_id')
    .eq('course_id', 'afaf970c-b3e2-447c-a098-2484bc09d6c8')
    .order('day')
    .order('start_time');
  
  const { data: subjects } = await supabase.from('subjects').select('id, name');
  
  entries.forEach(e => {
    const s = subjects.find(sub => sub.id === e.subject_id);
    console.log(`${e.day} ${e.start_time} -> ${s ? s.name : 'Unknown'}`);
  });
}

checkDb();
