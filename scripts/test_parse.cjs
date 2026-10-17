const fs = require('fs');
const XLSX = require('xlsx');

const filePath = '/Users/juancarlos/.gemini/antigravity/brain/a19d5280-d6ec-4b77-8b7e-a1ae41f25e9a/.user_uploaded/media_1791784220732.xlsx';
const wb = XLSX.readFile(filePath);

console.log('Sheet names:', wb.SheetNames);

// 1. Parse Horarios-personales
const wsPers = wb.Sheets['Horarios-personales'];
const dPers = XLSX.utils.sheet_to_json(wsPers, { header: 1 });

const teacherHeaders = [];
for (let r = 0; r < dPers.length; r++) {
  const row = dPers[r] || [];
  for (let c = 0; c < row.length; c++) {
    const val = String(row[c] || '').trim();
    if (val.toLowerCase().startsWith('prof:') || val.toLowerCase().startsWith('prof.')) {
      let teacherName = '';
      let subject = '';
      let gradeSec = '';

      const pIdx = val.toLowerCase().indexOf('materia:');
      const gIdx = val.toLowerCase().indexOf('grado/seccion:');

      if (pIdx !== -1) {
        teacherName = val.substring(val.indexOf(':') + 1, pIdx).trim();
        if (gIdx !== -1) {
          subject = val.substring(pIdx + 'materia:'.length, gIdx).trim();
          gradeSec = val.substring(gIdx + 'grado/seccion:'.length).trim();
        } else {
          subject = val.substring(pIdx + 'materia:'.length).trim();
        }
      } else {
        teacherName = val.substring(val.indexOf(':') + 1).trim();
      }

      if (teacherName && teacherName.length > 1) {
        teacherHeaders.push({ row: r, col: c, name: teacherName, subject, gradeSec, raw: val });
      }
    }
  }
}

console.log('Teachers detected in Horarios-personales:', teacherHeaders.length);
teacherHeaders.forEach((t, i) => console.log(`${i+1}. ${t.name} (Materia: ${t.subject || 'N/A'}) - Ref: ${t.gradeSec || 'N/A'}`));
