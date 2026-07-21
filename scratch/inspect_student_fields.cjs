const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
const lines = envFile.split('\n');
let url = '', key = '';
for (const line of lines) {
  if (line.trim().startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.trim().startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

const supabase = createClient(url, key);

async function run() {
  const email = `edugens.inspect.${Math.floor(Math.random() * 1000000)}@gmail.com`;
  const password = 'TestPassword123!';

  console.log('Signing up user...');
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Inspector Admin'
      }
    }
  });

  if (signUpError) {
    console.error('Sign up error:', signUpError);
    return;
  }

  const { user } = signUpData;
  console.log('User signed up. UID:', user.id);

  // Sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  if (signInError) {
    console.error('Sign in error:', signInError);
    return;
  }

  console.log('Registering school...');
  const { data: centerId, error: regError } = await supabase.rpc('register_school_saas', {
    p_name: 'Inspection Center'
  });

  if (regError) {
    console.error('Registration error:', regError);
    return;
  }

  console.log('Inserting dummy student to inspect columns...');
  const { data: insertData, error: insertError } = await supabase
    .from('students')
    .insert({
      center_id: centerId,
      first_name: 'Inspection',
      last_name: 'Student',
      sex: 'M'
    })
    .select();

  if (insertError) {
    console.error('Insert error:', insertError);
  } else {
    console.log('Inserted student record keys:', Object.keys(insertData[0]));
    console.log('Full inserted student record:', JSON.stringify(insertData[0], null, 2));
  }
}

run();
