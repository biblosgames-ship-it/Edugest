const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./src/lib/supabase.ts', 'utf8').match(/supabaseUrl = '([^']+)'[\s\S]*supabaseKey = '([^']+)'/)?.[0]?.replace(/supabaseUrl = '([^']+)'/, '{"url":"$1"').replace(/supabaseKey = '([^']+)'/, ',"key":"$1"}') || "{}");
const supabase = createClient(config.url || process.env.VITE_SUPABASE_URL, config.key || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data } = await supabase.from('finance_ledger_entries').select('*').eq('type', 'expense').limit(10);
  console.log(JSON.stringify(data, null, 2));
}
run();
