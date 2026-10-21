import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { playSchoolBellSound, SoundStyle } from '../utils/schoolBellAudio';
import { getDefaultMinerdEphemerides } from '../components/SchoolEphemeridesManager';
import { getStandardExtendedDaySlots } from '../services/scheduleService';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export interface BellSlot {
  time: string; // "08:00" (formato 24h HH:MM)
  label: string; // "1ra Hora de Clase", "Recreo", etc.
  type: 'class' | 'break' | 'assembly' | 'dismissal';
}

// Bloques estándar matutinos (cuando el centro no tiene configurada estructura propia)
const DEFAULT_SCHEDULE_MATUTINA: BellSlot[] = [
  { time: '07:45', label: 'Acto Cívico / Entrada', type: 'assembly' },
  { time: '08:00', label: '1ra Hora de Clase', type: 'class' },
  { time: '08:45', label: '2da Hora de Clase', type: 'class' },
  { time: '09:30', label: '3ra Hora de Clase', type: 'class' },
  { time: '10:15', label: 'Recreo Matutino', type: 'break' },
  { time: '10:45', label: '4ta Hora de Clase', type: 'class' },
  { time: '11:30', label: '5ta Hora de Clase', type: 'class' },
  { time: '12:15', label: '6ta Hora de Clase', type: 'class' },
  { time: '13:00', label: 'Salida Tanda Matutina', type: 'dismissal' }
];

// Bloques estándar vespertinos
const DEFAULT_SCHEDULE_VESPERTINA: BellSlot[] = [
  { time: '14:00', label: '1ra Hora Vespertina', type: 'class' },
  { time: '14:45', label: '2da Hora Vespertina', type: 'class' },
  { time: '15:30', label: '3ra Hora Vespertina', type: 'class' },
  { time: '16:15', label: 'Recreo Vespertino', type: 'break' },
  { time: '16:30', label: '4ta Hora Vespertina', type: 'class' },
  { time: '17:15', label: '5ta Hora Vespertina', type: 'class' },
  { time: '18:00', label: 'Salida Tanda Vespertina', type: 'dismissal' }
];

// Bloques oficiales MINERD Jornada Extendida (8 bloques, 2 recreos y almuerzo)
const DEFAULT_SCHEDULE_EXTENDIDA: BellSlot[] = [
  { time: '07:45', label: 'Acto a la Bandera / Entrada', type: 'assembly' },
  { time: '08:00', label: 'Desayuno Escolar', type: 'break' },
  { time: '08:15', label: '1ra Hora de Clase', type: 'class' },
  { time: '09:00', label: '2da Hora de Clase', type: 'class' },
  { time: '09:45', label: 'Recreo Matutino', type: 'break' },
  { time: '10:15', label: '3ra Hora de Clase', type: 'class' },
  { time: '11:00', label: '4ta Hora de Clase', type: 'class' },
  { time: '11:45', label: 'Almuerzo Escolar', type: 'break' },
  { time: '12:45', label: '5ta Hora de Clase', type: 'class' },
  { time: '13:30', label: '6ta Hora de Clase', type: 'class' },
  { time: '14:15', label: 'Recreo de la Tarde', type: 'break' },
  { time: '14:30', label: '7ma Hora de Clase', type: 'class' },
  { time: '15:15', label: '8va Hora de Clase', type: 'class' },
  { time: '16:00', label: 'Salida Jornada Extendida', type: 'dismissal' }
];

// Prevenir sonar más de 1 vez en el mismo minuto a nivel global del runtime
let globalLastTriggeredMinute = '';

export const useSchoolBell = () => {
  const { state, center, selectedYear, profile, user } = useApp();
  const userId = profile?.id || user?.id || '';

  // Estado del timbre guardado en localStorage y perfil
  const [isBellEnabled, setIsBellEnabled] = useState<boolean>(() => {
    try {
      if (userId) {
        const userSaved = localStorage.getItem(`edugens_user_bell_enabled_${userId}`);
        if (userSaved !== null) return JSON.parse(userSaved);
      }
      if (center?.id) {
        const centerSpecific = localStorage.getItem(`edugens_school_bell_enabled_${center.id}`);
        if (centerSpecific !== null) return JSON.parse(centerSpecific);
      }
      if (profile?.bell_settings?.is_enabled !== undefined) {
        return !!profile.bell_settings.is_enabled;
      }
      if (center?.bell_settings?.is_enabled !== undefined) {
        return !!center.bell_settings.is_enabled;
      }
      const saved = localStorage.getItem('edugens_school_bell_enabled');
      return saved !== null ? JSON.parse(saved) : true;
    } catch {
      return true;
    }
  });

  // Sonido de timbre con prioridad estricta en el PERFIL del usuario (consistencia permanente)
  const [soundStyle, setSoundStyleState] = useState<SoundStyle>(() => {
    try {
      if (userId) {
        const userSaved = localStorage.getItem(`edugens_user_bell_style_${userId}`);
        if (userSaved) return userSaved as SoundStyle;
      }
      if (profile?.bell_sound) {
        return profile.bell_sound as SoundStyle;
      }
      if (profile?.bell_settings?.sound_style) {
        return profile.bell_settings.sound_style as SoundStyle;
      }
      const saved = localStorage.getItem('edugens_school_bell_style');
      if (saved) return saved as SoundStyle;

      if (center?.id) {
        const centerSpecific = localStorage.getItem(`edugens_school_bell_style_${center.id}`);
        if (centerSpecific) return centerSpecific as SoundStyle;
      }
      if (center?.bell_settings?.sound_style) {
        return center.bell_settings.sound_style as SoundStyle;
      }
      return 'traditional';
    } catch {
      return 'traditional';
    }
  });

  const [volume, setVolumeState] = useState<number>(() => {
    try {
      if (userId) {
        const userVol = localStorage.getItem(`edugens_user_bell_volume_${userId}`);
        if (userVol) return Number(userVol);
      }
      if (center?.id) {
        const centerSpecific = localStorage.getItem(`edugens_school_bell_volume_${center.id}`);
        if (centerSpecific) return Number(centerSpecific);
      }
      if (profile?.bell_settings?.volume !== undefined) {
        return Number(profile.bell_settings.volume);
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

  // Sincronizar desde profile o center (SOLO si no hay una preferencia ya fijada por el usuario)
  useEffect(() => {
    if (profile?.bell_sound && profile.bell_sound !== soundStyle) {
      setSoundStyleState(profile.bell_sound as SoundStyle);
      if (userId) localStorage.setItem(`edugens_user_bell_style_${userId}`, profile.bell_sound);
      return;
    }
    const hasUserPref = (userId && localStorage.getItem(`edugens_user_bell_style_${userId}`)) || profile?.bell_sound;
    if (!hasUserPref && center?.bell_settings?.sound_style && center.bell_settings.sound_style !== soundStyle) {
      setSoundStyleState(center.bell_settings.sound_style as SoundStyle);
    }
  }, [profile?.bell_sound, userId, center?.bell_settings?.sound_style]);

  const toggleBell = useCallback(() => {
    setIsBellEnabled((prev) => {
      const next = !prev;
      if (userId) {
        localStorage.setItem(`edugens_user_bell_enabled_${userId}`, JSON.stringify(next));
      }
      localStorage.setItem('edugens_school_bell_enabled', JSON.stringify(next));
      if (center?.id) {
        localStorage.setItem(`edugens_school_bell_enabled_${center.id}`, JSON.stringify(next));
      }

      if (profile?.id) {
        supabase.from('profiles').update({
          bell_settings: {
            sound_style: soundStyle,
            volume: volume,
            is_enabled: next,
            updated_at: new Date().toISOString()
          }
        }).eq('id', profile.id).then(() => {}).catch(() => {});
      }

      if (next) {
        toast.success('🔔 Timbre Escolar Activado', { duration: 2500 });
        playSchoolBellSound(soundStyle, volume * 0.4);
      } else {
        toast('🔕 Timbre Escolar Desactivado', { duration: 2500 });
      }
      return next;
    });
  }, [soundStyle, volume, center?.id, profile?.id, userId]);

  // Guardar modelo de timbre en el perfil de forma PERMANENTE
  const setSoundStyle = (style: SoundStyle) => {
    setSoundStyleState(style);

    // 1. Persistencia local inmediata vinculada a este usuario
    if (userId) {
      localStorage.setItem(`edugens_user_bell_style_${userId}`, style);
    }
    localStorage.setItem('edugens_school_bell_style', style);
    if (center?.id) {
      localStorage.setItem(`edugens_school_bell_style_${center.id}`, style);
    }

    // 2. Actualizar perfil en memoria
    if (profile) {
      profile.bell_sound = style;
      if (!profile.bell_settings) profile.bell_settings = {};
      profile.bell_settings.sound_style = style;
    }

    // 3. Persistir en la base de datos (profiles)
    if (profile?.id) {
      supabase.from('profiles').update({
        bell_sound: style,
        bell_settings: {
          sound_style: style,
          volume: volume,
          is_enabled: isBellEnabled,
          updated_at: new Date().toISOString()
        }
      }).eq('id', profile.id).then(({ error }) => {
        if (error) {
          // Si la columna bell_sound aún no se ha creado vía migración, guardar en bell_settings
          supabase.from('profiles').update({
            bell_settings: {
              sound_style: style,
              volume: volume,
              is_enabled: isBellEnabled,
              updated_at: new Date().toISOString()
            }
          }).eq('id', profile.id).then(() => {}).catch(() => {});
        }
      }).catch(() => {});
    }

    // 4. Si es administrador, actualizar también a nivel institucional del centro
    if (center?.id && (profile?.role === 'admin' || profile?.role === 'creator' || profile?.is_superadmin)) {
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

    toast.success('Modelo de timbre guardado permanentemente', { duration: 2500 });
  };

  const setVolume = (vol: number) => {
    setVolumeState(vol);
    if (userId) {
      localStorage.setItem(`edugens_user_bell_volume_${userId}`, String(vol));
    }
    localStorage.setItem('edugens_school_bell_volume', String(vol));
    if (center?.id) {
      localStorage.setItem(`edugens_school_bell_volume_${center.id}`, String(vol));
    }

    if (profile?.id) {
      supabase.from('profiles').update({
        bell_settings: {
          sound_style: soundStyle,
          volume: vol,
          is_enabled: isBellEnabled,
          updated_at: new Date().toISOString()
        }
      }).eq('id', profile.id).then(() => {}).catch(() => {});
    }
  };

  const testSound = useCallback(() => {
    playSchoolBellSound(soundStyle, volume);
  }, [soundStyle, volume]);

  // Detectar si el centro tiene tanda vespertina activa
  const hasAfternoonShift = useMemo(() => {
    const hasVespCourse = (state.courses || []).some((c: any) => {
      const t = (c.tanda || '').toLowerCase().trim();
      return t.includes('ves') || t.includes('tar');
    });
    const hasVespSchedule = (state.levelSchedules || []).some((ls: any) => {
      const s = (ls.shift || '').toLowerCase().trim();
      return s.includes('ves') || s.includes('tar');
    });
    const hasVespEntries = (state.schedule || []).some((s: any) => {
      const sh = (s.shift || '').toLowerCase().trim();
      return sh.includes('ves') || sh.includes('tar');
    });
    const hasVespCycleBlock = (state.cycleTimeBlocks || []).some((cfg: any) => {
      const s = (cfg.shift || '').toLowerCase().trim();
      return s.includes('ves') || s.includes('tar');
    });
    return hasVespCourse || hasVespSchedule || hasVespEntries || hasVespCycleBlock;
  }, [state.courses, state.levelSchedules, state.schedule, state.cycleTimeBlocks]);

  // Construir los horarios oficiales de timbrado adaptados al docente y al centro
  const bellSlots = useMemo<BellSlot[]>(() => {
    const rawSlots: BellSlot[] = [];

    // A. Identificar si el usuario actual es docente y sus cursos asignados
    const isTeacher = profile?.role === 'teacher' || !!profile?.teacher_id;
    const teacherId = profile?.teacher_id || (typeof window !== 'undefined' ? localStorage.getItem('selected_teacher_id') : '') || '';

    let teacherCourses: any[] = [];
    if (teacherId && state.courses) {
      const assignedCourseIds = new Set<string>();
      (state.assignments || []).forEach((a: any) => {
        if (a.teacher_id === teacherId) assignedCourseIds.add(String(a.course_id));
      });
      (state.schedule || []).forEach((s: any) => {
        if (s.teacher_id === teacherId) assignedCourseIds.add(String(s.course_id || s.courseId));
      });
      (state.courses || []).forEach((c: any) => {
        if (c.teacher_id === teacherId || c.headquarter_teacher_id === teacherId) {
          assignedCourseIds.add(String(c.id));
        }
      });
      teacherCourses = (state.courses || []).filter((c: any) => assignedCourseIds.has(String(c.id)));
    }

    const isTeacherExtended = teacherCourses.some((c: any) => {
      const t = (c.tanda || '').toLowerCase();
      return t.includes('ext') || t.includes('jor');
    });
    const isTeacherVespertina = !isTeacherExtended && teacherCourses.length > 0 && teacherCourses.every((c: any) => {
      const t = (c.tanda || '').toLowerCase();
      return t.includes('ves') || t.includes('tar');
    });

    // Detectar si el centro en general opera con Jornada Extendida
    const centerIsExtended = (state.courses || []).some((c: any) => {
      const t = (c.tanda || '').toLowerCase();
      return t.includes('ext') || t.includes('jor');
    }) || (state.levelSchedules || []).some((ls: any) => {
      const s = (ls.shift || '').toLowerCase();
      return s.includes('ext') || s.includes('jor');
    }) || (state.cycleTimeBlocks || []).some((cfg: any) => {
      const s = (cfg.shift || '').toLowerCase();
      return s.includes('ext') || s.includes('jor');
    });

    // 1. PRIORIDAD MÁXIMA: Estructuras de Bloques por Ciclo del Centro (cycleTimeBlocks)
    const cycleConfigs = state.cycleTimeBlocks || [];
    if (cycleConfigs.length > 0) {
      let relevantConfigs = cycleConfigs;

      // Si es docente con cursos identificados, filtrar las configuraciones de su tanda/nivel
      if (isTeacher && teacherCourses.length > 0) {
        const teacherLevels = new Set(teacherCourses.map((c: any) => (c.level || '').toLowerCase().trim()));
        const teacherShifts = new Set(teacherCourses.map((c: any) => (c.tanda || '').toLowerCase().trim()));

        const matched = cycleConfigs.filter((cfg: any) => {
          const cfgLevel = (cfg.level || '').toLowerCase().trim();
          const cfgShift = (cfg.shift || '').toLowerCase().trim();
          const levelMatch = Array.from(teacherLevels).some((tl) => tl && (cfgLevel.includes(tl) || tl.includes(cfgLevel)));
          const shiftMatch = Array.from(teacherShifts).some((ts) => ts && (cfgShift.includes(ts) || ts.includes(cfgShift)));
          return levelMatch || shiftMatch;
        });

        if (matched.length > 0) {
          relevantConfigs = matched;
        }
      }

      // Extraer los slots de cada configuración oficial
      relevantConfigs.forEach((cfg: any) => {
        if (!cfg.slots || cfg.slots.length === 0) return;

        let periodCount = 1;
        cfg.slots.forEach((s: any, idx: number) => {
          const rawStart = (s.start || '').trim();
          const start5 = rawStart.substring(0, 5);
          if (!start5 || start5.length < 4) return;

          const isBreak = !!s.isBreak;
          const label = s.label || (isBreak ? 'Recreo / Descanso' : `${periodCount}ra Hora de Clase`);
          if (!isBreak) periodCount++;

          rawSlots.push({
            time: start5,
            label,
            type: isBreak ? 'break' : 'class'
          });

          // Si es el último bloque de la tanda, registrar también la hora de Salida Oficial
          if (idx === cfg.slots.length - 1) {
            const rawEnd = (s.end || '').trim();
            const end5 = rawEnd.substring(0, 5);
            if (end5 && end5.length >= 4) {
              rawSlots.push({
                time: end5,
                label: `Salida de Clases (${cfg.shift || 'Oficial'})`,
                type: 'dismissal'
              });
            }
          }
        });
      });
    }

    // 2. Si no hubo cycleTimeBlocks pero el centro o docente es Jornada Extendida
    if (rawSlots.length === 0 && (isTeacherExtended || centerIsExtended)) {
      const extSlots = getStandardExtendedDaySlots();
      extSlots.forEach((s: any, idx: number) => {
        const s5 = s.start.substring(0, 5);
        rawSlots.push({
          time: s5,
          label: s.label || (s.isBreak ? 'Recreo / Almuerzo' : 'Hora de Clase'),
          type: s.isBreak ? 'break' : 'class'
        });
        if (idx === extSlots.length - 1) {
          const e5 = s.end.substring(0, 5);
          rawSlots.push({
            time: e5,
            label: 'Salida de Clases (Jornada Extendida)',
            type: 'dismissal'
          });
        }
      });
    }

    // 3. Si no hay Jornada Extendida ni cycleTimeBlocks, usar horarios por nivel (levelSchedules) y recreos
    if (rawSlots.length === 0 && state.levelSchedules && state.levelSchedules.length > 0) {
      state.levelSchedules.forEach((ls: any) => {
        const isVespLs = (ls.shift || '').toLowerCase().includes('ves') || (ls.shift || '').toLowerCase().includes('tar');
        if (!hasAfternoonShift && isVespLs) return;

        if (ls.start_time) {
          rawSlots.push({
            time: ls.start_time.substring(0, 5),
            label: `Inicio de Clases (${ls.level || 'Nivel'})`,
            type: 'class'
          });
        }
        if (ls.end_time) {
          rawSlots.push({
            time: ls.end_time.substring(0, 5),
            label: `Salida de Clases (${ls.level || 'Nivel'})`,
            type: 'dismissal'
          });
        }
      });

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
    }

    // 4. Fallback ÚNICAMENTE si no existe ninguna configuración registrada en el centro
    if (rawSlots.length === 0) {
      if (isTeacherVespertina) {
        return DEFAULT_SCHEDULE_VESPERTINA;
      }
      return hasAfternoonShift
        ? [...DEFAULT_SCHEDULE_MATUTINA, ...DEFAULT_SCHEDULE_VESPERTINA]
        : [...DEFAULT_SCHEDULE_MATUTINA];
    }

    // 5. Desduplicar y ordenar por hora (SIN concatenar fallbackDefaults para evitar timbres extra)
    const uniqueMap = new Map<string, BellSlot>();
    rawSlots.forEach((slot) => {
      if (!uniqueMap.has(slot.time)) {
        uniqueMap.set(slot.time, slot);
      }
    });

    return Array.from(uniqueMap.values()).sort((a, b) => a.time.localeCompare(b.time));
  }, [
    state.cycleTimeBlocks,
    state.courses,
    state.assignments,
    state.schedule,
    state.levelSchedules,
    state.breakPreferences,
    profile?.role,
    profile?.teacher_id,
    hasAfternoonShift
  ]);

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

    // Evitar disparar múltiples veces dentro del mismo minuto (a nivel local y global)
    if (lastTriggeredMinuteRef.current === timeKey || globalLastTriggeredMinute === timeKey) return;

    const matchingSlot = bellSlots.find((s) => s.time === timeKey);
    if (matchingSlot) {
      lastTriggeredMinuteRef.current = timeKey;
      globalLastTriggeredMinute = timeKey;

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
