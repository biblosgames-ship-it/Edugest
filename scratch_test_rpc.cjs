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
  console.log('Calling RPC validate_invitation_code with DUMMY code...');
  const { data, error } = await supabase.rpc('validate_invitation_code', { p_code: 'DUMMY' });
  console.log('RPC Response:', data, error);
}

test();
