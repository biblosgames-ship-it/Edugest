import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkDb() {
  const { data, error, count } = await supabase.from('schedule_entries').select('id', { count: 'exact' });
  console.log('Count:', count);
}

checkDb();
