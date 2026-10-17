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

/**
 * Descarga todas las filas de una consulta Supabase paginando automáticamente de 1,000 en 1,000
 * para evitar el truncamiento por defecto de PostgREST cuando un curso o centro supera los 1,000 registros.
 */
export async function fetchAllRows<T = any>(
  buildQuery: () => any,
  pageSize = 1000
): Promise<{ data: T[]; error: any }> {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) {
      return { data: allRows, error };
    }
    if (!data || data.length === 0) {
      break;
    }
    allRows.push(...data);
    if (data.length < pageSize) {
      break;
    }
    from += pageSize;
  }

  return { data: allRows, error: null };
}

