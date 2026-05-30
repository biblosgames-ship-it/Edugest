const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const url = 'https://zvfdcpfatunkhgcgfddp.supabase.co';
const key = 'sb_publishable_PNG7WdhKMlfvQpvtGcDkLA_dkFGiGFk';

const supabase = createClient(url, key);
async function test() {
  const { data, error } = await supabase.from('courses').select('*');
  console.log('Got', data?.length, 'courses');
}
test();
