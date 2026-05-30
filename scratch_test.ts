import { supabase } from './src/lib/supabase';

async function testQuery() {
  const { data, error } = await supabase.from('students').select('*').limit(1);
  console.log('Data:', data);
  console.log('Error:', error);
}

testQuery();
