import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

console.log('URL:', supabaseUrl);
console.log('Anon Key length:', supabaseAnonKey.length);

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  console.log('--- Testing insert and query on announcements ---');
  
  // First, let's get the profile of the user to get a valid center_id and id
  const { data: profiles, error: pError } = await supabase
    .from('profiles')
    .select('id, center_id')
    .limit(1);
    
  if (pError || !profiles || profiles.length === 0) {
    console.error('Error fetching a profile for test context:', pError);
    return;
  }
  
  const testProfile = profiles[0];
  console.log('Using profile for test:', testProfile);

  // Now, try inserting a test announcement with __COM_DATA__ format
  const dummyData = {
    center_id: testProfile.center_id,
    sender_id: testProfile.id,
    sender_role: 'admin',
    title: 'Test Motive',
    content: `__COM_DATA__:${JSON.stringify({
      sender_name: 'Test Sender',
      motive: 'Test Motive',
      message: 'Test Message content',
      target_roles: ['Docentes'],
      target_courses: [],
      target_teachers: []
    })}`
  };

  const { data: insertData, error: insertError } = await supabase
    .from('announcements')
    .insert([dummyData])
    .select();

  if (insertError) {
    console.error('Error inserting dummy announcement:', insertError.message);
  } else {
    console.log('Insert announcement success! Inserted:', insertData);
    
    // Now try fetching it back
    const { data: fetchData, error: fetchError } = await supabase
      .from('announcements')
      .select('*')
      .eq('id', insertData[0].id);
      
    if (fetchError) {
      console.error('Error fetching it back:', fetchError.message);
    } else {
      console.log('Fetch back success! Data:', fetchData);
      
      // Clean up the dummy insert
      const { error: deleteError } = await supabase
        .from('announcements')
        .delete()
        .eq('id', insertData[0].id);
        
      if (deleteError) {
        console.error('Error deleting dummy announcement:', deleteError.message);
      } else {
        console.log('Clean up success!');
      }
    }
  }
}

test();
