const XLSX = require('xlsx');

const filePath = '/Users/juancarlos/.gemini/antigravity/brain/a19d5280-d6ec-4b77-8b7e-a1ae41f25e9a/.user_uploaded/media_1791784220732.xlsx';
const wb = XLSX.readFile(filePath);
const wsSec = wb.Sheets['Horario-Seccion'];
const d = XLSX.utils.sheet_to_json(wsSec, { header: 1 });

const periods = [
  { rowOffset: 4, name: '8:15am-9:00am' },
  { rowOffset: 5, name: '9:00am-9:45am' },
  { rowOffset: 7, name: '10:15am-11:00am' },
  { rowOffset: 8, name: '11:00am-11:45am' },
  { rowOffset: 10, name: '12:45pm-1:30pm' },
  { rowOffset: 11, name: '1:30pm-2:15pm' },
  { rowOffset: 13, name: '2:30pm-3:15pm' },
  { rowOffset: 14, name: '3:15pm-4:00pm' }
];

const days = ['Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes'];

const blocks = [
  // Block 1 (Section A): header row 3, days row 4, start period row 5
  { grade: '6to', sec: 'A', name: '6to. A', dayRow: 4, startCol: 4 },
  { grade: '5to', sec: 'A', name: '5to. A', dayRow: 4, startCol: 13 },
  { grade: '4to', sec: 'A', name: '4to. A', dayRow: 4, startCol: 22 },
  { grade: '3ero', sec: 'A', name: '3ero. A', dayRow: 4, startCol: 32 },
  { grade: '2do', sec: 'A', name: '2do. A', dayRow: 4, startCol: 42 },
  { grade: '1ero', sec: 'A', name: '1ero. A', dayRow: 4, startCol: 53 },

  // Block 2 (Section B): header row 22, days row 23
  { grade: '6to', sec: 'B', name: '6to. B', dayRow: 23, startCol: 4 },
  { grade: '5to', sec: 'B', name: '5to. B', dayRow: 23, startCol: 13 },
  { grade: '4to', sec: 'B', name: '4to. B', dayRow: 23, startCol: 22 },
  { grade: '3ero', sec: 'B', name: '3ro. B', dayRow: 23, startCol: 32 },
  { grade: '2do', sec: 'B', name: '2do. B', dayRow: 23, startCol: 42 },
  { grade: '1ero', sec: 'B', name: '1ero. B', dayRow: 23, startCol: 53 },

  // Block 3 (Section C): header row 41, days row 42
  { grade: '6to', sec: 'D', name: '6to. D', dayRow: 42, startCol: 4 },
  { grade: '5to', sec: 'C', name: '5to. C', dayRow: 42, startCol: 13 },
  { grade: '4to', sec: 'C', name: '4to. C', dayRow: 42, startCol: 22 },
  { grade: '3ero', sec: 'C', name: '3ero. C', dayRow: 42, startCol: 32 },
  { grade: '2do', sec: 'C', name: '2do. C', dayRow: 42, startCol: 42 },
  { grade: '1ero', sec: 'C', name: '1ero. C', dayRow: 42, startCol: 53 },

  // Block 4 (Section D & 6to C):
  { grade: '6to', sec: 'C', name: '6to. C', dayRow: 62, startCol: 4 },
  { grade: '4to', sec: 'D', name: '4to. D', dayRow: 61, startCol: 22 },
  { grade: '3ero', sec: 'D', name: '3ero. D', dayRow: 61, startCol: 32 },
  { grade: '2do', sec: 'D', name: '2do. D', dayRow: 61, startCol: 42 },
  { grade: '1ero', sec: 'D', name: '1ero. D', dayRow: 61, startCol: 53 },

  // Block 5 (Section E):
  { grade: '1ero', sec: 'E', name: '1ero. E', dayRow: 82, startCol: 53 }
];

const courseAssignments = [];

for (const b of blocks) {
  const mapPerCourse = {};
  for (let dIdx = 0; dIdx < 5; dIdx++) {
    const col = b.startCol + dIdx;
    const day = days[dIdx];
    for (const p of periods) {
      const r = b.dayRow + 1 + p.rowOffset;
      const cellVal = d[r] ? String(d[r][col] || '').trim() : '';
      if (!cellVal) continue;

      // Extract subject and teacher
      // Example: 'Español (Idaliza)'
      // 'Apreciasion y p. literari, Ingles (Wilkin)'
      let materia = cellVal;
      let docente = 'Por Asignar';

      const match = cellVal.match(/^(.*?)\s*\((.*?)\)(.*)$/);
      if (match) {
        materia = (match[1] + match[3]).trim();
        docente = match[2].trim();
      }

      const key = `${docente}___${materia}`;
      if (!mapPerCourse[key]) {
        mapPerCourse[key] = {
          grade: b.grade,
          sec: b.sec,
          course: b.name,
          docente: docente,
          materia: materia,
          horas: 0,
          rawExamples: new Set()
        };
      }
      mapPerCourse[key].horas++;
      mapPerCourse[key].rawExamples.add(cellVal);
    }
  }

  for (const item of Object.values(mapPerCourse)) {
    courseAssignments.push(item);
  }
}

console.log('Total course assignments extracted in 2026-2027:', courseAssignments.length);

// Print summary by Grade
const byGrade = {};
for (const a of courseAssignments) {
  if (!byGrade[a.grade]) byGrade[a.grade] = 0;
  byGrade[a.grade] += a.horas;
}
console.log('Weekly hours by Grade (each course = 40h):', byGrade);

// Top teachers by total hours
const byTeacher = {};
for (const a of courseAssignments) {
  if (!byTeacher[a.docente]) byTeacher[a.docente] = { horas: 0, cursos: new Set() };
  byTeacher[a.docente].horas += a.horas;
  byTeacher[a.docente].cursos.add(a.course);
}

console.log('\nTop 20 Teachers by total weekly workload:');
Object.entries(byTeacher)
  .sort((a, b) => b[1].horas - a[1].horas)
  .slice(0, 20)
  .forEach(([t, info]) => {
    console.log(`  ${t.padEnd(25)}: ${info.horas} horas semanales (en ${Array.from(info.cursos).join(', ')})`);
  });
