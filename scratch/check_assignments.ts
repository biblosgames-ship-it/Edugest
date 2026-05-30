import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function check() {
  console.log('--- DIAGNÓSTICO DE BASE DE DATOS ---');
  const { data: assignments, error } = await supabase.from('assignments').select('*');
  if (error) console.error('Error assignments:', error);
  console.log('ASIGNACIONES EN DB:', assignments?.length || 0);
  
  const { data: teachers } = await supabase.from('teachers').select('id, name');
  console.log('DOCENTES EN DB:', teachers?.length || 0);
  
  const { data: courses } = await supabase.from('courses').select('id, level, grade');
  console.log('CURSOS EN DB:', courses?.length || 0);
}

check();
