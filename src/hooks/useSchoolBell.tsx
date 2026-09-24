import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { playSchoolBellSound, SoundStyle } from '../utils/schoolBellAudio';
import { getDefaultMinerdEphemerides } from '../components/SchoolEphemeridesManager';
import { supabase } from '../lib/supabase';
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
  const { state, center, selectedYear } = useApp();

  // Estado del timbre guardado en localStorage y sincronizado con el centro escolar
  const [isBellEnabled, setIsBellEnabled] = useState<boolean>(() => {
    try {
      if (center?.id) {
        const centerSpecific = localStorage.getItem(`edugens_school_bell_enabled_${center.id}`);
        if (centerSpecific !== null) return JSON.parse(centerSpecific);
      }
      if (center?.bell_settings?.is_enabled !== undefined) {
        return !!center.bell_settings.is_enabled;
      }
      const saved = localStorage.getItem('edugens_school_bell_enabled');
      return saved !== null ? JSON.parse(saved) : true; // Por defecto activo
    } catch {
      return true;
    }
  });

  const [soundStyle, setSoundStyleState] = useState<SoundStyle>(() => {
    try {
      if (center?.id) {
        const centerSpecific = localStorage.getItem(`edugens_school_bell_style_${center.id}`);
        if (centerSpecific) return centerSpecific as SoundStyle;
      }
      if (center?.bell_settings?.sound_style) {
        return center.bell_settings.sound_style as SoundStyle;
      }
      const saved = localStorage.getItem('edugens_school_bell_style');
      return (saved as SoundStyle) || 'traditional';
    } catch {
      return 'traditional';
    }
  });

  const [volume, setVolumeState] = useState<number>(() => {
    try {
      if (center?.id) {
        const centerSpecific = localStorage.getItem(`edugens_school_bell_volume_${center.id}`);
        if (centerSpecific) return Number(centerSpecific);
      }
      if (center?.bell_settings?.volume !== undefined) {
        return Number(center.bell_settings.volume);
      }
      const saved = localStorage.getItem('edugens_school_bell_volume');
      return saved ? Number(saved) : 0.9;
    } catch {
      return 0.9;
    }
  });

  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const lastTriggeredMinuteRef = useRef<string>('');

  // Sincronizar automáticamente si el centro tiene configuración institucional en la nube
  useEffect(() => {
    if (center?.bell_settings) {
      if (center.bell_settings.sound_style) {
        setSoundStyleState(center.bell_settings.sound_style as SoundStyle);
        localStorage.setItem('edugens_school_bell_style', center.bell_settings.sound_style);
        if (center.id) {
          localStorage.setItem(`edugens_school_bell_style_${center.id}`, center.bell_settings.sound_style);
        }
      }
      if (center.bell_settings.volume !== undefined) {
        const volNum = Number(center.bell_settings.volume);
        setVolumeState(volNum);
        localStorage.setItem('edugens_school_bell_volume', String(volNum));
        if (center.id) {
          localStorage.setItem(`edugens_school_bell_volume_${center.id}`, String(volNum));
        }
      }
      if (center.bell_settings.is_enabled !== undefined) {
        const enBool = !!center.bell_settings.is_enabled;
        setIsBellEnabled(enBool);
        localStorage.setItem('edugens_school_bell_enabled', JSON.stringify(enBool));
        if (center.id) {
          localStorage.setItem(`edugens_school_bell_enabled_${center.id}`, JSON.stringify(enBool));
        }
      }
    }
  }, [center?.id, center?.bell_settings]);

  const toggleBell = useCallback(() => {
    setIsBellEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('edugens_school_bell_enabled', JSON.stringify(next));
      if (center?.id) {
        localStorage.setItem(`edugens_school_bell_enabled_${center.id}`, JSON.stringify(next));
        try {
          supabase.from('centers').update({
            bell_settings: {
              sound_style: soundStyle,
              volume: volume,
              is_enabled: next,
              updated_at: new Date().toISOString()
            }
          }).eq('id', center.id).then(() => {}).catch(() => {});
        } catch {}
      }

      if (next) {
        toast.success('🔔 Timbre Escolar Activado', { duration: 2500 });
        playSchoolBellSound(soundStyle, volume * 0.4);
      } else {
        toast('🔕 Timbre Escolar Desactivado', { duration: 2500 });
      }
      return next;
    });
  }, [soundStyle, volume, center?.id]);

  const setSoundStyle = (style: SoundStyle) => {
    setSoundStyleState(style);
    localStorage.setItem('edugens_school_bell_style', style);
    if (center?.id) {
      localStorage.setItem(`edugens_school_bell_style_${center.id}`, style);
      try {
        supabase.from('centers').update({
          bell_settings: {
            sound_style: style,
            volume: volume,
            is_enabled: isBellEnabled,
            updated_at: new Date().toISOString()
          }
        }).eq('id', center.id).then(() => {}).catch(() => {});
      } catch {}
    }
    toast.success('Tipo de sonido guardado permanentemente', { duration: 2000 });
  };

  const setVolume = (vol: number) => {
    setVolumeState(vol);
    localStorage.setItem('edugens_school_bell_volume', String(vol));
    if (center?.id) {
      localStorage.setItem(`edugens_school_bell_volume_${center.id}`, String(vol));
      try {
        supabase.from('centers').update({
          bell_settings: {
            sound_style: soundStyle,
            volume: vol,
            is_enabled: isBellEnabled,
            updated_at: new Date().toISOString()
          }
        }).eq('id', center.id).then(() => {}).catch(() => {});
      } catch {}
    }
  };

  const testSound = useCallback(() => {
    playSchoolBellSound(soundStyle, volume);
  }, [soundStyle, volume]);

  // Detectar si el centro tiene tanda vespertina activa
  const hasAfternoonShift = useMemo(() => {
    // 1. Verificar si hay cursos en la tarde
    const hasVespCourse = (state.courses || []).some((c: any) => {
      const t = (c.tanda || '').toLowerCase().trim();
      return t.includes('ves') || t.includes('tar');
    });
    // 2. Verificar si en levelSchedules hay tanda vespertina
    const hasVespSchedule = (state.levelSchedules || []).some((ls: any) => {
      const s = (ls.shift || '').toLowerCase().trim();
      return s.includes('ves') || s.includes('tar');
    });
    // 3. Verificar si en el horario generado hay clases en la tarde
    const hasVespEntries = (state.schedule || []).some((s: any) => {
      const sh = (s.shift || '').toLowerCase().trim();
      return sh.includes('ves') || sh.includes('tar');
    });
    return hasVespCourse || hasVespSchedule || hasVespEntries;
  }, [state.courses, state.levelSchedules, state.schedule]);

  // Construir los horarios de timbrado activos
  const bellSlots = useMemo<BellSlot[]>(() => {
    const rawSlots: BellSlot[] = [];

    // 1. Integrar horarios de levelSchedules si existen
    if (state.levelSchedules && state.levelSchedules.length > 0) {
      state.levelSchedules.forEach((ls: any) => {
        const isVespLs = (ls.shift || '').toLowerCase().includes('ves') || (ls.shift || '').toLowerCase().includes('tar');
        if (!hasAfternoonShift && isVespLs) return;

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
          const [h] = bStart.split(':').map(Number);
          // Si el centro es solo matutino, omitir recreos de la tarde (> 13:30)
          if (!hasAfternoonShift && h >= 14) return;
          rawSlots.push({
            time: bStart,
            label: bp.name || 'Recreo / Descanso',
            type: 'break'
          });
        }
      });
    }

    // Si el centro solo opera en la mañana, usar solo los bloques matutinos
    const fallbackDefaults = hasAfternoonShift
      ? [...DEFAULT_SCHEDULE_MATUTINA, ...DEFAULT_SCHEDULE_VESPERTINA]
      : [...DEFAULT_SCHEDULE_MATUTINA];

    if (rawSlots.length < 3) {
      return fallbackDefaults;
    }

    // Ordenar y desduplicar por hora
    const uniqueMap = new Map<string, BellSlot>();
    [...rawSlots, ...fallbackDefaults].forEach((slot) => {
      const [h] = slot.time.split(':').map(Number);
      // Si el centro solo es matutino, no agregar horas vespertinas
      if (!hasAfternoonShift && h >= 14 && slot.type !== 'dismissal') return;
      if (!uniqueMap.has(slot.time)) {
        uniqueMap.set(slot.time, slot);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => a.time.localeCompare(b.time));
  }, [state.levelSchedules, state.breakPreferences, hasAfternoonShift]);

  // Actualizar reloj cada segundo
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fecha actual local en formato YYYY-MM-DD y MM-DD
  const todayYMD = useMemo(() => {
    const y = currentTime.getFullYear();
    const m = String(currentTime.getMonth() + 1).padStart(2, '0');
    const d = String(currentTime.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [currentTime]);

  const todayMD = useMemo(() => {
    const m = String(currentTime.getMonth() + 1).padStart(2, '0');
    const d = String(currentTime.getDate()).padStart(2, '0');
    return `${m}-${d}`;
  }, [currentTime]);

  const dayOfWeek = currentTime.getDay(); // 0 = Domingo, 6 = Sábado
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  // Detección inteligente de días feriados, asuetos, fines de semana y suspensión de docencia
  const noSchoolInfo = useMemo<{ isNoSchool: boolean; reason: string }>(() => {
    if (isWeekend) {
      const dayName = dayOfWeek === 6 ? 'Sábado' : 'Domingo';
      return { isNoSchool: true, reason: `Fin de semana (${dayName}) • Sin clases hoy` };
    }

    // 1. Días feriados oficiales inamovibles de la República Dominicana (por MM-DD)
    const DOMINICAN_NATIONAL_HOLIDAYS: Record<string, string> = {
      '01-01': 'Año Nuevo (Feriado Nacional)',
      '01-06': 'Día de los Santos Reyes (Feriado)',
      '01-21': 'Día de Nuestra Señora de la Altagracia (Feriado Nacional)',
      '01-26': 'Natalicio de Juan Pablo Duarte (Feriado Nacional)',
      '02-27': 'Día de la Independencia Nacional (Fiesta Patria)',
      '05-01': 'Día Internacional del Trabajo (Feriado)',
      '08-16': 'Día de la Restauración de la República (Feriado Nacional)',
      '09-24': 'Día de Nuestra Señora de las Mercedes (Feriado Nacional)',
      '11-06': 'Día de la Constitución Dominicana (Feriado)',
      '12-25': 'Día de Navidad (Feriado Nacional)'
    };

    if (DOMINICAN_NATIONAL_HOLIDAYS[todayMD]) {
      return {
        isNoSchool: true,
        reason: `${DOMINICAN_NATIONAL_HOLIDAYS[todayMD]} • Sin docencia hoy`
      };
    }

    // 2. Verificar actividades o eventos institucionales registrados en la base de datos del centro
    const activities = state.activities || [];
    const todayAct = activities.find((a: any) => {
      if (a.date !== todayYMD) return false;
      const t = String(a.title || '').toLowerCase();
      const d = String(a.description || '').toLowerCase();
      return (
        a.suspends_classes === true ||
        a.category === 'holiday' ||
        t.includes('feriado') ||
        t.includes('asueto') ||
        t.includes('no docencia') ||
        t.includes('sin docencia') ||
        t.includes('suspensión') ||
        d.includes('[no_docencia]') ||
        d.includes('feriado') ||
        d.includes('sin docencia')
      );
    });

    if (todayAct) {
      return {
        isNoSchool: true,
        reason: `${todayAct.title || 'Día No Laborable'} • Clases suspendidas`
      };
    }

    // 3. Verificar efemérides y feriados oficiales del calendario escolar MINERD
    const minerdList = getDefaultMinerdEphemerides(selectedYear || '2026-2027');
    const todayMinerd = minerdList.find((e) => {
      if (e.date !== todayYMD) return false;
      const t = e.title.toLowerCase();
      const d = (e.description || '').toLowerCase();
      return (
        e.suspends_classes === true ||
        e.category === 'holiday' ||
        t.includes('feriado') ||
        t.includes('asueto') ||
        d.includes('feriado') ||
        d.includes('sin docencia')
      );
    });

    if (todayMinerd) {
      return {
        isNoSchool: true,
        reason: `${todayMinerd.title} • Feriado escolar (Sin docencia)`
      };
    }

    return { isNoSchool: false, reason: '' };
  }, [isWeekend, dayOfWeek, todayMD, todayYMD, state.activities, selectedYear]);

  // Si hoy no hay clases (fin de semana, feriado, asueto o suspensión), NO es día escolar
  const isSchoolDay = !noSchoolInfo.isNoSchool;

  // Comprobar si corresponde timbrar en el minuto actual
  useEffect(() => {
    // Si el timbre está desactivado o NO hay clases (feriado, asueto, fin de semana), NUNCA timbrar
    if (!isBellEnabled || !isSchoolDay) return;

    // Si el centro solo opera en horario matutino, desactivar el timbre al finalizar la última hora
    if (!hasAfternoonShift) {
      const currentH = currentTime.getHours();
      const currentM = currentTime.getMinutes();
      const nowMins = currentH * 60 + currentM;

      const morningSlotMins = bellSlots.map((s) => {
        const [sh, sm] = s.time.split(':').map(Number);
        return sh * 60 + sm;
      });
      const maxMorningMins = morningSlotMins.length > 0 ? Math.max(...morningSlotMins) : 870; // máx 14:30

      // Ya finalizó la última hora matutina: no seguir sonando en toda la tarde
      if (nowMins > maxMorningMins) return;
    }

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
  }, [currentTime, isBellEnabled, isSchoolDay, bellSlots, soundStyle, volume, hasAfternoonShift]);

  // Calcular la próxima rotación
  const nextRotation = useMemo(() => {
    if (bellSlots.length === 0) return null;

    const firstSlot = bellSlots[0];

    // Si hoy no hay clases (feriado, asueto, fin de semana)
    if (noSchoolInfo.isNoSchool) {
      return {
        isSchoolDay: false,
        isWeekend: isWeekend,
        isHoliday: !isWeekend,
        holidayName: noSchoolInfo.reason,
        slot: firstSlot,
        diffSeconds: 0,
        minsLeft: 0,
        secsLeft: 0,
        timeFormatted: isWeekend ? `Lunes a las ${firstSlot.time}` : `Próximo día escolar a las ${firstSlot.time}`,
        statusText: noSchoolInfo.reason
      };
    }

    // Si es día de semana (Lunes a Viernes)
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
          isSchoolDay: true,
          isWeekend: false,
          slot,
          diffSeconds,
          minsLeft,
          secsLeft,
          timeFormatted: `${minsLeft}m ${secsLeft < 10 ? '0' : ''}${secsLeft}s`,
          statusText: `En curso hoy`
        };
      }
    }

    // Si ya finalizaron todas las rotaciones del día de hoy
    const isFriday = dayOfWeek === 5;
    const isMorningCenterEnded = !hasAfternoonShift;
    return {
      isSchoolDay: false,
      isWeekend: false,
      slot: firstSlot,
      diffSeconds: 0,
      minsLeft: 0,
      secsLeft: 0,
      timeFormatted: isFriday ? `Lunes a las ${firstSlot.time}` : `Mañana a las ${firstSlot.time}`,
      statusText: isMorningCenterEnded
        ? (isFriday ? 'Fin de jornada semanal (Matutina)' : 'Jornada Matutina concluida • Timbre inactivo')
        : (isFriday ? 'Fin de jornada semanal' : 'Jornada de hoy concluida')
    };
  }, [currentTime, isWeekend, dayOfWeek, bellSlots, hasAfternoonShift, noSchoolInfo]);

  return {
    isBellEnabled,
    isSchoolDay,
    isWeekend,
    isHoliday: !isWeekend && noSchoolInfo.isNoSchool,
    noSchoolReason: noSchoolInfo.reason,
    isNoSchool: noSchoolInfo.isNoSchool,
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
