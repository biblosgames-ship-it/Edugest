const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://zvfdcpfatunkhgcgfddp.supabase.co';
const supabaseAnonKey = 'sb_publishable_PNG7WdhKMlfvQpvtGcDkLA_dkFGiGFk';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const targetCid = '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1';

async function run() {
  const { data: reqs } = await supabase.from('academic_requirements').select('*').eq('center_id', targetCid);
  console.log('Total academic_requirements in Génesis:', reqs?.length);
  if (reqs && reqs.length > 0) {
    console.log('Sample academic_requirement:', reqs[0]);
  }
}

run();
