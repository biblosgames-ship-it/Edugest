const fs = require('fs');
const path = require('path');

// Extract supabase url and key from .env
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
    const centersDefinition = data.definitions && data.definitions.centers;
    if (centersDefinition) {
      console.log('Centers properties:', Object.keys(centersDefinition.properties));
      console.log('Centers properties detail:', JSON.stringify(centersDefinition.properties, null, 2));
    } else {
      console.log('Centers definition not found in schema. Available definitions:', Object.keys(data.definitions || {}));
    }
  })
  .catch(err => {
    console.error('Error fetching schema:', err);
  });
