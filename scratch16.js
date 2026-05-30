import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function checkSchema() {
  const { data, error } = await supabase.rpc('get_table_info', { table_name: 'fixed_events' });
  // If rpc fails, just try a limit 1 select
  const { data: sample } = await supabase.from('fixed_events').select('*').limit(1);
  console.log('Sample Fixed Event:', sample);
}

checkSchema();
