import dotenv from 'dotenv';
import fetch from 'node-fetch'; // or we can use global fetch if node is v18+

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

async function listTables() {
  const url = `${supabaseUrl}/rest/v1/`;
  console.log('Fetching OpenAPI spec from:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`
      }
    });
    if (!res.ok) {
      console.error('HTTP Error:', res.status, res.statusText);
      const text = await res.text();
      console.error('Body:', text);
      return;
    }
    const openapi = await res.json() as any;
    const paths = Object.keys(openapi.paths || {});
    console.log('All available REST paths (tables/views/functions):');
    const tables = new Set<string>();
    paths.forEach(p => {
      // paths look like "/courses" or "/rpc/something"
      const parts = p.split('/');
      if (parts[1] && parts[1] !== 'rpc') {
        tables.add(parts[1]);
      }
    });
    console.log(Array.from(tables).sort());
  } catch (err) {
    console.error('Failed to list tables:', err);
  }
}

listTables();
