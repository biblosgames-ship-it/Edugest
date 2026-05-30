import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkCourses() {
  const { data } = await supabase.from('courses').select('level, cycle, grade').limit(5);
  console.log('Course levels/cycles:', data);
}

checkCourses();
