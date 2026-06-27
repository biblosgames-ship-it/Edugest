const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const lines = envFile.split('\n');
let url = '', key = '';
for (const line of lines) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

// We will test the whole flow
// 1. We will insert using the RPC or try to login to insert? No, we don't have login credentials.
// Let's just create a function in Postgres via a trick, or we can see if we can use Supabase CLI to query the DB?
// Is supabase CLI installed?

console.log('Trying to use supabase CLI to execute query');
const { execSync } = require('child_process');
try {
  const result = execSync('npx supabase db psql -c "SELECT code, is_used, center_id FROM public.invitation_codes;"', { encoding: 'utf-8' });
  console.log(result);
} catch (e) {
  console.log('No supabase CLI or DB not linked:', e.message);
}
