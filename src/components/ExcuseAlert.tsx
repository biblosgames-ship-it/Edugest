import React, { useEffect, useState } from 'react';
import { useSupabase } from '../context/AppContext';
import { dataService } from '../services/dataService';
import { Bell, Info, X } from 'lucide-react';

export const ExcuseAlert = () => {
  const { user, profile } = useSupabase();
  const [communications, setCommunications] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;

    const fetchCommunications = async () => {
      try {
        setLoading(true);
        const data = await dataService.getCommunications(user.id, profile.role);
        setCommunications(data || []);
      } catch (error) {
        console.error('Error fetching communications for alerts:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCommunications();

    // Podríamos añadir una suscripción en tiempo real aquí si fuera necesario
  }, [user, profile]);

  if (communications.length === 0 || loading) return null;

  return (
    <div className="space-y-3 mb-6">
      {communications.map((comm) => (
        <div
          key={comm.id}
          className="flex items-start gap-4 bg-brand-blue/5 border border-brand-blue/10 p-4 rounded-2xl relative group hover:bg-brand-blue/10 transition-all shadow-sm"
        >
          <div className="w-10 h-10 bg-brand-blue/20 rounded-full flex items-center justify-center text-brand-blue shrink-0">
            <Bell size={18} />
          </div>
          <div className="flex-1 pr-8">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-blue/60">
                {comm.motive}
              </span>
              <span className="text-[10px] text-slate-400">
                • {new Date(comm.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-800 mb-1">{comm.sender_name}</p>
            <p className="text-sm text-slate-600 leading-relaxed">{comm.message}</p>
          </div>
          <button
            onClick={() => setCommunications((prev) => prev.filter((c) => c.id !== comm.id))}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all"
          >
            <X size={16} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-[11px] font-bold text-slate-400 w-fit">
        <Info size={12} />
        Tienes {communications.length} notificaciones nuevas
      </div>
    </div>
  );
};
