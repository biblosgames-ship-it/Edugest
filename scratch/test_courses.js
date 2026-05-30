import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

const envConfig = dotenv.parse(fs.readFileSync('.env'));
const supabase = createClient(envConfig.VITE_SUPABASE_URL, envConfig.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase.from('courses').select('*').limit(1);
  if (error) {
    console.error('Error fetching courses:', error);
  } else if (data && data.length > 0) {
    console.log('Columns in courses table:', Object.keys(data[0]));
  } else {
    console.log('No courses found in database.');
  }
}
test();
