import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDb() {
  const { data: courses } = await supabase.from('courses').select('id, grade, section, level');
  const primero = courses.filter(c => c.grade.toLowerCase().includes('1ro') || c.grade.toLowerCase().includes('primero'));
  console.log('Primero:', primero);
}

checkDb();
