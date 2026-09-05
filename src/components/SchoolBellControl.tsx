import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell, BellOff, Volume2, Play, Sparkles, Clock, Check, Settings2, X, ShieldAlert } from 'lucide-react';
import { useSchoolBell } from '../hooks/useSchoolBell';
import { SoundStyle } from '../utils/schoolBellAudio';

export const SchoolBellControl = () => {
  const {
    isBellEnabled,
    toggleBell,
    soundStyle,
    setSoundStyle,
    volume,
    setVolume,
    testSound,
    nextRotation,
    bellSlots
  } = useSchoolBell();

  const [isOpenModal, setIsOpenModal] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpenModal(false);
    };
    if (isOpenModal) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpenModal]);

  const modalContent = isOpenModal && (
    <div
      className="fixed inset-0 z-[999999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200 overflow-y-auto"
      onClick={() => setIsOpenModal(false)}
    >
      <div
        className="bg-slate-900 border border-slate-800 text-white rounded-[2rem] sm:rounded-[2.5rem] max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Fijo del Modal */}
        <div className="flex items-center justify-between border-b border-slate-800/80 p-5 sm:p-6 bg-slate-900/95 sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/30 shrink-0">
              <Bell size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-white flex items-center gap-2 truncate">
                Timbre y Alarma de Rotación
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                Sonido automático en cada cambio de hora y recreo
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOpenModal(false)}
            className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-slate-700 shrink-0 ml-2 shadow-sm"
            title="Cerrar ventana (Esc)"
          >
            <X size={18} />
          </button>
        </div>

        {/* Contenido con Scroll Interno */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
          {/* Interruptor Principal y Estado */}
          <div
            className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
              isBellEnabled
                ? 'bg-indigo-950/40 border-indigo-500/40 text-white'
                : 'bg-slate-800/40 border-slate-700/50 text-slate-400'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isBellEnabled ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'
                }`}
              >
                {isBellEnabled ? <Bell size={18} /> : <BellOff size={18} />}
              </div>
              <div>
                <div className="text-sm font-bold uppercase">
                  {isBellEnabled ? 'Alarma Automática Activa' : 'Alarma Desactivada'}
                </div>
                <div className="text-xs text-slate-400">
                  {isBellEnabled
                    ? 'Sonará automáticamente al llegar cada hora'
                    : 'No emitirá sonido durante los cambios de clase'}
                </div>
              </div>
            </div>

            <button
              onClick={toggleBell}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                isBellEnabled
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-200'
              }`}
            >
              {isBellEnabled ? 'Encendido' : 'Apagado'}
            </button>
          </div>

          {/* Próximo Cambio de Hora en Tiempo Real */}
          {isBellEnabled && nextRotation && (
            <div className="bg-gradient-to-r from-emerald-950/30 to-slate-900 border border-emerald-500/30 p-4 rounded-2xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Clock size={16} className="text-emerald-400 animate-pulse" />
                <div>
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                    Próxima Rotación
                  </span>
                  <span className="text-xs font-bold text-white">
                    {nextRotation.slot.label} ({nextRotation.slot.time})
                  </span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                  en {nextRotation.timeFormatted}
                </span>
              </div>
            </div>
          )}

          {/* Selector de Tipo de Sonido */}
          <div className="space-y-3">
            <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider flex items-center justify-between">
              <span>Tipo de Sonido / Alerta</span>
              <span className="text-[9px] text-indigo-400 font-bold">100% Offline (Web Audio)</span>
            </label>

            <div className="grid grid-cols-3 gap-2.5">
              {[
                {
                  id: 'chime' as SoundStyle,
                  label: 'Campana Armónica',
                  desc: 'Chime suave Westminster'
                },
                {
                  id: 'whistle' as SoundStyle,
                  label: 'Pito Deportivo',
                  desc: 'Silbato triple rotación'
                },
                {
                  id: 'bell' as SoundStyle,
                  label: 'Timbre Clásico',
                  desc: 'Repique eléctrico escolar'
                }
              ].map((s) => {
                const isSelected = soundStyle === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setSoundStyle(s.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                        : 'bg-slate-800/60 border-slate-700/60 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div className="font-bold text-xs uppercase">{s.label}</div>
                    <div
                      className={`text-[9px] mt-1 ${isSelected ? 'text-indigo-100' : 'text-slate-500'}`}
                    >
                      {s.desc}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Control de Volumen y Botón de Prueba */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-400 flex items-center gap-1.5">
                <Volume2 size={14} /> Volumen de Alerta ({Math.round(volume * 100)}%)
              </span>
              <button
                onClick={testSound}
                className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Play size={12} fill="currentColor" /> Probar Sonido
              </button>
            </div>

            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          {/* Listado de Horarios de Rotación Programados */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Horarios Programados del Centro ({bellSlots.length})</span>
              <span className="text-slate-500">Formato 24h</span>
            </div>

            <div className="max-h-36 overflow-y-auto pr-1 space-y-1 custom-scrollbar">
              {bellSlots.map((slot, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs"
                >
                  <span className="font-medium text-slate-300 truncate">{slot.label}</span>
                  <span
                    className={`font-mono font-bold px-2 py-0.5 rounded-md text-[10px] ${
                      slot.type === 'break'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : slot.type === 'dismissal'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}
                  >
                    {slot.time}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Fijo */}
        <div className="p-4 sm:p-5 border-t border-slate-800/80 bg-slate-900/95 sticky bottom-0 z-20 shrink-0">
          <button
            onClick={() => setIsOpenModal(false)}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-2xl text-xs uppercase tracking-wider transition-all cursor-pointer border border-slate-700 shadow-sm"
          >
            Cerrar Configuración
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Botón Principal en el Menú / Sidebar */}
      <div className="relative">
        <div
          className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all duration-300 ${
            isBellEnabled
              ? 'bg-gradient-to-r from-indigo-900/50 to-indigo-800/40 border-indigo-500/50 text-white shadow-lg shadow-indigo-950/40'
              : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/10'
          }`}
        >
          {/* Lado Izquierdo: Clic abre modal de configuración */}
          <button
            onClick={() => setIsOpenModal(true)}
            className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer group"
            title="Configurar Timbre Escolar y Horarios"
          >
            <div
              className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all ${
                isBellEnabled
                  ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/40 animate-pulse'
                  : 'bg-white/10 text-slate-400 group-hover:text-white'
              }`}
            >
              {isBellEnabled ? <Bell size={14} /> : <BellOff size={14} />}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase tracking-tight">
                  {isBellEnabled ? 'Timbre Escolar' : 'Timbre'}
                </span>
                {isBellEnabled && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                )}
              </div>
              <p className="text-[9px] font-medium text-slate-400 truncate">
                {isBellEnabled && nextRotation
                  ? `Próx: ${nextRotation.slot.time} (${nextRotation.minsLeft}m)`
                  : 'Desactivado (Silencio)'}
              </p>
            </div>
          </button>

          {/* Lado Derecho: Toggle Switch Directo */}
          <button
            onClick={toggleBell}
            aria-label={isBellEnabled ? 'Desactivar timbre' : 'Activar timbre'}
            className={`w-9 h-5 rounded-full p-0.5 transition-colors cursor-pointer flex items-center shrink-0 ml-2 ${
              isBellEnabled ? 'bg-indigo-500' : 'bg-slate-700'
            }`}
            title={isBellEnabled ? 'Desactivar Alarma' : 'Activar Alarma de Rotación'}
          >
            <div
              className={`w-4 h-4 bg-white rounded-full transition-transform shadow-md ${
                isBellEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {typeof document !== 'undefined' && modalContent && createPortal(modalContent, document.body)}
    </>
  );
};
