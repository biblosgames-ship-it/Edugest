import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, CloudUpload } from 'lucide-react';
import {
  getPendingSyncCount,
  processSyncQueue
} from '../utils/offlineSync';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showNotification, setShowNotification] = useState<boolean>(false);

  useEffect(() => {
    // 1. Cargar conteo inicial de cambios pendientes
    getPendingSyncCount().then((count) => {
      setPendingCount(count);
      if (count > 0 && typeof navigator !== 'undefined' && navigator.onLine) {
        processSyncQueue();
      }
    });

    // 2. Escuchar cambios de estado de red
    const handleOnline = () => {
      setIsOnline(true);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 5000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowNotification(true);
    };

    const handleQueueChange = (e: any) => {
      if (e.detail?.count !== undefined) {
        setPendingCount(e.detail.count);
      } else {
        getPendingSyncCount().then(setPendingCount);
      }
    };

    const handleSyncStarted = () => {
      setIsSyncing(true);
    };

    const handleSyncFinished = (e: any) => {
      setIsSyncing(false);
      getPendingSyncCount().then(setPendingCount);
      setShowNotification(true);
      setTimeout(() => setShowNotification(false), 4000);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('edugest_sync_queue_changed', handleQueueChange);
    window.addEventListener('edugest_sync_started', handleSyncStarted);
    window.addEventListener('edugest_sync_finished', handleSyncFinished);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('edugest_sync_queue_changed', handleQueueChange);
      window.removeEventListener('edugest_sync_started', handleSyncStarted);
      window.removeEventListener('edugest_sync_finished', handleSyncFinished);
    };
  }, []);

  const handleManualSync = async () => {
    if (!isOnline || isSyncing) return;
    setIsSyncing(true);
    try {
      await processSyncQueue();
    } finally {
      setIsSyncing(false);
    }
  };

  // Si está online y no hay cambios pendientes y no está sincronizando, mostrar solo un pill discreto o permanecer oculto
  if (isOnline && pendingCount === 0 && !isSyncing && !showNotification) {
    return null;
  }

  return (
    <aside
      aria-label="Estado de conexión"
      className="fixed bottom-5 right-5 z-50 flex items-center shadow-2xl rounded-2xl overflow-hidden border border-white/20 transition-all duration-300 animate-in fade-in slide-in-from-bottom-3"
    >
      {/* MODO SIN CONEXIÓN */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2.5 flex items-center gap-2.5 font-bold text-xs">
          <WifiOff size={16} className="animate-pulse text-slate-950 shrink-0" />
          <div className="flex flex-col">
            <span className="font-extrabold tracking-wide uppercase text-[10px]">Modo Sin Conexión</span>
            <span className="text-slate-900 font-medium">
              {pendingCount > 0
                ? `${pendingCount} ${pendingCount === 1 ? 'cambio guardado' : 'cambios guardados'} en este equipo`
                : 'Trabajando de forma local'}
            </span>
          </div>
        </div>
      )}

      {/* SINCRONIZANDO CAMBIOS */}
      {isOnline && isSyncing && (
        <div className="bg-indigo-600 text-white px-4 py-2.5 flex items-center gap-2.5 font-semibold text-xs">
          <RefreshCw size={15} className="animate-spin text-indigo-200 shrink-0" />
          <div className="flex flex-col">
            <span className="font-extrabold tracking-wide uppercase text-[10px] text-indigo-200">Sincronizando</span>
            <span>Subiendo cambios a la nube...</span>
          </div>
        </div>
      )}

      {/* EN LÍNEA CON CAMBIOS PENDIENTES (Listo para sincronizar) */}
      {isOnline && !isSyncing && pendingCount > 0 && (
        <button
          onClick={handleManualSync}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2.5 flex items-center gap-2.5 font-semibold text-xs transition-colors cursor-pointer"
          title="Haga clic para sincronizar ahora"
        >
          <CloudUpload size={16} className="text-emerald-200 shrink-0" />
          <div className="flex flex-col text-left">
            <span className="font-extrabold tracking-wide uppercase text-[10px] text-emerald-200">Conexión restablecida</span>
            <span>{pendingCount} pendientes • Sincronizar ahora</span>
          </div>
        </button>
      )}

      {/* NOTIFICACIÓN BREVE DE TODO AL DÍA */}
      {isOnline && !isSyncing && pendingCount === 0 && showNotification && (
        <div className="bg-emerald-700 text-white px-3.5 py-2 flex items-center gap-2 font-medium text-xs">
          <CheckCircle2 size={15} className="text-emerald-300 shrink-0" />
          <span>Datos sincronizados con la nube</span>
        </div>
      )}
    </aside>
  );
};
