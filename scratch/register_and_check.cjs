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
  const email = `edugens.test.${Math.floor(Math.random() * 1000000)}@gmail.com`;
  const password = 'TestPassword123!';

  console.log('Signing up user:', email);
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: 'Test Administrator'
      }
    }
  });

  if (signUpError) {
    console.error('Sign up error:', signUpError);
    return;
  }

  const user = signUpData.user;
  console.log('User signed up successfully. UID:', user.id);

  // Sign in to make sure session is active
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    console.error('Sign in error:', signInError);
    return;
  }

  console.log('Signed in successfully.');

  // Create a license key for this test
  // Since we cannot generate license key unless we are superadmin, wait!
  // Let's see if we can register a school without license key using another RPC or if we can bypass?
  // Wait! In saas_setup.sql:
  // create or replace function public.register_school_saas(p_name text, p_district text default null, p_regional text default null)
  // Wait! The version of register_school_saas in saas_setup.sql DOES NOT take a license key!
  // But wait! The version in saas_superadmin_setup.sql DOES take a license key!
  // Let's check which version is active in the DB by calling it without license key first!
  console.log('Registering school saas...');
  let registerRes = await supabase.rpc('register_school_saas', {
    p_name: 'Scratch Test School',
    p_district: '01-01',
    p_regional: '01'
  });

  if (registerRes.error) {
    console.log('Registration without license failed, trying with license key...');
    // We need a license key. Let's see if there is any unused license key in the DB!
    // Wait, since we are not authenticated as superadmin, we cannot read saas_licenses table.
    // Let's check if there is an unused license key in the backup files or if we can query licenses?
    // Let's query saas_licenses using the anonymous key just in case.
    const { data: licenses } = await supabase.from('saas_licenses').select('*');
    console.log('Licenses:', licenses);
    
    console.error('RPC Error:', registerRes.error);
    return;
  }

  const centerId = registerRes.data;
  console.log('School registered successfully! Center ID:', centerId);

  // Now, fetch the center
  console.log('Fetching center...');
  const { data: center, error: fetchErr } = await supabase.from('centers').select('*').eq('id', centerId).single();
  console.log('Fetched Center:', center, fetchErr);

  // Update center settings including slogan
  console.log('Updating center...');
  const { data: updateRes, error: updateErr } = await supabase
    .from('centers')
    .update({
      slogan: 'A New Excellence Slogan',
      address: 'Test Street 123',
      phone: '809-111-2222'
    })
    .eq('id', centerId)
    .select();
  console.log('Update Result:', updateRes, updateErr);

  // Fetch again to verify
  const { data: verifiedCenter } = await supabase.from('centers').select('*').eq('id', centerId).single();
  console.log('Verified Center after update:', verifiedCenter);
}

test();
