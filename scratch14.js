import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function checkDb() {
  const { data: subjects } = await supabase.from('subjects').select('id, name');
  const tcd = subjects.find(s => s.name.toLowerCase().includes('dios') || s.name.toLowerCase().includes('tiempo'));
  console.log('Tiempo con Dios:', tcd);
}

checkDb();
