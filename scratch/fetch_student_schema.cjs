const fs = require('fs');
const path = require('path');

const envFile = fs.readFileSync(path.join(__dirname, '../.env'), 'utf-8');
const lines = envFile.split('\n');
let url = '', key = '';
for (const line of lines) {
  if (line.trim().startsWith('VITE_SUPABASE_URL=')) url = line.split('=')[1].trim();
  if (line.trim().startsWith('VITE_SUPABASE_ANON_KEY=')) key = line.split('=')[1].trim();
}

const fetchUrl = `${url}/rest/v1/?apikey=${key}`;

console.log('Fetching OpenAPI spec from:', fetchUrl);

fetch(fetchUrl)
  .then(res => res.json())
  .then(data => {
    const studentsDefinition = data.definitions && data.definitions.students;
    if (studentsDefinition) {
      console.log('Students properties:', Object.keys(studentsDefinition.properties));
    } else {
      console.log('Students definition not found.');
    }
  })
  .catch(err => {
    console.error('Error fetching schema:', err);
  });
