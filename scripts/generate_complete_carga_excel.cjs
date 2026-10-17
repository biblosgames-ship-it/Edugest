const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const inputFile = '/Users/juancarlos/.gemini/antigravity/brain/a19d5280-d6ec-4b77-8b7e-a1ae41f25e9a/.user_uploaded/media_1791784220732.xlsx';
const outputFile = '/Users/juancarlos/Documents/edugens (2)/Carga_Academica_Docente_Liceo_Antonio_Desi.xlsx';

const wbIn = XLSX.readFile(inputFile);

// -------------------------------------------------------------
// 1. DICTIONARY OF TEACHERS (Alias -> Full Name & Area)
// -------------------------------------------------------------
const teacherDict = {
  'bartolo': { name: 'Bartolo Santana', area: 'Matemática' },
  'maxima': { name: 'Máxima Peguero', area: 'Ciencias Sociales' },
  'johanny': { name: 'Johanny Encarnación', area: 'Ciencias Naturales' },
  'reina': { name: 'Reina Vilorio', area: 'Lengua Española / Apoyo' },
  'zalazar': { name: 'Zalazar', area: 'Lengua Española' },
  'greimi': { name: 'Greimy Mercedes', area: 'Lengua Española' },
  'greimy': { name: 'Greimy Mercedes', area: 'Lengua Española' },
  'wilkin': { name: 'Wilkin Marfte', area: 'Lenguas Extranjeras (Inglés)' },
  'jazmin': { name: 'Jazmín', area: 'Matemática' },
  'olga': { name: 'Olga Castillo', area: 'Ciencias Sociales / Arte' },
  'amalia': { name: 'Rosa Amalia', area: 'Ciencias Naturales' },
  'virginia': { name: 'Virginia', area: 'Lengua Española' },
  'virginuia': { name: 'Virginia', area: 'Lengua Española' },
  'juan carlos': { name: 'Juan Carlos', area: 'Lenguas Extranjeras (Francés/Inglés)' },
  'luis': { name: 'Luis Mercedes', area: 'Matemática' },
  'omar': { name: 'Omar Castillo', area: 'Ciencias Sociales / Arte' },
  'ana': { name: 'Ana Rosmeri', area: 'Ciencias Naturales' },
  'blanca': { name: 'Blanca Pion', area: 'Lengua Española' },
  'nelsido': { name: 'Nelsido Batiste', area: 'Lenguas Extranjeras' },
  'angela': { name: 'Angela Pontier', area: 'Matemática' },
  'sonia': { name: 'Sonia Susaña', area: 'Ciencias Sociales / Arte' },
  'somia': { name: 'Sonia Susaña', area: 'Ciencias Sociales / Arte' },
  'yenifer': { name: 'Yenifer', area: 'Ciencias Naturales / Biología' },
  'trinidad': { name: 'Trinidad', area: 'Formación Humana y Religiosa' },
  'yajaira': { name: 'Yajaira Cornelio', area: 'Lengua Española' },
  'milgia': { name: 'Milgia', area: 'Lenguas Extranjeras (Inglés/Francés)' },
  'yokasta': { name: 'Yokasta Alvarez', area: 'Matemática' },
  'sofis': { name: 'Sofis', area: 'Ciencias Sociales / Moral y Cívica' },
  'sorfis': { name: 'Sofis', area: 'Ciencias Sociales / Moral y Cívica' },
  'sifis': { name: 'Sofis', area: 'Ciencias Sociales / Moral y Cívica' },
  'jessenia': { name: 'Jessenia Rojas', area: 'Ciencias Naturales / Química' },
  'idaliza': { name: 'Idaliza Gil', area: 'Lengua Española' },
  'jose luis': { name: 'José Luis Peguero', area: 'Matemática' },
  'jose luis p': { name: 'José Luis Peguero', area: 'Matemática' },
  'yolanda': { name: 'Yolanda Reyes', area: 'Ciencias Sociales / Arte' },
  'grely': { name: 'Grely Solano', area: 'Ciencias Naturales / Física' },
  'grelin': { name: 'Grely Solano', area: 'Ciencias Naturales / Física' },
  'chery': { name: 'Chery Hernandes', area: 'Lenguas Extranjeras (Francés/Inglés)' },
  'cheri': { name: 'Chery Hernandes', area: 'Lenguas Extranjeras (Francés/Inglés)' },
  'cherry': { name: 'Chery Hernandes', area: 'Lenguas Extranjeras (Francés/Inglés)' },
  'carmen': { name: 'Carmen', area: 'Educación Física / Deporte' },
  'edwin': { name: 'Edwin', area: 'Educación Física / Deporte' },
  'junior': { name: 'Junior', area: 'Educación Física / Deporte' },
  'deporte-i': { name: 'Deporte-I (Educ. Física)', area: 'Educación Física / Deporte' },
  'depote ii': { name: 'Deporte-II (Educ. Física)', area: 'Educación Física / Deporte' },
  'xxxxx': { name: 'Docente Por Designar (XXXXX)', area: 'Ciencias Naturales / General' },
  'xxxxxx': { name: 'Docente Por Designar (XXXXXX)', area: 'Lengua Española' },
  'xxxx': { name: 'Docente Por Designar (XXXX)', area: 'Formación Humana y Religiosa' },
  'xxx': { name: 'Docente Por Designar (XXX)', area: 'Matemática' }
};

function normalizeTeacher(rawDoc) {
  if (!rawDoc) return { name: 'Sin Asignar', area: 'General' };
  let clean = rawDoc.toLowerCase().trim().replace(/[\.\,\-]/g, ' ').replace(/\s+/g, ' ');
  if (clean.includes('juna carlos')) clean = clean.replace('juna carlos', 'juan carlos');
  
  // 1. Exact match first
  if (teacherDict[clean]) return teacherDict[clean];

  // 2. Sorted keys by length descending to match longest specific phrases first (e.g. 'jose luis' before 'luis')
  const keysByLen = Object.keys(teacherDict).sort((a, b) => b.length - a.length);
  for (const k of keysByLen) {
    if (clean === k || clean.includes(k) || (clean.length > 3 && k.includes(clean))) {
      return teacherDict[k];
    }
  }
  return { name: rawDoc.trim(), area: 'General' };
}

function cleanSubjectName(rawMat) {
  let s = (rawMat || '').trim();
  s = s.replace(/[\-\d]+$/, '').trim(); // Remove trailing -1, -2
  if (s.toLowerCase().includes('aprec') && s.toLowerCase().includes('ingles')) return 'Apreciación Literaria e Inglés';
  if (s.toLowerCase().includes('aprec') && s.toLowerCase().includes('literari')) return 'Apreciación y Producción Literaria';
  if (s.toLowerCase().includes('trigonometria')) return 'Trigonometría y Cálculo Diferencial';
  if (s.toLowerCase().includes('matematica finaciera')) return 'Matemática Financiera y Tecnología';
  if (s.toLowerCase().includes('fisica y computacion')) return 'Física y Computación';
  if (s.toLowerCase().includes('quimica y computacion')) return 'Química y Computación';
  if (s.toLowerCase().includes('biologia y coputacion') || s.toLowerCase().includes('biologia y computacion')) return 'Biología y Computación';
  if (s.toLowerCase().includes('filosofia social')) return 'Filosofía Social y Pensamiento Dominicano';
  if (s.toLowerCase().includes('geografia humana')) return 'Geografía Humana y Demografía';
  if (s.toLowerCase().includes('ciudadania y democracia')) return 'Ciudadanía y Democracia';
  if (s.toLowerCase().includes('moral y civica')) return 'Moral y Cívica';
  if (s.toLowerCase().includes('formacion h')) return 'Formación Humana y Religiosa';
  if (s.toLowerCase().includes('educ. artistica') || s.toLowerCase().includes('artistica')) return 'Educación Artística';
  if (s.toLowerCase().includes('educ. fisica') || s.toLowerCase().includes('fisica')) return 'Educación Física';
  if (s.toLowerCase().includes('frances')) return 'Lengua Extranjera (Francés)';
  if (s.toLowerCase().includes('ingles')) return 'Lengua Extranjera (Inglés)';
  if (s.toLowerCase().includes('sociales')) return 'Ciencias Sociales';
  if (s.toLowerCase().includes('naturales')) return 'Ciencias Naturales';
  if (s.toLowerCase().includes('matematica')) return 'Matemática';
  if (s.toLowerCase().includes('español')) return 'Lengua Española';
  return s;
}

// -------------------------------------------------------------
// 2. PARSE PROYECCION 2026-2027 (from Horario-Seccion)
// -------------------------------------------------------------
const wsSec = wbIn.Sheets['Horario-Seccion'];
const dSec = XLSX.utils.sheet_to_json(wsSec, { header: 1 });

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

const blocks2026 = [
  // Block 1 (Section A): row 4
  { gradeNum: '6to', sec: 'A', name: '6to. A', dayRow: 4, startCol: 4 },
  { gradeNum: '5to', sec: 'A', name: '5to. A', dayRow: 4, startCol: 13 },
  { gradeNum: '4to', sec: 'A', name: '4to. A', dayRow: 4, startCol: 22 },
  { gradeNum: '3ero', sec: 'A', name: '3ero. A', dayRow: 4, startCol: 32 },
  { gradeNum: '2do', sec: 'A', name: '2do. A', dayRow: 4, startCol: 42 },
  { gradeNum: '1ero', sec: 'A', name: '1ero. A', dayRow: 4, startCol: 53 },

  // Block 2 (Section B): row 23
  { gradeNum: '6to', sec: 'B', name: '6to. B', dayRow: 23, startCol: 4 },
  { gradeNum: '5to', sec: 'B', name: '5to. B', dayRow: 23, startCol: 13 },
  { gradeNum: '4to', sec: 'B', name: '4to. B', dayRow: 23, startCol: 22 },
  { gradeNum: '3ero', sec: 'B', name: '3ro. B', dayRow: 23, startCol: 32 },
  { gradeNum: '2do', sec: 'B', name: '2do. B', dayRow: 23, startCol: 42 },
  { gradeNum: '1ero', sec: 'B', name: '1ero. B', dayRow: 23, startCol: 53 },

  // Block 3 (Section C/D): row 42
  { gradeNum: '6to', sec: 'D', name: '6to. D', dayRow: 42, startCol: 4 },
  { gradeNum: '5to', sec: 'C', name: '5to. C', dayRow: 42, startCol: 13 },
  { gradeNum: '4to', sec: 'C', name: '4to. C', dayRow: 42, startCol: 22 },
  { gradeNum: '3ero', sec: 'C', name: '3ero. C', dayRow: 42, startCol: 32 },
  { gradeNum: '2do', sec: 'C', name: '2do. C', dayRow: 42, startCol: 42 },
  { gradeNum: '1ero', sec: 'C', name: '1ero. C', dayRow: 42, startCol: 53 },

  // Block 4 (Section D & 6to C): row 61 & 62
  { gradeNum: '6to', sec: 'C', name: '6to. C', dayRow: 62, startCol: 4 },
  { gradeNum: '4to', sec: 'D', name: '4to. D', dayRow: 61, startCol: 22 },
  { gradeNum: '3ero', sec: 'D', name: '3ero. D', dayRow: 61, startCol: 32 },
  { gradeNum: '2do', sec: 'D', name: '2do. D', dayRow: 61, startCol: 42 },
  { gradeNum: '1ero', sec: 'D', name: '1ero. D', dayRow: 61, startCol: 53 },

  // Block 5 (Section E): row 82
  { gradeNum: '1ero', sec: 'E', name: '1ero. E', dayRow: 82, startCol: 53 }
];

const assignments2026 = [];
for (const b of blocks2026) {
  const courseMap = {};
  for (let dIdx = 0; dIdx < 5; dIdx++) {
    const col = b.startCol + dIdx;
    const dayName = days[dIdx];
    for (const p of periods) {
      const r = b.dayRow + 1 + p.rowOffset;
      const cellVal = dSec[r] ? String(dSec[r][col] || '').trim() : '';
      if (!cellVal) continue;

      let rawMateria = cellVal;
      let rawDocente = '';
      const match = cellVal.match(/^(.*?)\s*\((.*?)\)(.*)$/);
      if (match) {
        rawMateria = (match[1] + match[3]).trim();
        rawDocente = match[2].trim();
      }

      const tObj = normalizeTeacher(rawDocente);
      const matClean = cleanSubjectName(rawMateria);
      const key = `${tObj.name}___${matClean}`;

      if (!courseMap[key]) {
        courseMap[key] = {
          year: '2026-2027',
          grade: b.gradeNum,
          sec: b.sec,
          course: `${b.gradeNum} de Sec. ${b.sec}`,
          courseShort: b.name,
          rawDocente: rawDocente,
          teacherName: tObj.name,
          teacherArea: tObj.area,
          subject: matClean,
          rawSubject: rawMateria,
          hours: 0,
          daysMap: {}
        };
      }
      courseMap[key].hours++;
      courseMap[key].daysMap[dayName] = (courseMap[key].daysMap[dayName] || 0) + 1;
    }
  }

  for (const item of Object.values(courseMap)) {
    assignments2026.push(item);
  }
}

// -------------------------------------------------------------
// 3. PARSE HORARIO 2024-2025 (from General)
// -------------------------------------------------------------
const wsGen = wbIn.Sheets['General'];
const dGen = XLSX.utils.sheet_to_json(wsGen, { header: 1 });

const daysGenRows = [
  { day: 'Lunes', row: 5 },
  { day: 'Martes', row: 22 },
  { day: 'Miercoles', row: 39 },
  { day: 'Jueves', row: 56 },
  { day: 'Viernes', row: 73 }
];
const genPeriodOffsets = [5, 6, 8, 9, 11, 12, 14, 15];
const coursesRowGen = dGen[6];

const assignments2024 = [];
const genCourseMap = {};

for (const dObj of daysGenRows) {
  for (const off of genPeriodOffsets) {
    const r = dObj.row + off;
    const row = dGen[r] || [];
    for (let c = 2; c < row.length; c++) {
      const cHeader = coursesRowGen[c];
      const cellVal = row[c] ? String(row[c]).trim() : '';
      if (!cHeader || !cellVal) continue;

      let rawMateria = cellVal;
      let rawDocente = '';
      const match = cellVal.match(/^(.*?)\s*\((.*?)\)(.*)$/);
      if (match) {
        rawMateria = (match[1] + match[3]).trim();
        rawDocente = match[2].trim();
      }

      const tObj = normalizeTeacher(rawDocente);
      const matClean = cleanSubjectName(rawMateria);
      const key = `${cHeader}___${tObj.name}___${matClean}`;

      // Extract grade and sec from cHeader (e.g. '1ero A', '4to. A (H. y L. Modernas)')
      let g = '1ero';
      let s = 'A';
      const gMatch = String(cHeader).match(/^([1-6](?:ero|do|ro|to)?)\.?\s*([A-E])/i);
      if (gMatch) {
        g = gMatch[1];
        s = gMatch[2].toUpperCase();
      }

      if (!genCourseMap[key]) {
        genCourseMap[key] = {
          year: '2024-2025',
          grade: g,
          sec: s,
          course: `${g} de Sec. ${s}`,
          courseShort: cHeader,
          rawDocente: rawDocente,
          teacherName: tObj.name,
          teacherArea: tObj.area,
          subject: matClean,
          rawSubject: rawMateria,
          hours: 0
        };
      }
      genCourseMap[key].hours++;
    }
  }
}

for (const item of Object.values(genCourseMap)) {
  assignments2024.push(item);
}

// Sort orders
const gradeOrder = { '1ero': 1, '2do': 2, '3ero': 3, '3ro': 3, '4to': 4, '5to': 5, '6to': 6 };
const secOrder = { 'A': 1, 'B': 2, 'C': 3, 'D': 4, 'E': 5 };

assignments2026.sort((a, b) => {
  const gDiff = (gradeOrder[a.grade] || 9) - (gradeOrder[b.grade] || 9);
  if (gDiff !== 0) return gDiff;
  const sDiff = (secOrder[a.sec] || 9) - (secOrder[b.sec] || 9);
  if (sDiff !== 0) return sDiff;
  return a.subject.localeCompare(b.subject);
});

assignments2024.sort((a, b) => {
  const gDiff = (gradeOrder[a.grade] || 9) - (gradeOrder[b.grade] || 9);
  if (gDiff !== 0) return gDiff;
  const sDiff = (secOrder[a.sec] || 9) - (secOrder[b.sec] || 9);
  if (sDiff !== 0) return sDiff;
  return a.subject.localeCompare(b.subject);
});

// -------------------------------------------------------------
// 4. PREPARE WORKBOOK SHEETS
// -------------------------------------------------------------
const wbOut = XLSX.utils.book_new();

// SHEET 1: Carga 2026-2027 por Grados y Secciones
const sheet1Rows = [
  ['LICEO PROF. ANTONIO DESÍ - CARGA ACADÉMICA DOCENTE POR GRADOS Y SECCIONES (2026-2027)'],
  ['Grado', 'Sección', 'Aula / Curso', 'Asignatura / Materia', 'Docente Asignado', 'Área Curricular', 'Horas Semanales (45 min)', 'Distribución Semanal']
];

let currGrade = '';
for (const a of assignments2026) {
  const daysStr = Object.entries(a.daysMap).map(([d, h]) => `${d}: ${h}h`).join(', ');
  sheet1Rows.push([
    a.grade,
    a.sec,
    a.course,
    a.subject,
    a.teacherName,
    a.teacherArea,
    a.hours,
    daysStr
  ]);
}
const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
ws1['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 35 }, { wch: 28 }, { wch: 25 }, { wch: 24 }, { wch: 40 }];
XLSX.utils.book_append_sheet(wbOut, ws1, 'Carga por Grados (2026-27)');

// SHEET 2: Carga 2026-2027 por Docentes
const sheet2Rows = [
  ['LICEO PROF. ANTONIO DESÍ - CARGA ACADÉMICA ORGANIZADA POR DOCENTE (2026-2027)'],
  ['Docente', 'Área Curricular', 'Asignatura Impartida', 'Grado', 'Sección', 'Curso Completo', 'Horas Semanales']
];

const teacherGroups2026 = {};
for (const a of assignments2026) {
  if (!teacherGroups2026[a.teacherName]) {
    teacherGroups2026[a.teacherName] = { area: a.teacherArea, totalHours: 0, items: [] };
  }
  teacherGroups2026[a.teacherName].totalHours += a.hours;
  teacherGroups2026[a.teacherName].items.push(a);
}

const sortedTeachers = Object.keys(teacherGroups2026).sort();
for (const tName of sortedTeachers) {
  const group = teacherGroups2026[tName];
  group.items.sort((x, y) => {
    const gd = (gradeOrder[x.grade] || 9) - (gradeOrder[y.grade] || 9);
    if (gd !== 0) return gd;
    return (secOrder[x.sec] || 9) - (secOrder[y.sec] || 9);
  });
  for (const it of group.items) {
    sheet2Rows.push([
      it.teacherName,
      it.teacherArea,
      it.subject,
      it.grade,
      it.sec,
      it.course,
      it.hours
    ]);
  }
  sheet2Rows.push([`TOTAL ${tName}`, '', '', '', '', '', group.totalHours]);
  sheet2Rows.push(['', '', '', '', '', '', '']); // empty separator
}
const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
ws2['!cols'] = [{ wch: 28 }, { wch: 25 }, { wch: 35 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 16 }];
XLSX.utils.book_append_sheet(wbOut, ws2, 'Carga por Docentes (2026-27)');

// SHEET 3: Matriz Docente vs Grados (Resumen de horas)
const sheet3Rows = [
  ['LICEO PROF. ANTONIO DESÍ - MATRIZ RESUMEN DE CARGA HORARIA DOCENTE POR GRADO (2026-2027)'],
  ['No.', 'Docente', 'Área Curricular', '1ero Sec.', '2do Sec.', '3ero Sec.', '4to Sec.', '5to Sec.', '6to Sec.', 'Total Horas Semanales', 'Cursos / Secciones Asignadas']
];

let tIdx = 1;
for (const tName of sortedTeachers) {
  const group = teacherGroups2026[tName];
  const gHours = { '1ero': 0, '2do': 0, '3ero': 0, '4to': 0, '5to': 0, '6to': 0 };
  const coursesSet = new Set();
  for (const it of group.items) {
    if (gHours[it.grade] !== undefined) gHours[it.grade] += it.hours;
    coursesSet.add(it.courseShort);
  }
  sheet3Rows.push([
    tIdx++,
    tName,
    group.area,
    gHours['1ero'] || 0,
    gHours['2do'] || 0,
    gHours['3ero'] || 0,
    gHours['4to'] || 0,
    gHours['5to'] || 0,
    gHours['6to'] || 0,
    group.totalHours,
    Array.from(coursesSet).join(', ')
  ]);
}
// Summary row
sheet3Rows.push([
  '',
  'TOTAL GENERAL DEL CENTRO',
  '40h por curso (JEE)',
  200, // 5 cursos 1ero
  160, // 4 cursos 2do
  160, // 4 cursos 3ero
  160, // 4 cursos 4to
  120, // 3 cursos 5to
  160, // 4 cursos 6to
  960,
  '24 Secciones activas'
]);

const ws3 = XLSX.utils.aoa_to_sheet(sheet3Rows);
ws3['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 22 }, { wch: 45 }];
XLSX.utils.book_append_sheet(wbOut, ws3, 'Matriz Docente vs Grados');

// SHEET 4: Carga 2024-2025
const sheet4Rows = [
  ['LICEO PROF. ANTONIO DESÍ - CARGA ACADÉMICA HISTÓRICA POR GRADOS Y SECCIONES (2024-2025)'],
  ['Grado', 'Sección', 'Aula / Curso', 'Asignatura / Materia', 'Docente Asignado', 'Área Curricular', 'Horas Semanales (45 min)']
];
for (const a of assignments2024) {
  sheet4Rows.push([
    a.grade,
    a.sec,
    a.course,
    a.subject,
    a.teacherName,
    a.teacherArea,
    a.hours
  ]);
}
const ws4 = XLSX.utils.aoa_to_sheet(sheet4Rows);
ws4['!cols'] = [{ wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 35 }, { wch: 28 }, { wch: 25 }, { wch: 24 }];
XLSX.utils.book_append_sheet(wbOut, ws4, 'Carga por Grados (2024-25)');

// SHEET 5: Comparativa 2024-2025 vs 2026-2027
const sheet5Rows = [
  ['LICEO PROF. ANTONIO DESÍ - COMPARATIVA DE CARGA DOCENTE (2024-2025 vs 2026-2027)'],
  ['No.', 'Docente', 'Área Curricular', 'Horas 2024-2025', 'Horas 2026-2027', 'Variación Horas', 'Estado / Observación', 'Grados Impartidos (2026-27)']
];

const teacherHours2024 = {};
for (const a of assignments2024) {
  teacherHours2024[a.teacherName] = (teacherHours2024[a.teacherName] || 0) + a.hours;
}

const allTeacherNames = Array.from(new Set([...Object.keys(teacherGroups2026), ...Object.keys(teacherHours2024)])).sort();

let compIdx = 1;
for (const tName of allTeacherNames) {
  const h24 = teacherHours2024[tName] || 0;
  const g26 = teacherGroups2026[tName];
  const h26 = g26 ? g26.totalHours : 0;
  const diff = h26 - h24;

  let obs = 'Sin variación';
  if (h24 === 0 && h26 > 0) obs = 'Nuevo en proyección';
  else if (h24 > 0 && h26 === 0) obs = 'Sin carga en proyección';
  else if (diff > 0) obs = `Incremento (+${diff}h)`;
  else if (diff < 0) obs = `Reducción (${diff}h)`;

  const grades26 = g26 ? Array.from(new Set(g26.items.map(x => x.grade))).join(', ') : '-';
  const area = (g26 ? g26.area : null) || (normalizeTeacher(tName).area);

  sheet5Rows.push([
    compIdx++,
    tName,
    area,
    h24,
    h26,
    diff > 0 ? `+${diff}` : String(diff),
    obs,
    grades26
  ]);
}
const ws5 = XLSX.utils.aoa_to_sheet(sheet5Rows);
ws5['!cols'] = [{ wch: 6 }, { wch: 28 }, { wch: 25 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 24 }, { wch: 28 }];
XLSX.utils.book_append_sheet(wbOut, ws5, 'Comparativa 2024 vs 2026');

// SHEET 6: Formato Importación Edugest (Asignaciones)
const sheet6Rows = [
  ['Nombre_Docente', 'Nombre_Materia', 'Nivel_Curso', 'Grado_Curso', 'Seccion_Curso', 'Tanda_Curso', 'Horas_Semanales']
];
for (const a of assignments2026) {
  sheet6Rows.push([
    a.teacherName,
    a.subject,
    'Secundario',
    a.grade,
    a.sec,
    'Extendida',
    a.hours
  ]);
}
const ws6 = XLSX.utils.aoa_to_sheet(sheet6Rows);
ws6['!cols'] = [{ wch: 28 }, { wch: 35 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
XLSX.utils.book_append_sheet(wbOut, ws6, 'Asignaciones Edugest');

// Write out file
XLSX.writeFile(wbOut, outputFile);
console.log('✅ EXCEL FILE SUCCESSFULLY CREATED AT:', outputFile);
