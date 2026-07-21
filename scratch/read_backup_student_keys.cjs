const fs = require('fs');
const path = require('path');

const backupPath = path.join(__dirname, '../public/respaldo_centro_educativo_cristiano_génesis_2026-07-11.json');

try {
  const content = fs.readFileSync(backupPath, 'utf-8');
  const backup = JSON.parse(content);
  if (backup.students && backup.students.length > 0) {
    console.log('Student keys in backup:', Object.keys(backup.students[0]));
    console.log('Sample student in backup:', JSON.stringify(backup.students[0], null, 2));
  } else {
    console.log('No students found in backup or backup.students is empty.');
  }
} catch (e) {
  console.error('Error reading backup file:', e.message);
}
