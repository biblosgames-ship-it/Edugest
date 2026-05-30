const { createClient } = require('@supabase/supabase-js');
const url = 'https://zvfdcpfatunkhgcgfddp.supabase.co';
const key = 'sb_publishable_PNG7WdhKMlfvQpvtGcDkLA_dkFGiGFk';
const supabase = createClient(url, key);

async function check() {
  console.log('Fetching facility_areas...');
  const { data: areas, error: areaErr } = await supabase.from('facility_areas').select('*');
  if (areaErr) console.error('Error facility_areas:', areaErr);
  else console.log('facility_areas count:', areas.length, areas);

  console.log('Fetching rooms...');
  const { data: rooms, error: roomErr } = await supabase.from('rooms').select('*');
  if (roomErr) console.error('Error rooms:', roomErr);
  else console.log('rooms count:', rooms.length, rooms);
}

check();
