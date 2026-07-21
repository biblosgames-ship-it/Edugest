const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Extract supabase url and key from .env
const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
const lines = envFile.split('\n');
let url = '', key = '';
for (const line of lines) {
  if (line.trim().startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.trim().startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);

async function test() {
  console.log('Querying information_schema.columns for centers table...');
  // Since pg_catalog and information_schema might be exposed via RPC or REST if configured,
  // let's try querying information_schema.columns via PostgREST.
  // Wait! PostgREST by default does NOT expose information_schema, but let's see if we get an error or data.
  const { data, error } = await supabase.from('information_schema.columns').select('*');
  console.log('Direct query result:', data, error);
}

test();
