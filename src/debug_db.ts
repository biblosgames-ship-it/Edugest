import { supabase } from './lib/supabase';

async function debug() {
  const { data: teachers, error } = await supabase.from('teachers').select('*');
  console.log('DEBUG TEACHERS:', teachers?.length || 0);
  if (error) console.error('DEBUG ERROR:', error);
}
debug();
