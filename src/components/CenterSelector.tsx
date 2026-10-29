import React, { useState, useEffect } from 'react';
import { Building2, ChevronDown, Check } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

export const CenterSelector = () => {
  const { center, switchCenter } = useApp();
  const [isOpen, setIsOpen] = useState(false);
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from('centers')
      .select('id, name')
      .order('name', { ascending: true })
      .then(({ data }) => {
        if (data && data.length > 0) {
          setCenters(data);
        }
      });
  }, []);

  if (centers.length <= 1 && !center) return null;

  return (
    <div className="relative px-1 mb-2">
      <div className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-2 opacity-70">
        Centro Educativo
      </div>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition-all duration-300 border ${
          isOpen
            ? 'bg-emerald-500/20 border-emerald-500/30 text-white'
            : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
        }`}
        title="Cambiar de Centro Educativo"
      >
        <div className="flex items-center gap-2 overflow-hidden min-w-0">
          <div
            className={`p-1.5 rounded-lg transition-colors shrink-0 ${
              isOpen ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-emerald-400'
            }`}
          >
            <Building2 size={14} />
          </div>
          <span className="text-xs font-black truncate tracking-tight uppercase">
            {center?.name || 'Seleccionar Centro'}
          </span>
        </div>
        <ChevronDown
          size={12}
          className={`text-slate-500 transition-transform duration-300 shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 w-full mb-1 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl z-[100] max-h-56 overflow-y-auto animate-in fade-in slide-in-from-bottom-1 duration-200 custom-scrollbar">
          <div className="p-1.5 space-y-1">
            {centers.map((c) => {
              const isSelected = center?.id === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={loading}
                  onClick={async () => {
                    if (switchCenter) {
                      setLoading(true);
                      await switchCenter(c.id);
                      setLoading(false);
                    }
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-lg'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  {isSelected && <Check size={12} className="shrink-0 text-white" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
