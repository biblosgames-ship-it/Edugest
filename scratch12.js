import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDb() {
  const { data: assignments } = await supabase
    .from('assignments')
    .select('hours_per_week, subject_id')
    .eq('course_id', 'afaf970c-b3e2-447c-a098-2484bc09d6c8');
  
  const { data: subjects } = await supabase.from('subjects').select('id, name');
  
  let total = 0;
  assignments.forEach(a => {
    const s = subjects.find(sub => sub.id === a.subject_id);
    console.log(`${s ? s.name : 'Unknown'}: ${a.hours_per_week}h`);
    total += Number(a.hours_per_week);
  });
  console.log('Total Assigned:', total);
}

checkDb();
