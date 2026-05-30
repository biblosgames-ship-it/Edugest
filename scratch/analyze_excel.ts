import * as XLSX from 'xlsx';
import fs from 'fs';

const buf = fs.readFileSync('public/2LISTADO 2025-2026 Oficiales.xlsx');
const wb = XLSX.read(buf);
const sheetName = wb.SheetNames[0];
const sheet = wb.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, {header: 1});

console.log('--- ESTRUCTURA DE COLUMNAS (FILA 1) ---');
console.log(data[0]);
console.log('--- ESTRUCTURA DE COLUMNAS (FILA 2) ---');
console.log(data[1]);
console.log('--- DATOS DE MUESTRA (FILA 3) ---');
console.log(data[2]);

