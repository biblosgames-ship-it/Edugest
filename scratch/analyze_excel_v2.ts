import * as XLSX from 'xlsx';
import fs from 'fs';

const buf = fs.readFileSync('public/2LISTADO 2025-2026 Oficiales.xlsx');
const wb = XLSX.read(buf);
wb.SheetNames.forEach(name => {
  console.log('SHEET:', name);
  const sheet = wb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, {header: 1}) as any[];
  for (let i = 0; i < 20; i++) {
    if (data[i] && data[i].length > 0) {
      console.log('Row', i, ':', data[i]);
    }
  }
});

