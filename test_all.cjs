const { createClient } = require('@supabase/supabase-js');
const url = 'https://zvfdcpfatunkhgcgfddp.supabase.co';
const key = 'sb_publishable_PNG7WdhKMlfvQpvtGcDkLA_dkFGiGFk';
const supabase = createClient(url, key);

async function test() {
  const p1 = supabase.from('courses').select('*');
  const p2 = supabase.from('subjects').select('*');
  const p3 = supabase.from('teachers').select('*, profiles(*)');
  const p4 = supabase.from('time_blocks').select('*');
  const p5 = supabase.from('assignments').select('*');
  const p6 = supabase.from('schedule_entries').select('*');
  const p7 = supabase.from('activities').select('*');

  const results = await Promise.all([p1, p2, p3, p4, p5, p6, p7]);
  results.forEach((res, i) => {
    console.log(`Query ${i} error:`, res.error);
  });
}
test();
