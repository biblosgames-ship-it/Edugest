import dotenv from 'dotenv';
dotenv.config();

console.log('Keys:', Object.keys(process.env).filter(k => k.includes('VITE_SUPABASE')));
