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

async function run() {
  const sql = `
    DROP POLICY IF EXISTS "Users can read their own center license" ON public.saas_licenses;
    CREATE POLICY "Users can read their own center license"
      ON public.saas_licenses FOR SELECT
      USING (used_by_center = (SELECT center_id FROM public.profiles WHERE id = auth.uid() LIMIT 1));
  `;

  console.log('Running SQL migration via exec_sql...');
  const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
  if (error) {
    console.error('Migration failed:', error);
  } else {
    console.log('Migration completed successfully!', data);
  }
}

run();
