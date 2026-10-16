import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});

// Resiliencia de sesión: reactivar token automáticamente tras suspensión del navegador o reconexión
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      supabase.auth.startAutoRefresh();
      // Verificación y refresco proactivo silencioso de sesión
      supabase.auth.getSession().catch(() => {});
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });

  window.addEventListener('online', () => {
    supabase.auth.startAutoRefresh();
    supabase.auth.getSession().catch(() => {});
  });
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).supabase = supabase;
}
