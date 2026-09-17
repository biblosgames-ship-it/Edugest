/**
 * Motor de Almacenamiento Local y Sincronización en Segundo Plano para Edugest (Offline-First)
 */
import { supabase } from '../lib/supabase';

const DB_NAME = 'edugest_offline_db';
const DB_VERSION = 1;

export interface SyncAction {
  id: string;
  type: 'grades' | 'attendance' | 'partial_activities';
  payload: any;
  createdAt: number;
  attempts: number;
  centerId?: string;
  description?: string;
}

// Inicializador de base de datos IndexedDB
const openDatabase = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB no está disponible'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('snapshots')) {
        db.createObjectStore('snapshots', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('grades_cache')) {
        db.createObjectStore('grades_cache', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Helper genérico para operaciones IndexedDB con fallback seguro
const idbGet = async <T = any>(storeName: string, key: string): Promise<T | null> => {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => resolve(null);
    });
  } catch (e) {
    try {
      const fallback = localStorage.getItem(`idb_fb_${storeName}_${key}`);
      return fallback ? JSON.parse(fallback) : null;
    } catch {
      return null;
    }
  }
};

const idbSet = async (storeName: string, key: string, value: any): Promise<void> => {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      const req = store.put({ key, value, updatedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    try {
      localStorage.setItem(`idb_fb_${storeName}_${key}`, JSON.stringify(value));
    } catch {}
  }
};

// ==========================================
// 1. PERFIL Y SESIÓN OFFLINE
// ==========================================
export const saveCachedProfile = (profile: any) => {
  if (!profile) return;
  try {
    localStorage.setItem('edugest_cached_profile', JSON.stringify(profile));
    if (profile.id) {
      localStorage.setItem(`edugest_cached_profile_${profile.id}`, JSON.stringify(profile));
    }
  } catch (e) {
    console.warn('[OfflineSync] Error saving cached profile:', e);
  }
};

export const getCachedProfile = (userId?: string): any | null => {
  try {
    if (userId) {
      const userSpecific = localStorage.getItem(`edugest_cached_profile_${userId}`);
      if (userSpecific) return JSON.parse(userSpecific);
    }
    const general = localStorage.getItem('edugest_cached_profile');
    return general ? JSON.parse(general) : null;
  } catch {
    return null;
  }
};

// ==========================================
// 2. SNAPSHOT DE DATOS ESCOLARES (LECTURA)
// ==========================================
export const saveStateSnapshot = async (centerId: string, data: any) => {
  if (!centerId || !data) return;
  const snapshotData = {
    courses: data.courses || [],
    subjects: data.subjects || [],
    teachers: data.teachers || [],
    assignments: data.assignments || [],
    schoolYears: data.schoolYears || [],
    schedule: data.schedule || [],
    students: data.students || [],
    academicRequirements: data.academicRequirements || [],
    activities: data.activities || [],
    rooms: data.rooms || [],
    timeBlocks: data.timeBlocks || [],
    levelSchedules: data.levelSchedules || [],
    cycleTimeBlocks: data.cycleTimeBlocks || []
  };

  await idbSet('snapshots', `state_${centerId}`, snapshotData);
};

export const getStateSnapshot = async (centerId: string): Promise<any | null> => {
  if (!centerId) return null;
  return await idbGet('snapshots', `state_${centerId}`);
};

// ==========================================
// 3. CACHÉ LOCAL DE CALIFICACIONES
// ==========================================
export const saveCachedGrades = async (key: string, grades: Record<string, any>) => {
  if (!key) return;
  await idbSet('grades_cache', key, grades);
};

export const getCachedGrades = async (key: string): Promise<Record<string, any> | null> => {
  if (!key) return null;
  return await idbGet('grades_cache', key);
};

// ==========================================
// 4. COLA DE CAMBIOS PENDIENTES (OUTBOX QUEUE)
// ==========================================
const notifyQueueChange = async () => {
  const count = await getPendingSyncCount();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('edugest_sync_queue_changed', {
        detail: { count }
      })
    );
  }
};

export const enqueueSyncAction = async (action: Omit<SyncAction, 'id' | 'createdAt' | 'attempts'>): Promise<string> => {
  const id = `sync_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const syncItem: SyncAction = {
    ...action,
    id,
    createdAt: Date.now(),
    attempts: 0
  };

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const req = store.put(syncItem);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    try {
      const current = JSON.parse(localStorage.getItem('edugest_sync_queue_fb') || '[]');
      current.push(syncItem);
      localStorage.setItem('edugest_sync_queue_fb', JSON.stringify(current));
    } catch {}
  }

  notifyQueueChange();
  return id;
};

export const getPendingSyncActions = async (): Promise<SyncAction[]> => {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction('sync_queue', 'readonly');
      const store = tx.objectStore('sync_queue');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (e) {
    try {
      return JSON.parse(localStorage.getItem('edugest_sync_queue_fb') || '[]');
    } catch {
      return [];
    }
  }
};

export const removeSyncAction = async (id: string): Promise<void> => {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sync_queue', 'readwrite');
      const store = tx.objectStore('sync_queue');
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    try {
      const current = JSON.parse(localStorage.getItem('edugest_sync_queue_fb') || '[]');
      const filtered = current.filter((x: any) => x.id !== id);
      localStorage.setItem('edugest_sync_queue_fb', JSON.stringify(filtered));
    } catch {}
  }

  notifyQueueChange();
};

export const getPendingSyncCount = async (): Promise<number> => {
  const actions = await getPendingSyncActions();
  return actions.length;
};

// ==========================================
// 5. MOTOR DE PROCESAMIENTO DE SINCRONIZACIÓN
// ==========================================
let isSyncInProgress = false;

export const processSyncQueue = async (): Promise<{ processed: number; failed: number }> => {
  if (isSyncInProgress) {
    return { processed: 0, failed: 0 };
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { processed: 0, failed: 0 };
  }

  const actions = await getPendingSyncActions();
  if (actions.length === 0) {
    return { processed: 0, failed: 0 };
  }

  isSyncInProgress = true;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('edugest_sync_started', { detail: { total: actions.length } }));
  }

  let processed = 0;
  let failed = 0;

  try {
    for (const item of actions) {
      try {
        if (item.type === 'grades') {
          const updates = item.payload;
          if (Array.isArray(updates) && updates.length > 0) {
            const { error } = await supabase
              .from('student_grades')
              .upsert(updates, { onConflict: 'student_id,course_id,subject_id,period,competency_id' });
            if (error) throw error;
          }
        } else if (item.type === 'attendance') {
          const { courseId, date, recordsToInsert } = item.payload;
          if (courseId && date) {
            await supabase
              .from('attendance_records')
              .delete()
              .eq('course_id', courseId)
              .eq('date', date);

            if (recordsToInsert && recordsToInsert.length > 0) {
              const { error: insertErr } = await supabase
                .from('attendance_records')
                .insert(recordsToInsert);

              if (insertErr) {
                // Intento fila a fila en caso de fallo parcial
                for (const rec of recordsToInsert) {
                  try {
                    await supabase.from('attendance_records').insert([rec]);
                  } catch {}
                }
              }
            }
          }
        } else if (item.type === 'partial_activities') {
          const { centerId, courseId, subjectId, period, schoolYear, scoresData, activityName } = item.payload;
          if (courseId && subjectId && period && schoolYear) {
            let checkQuery = supabase
              .from('student_partial_activities')
              .select('id')
              .eq('course_id', courseId)
              .eq('subject_id', subjectId)
              .eq('period', period)
              .eq('school_year', schoolYear);

            if (centerId) {
              checkQuery = checkQuery.eq('center_id', centerId);
            }

            const { data: existingRows } = await checkQuery;

            if (existingRows && existingRows.length > 0) {
              const primaryId = existingRows[0].id;
              const { error: updateErr } = await supabase
                .from('student_partial_activities')
                .update({
                  scores: scoresData,
                  activity_name: activityName || 'Desglose de Parciales',
                  updated_at: new Date().toISOString()
                })
                .eq('id', primaryId);
              if (updateErr) throw updateErr;

              if (existingRows.length > 1) {
                const dupIds = existingRows.slice(1).map((r: any) => r.id);
                await supabase.from('student_partial_activities').delete().in('id', dupIds);
              }
            } else {
              const { error: insertErr } = await supabase
                .from('student_partial_activities')
                .insert([{
                  center_id: centerId,
                  course_id: courseId,
                  subject_id: subjectId,
                  period: period,
                  school_year: schoolYear,
                  competency_id: 'all',
                  activity_name: activityName || 'Desglose de Parciales',
                  scores: scoresData,
                  updated_at: new Date().toISOString()
                }]);
              if (insertErr) throw insertErr;
            }
          }
        }

        await removeSyncAction(item.id);
        processed++;
      } catch (itemError: any) {
        console.warn(`[OfflineSync] Falló sincronización de elemento ${item.id}:`, itemError);
        failed++;
        // Si no hay red durante el proceso, detenemos el bucle para reintentar luego
        if (!navigator.onLine || itemError?.message?.includes('Failed to fetch')) {
          break;
        }
      }
    }
  } finally {
    isSyncInProgress = false;
    notifyQueueChange();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('edugest_sync_finished', {
          detail: { processed, failed, remaining: actions.length - processed }
        })
      );
    }
  }

  return { processed, failed };
};

// ==========================================
// 6. AUTO-ESCUCHA DE CONEXIÓN A INTERNET
// ==========================================
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[OfflineSync] Conexión recuperada. Iniciando sincronización de cola pendiente...');
    // Esperamos 2 segundos a que la conexión sea estable antes de enviar
    setTimeout(() => {
      processSyncQueue();
    }, 2000);
  });

  // Si arranca la app con conexión, procesar cola pendiente de sesiones previas
  if (navigator.onLine) {
    setTimeout(() => {
      getPendingSyncCount().then((count) => {
        if (count > 0) {
          console.log(`[OfflineSync] Procesando ${count} acciones pendientes de sesión previa...`);
          processSyncQueue();
        }
      });
    }, 2500);
  }
}
