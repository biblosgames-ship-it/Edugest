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

async function diagnose() {
  try {
    // 1. Get profiles to find center_id
    const { data: profiles, error: profError } = await supabase.from('profiles').select('*');
    if (profError) throw profError;
    
    console.log('Profiles found:', profiles.map(p => ({ id: p.id, email: p.email, role: p.role, center_id: p.center_id })));
    
    const centerId = profiles[0]?.center_id;
    if (!centerId) {
      console.log('No center_id found in profiles.');
      return;
    }
    
    console.log('Diagnosing for Center ID:', centerId);
    
    // 2. Fetch courses
    const { data: courses, error: coursesError } = await supabase.from('courses').select('*').eq('center_id', centerId);
    if (coursesError) throw coursesError;
    
    console.log(`\n--- Courses (${courses.length}) ---`);
    console.log(courses.map(c => ({ id: c.id, grade: c.grade, section: c.section, level: c.level, tanda: c.tanda })));
    
    // 3. Fetch assignments
    const { data: assignments, error: assignError } = await supabase.from('assignments').select('*').eq('center_id', centerId);
    if (assignError) throw assignError;
    
    console.log(`\n--- Assignments (${assignments.length}) ---`);
    console.log(assignments.map(a => ({ id: a.id, course_id: a.course_id, subject_id: a.subject_id, hours_per_week: a.hours_per_week })));
    
    // 4. Fetch schedule_entries
    const { data: schedule, error: schedError } = await supabase.from('schedule_entries').select('*').eq('center_id', centerId);
    if (schedError) throw schedError;
    
    console.log(`\n--- Schedule Entries (${schedule.length}) ---`);
    console.log(schedule.map(s => ({ id: s.id, course_id: s.course_id, subject_id: s.subject_id, shift: s.shift, school_year: s.school_year })));
    
    // 5. Run the exact calculation logic from ScheduleViewer
    console.log('\n--- Running Coverage Logic for selectedShift: Matutina, selectedYear: 2025-2026 ---');
    runLogic(courses, assignments, schedule, 'Matutina', '2025-2026');
    
    console.log('\n--- Running Coverage Logic for selectedShift: Vespertina, selectedYear: 2025-2026 ---');
    runLogic(courses, assignments, schedule, 'Vespertina', '2025-2026');
    
  } catch (err) {
    console.error('Error during diagnosis:', err);
  }
}

function runLogic(courses, assignments, schedule, selectedShift, selectedYear) {
  let totalAssigned = 0;
  let totalPlaced = 0;
  const coursesWithIssues = [];
  
  const shiftBaseVal = selectedShift.toLowerCase().substring(0, 3);
  const filteredCourses = courses.filter((c) => {
    const tStr = (c.tanda || '').toLowerCase();
    const lvlStr = (c.level || '').toLowerCase();
    if (shiftBaseVal === 'mat') {
      return tStr.includes('mat') || tStr.includes('mañ') || tStr.includes('ext') || tStr.includes('com') || tStr === '' ||
             ((lvlStr.includes('primar') || lvlStr.includes('ini')) && !tStr.includes('ves') && !tStr.includes('tar'));
    } else {
      return tStr.includes('ves') || tStr.includes('tar') || (tStr === '' && lvlStr.includes('secun'));
    }
  });
  
  console.log(`Filtered Courses for ${selectedShift}:`, filteredCourses.map(c => `${c.grade} ${c.section} (ID: ${c.id})`));
  
  filteredCourses.forEach((course) => {
    const courseAssignments = assignments.filter((a) => a.course_id === course.id);
    console.log(`  Course ${course.grade} ${course.section} assignments:`, courseAssignments.length);
    
    courseAssignments.forEach((assign) => {
      const weeklyHours = Number(assign.hours_per_week || assign.hoursPerWeek || assign.weekly_hours) || 0;
      totalAssigned += weeklyHours;
      const placedHours = schedule.filter(
        (s) =>
          s.course_id === course.id &&
          s.subject_id === assign.subject_id &&
          s.shift === selectedShift &&
          s.school_year === selectedYear
      ).length;
      totalPlaced += placedHours;
      console.log(`    Subject ID ${assign.subject_id}: weeklyHours = ${weeklyHours}, placedHours = ${placedHours}`);
      if (placedHours < weeklyHours) {
        if (!coursesWithIssues.includes(`${course.grade} ${course.section}`)) {
          coursesWithIssues.push(`${course.grade} ${course.section}`);
        }
      }
    });
  });
  
  console.log(`Result for ${selectedShift}: totalAssigned = ${totalAssigned}, totalPlaced = ${totalPlaced}, coursesWithIssues =`, coursesWithIssues);
}

diagnose();
