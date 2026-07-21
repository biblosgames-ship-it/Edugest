const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
async function run() {
  const { data: plans, error } = await supabase.from('finance_payment_plans').select('*');
  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Plans:', plans);
  }
}
run();
