import React, { useEffect, useState } from 'react';
import { useSupabase } from '../context/AppContext';
import { dataService } from '../services/dataService';
import { Bell, CheckCheck, Info, X } from 'lucide-react';

export const ExcuseAlert = () => {
  const { user, profile } = useSupabase();
  const [communications, setCommunications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const storageKey = `edugens_dismissed_comms_${user?.id || profile?.id || 'default'}`;

  const getDismissedIds = (): Set<string> => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  };

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(getDismissedIds);

  useEffect(() => {
    if (!user || !profile) return;

    const fetchCommunications = async () => {
      try {
        setLoading(true);
        const data = await dataService.getCommunications(user.id, profile.role);
        const dismissed = getDismissedIds();
        setDismissedIds(dismissed);
        const active = (data || []).filter((c: any) => !dismissed.has(c.id));
        setCommunications(active);
      } catch (error) {
        console.error('Error fetching communications for alerts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCommunications();
  }, [user, profile]);

  const handleDismiss = (commId: string) => {
    const updated = new Set(dismissedIds);
    updated.add(commId);
    setDismissedIds(updated);
    localStorage.setItem(storageKey, JSON.stringify(Array.from(updated)));
    setCommunications((prev) => prev.filter((c) => c.id !== commId));
  };

  const handleDismissAll = () => {
    const updated = new Set(dismissedIds);
    communications.forEach((c) => updated.add(c.id));
    setDismissedIds(updated);
    localStorage.setItem(storageKey, JSON.stringify(Array.from(updated)));
    setCommunications([]);
  };

  if (communications.length === 0 || loading) return null;

  return (
    <div className="space-y-3 mb-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[11px] font-black uppercase tracking-wider">
          <Bell size={14} className="text-amber-600 animate-bounce" />
          Tienes {communications.length} {communications.length === 1 ? 'notificación pendiente' : 'notificaciones pendientes'}
        </div>
        <button
          onClick={handleDismissAll}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
          title="Marcar todas las notificaciones como leídas"
        >
          <CheckCheck size={14} className="text-emerald-600" />
          Limpiar todas
        </button>
      </div>

      {communications.map((comm) => (
        <div
          key={comm.id}
          className="flex items-start gap-4 bg-white border-2 border-indigo-100 hover:border-indigo-300 p-5 rounded-3xl relative group transition-all shadow-sm"
        >
          <div className="w-10 h-10 bg-indigo-50 border border-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600 shrink-0 shadow-sm">
            <Bell size={18} />
          </div>
          <div className="flex-1 pr-4">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                {comm.motive || 'Aviso'}
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                • {new Date(comm.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{comm.sender_name}</p>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{comm.message}</p>
          </div>
          <button
            onClick={() => handleDismiss(comm.id)}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 hover:text-rose-600 text-slate-400 flex items-center justify-center transition-all cursor-pointer shrink-0"
            title="Marcar como leída y borrar"
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};
