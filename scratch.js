import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDb() {
  const { data, error } = await supabase.from('schedule_entries').select('id, shift, school_year').limit(10);
  console.log('Entries:', data);
  console.log('Error:', error);
}

checkDb();
