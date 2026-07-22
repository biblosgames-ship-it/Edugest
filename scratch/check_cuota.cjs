const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config();
const config = JSON.parse(fs.readFileSync('./src/lib/supabase.ts', 'utf8').match(/supabaseUrl = '([^']+)'[\s\S]*supabaseKey = '([^']+)'/)?.[0]?.replace(/supabaseUrl = '([^']+)'/, '{"url":"$1"').replace(/supabaseKey = '([^']+)'/, ',"key":"$1"}') || "{}");
const supabase = createClient(config.url || process.env.VITE_SUPABASE_URL, config.key || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.from('finance_invoices').select('concept, description').or('concept.ilike.%cuota 3%,description.ilike.%cuota 3%,concept.ilike.%cuota 03%,description.ilike.%cuota 03%');
  if (error) console.error(error);
  console.log(JSON.stringify(data, null, 2));
}
run();
