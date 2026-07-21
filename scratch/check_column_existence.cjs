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
  console.log('Querying slogan column...');
  const { data: dataSlogan, error: errorSlogan } = await supabase
    .from('centers')
    .select('slogan')
    .limit(1);
  console.log('Slogan Query - Error:', errorSlogan);

  console.log('Querying center_code column...');
  const { data: dataCode, error: errorCode } = await supabase
    .from('centers')
    .select('center_code')
    .limit(1);
  console.log('Center Code Query - Error:', errorCode);

  console.log('Querying director_name column...');
  const { data: dataDirector, error: errorDirector } = await supabase
    .from('centers')
    .select('director_name')
    .limit(1);
  console.log('Director Name Query - Error:', errorDirector);

  console.log('Querying secretary_name column...');
  const { data: dataSecretary, error: errorSecretary } = await supabase
    .from('centers')
    .select('secretary_name')
    .limit(1);
  console.log('Secretary Name Query - Error:', errorSecretary);
}

test();
