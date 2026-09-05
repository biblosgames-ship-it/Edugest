import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { playSchoolBellSound, SoundStyle } from '../utils/schoolBellAudio';
import toast from 'react-hot-toast';

export interface BellSlot {
  time: string; // "08:00" (formato 24h HH:MM)
  label: string; // "1ra Hora de Clase", "Recreo", etc.
  type: 'class' | 'break' | 'assembly' | 'dismissal';
}

const DEFAULT_SCHEDULE_MATUTINA: BellSlot[] = [
  { time: '07:45', label: 'Acto Cívico / Entrada', type: 'assembly' },
  { time: '08:00', label: '1ra Hora de Clase', type: 'class' },
  { time: '08:45', label: '2da Hora de Clase', type: 'class' },
  { time: '09:30', label: '3ra Hora de Clase', type: 'class' },
  { time: '10:15', label: 'Recreo Matutino', type: 'break' },
  { time: '10:45', label: '4ta Hora de Clase', type: 'class' },
  { time: '11:30', label: '5ta Hora de Clase', type: 'class' },
  { time: '12:15', label: '6ta Hora / Almuerzo', type: 'break' },
  { time: '13:00', label: '7ma Hora de Clase', type: 'class' },
  { time: '13:45', label: '8va Hora de Clase', type: 'class' },
  { time: '14:30', label: '9na Hora / Salida Jornada Extendida', type: 'dismissal' }
];

const DEFAULT_SCHEDULE_VESPERTINA: BellSlot[] = [
  { time: '14:00', label: '1ra Hora Vespertina', type: 'class' },
  { time: '14:45', label: '2da Hora Vespertina', type: 'class' },
  { time: '15:30', label: '3ra Hora Vespertina', type: 'class' },
  { time: '16:15', label: 'Recreo Vespertino', type: 'break' },
  { time: '16:30', label: '4ta Hora Vespertina', type: 'class' },
  { time: '17:15', label: '5ta Hora Vespertina', type: 'class' },
  { time: '18:00', label: 'Salida Tanda Vespertina', type: 'dismissal' }
];

export const useSchoolBell = () => {
  const { state } = useApp();

  // Estado del timbre guardado en localStorage
  const [isBellEnabled, setIsBellEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('edugens_school_bell_enabled');
      return saved !== null ? JSON.parse(saved) : true; // Por defecto activo
    } catch {
      return true;
    }
  });

  const [soundStyle, setSoundStyleState] = useState<SoundStyle>(() => {
    try {
      const saved = localStorage.getItem('edugens_school_bell_style');
      return (saved as SoundStyle) || 'chime';
    } catch {
      return 'chime';
    }
  });

  const [volume, setVolumeState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('edugens_school_bell_volume');
      return saved ? Number(saved) : 0.9;
    } catch {
      return 0.9;
    }
  });

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const lastTriggeredMinuteRef = useRef<string>('');

  const toggleBell = useCallback(() => {
    setIsBellEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('edugens_school_bell_enabled', JSON.stringify(next));
      if (next) {
        toast.success('🔔 Timbre Escolar Activado', { duration: 2500 });
        // Desbloquear AudioContext con el clic del usuario
        playSchoolBellSound(soundStyle, volume * 0.4);
      } else {
        toast('🔕 Timbre Escolar Desactivado', { duration: 2500 });
      }
      return next;
    });
  }, [soundStyle, volume]);

  const setSoundStyle = (style: SoundStyle) => {
    setSoundStyleState(style);
    localStorage.setItem('edugens_school_bell_style', style);
  };

  const setVolume = (vol: number) => {
    setVolumeState(vol);
    localStorage.setItem('edugens_school_bell_volume', String(vol));
  };

  const testSound = useCallback(() => {
    playSchoolBellSound(soundStyle, volume);
  }, [soundStyle, volume]);

  // Construir los horarios de timbrado activos
  const bellSlots = useMemo<BellSlot[]>(() => {
    const rawSlots: BellSlot[] = [];

    // 1. Integrar horarios de levelSchedules si existen
    if (state.levelSchedules && state.levelSchedules.length > 0) {
      state.levelSchedules.forEach((ls: any) => {
        if (ls.start_time) {
          const s5 = ls.start_time.substring(0, 5);
          rawSlots.push({
            time: s5,
            label: `Inicio de Clases (${ls.level || 'Nivel'})`,
            type: 'class'
          });
        }
        if (ls.end_time) {
          const e5 = ls.end_time.substring(0, 5);
          rawSlots.push({
            time: e5,
            label: `Fin de Clases (${ls.level || 'Nivel'})`,
            type: 'dismissal'
          });
        }
      });
    }

    // 2. Integrar descansos/recreos configurados
    if (state.breakPreferences && state.breakPreferences.length > 0) {
      state.breakPreferences.forEach((bp: any) => {
        const bStart = (bp.startTime || bp.start_time || '').substring(0, 5);
        if (bStart) {
          rawSlots.push({
            time: bStart,
            label: bp.name || 'Recreo / Descanso',
            type: 'break'
          });
        }
      });
    }

    // Si no hay horarios personalizados suficientes, usar el estándar oficial
    if (rawSlots.length < 4) {
      return [...DEFAULT_SCHEDULE_MATUTINA, ...DEFAULT_SCHEDULE_VESPERTINA];
    }

    // Ordenar y desduplicar por hora
    const uniqueMap = new Map<string, BellSlot>();
    [...rawSlots, ...DEFAULT_SCHEDULE_MATUTINA, ...DEFAULT_SCHEDULE_VESPERTINA].forEach((slot) => {
      if (!uniqueMap.has(slot.time)) {
        uniqueMap.set(slot.time, slot);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => a.time.localeCompare(b.time));
  }, [state.levelSchedules, state.breakPreferences]);

  // Actualizar reloj cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Comprobar si corresponde timbrar en el minuto actual
  useEffect(() => {
    if (!isBellEnabled) return;

    const hours = String(currentTime.getHours()).padStart(2, '0');
    const minutes = String(currentTime.getMinutes()).padStart(2, '0');
    const timeKey = `${hours}:${minutes}`;

    // Evitar disparar múltiples veces dentro del mismo minuto
    if (lastTriggeredMinuteRef.current === timeKey) return;

    const matchingSlot = bellSlots.find((s) => s.time === timeKey);
    if (matchingSlot) {
      lastTriggeredMinuteRef.current = timeKey;

      // 1. Sonar timbre
      playSchoolBellSound(soundStyle, volume);

      // 2. Vibración háptica en móviles (si está soportado)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate([400, 200, 400, 200, 600]);
        } catch {}
      }

      // 3. Notificación visual flotante
      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-slate-900 text-white shadow-2xl rounded-2xl pointer-events-auto flex ring-2 ring-indigo-500/80 p-4 border border-indigo-400/30 gap-3.5 items-center`}
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 animate-bounce">
              🔔
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black uppercase text-indigo-300 tracking-wider">
                  ¡Timbre Escolar! • {matchingSlot.time}
                </p>
                <span className="text-[9px] bg-indigo-500/30 text-indigo-200 px-2 py-0.5 rounded-full uppercase font-bold">
                  Rotación
                </span>
              </div>
              <p className="text-sm font-bold text-white mt-0.5 truncate">
                {matchingSlot.label}
              </p>
            </div>
          </div>
        ),
        { duration: 8000 }
      );
    }
  }, [currentTime, isBellEnabled, bellSlots, soundStyle, volume]);

  // Calcular la próxima rotación
  const nextRotation = useMemo(() => {
    const nowMins = currentTime.getHours() * 60 + currentTime.getMinutes();
    const nowSecs = currentTime.getSeconds();

    for (const slot of bellSlots) {
      const [h, m] = slot.time.split(':').map(Number);
      const slotMins = h * 60 + m;

      if (slotMins > nowMins || (slotMins === nowMins && nowSecs < 5)) {
        const diffSeconds = (slotMins - nowMins) * 60 - nowSecs;
        const minsLeft = Math.floor(diffSeconds / 60);
        const secsLeft = diffSeconds % 60;
        return {
          slot,
          diffSeconds,
          minsLeft,
          secsLeft,
          timeFormatted: `${minsLeft}m ${secsLeft < 10 ? '0' : ''}${secsLeft}s`
        };
      }
    }

    // Si ya pasaron todas las de hoy, la primera de mañana
    if (bellSlots.length > 0) {
      const first = bellSlots[0];
      return {
        slot: first,
        diffSeconds: 0,
        minsLeft: 0,
        secsLeft: 0,
        timeFormatted: `Mañana a las ${first.time}`
      };
    }

    return null;
  }, [currentTime, bellSlots]);

  return {
    isBellEnabled,
    toggleBell,
    soundStyle,
    setSoundStyle,
    volume,
    setVolume,
    testSound,
    nextRotation,
    bellSlots
  };
};
