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

async function verify() {
  try {
    // 1. Get a sample teacher record from staff table
    const { data: staff, error: fetchErr } = await supabase.from('staff').select('*').limit(1);
    if (fetchErr || !staff || staff.length === 0) {
      console.error('Error fetching sample staff:', fetchErr);
      return;
    }

    const testTeacher = staff[0];
    const originalSex = testTeacher.sex;
    const originalGender = testTeacher.gender;
    const testId = testTeacher.id;
    const centerId = testTeacher.center_id;

    console.log(`\nOriginal record details: ID: ${testId}, Name: ${testTeacher.name}, Sex: ${originalSex}, Gender: ${originalGender}`);

    // Toggle sex
    const targetSex = originalSex === 'F' ? 'M' : 'F';
    const targetGender = targetSex === 'F' ? 'Femenino' : 'Masculino';
    console.log(`Updating record to target sex: ${targetSex}, gender: ${targetGender}`);

    // 2. Perform upsert (which is the updated mutation logic)
    const { error: upsertErr } = await supabase
      .from('staff')
      .upsert({
        id: testId,
        center_id: centerId,
        sex: targetSex,
        gender: targetGender
      });

    if (upsertErr) {
      console.error('Upsert failed:', upsertErr);
      return;
    }

    // 3. Fetch again to verify
    const { data: updatedStaff, error: refetchErr } = await supabase.from('staff').select('*').eq('id', testId).single();
    if (refetchErr) {
      console.error('Error refetching updated staff:', refetchErr);
      return;
    }

    console.log(`Updated record details: ID: ${updatedStaff.id}, Name: ${updatedStaff.name}, Sex: ${updatedStaff.sex}, Gender: ${updatedStaff.gender}`);

    if (updatedStaff.sex === targetSex && updatedStaff.gender === targetGender) {
      console.log('SUCCESS: Database updated and verified successfully!');
    } else {
      console.error('FAILURE: Values in database do not match target!');
    }

    // 4. Revert back to original values
    console.log('Reverting to original values...');
    const { error: revertErr } = await supabase
      .from('staff')
      .upsert({
        id: testId,
        center_id: centerId,
        sex: originalSex || null,
        gender: originalGender || null
      });

    if (revertErr) {
      console.error('Revert failed:', revertErr);
    } else {
      console.log('Reverted successfully.');
    }

  } catch (err) {
    console.error(err);
  }
}

verify();
