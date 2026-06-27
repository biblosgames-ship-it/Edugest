const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const lines = envFile.split('\n');
let url = '', key = '';
for (const line of lines) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);

async function test() {
  const { data: codes, error: codesErr } = await supabase.from('invitation_codes').select('*').eq('is_used', false);
  console.log('Unused invitation codes in DB:', codes);
  
  if (codes && codes.length > 0) {
    for (const c of codes) {
      console.log(`\nValidating code via RPC: ${c.code}`);
      const { data, error } = await supabase.rpc('validate_invitation_code', { p_code: c.code });
      console.log('RPC Response:', data, error);
    }
  } else {
    console.log('No unused codes found in invitation_codes table.');
  }
}

test();
