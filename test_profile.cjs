const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env', 'utf-8');
const lines = envFile.split('\n');
let url = '', key = '';
for (const line of lines) {
  if (line.startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  // using SERVICE_ROLE_KEY if available to bypass RLS, or extract from elsewhere?
  // Let's check what variables are in .env
}
console.log(lines);
