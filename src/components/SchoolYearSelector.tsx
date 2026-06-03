import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const SchoolYearSelector = () => {
  const { state, selectedYear, setSelectedYear } = useApp();
  const [isOpen, setIsOpen] = useState(false);

  const years =
    state.schoolYears.length > 0 ? state.schoolYears : [{ name: selectedYear, status: 'activo' }];

  return (
    <div className="relative px-1 mb-2">
      <div className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-2 opacity-70">
        Ciclo Lectivo
      </div>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl transition-all duration-300 border ${
          isOpen
            ? 'bg-brand-blue/20 border-brand-blue/30 text-white'
            : 'bg-white/5 border-white/5 text-slate-300 hover:bg-white/10'
        }`}
      >
        <div className="flex items-center gap-2 overflow-hidden">
          <div
            className={`p-1.5 rounded-lg transition-colors ${isOpen ? 'bg-brand-blue text-white' : 'bg-slate-800 text-slate-400'}`}
          >
            <Calendar size={14} />
          </div>
          <span className="text-xs font-black truncate tracking-tight uppercase">
            {selectedYear}
          </span>
        </div>
        <ChevronDown
          size={12}
          className={`text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 w-full mb-1 bg-[#1e293b] border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-200">
          <div className="p-1.5 space-y-1">
            {years.map((y) => (
              <button
                key={y.name}
                onClick={() => {
                  setSelectedYear(y.name);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-between ${
                  selectedYear === y.name
                    ? 'bg-brand-blue text-white shadow-lg'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>{y.name}</span>
                {(y.status === 'activo' || y.is_active) && (
                  <div
                    className={`w-1.5 h-1.5 rounded-full ${selectedYear === y.name ? 'bg-white' : 'bg-emerald-500'} shadow-[0_0_8px_rgba(16,185,129,0.5)]`}
                  ></div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
