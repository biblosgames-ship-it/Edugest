/** VERSION 45.0 - BLINDAJE TOTAL Y LIMPIEZA DE CÓDIGO **/
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Download,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Sparkles,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Clock,
  Calendar,
  ShieldCheck,
  Wrench,
  Lock,
  Unlock,
  Zap,
  Trash2
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import * as XLSX from 'xlsx';
import { SEO } from './SEO';

import { scheduleService } from '../services/scheduleService';
import { supabase } from '../lib/supabase';

export const ScheduleViewer = () => {
  const { state, profile, refreshData, selectedYear, setAvoidDeporteDuringAnyBreak } = useApp();

  const isAdminOrStaff =
    profile?.role && ['admin', 'coordinator', 'finance', 'superAdmin'].includes(profile.role);
  const isStudentOrParent = profile?.role === 'student' || profile?.role === 'parent';

  const [selectedShift, setSelectedShift] = useState<'Matutina' | 'Vespertina'>('Matutina');
  const [filterType, setFilterType] = useState<'all' | 'course' | 'teacher'>(() => {
    if (profile?.role === 'student' || profile?.role === 'parent') return 'course';
    return 'all';
  });
  const [filterId, setFilterId] = useState(() => {
    if (profile?.role === 'student') return profile.course_id || profile.course_code || '';
    if (profile?.role === 'parent') {
      const saved = localStorage.getItem('parent_course_ids');
      let localList: string[] = [];
      try {
        localList = saved ? JSON.parse(saved) : [];
      } catch {}
      const firstId = profile?.parent_course_ids?.[0] || localList?.[0] || '';
      return firstId || localStorage.getItem('selected_course_id') || '';
    }
    return '';
  });
  const [viewMode, setViewMode] = useState<'list' | 'matrix'>('matrix');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRepairing, setIsRepairing] = useState(false);
  const [isDeepRepairing, setIsDeepRepairing] = useState(false);
  const [deepRepairAttempt, setDeepRepairAttempt] = useState(0);
  const tableRef = useRef<HTMLDivElement>(null);

  // Candados de Seguridad 🔒 (Blindaje de casillas y bloqueo maestro del horario)
  const lockStorageKey = `edugens_locked_entries_${profile?.center_id || 'default'}_${selectedShift}_${selectedYear || 'default'}`;
  const [lockedEntries, setLockedEntries] = useState<Set<string>>(() => {
    const initialSet = new Set<string>();
    try {
      const saved = localStorage.getItem(lockStorageKey);
      if (saved) JSON.parse(saved).forEach((k: string) => initialSet.add(k));
    } catch {}
    return initialSet;
  });

  // Sincronizar candados al cambiar de tanda, año o al cargar el horario de la DB
  useEffect(() => {
    const combinedSet = new Set<string>();

    // 1. Cargar desde la base de datos (e.is_locked = true)
    (state.schedule || []).forEach((e: any) => {
      const isShiftMatch = !selectedShift || e.shift === selectedShift;
      const isYearMatch = !selectedYear || !e.school_year || e.school_year === selectedYear;
      if (isShiftMatch && isYearMatch && e.is_locked) {
        if (e.id) combinedSet.add(e.id);
        combinedSet.add(`${e.course_id}_${e.day}_${e.start_time}`);
      }
    });

    // 2. Cargar desde almacenamiento local
    try {
      const saved = localStorage.getItem(lockStorageKey);
      if (saved) {
        JSON.parse(saved).forEach((k: string) => combinedSet.add(k));
      }
    } catch {}

    setLockedEntries(combinedSet);
  }, [lockStorageKey, state.schedule, selectedShift, selectedYear]);

  const toggleLock = async (entry: any) => {
    const locKey = `${entry.course_id}_${entry.day}_${entry.start_time}`;
    const idKey = entry.id;
    const isCurrentlyLocked = (idKey && lockedEntries.has(idKey)) || lockedEntries.has(locKey);
    const newLockState = !isCurrentlyLocked;

    // Actualizar estado local inmediatamente
    setLockedEntries((prev) => {
      const next = new Set(prev);
      if (isCurrentlyLocked) {
        if (idKey) next.delete(idKey);
        next.delete(locKey);
      } else {
        if (idKey) next.add(idKey);
        next.add(locKey);
      }
      localStorage.setItem(lockStorageKey, JSON.stringify(Array.from(next)));
      return next;
    });

    // Persistir directamente en Supabase (Base de Datos)
    try {
      if (entry.id) {
        await supabase
          .from('schedule_entries')
          .update({ is_locked: newLockState })
          .eq('id', entry.id);
      } else if (entry.course_id && entry.day && entry.start_time) {
        await supabase
          .from('schedule_entries')
          .update({ is_locked: newLockState })
          .eq('course_id', entry.course_id)
          .eq('day', entry.day)
          .eq('start_time', entry.start_time);
      }
    } catch (err) {
      console.warn('Nota de guardado en DB de is_locked:', err);
    }
  };

  // Verificar si todas las materias programadas de este turno están blindadas
  const isAllLocked = useMemo(() => {
    const shiftEntries = (state.schedule || []).filter(
      (s: any) => s.shift === selectedShift && (!selectedYear || s.school_year === selectedYear)
    );
    if (shiftEntries.length === 0) return false;
    return shiftEntries.every(
      (e: any) =>
        lockedEntries.has(e.id) || lockedEntries.has(`${e.course_id}_${e.day}_${e.start_time}`)
    );
  }, [state.schedule, selectedShift, selectedYear, lockedEntries]);

  // Blindar / Desblindar todas las materias del turno actual juntas con un solo clic
  const toggleLockAllSchedule = async () => {
    const shiftEntries = (state.schedule || []).filter(
      (s: any) => s.shift === selectedShift && (!selectedYear || s.school_year === selectedYear)
    );
    if (shiftEntries.length === 0) {
      alert('No hay materias programadas en este horario para blindar.');
      return;
    }

    const newLockState = !isAllLocked;

    setLockedEntries((prev) => {
      const next = new Set(prev);
      if (isAllLocked) {
        // Desbloquear todas las materias del turno actual
        shiftEntries.forEach((e: any) => {
          next.delete(e.id);
          next.delete(`${e.course_id}_${e.day}_${e.start_time}`);
        });
      } else {
        // Bloquear todas las materias del turno actual
        shiftEntries.forEach((e: any) => {
          next.add(e.id);
          next.add(`${e.course_id}_${e.day}_${e.start_time}`);
        });
      }
      localStorage.setItem(lockStorageKey, JSON.stringify(Array.from(next)));
      return next;
    });

    // Persistir blindaje completo en Supabase DB
    try {
      if (profile?.center_id) {
        let query = supabase
          .from('schedule_entries')
          .update({ is_locked: newLockState })
          .eq('center_id', profile.center_id)
          .eq('shift', selectedShift);
        if (selectedYear) {
          query = query.eq('school_year', selectedYear);
        }
        await query;
      }
    } catch (err) {
      console.warn('Nota de guardado en DB de blindaje:', err);
    }
  };

  // Asistente de Intercambio Directo Modal State
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapCourseId, setSwapCourseId] = useState('');
  const [swapSubjectId, setSwapSubjectId] = useState('');
  const [swapDayFilter, setSwapDayFilter] = useState('Todos');

  // Modal de Asignación Directa desde Casilla Vacía
  const [directAssignModal, setDirectAssignModal] = useState<{
    open: boolean;
    day: string;
    slot: any;
    courseId: string;
    subjectId: string;
  }>({
    open: false,
    day: '',
    slot: null,
    courseId: '',
    subjectId: ''
  });

  // Sincronizar reactivamente el filtro de grado si cambia el perfil del alumno/padre
  useEffect(() => {
    if (isStudentOrParent) {
      setFilterType('course');
      const activeId =
        profile?.role === 'student'
          ? profile.course_id || profile.course_code || ''
          : localStorage.getItem('selected_course_id') || profile?.parent_course_ids?.[0] || '';
      setFilterId(activeId);
    }
  }, [profile, isStudentOrParent]);

  // Escuchar cambios de curso desde el Dashboard (para padres alternando hijos)
  useEffect(() => {
    const handleCourseChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (isStudentOrParent) {
        setFilterType('course');
        setFilterId(customEvent.detail);
      }
    };

    window.addEventListener('selectedCourseChanged', handleCourseChange);
    return () => {
      window.removeEventListener('selectedCourseChanged', handleCourseChange);
    };
  }, [isStudentOrParent]);

  // Sincronizar la tanda del curso de manera automática para alumnos y padres
  useEffect(() => {
    if (isStudentOrParent && filterId) {
      const activeCourse = state.courses.find((c) => c.id === filterId);
      if (activeCourse) {
        const tStr = (activeCourse.tanda || '').toLowerCase();
        const lvlStr = (activeCourse.level || '').toLowerCase();
        const isVespertina =
          tStr.includes('ves') || tStr.includes('tar') || (tStr === '' && lvlStr.includes('secun'));
        setSelectedShift(isVespertina ? 'Vespertina' : 'Matutina');
      }
    }
  }, [filterId, state.courses, isStudentOrParent]);

  const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
  const schedule = state.schedule || [];
  const isMorning = selectedShift === 'Matutina';
  const cleanDuration = isMorning ? 45 : 40;
  const targetTotal = isMorning ? 5 : 6;
  const preCount = Math.floor(targetTotal / 2);
  const postCount = targetTotal - preCount;

  const toMins = (val: string) => {
    const [h, m] = (val || '')
      .replace(/[^0-9:]/g, '')
      .split(':')
      .map(Number);
    return (h || 0) * 60 + (m || 0);
  };

  const fromMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  };

  const filteredSchedule = useMemo(() => {
    let list = [...(state.schedule || [])];
    const shiftBase = selectedShift.toLowerCase().substring(0, 3);
    // FILTRO ROBUSTO POR AÑO Y TANDA
    list = list.filter((s: any) => {
      const sShift = (s.shift || '').toLowerCase();
      const shiftMatch = !sShift || sShift.includes(shiftBase) || shiftBase.includes(sShift.substring(0, 3));
      const yearMatch = !selectedYear || s.school_year === selectedYear;
      return shiftMatch && yearMatch;
    });

    if (filterType === 'teacher' && filterId) {
      list = list.filter((s: any) => {
        if (s.teacher_id === filterId) return true;
        if (!s.teacher_id) {
          return (state.assignments || []).some(
            (a: any) =>
              a.teacher_id === filterId &&
              (a.course_id === s.course_id || a.courseId === s.course_id) &&
              a.subject_id === s.subject_id
          );
        }
        return false;
      });
    }

    if (filterType === 'course' && filterId) {
      list = list.filter((s: any) => {
        const sCid = s.course_id || s.courseId;
        return sCid === filterId;
      });
    }

    return list;
  }, [state.schedule, state.assignments, filterType, filterId, selectedShift, selectedYear]);

  const timeSlots = useMemo(() => {
    let startT = isMorning ? 480 : 840; // 08:00 o 14:00
    let endT = isMorning ? 720 : 1095; // 12:00 o 18:15 default

    const findOfficialSchedule = (schedules: any[], levelName: string, shiftName: string) => {
      if (!schedules || schedules.length === 0) return null;
      const lNorm = (levelName || '').toLowerCase().substring(0, 3);
      const sNorm = (shiftName || '').toLowerCase().substring(0, 3);

      let match = schedules.find((ls: any) => {
        const lsLvl = (ls.level || '').toLowerCase();
        const lsShift = (ls.shift || '').toLowerCase();
        const lvlMatch = !lNorm || lsLvl.substring(0, 3) === lNorm || lNorm.includes(lsLvl.substring(0, 3));
        const shiftMatch =
          lsShift.substring(0, 3) === sNorm ||
          (sNorm === 'mat' && (lsShift.includes('mañ') || lsShift.includes('ext') || lsShift.includes('com'))) ||
          (sNorm === 'ves' && (lsShift.includes('tar') || lsShift.includes('ves')));
        return lvlMatch && shiftMatch;
      });

      if (!match) {
        match = schedules.find((ls: any) => {
          const lsShift = (ls.shift || '').toLowerCase();
          return (
            lsShift.substring(0, 3) === sNorm ||
            (sNorm === 'mat' && (lsShift.includes('mañ') || lsShift.includes('ext') || lsShift.includes('com'))) ||
            (sNorm === 'ves' && (lsShift.includes('tar') || lsShift.includes('ves')))
          );
        });
      }
      return match || null;
    };

    // Si estamos filtrando por un curso específico, intentar obtener SU horario oficial
    if (filterType === 'course' && filterId) {
      const course = state.courses.find((c) => c.id === filterId);
      if (course) {
        const official = findOfficialSchedule(state.levelSchedules, course.level, selectedShift);
        if (official) {
          let s = toMins(official.start_time);
          if (!isMorning && s < 720 && s > 0) s += 720;
          let e = toMins(official.end_time);
          if (!isMorning && e < 720 && e > 0) e += 720;
          startT = s;
          endT = e;
        }
      }
    } else if (filterType === 'all') {
      // En vista general, buscamos el horario más común de la tanda seleccionada
      const primaryOfficial = findOfficialSchedule(state.levelSchedules, 'Primario', selectedShift);
      if (primaryOfficial) {
        let s = toMins(primaryOfficial.start_time);
        if (!isMorning && s < 720 && s > 0) s += 720;
        let e = toMins(primaryOfficial.end_time);
        if (!isMorning && e < 720 && e > 0) e += 720;
        startT = s;
        endT = e;
      }
    }

    // Bloque maestro de recreo (priorizando el nivel del contexto actual)
    const firstRelevantBreak = (state.breakPreferences || []).find((bp: any) => {
      let bpMins = toMins(bp.startTime);
      if (!isMorning && bpMins < 720) bpMins += 720;
      const isBpMorning = bpMins < 780; // Antes de la 1 PM es mañana
      return isMorning === isBpMorning;
    });

    const rawMasterStart = firstRelevantBreak?.startTime || (isMorning ? '10:00:00' : '16:00:00');
    let masterStartMins = toMins(rawMasterStart);
    if (!isMorning && masterStartMins < 720 && masterStartMins > 0) masterStartMins += 720;
    if (!isMorning && (masterStartMins <= startT || masterStartMins >= endT)) masterStartMins = 960;
    const masterBPref = {
      startTime: fromMins(masterStartMins),
      durationMinutes: firstRelevantBreak?.durationMinutes || (isMorning ? 30 : 15)
    };

    const getSlotsForCourse = (course: any) => {
      const courseOfficial = findOfficialSchedule(state.levelSchedules, course.level, selectedShift);
      let courseStartT = startT;
      let courseEndT = endT;
      if (courseOfficial?.start_time) {
        let s = toMins(courseOfficial.start_time);
        if (!isMorning && s < 720 && s > 0) s += 720;
        courseStartT = s;
      }
      if (courseOfficial?.end_time) {
        let e = toMins(courseOfficial.end_time);
        if (!isMorning && e < 720 && e > 0) e += 720;
        courseEndT = e;
      }

      const grade = course.grade?.toLowerCase() || '';
      const cycleStr = (course.cycle || '').toLowerCase();

      const isFirstCycle =
        cycleStr.includes('primer') ||
        cycleStr.includes('1er') ||
        cycleStr.includes('1') ||
        (!cycleStr.includes('segundo') &&
          !cycleStr.includes('2do') &&
          !grade.includes('segundo ciclo') &&
          !grade.includes('2do ciclo') &&
          (/^[1-3]/.test(grade) ||
            grade.includes('1ro') ||
            grade.includes('2do') ||
            grade.includes('3ro') ||
            grade.includes('primer') ||
            grade.includes('tercer')));

      const isSecondCycle =
        cycleStr.includes('segundo') ||
        cycleStr.includes('2do') ||
        cycleStr.includes('2') ||
        grade.includes('segundo ciclo') ||
        grade.includes('2do ciclo') ||
        /^[4-6]/.test(grade) ||
        grade.includes('4to') ||
        grade.includes('5to') ||
        grade.includes('6to') ||
        grade.includes('cuarto') ||
        grade.includes('quinto') ||
        grade.includes('sexto');

      const applicableBPs = (state.breakPreferences || []).filter((bp: any) => {
        let bpMins = toMins(bp.startTime);
        if (!isMorning && bpMins < 420) bpMins += 720;
        const isBpMorning = bpMins < 780;
        if (isMorning !== isBpMorning) return false;

        const levelNormBP = (bp.level || '').toLowerCase();
        const levelNormCourse = (course.level || '').toLowerCase();

        // Coincidencia permisiva (General, Todo el Centro, Primario vs Primaria)
        if (!levelNormBP || levelNormBP.includes('gen') || levelNormBP.includes('todo')) return true;
        return (
          levelNormBP.substring(0, 3) === levelNormCourse.substring(0, 3) ||
          levelNormCourse.includes(levelNormBP.substring(0, 3))
        );
      });

      let bPref = applicableBPs.find((bp: any) => {
        const cNorm = (bp.cycle || '').toLowerCase();
        if (isFirstCycle && (cNorm.includes('primer') || cNorm.includes('1er') || cNorm.includes('1'))) return true;
        if (isSecondCycle && (cNorm.includes('segundo') || cNorm.includes('2do') || cNorm.includes('2'))) return true;
        return false;
      });

      if (!bPref) {
        bPref = applicableBPs.find((bp: any) => {
          const cNorm = (bp.cycle || '').toLowerCase();
          return !cNorm || cNorm === 'general' || cNorm === 'gen';
        });
      }

      bPref = bPref || masterBPref;

      let bStart = toMins(bPref.startTime);
      if (!isMorning && bStart < 720 && bStart > 0) bStart += 720;
      if (!isMorning && (bStart <= courseStartT || bStart >= courseEndT)) bStart = 960;
      const bEnd = bStart + (Number(bPref.durationMinutes) || masterBPref.durationMinutes);

      // 1. EVENTO FIJO DE APERTURA / ACTO DE BANDERA (100% Dinámico desde Preferencias de la DB)
      const dbActoEvent = (state.fixedEvents || []).find((fe: any) => {
        const feName = (fe.name || '').toLowerCase();
        return feName.includes('acto') || feName.includes('bandera') || feName.includes('apertura');
      });

      let classStart = courseOfficial?.start_time ? courseStartT : (isMorning && startT <= 480 ? 480 : startT);
      const slots = [];

      if (isMorning && dbActoEvent) {
        const feEndMins = toMins(dbActoEvent.end_time);
        if (feEndMins > 0) classStart = feEndMins;

        slots.push({
          start: dbActoEvent.start_time,
          end: dbActoEvent.end_time,
          isBreak: true,
          label: dbActoEvent.name
        });
      }

      const levelNormCourse = (course.level || '').toLowerCase();
      const isPrimariaOrInicial = levelNormCourse.includes('primar') || levelNormCourse.includes('ini');
      const isSecundaria = levelNormCourse.includes('secun');
      const targetTotalLocal = isSecundaria ? 6 : 5;

      const calculateSlotDurations = (totalMins: number, preferredCount: number) => {
        if (totalMins <= 0 || preferredCount <= 0) return [];
        let count = preferredCount;
        while (count > 1 && totalMins / count < 33) {
          count--;
        }
        while (totalMins / count > 45 && count < 6) {
          count++;
        }
        const base = Math.floor(totalMins / count);
        let rem = totalMins - base * count;
        const durs = new Array(count).fill(base);
        for (let idx = 0; idx < count && rem > 0; idx++) {
          durs[idx] += 1;
          rem -= 1;
        }
        return durs;
      };

      // CÁLCULO FLEXIBLE Y DINÁMICO ANTES DEL RECREO (entre 33 y 45 minutos por clase)
      const preWindow = Math.max(0, bStart - classStart);
      let preCountLocal = targetTotalLocal === 5 ? 2 : 3;
      if (preWindow / preCountLocal < 33) {
        preCountLocal = Math.max(1, Math.floor(preWindow / 33));
      }
      const preDurs = calculateSlotDurations(preWindow, preCountLocal);
      preCountLocal = preDurs.length;

      let currTimePre = classStart;
      for (let i = 0; i < preCountLocal; i++) {
        let dur = preDurs[i];
        let sTime = currTimePre;
        let eTime = i === preCountLocal - 1 ? bStart : sTime + dur;
        currTimePre = eTime;

        slots.push({
          start: fromMins(sTime) + ':00',
          end: fromMins(eTime) + ':00',
          isBreak: false,
          label: `${i + 1}ra Hora`
        });
      }

      // EL RECREO
      slots.push({ start: fromMins(bStart) + ':00', end: fromMins(bEnd) + ':00', isBreak: true, label: 'RECREO' });

      // Eventos Fijos Post-Recreo (filtrados por nivel y ciclo)
      let currTimePost = bEnd;
      const postFixedEvents = (state.fixedEvents || []).filter((fe: any) => {
        const feName = (fe.name || '').toLowerCase();
        const isActo = feName.includes('acto') || feName.includes('bandera') || feName.includes('apertura');
        const feStartMins = toMins(fe.start_time);
        if (isActo || feStartMins < bStart - 5 || feStartMins >= courseEndT) return false;

        const feLevel = (fe.level || '').toLowerCase();
        const feCycle = (fe.cycle || '').toLowerCase();
        const levelMatch =
          !feLevel || feLevel.includes('gen') || feLevel.substring(0, 3) === levelNormCourse.substring(0, 3);
        const cycleMatch =
          !feCycle ||
          feCycle.includes('gen') ||
          (isFirstCycle && (feCycle.includes('primer') || feCycle.includes('1'))) ||
          (isSecondCycle && (feCycle.includes('segundo') || feCycle.includes('2')));
        return levelMatch && cycleMatch;
      });

      postFixedEvents.forEach((fe: any) => {
        const feEndMins = toMins(fe.end_time);
        if (feEndMins > currTimePost) {
          const sFormatted = fe.start_time.length === 5 ? fe.start_time + ':00' : fe.start_time;
          const eFormatted = fe.end_time.length === 5 ? fe.end_time + ':00' : fe.end_time;
          slots.push({
            start: sFormatted,
            end: eFormatted,
            isBreak: true,
            label: fe.name
          });
          currTimePost = Math.max(currTimePost, feEndMins);
        }
      });

      // CÁLCULO FLEXIBLE Y DINÁMICO DESPUÉS DEL RECREO
      const postWindow = Math.max(0, courseEndT - currTimePost);
      let postCountLocal = Math.max(1, targetTotalLocal - preCountLocal);
      const postDurs = calculateSlotDurations(postWindow, postCountLocal);

      for (let i = 0; i < postDurs.length; i++) {
        let dur = postDurs[i];
        let sTime = currTimePost;
        let eTime = i === postDurs.length - 1 ? courseEndT : sTime + dur;
        currTimePost = eTime;

        slots.push({
          start: fromMins(sTime) + ':00',
          end: fromMins(eTime) + ':00',
          isBreak: false,
          label: `${preCountLocal + i + 1}ra Hora`
        });
      }

      return slots;
    };

    // Si estamos filtrando por un curso específico, usamos sus slots exactos
    if (filterType === 'course' && filterId) {
      const course = state.courses.find((c) => c.id === filterId);
      if (course) {
        const slotsForCourse = getSlotsForCourse(course);
        return { slots: slotsForCourse, startT, endT, masterBPref };
      }
    }

    // VISTA DE DOCENTE: construir grilla unificada desde todos los cursos que enseña
    // Esto garantiza que cada bloque horario aparezca en su fila exacta,
    // sin importar que el docente enseñe en múltiples niveles o ciclos con distintos recreos.
    if (filterType === 'teacher' && filterId) {
      const shiftBaseTeacher = selectedShift.toLowerCase().substring(0, 3);
      // Obtener los cursos asignados a este docente en este turno
      const teacherAssignmentCourseIds = [
        ...new Set(
          (state.assignments || [])
            .filter((a: any) => a.teacher_id === filterId)
            .map((a: any) => a.course_id || a.courseId)
        )
      ];
      const teacherCourses = (state.courses || []).filter((c: any) => {
        if (!teacherAssignmentCourseIds.includes(c.id)) return false;
        const tStr = (c.tanda || '').toLowerCase();
        const lvlStr = (c.level || '').toLowerCase();
        if (shiftBaseTeacher === 'mat') {
          return (
            tStr.includes('mat') ||
            tStr.includes('mañ') ||
            tStr.includes('ext') ||
            tStr.includes('com') ||
            tStr === '' ||
            ((lvlStr.includes('primar') || lvlStr.includes('ini')) &&
              !tStr.includes('ves') &&
              !tStr.includes('tar'))
          );
        } else {
          return (
            tStr.includes('ves') ||
            tStr.includes('tar') ||
            (tStr === '' && lvlStr.includes('secun'))
          );
        }
      });

      if (teacherCourses.length > 0) {
        // Generar slots para cada curso y fusionarlos
        const mergedSlotsMap: Map<string, any> = new Map();
        teacherCourses.forEach((course: any) => {
          const courseSlots = getSlotsForCourse(course);
          courseSlots.forEach((slot: any) => {
            const existing = mergedSlotsMap.get(slot.start);
            if (!existing) {
              mergedSlotsMap.set(slot.start, { ...slot });
            } else {
              // Si CUALQUIER curso marca este bloque como clase (no recreo), prevalece como clase
              // Solo es recreo si TODOS los cursos que tienen este bloque lo marcan como recreo
              if (!slot.isBreak) existing.isBreak = false;
            }
          });
        });
        // Ordenar cronológicamente
        let mergedSlots = [...mergedSlotsMap.values()].sort(
          (a, b) => toMins(a.start) - toMins(b.start)
        );

        // Vista Compacta para Docentes: solo conservar slots con clases programadas o recreos
        const teacherSchedule = (state.schedule || []).filter(
          (s: any) =>
            s.teacher_id === filterId && s.shift === selectedShift && s.school_year === selectedYear
        );
        if (teacherSchedule.length > 0) {
          mergedSlots = mergedSlots.filter((slot) => {
            const hasEntry = teacherSchedule.some((entry) => {
              const eMins = toMins(entry.start_time);
              let closest = mergedSlots[0],
                bestDiff = Infinity;
              mergedSlots.forEach((temp) => {
                const diff = Math.abs(toMins(temp.start) - eMins);
                if (diff < bestDiff) {
                  bestDiff = diff;
                  closest = temp;
                }
              });
              return closest.start === slot.start && bestDiff <= 25;
            });
            return hasEntry;
          });
        }

        return { slots: mergedSlots, startT, endT, masterBPref };
      }
    }

    // VISTA GENERAL: Generar periodos estándar alineados al Recreo Maestro
    const slots = [];
    let bStartMaster = toMins(masterBPref.startTime);
    if (!isMorning && bStartMaster < 720 && bStartMaster > 0) bStartMaster += 720;
    if (!isMorning && (bStartMaster <= startT || bStartMaster >= endT)) bStartMaster = 960;
    const bEndMaster = bStartMaster + (Number(masterBPref.durationMinutes) || (isMorning ? 20 : 15));

    let classStart = startT;

    // Solo mostrar Acto de Bandera/Apertura si está configurado explícitamente en la base de datos
    const dbActoEvent = (state.fixedEvents || []).find((fe: any) => {
      const feName = (fe.name || '').toLowerCase();
      return feName.includes('acto') || feName.includes('bandera') || feName.includes('apertura');
    });

    if (isMorning && dbActoEvent) {
      const feEndMins = toMins(dbActoEvent.end_time);
      if (feEndMins > 0) classStart = feEndMins;
      slots.push({
        start: dbActoEvent.start_time,
        end: dbActoEvent.end_time,
        isBreak: true,
        label: dbActoEvent.name
      });
    }

    const targetTotalGen = isMorning ? 5 : 6;
    let preCountGen = isMorning ? 2 : 3;
    if (isMorning) {
      // Para la tanda matutina (8:00 a 9:30 AM = 90 min), son 2 bloques de 45 min
      if (bStartMaster - classStart <= 100) {
        preCountGen = 2;
      } else {
        preCountGen = Math.min(3, Math.floor((bStartMaster - classStart) / 33));
      }
    } else {
      preCountGen = 3;
    }
    const postCountGen = Math.max(1, targetTotalGen - preCountGen);

    const preDuration = Math.floor((bStartMaster - classStart) / preCountGen);
    for (let i = 0; i < preCountGen; i++) {
      let sTime = classStart + i * preDuration;
      let eTime = i === preCountGen - 1 ? bStartMaster : sTime + preDuration;
      slots.push({
        start: fromMins(sTime),
        end: fromMins(eTime),
        isBreak: false,
        label: `${i + 1}ra Hora`
      });
    }

    slots.push({
      start: fromMins(bStartMaster),
      end: fromMins(bEndMaster),
      isBreak: true,
      label: 'RECREO'
    });

    const postDuration = Math.floor((endT - bEndMaster) / postCountGen);
    for (let i = 0; i < postCountGen; i++) {
      let sTime = bEndMaster + i * postDuration;
      let eTime = i === postCountGen - 1 ? endT : sTime + postDuration;
      slots.push({
        start: fromMins(sTime),
        end: fromMins(eTime),
        isBreak: false,
        label: `${preCountGen + i + 1}ra Hora`
      });
    }

    return { slots, startT, endT, masterBPref };
  }, [
    state.levelSchedules,
    state.breakPreferences,
    state.assignments,
    selectedShift,
    filterType,
    filterId,
    state.courses
  ]);

  const { slots, startT, endT, masterBPref } = timeSlots;

  const entriesBySlotAndDay = useMemo(() => {
    const map = new Map<string, any[]>();

    // Initialize map keys for all days and slots to ensure they are always arrays
    days.forEach((day) => {
      slots.forEach((slot) => {
        map.set(`${day}-${slot.start}`, []);
      });
    });

    filteredSchedule.forEach((entry) => {
      if (!entry.day || !entry.start_time) return;

      const normDay = (entry.day || '').trim();
      const matchedDay = days.find((d) => d.toLowerCase() === normDay.toLowerCase()) || days[0];
      const eMins = toMins(entry.start_time);

      let closestSlot: any = null;
      let minDiff = Infinity;

      slots.forEach((slot) => {
        const slotMins = toMins(slot.start);
        const diff = Math.abs(eMins - slotMins);
        if (diff < minDiff) {
          minDiff = diff;
          closestSlot = slot;
        }
      });

      // Solo asociar si la entrada está a 25 min o menos del slot
      if (closestSlot && minDiff <= 25) {
        const key = `${matchedDay}-${closestSlot.start}`;
        if (!map.has(key)) map.set(key, []);
        const listInSlot = map.get(key)!;

        // En vista de curso, la casilla solo debe tener una materia asignada (evitar amontonamiento)
        if (filterType === 'course') {
          if (listInSlot.length === 0) {
            listInSlot.push(entry);
          }
        } else {
          // En vista general o docente, evitar duplicados exactos
          const isDup = listInSlot.some(
            (existing: any) =>
              existing.course_id === entry.course_id &&
              existing.subject_id === entry.subject_id &&
              existing.start_time === entry.start_time
          );
          if (!isDup) listInSlot.push(entry);
        }
      }
    });

    return map;
  }, [filteredSchedule, slots, days]);

  const conflicts = useMemo(() => {
    const conflictIds: string[] = [];
    const currentShiftSchedule = schedule.filter((s) => s.shift === selectedShift);
    currentShiftSchedule.forEach((e1: any) => {
      currentShiftSchedule.forEach((e2: any) => {
        if (e1.id !== e2.id && e1.day === e2.day && e1.start_time === e2.start_time) {
          if (e1.teacher_id === e2.teacher_id || e1.course_id === e2.course_id) {
            if (!conflictIds.includes(e1.id)) conflictIds.push(e1.id);
          }
        }
      });
    });
    return conflictIds;
  }, [schedule, selectedShift]);

  const handleRegenerate = async () => {
    if (isAllLocked) {
      alert(
        '🔒 HORARIO BLINDADO Y PROTEGIDO\n\nEste horario está 100% blindado contra modificaciones accidentales.\n\nSi realmente deseas regenerarlo y recalcular las clases, primero debes hacer clic en el botón "Desblindar Horario" (🔓) en la barra superior.'
      );
      return;
    }

    if (lockedEntries.size > 0) {
      if (
        !confirm(
          `🔒 Atención: Hay ${lockedEntries.size} materias bloqueadas con candado individual.\n\n¿Generar nuevo horario para Tanda ${selectedShift}?`
        )
      )
        return;
    } else {
      if (!confirm(`¿Generar nuevo horario para Tanda ${selectedShift}?`)) return;
    }

    setIsGenerating(true);
    await new Promise((r) => setTimeout(r, 100));
    try {
      const { entries, diagnostics } = await scheduleService.generateSchedule(
        state,
        profile,
        selectedShift,
        selectedYear
      );
      await refreshData(undefined, true);

      if (diagnostics && diagnostics.length > 0) {
        alert(
          '⚠️ Horario generado (Casi Completo)\n\nEl sistema intentó 1000 combinaciones diferentes pero no logró llegar al 100% por los siguientes motivos:\n\n' +
            diagnostics.join('\n\n')
        );
      } else {
        alert('✅ Horario generado al 100% con éxito.');
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRepair = async () => {
    if (isAllLocked) {
      alert(
        '🔒 HORARIO BLINDADO\n\nTodas las materias están protegidas. Desbloquea el blindaje general si deseas ejecutar la reparación de choques.'
      );
      return;
    }
    if (!confirm(`¿Intentar reparar los choques actuales del horario ${selectedShift}?`)) return;
    setIsRepairing(true);
    await new Promise((r) => setTimeout(r, 100));
    try {
      const { diagnostics } = await scheduleService.repairSchedule(
        state,
        profile,
        selectedShift,
        selectedYear,
        Array.from(lockedEntries)
      );
      await refreshData(undefined, true);
      if (diagnostics && diagnostics.length > 0) {
        alert(
          '⚠️ Reparación Parcial\n\nEl algoritmo de intercambio mejoró el horario, pero aún quedan conflictos irresolubles:\n\n' +
            diagnostics.join('\n\n')
        );
      } else {
        alert('✅ ¡Horario reparado exitosamente al 100%!');
      }
    } catch (e: any) {
      alert('Error: ' + e.message);
    } finally {
      setIsRepairing(false);
    }
  };

  const handleDeepRepair = async () => {
    if (isAllLocked) {
      alert(
        '🔒 HORARIO BLINDADO\n\nTodas las materias están protegidas. Desbloquea el blindaje general si deseas ajustar las horas faltantes.'
      );
      return;
    }
    if (
      !confirm(
        `¿Ajustar horas faltantes del horario ${selectedShift} moviendo lo necesario?\n\nEl sistema ejecutará hasta 5 intentos sucesivos de reparación para intentar colocar todas las horas pendientes.`
      )
    )
      return;
    setIsDeepRepairing(true);
    setDeepRepairAttempt(0);
    await new Promise((r) => setTimeout(r, 100));
    let lastDiagnostics: string[] = [];
    let allDone = false;
    try {
      for (let attempt = 1; attempt <= 5; attempt++) {
        setDeepRepairAttempt(attempt);
        const { diagnostics } = await scheduleService.repairSchedule(
          state,
          profile,
          selectedShift,
          selectedYear,
          Array.from(lockedEntries)
        );
        lastDiagnostics = diagnostics || [];
        await refreshData(undefined, true);
        allDone = lastDiagnostics.some((d) => d.includes('100%') || d.includes('Exitosa al 100'));
        if (allDone) break;
      }
    } catch (e: any) {
      alert('Error durante el ajuste: ' + e.message);
    } finally {
      setIsDeepRepairing(false);
      setDeepRepairAttempt(0);
    }
    if (allDone) {
      alert('✅ ¡Horario ajustado al 100%! Todas las horas fueron colocadas exitosamente.');
    } else {
      alert(
        `⚠️ Se realizaron 5 intentos de ajuste. El horario mejoró lo máximo posible pero aún quedan horas sin ubicar (posiblemente por falta de disponibilidad de docentes):\n\n` +
          lastDiagnostics.join('\n')
      );
    }
  };

  const handleExportImage = async () => {
    if (!tableRef.current) return;
    try {
      const printOnlyEl = tableRef.current.querySelector('.print-only') as HTMLDivElement;
      if (printOnlyEl) {
        printOnlyEl.style.display = 'block';
      }

      const canvas = await html2canvas(tableRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      if (printOnlyEl) {
        printOnlyEl.style.display = '';
      }

      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');

      let filename = `Horario_${selectedShift}`;
      if (filterType === 'course' && filterId) {
        const course = state.courses.find((c) => c.id === filterId);
        if (course)
          filename = `Horario_Curso_${course.grade}_${course.section || ''}`.replace(/\s+/g, '_');
      } else if (filterType === 'teacher' && filterId) {
        const teacher = state.teachers.find((t) => t.id === filterId);
        if (teacher) filename = `Horario_Docente_${teacher.name}`.replace(/\s+/g, '_');
      }

      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e: any) {
      alert('Error al exportar imagen: ' + e.message);
    }
  };

  const handleExportExcel = () => {
    const header = ['Hora/Bloque', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const rows = slots.map((slot) => {
      const rowData: string[] = [`${slot.start} - ${slot.end}`];
      days.forEach((day) => {
        const cellEntries = entriesBySlotAndDay.get(`${day}-${slot.start}`) || [];
        if (slot.isBreak) {
          const fixedEvent = state.fixedEvents?.find((fe) => {
            const feStartMins = toMins(fe.start_time);
            const feDayMatch = fe.day === 'Todos' || fe.day === day;
            const feTimeMatch = Math.abs(feStartMins - toMins(slot.start)) < 5;
            return feDayMatch && feTimeMatch;
          });
          rowData.push(fixedEvent ? fixedEvent.name : slot.label || 'RECREO');
        } else if (cellEntries.length > 0) {
          const texts = cellEntries.map((e) => {
            const subject = state.subjects.find((s) => s.id === e.subject_id);
            const teacher = state.teachers.find((t) => t.id === e.teacher_id);
            const course = state.courses.find((c) => c.id === e.course_id);
            const courseName = course ? `${course.grade} ${course.section || ''}`.trim() : '';
            if (filterType === 'teacher') return `${subject?.name || 'Materia'} (${courseName})`;
            if (filterType === 'course')
              return `${subject?.name || 'Materia'} - ${teacher?.name || 'Docente'}`;
            return `${subject?.name || 'Materia'} | ${courseName} | ${teacher?.name || 'Docente'}`;
          });
          rowData.push(texts.join(' / '));
        } else {
          rowData.push('');
        }
      });
      return rowData;
    });

    const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Horario');

    let filename = `Horario_${selectedShift}`;
    if (filterType === 'course' && filterId) {
      const course = state.courses.find((c) => c.id === filterId);
      if (course)
        filename = `Horario_Curso_${course.grade}_${course.section || ''}`.replace(/\s+/g, '_');
    } else if (filterType === 'teacher' && filterId) {
      const teacher = state.teachers.find((t) => t.id === filterId);
      if (teacher) filename = `Horario_Docente_${teacher.name}`.replace(/\s+/g, '_');
    }

    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      <SEO
        title="Generador de Horarios"
        description="Gestiona y genera horarios escolares de forma inteligente y automática."
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          aside, nav, header, footer, .no-print, button, select, input {
            display: none !important;
          }
          @page {
            size: landscape;
            margin: 1cm;
          }
          body {
            background: white !important;
            color: black !important;
          }
          .print-container {
            width: 100% !important;
            max-width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .grid {
            display: grid !important;
          }
          .grid-cols-6 {
            grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
          }
          .min-h-\\[90px\\] {
            min-height: 70px !important;
          }
          .bg-slate-50 {
            background-color: #f8fafc !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .bg-white {
            background-color: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .bg-amber-100 {
            background-color: #fef3c7 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .bg-rose-100 {
            background-color: #ffe4e6 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `
        }}
      />
      {(isGenerating || isRepairing || isDeepRepairing) && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[999] flex flex-col items-center justify-center p-6 text-white animate-fade-in no-print">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-md text-center space-y-4">
            <RefreshCw size={44} className="animate-spin text-indigo-400" />
            <h3 className="text-lg font-black uppercase tracking-wider text-white">
              {isGenerating ? 'Generando Horario...' : isRepairing ? 'Reparando Choques...' : `Ajustando Horas (${deepRepairAttempt}/5)...`}
            </h3>
            <p className="text-xs text-slate-300 font-medium leading-relaxed">
              El motor inteligente está evaluando combinaciones, asignaciones y restricciones. Por favor espere unos segundos...
            </p>
          </div>
        </div>
      )}
      {/* Header Panel */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-xl">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            <button
              onClick={() => setSelectedShift('Matutina')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${selectedShift === 'Matutina' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}
            >
              Matutina
            </button>
            <button
              onClick={() => setSelectedShift('Vespertina')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${selectedShift === 'Vespertina' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400'}`}
            >
              Vespertina
            </button>
          </div>
          {!isStudentOrParent ? (
            <>
              <select
                value={filterType}
                onChange={(e) => {
                  setFilterType(e.target.value as any);
                  setFilterId('');
                }}
                className="px-6 py-2.5 rounded-2xl bg-slate-50 border-none text-[10px] font-black uppercase outline-none focus:ring-2 focus:ring-indigo-500 shadow-inner"
              >
                <option value="all">Ver Todos</option>
                <option value="teacher">Por Docente</option>
                <option value="course">Por Curso</option>
              </select>
              {filterType === 'teacher' && (
                <select
                  value={filterId}
                  onChange={(e) => setFilterId(e.target.value)}
                  className="px-6 py-2.5 rounded-2xl bg-slate-50 border-none text-[10px] font-black uppercase shadow-inner"
                >
                  <option value="">Seleccionar Docente...</option>
                  {state.teachers
                    .filter((t) => t.role === 'teacher' || t.role === 'management_teacher')
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                </select>
              )}
              {filterType === 'course' && (
                <select
                  value={filterId}
                  onChange={(e) => setFilterId(e.target.value)}
                  className="px-6 py-2.5 rounded-2xl bg-slate-50 border-none text-[10px] font-black uppercase shadow-inner"
                >
                  <option value="">Seleccionar Curso...</option>
                  {state.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.level} {c.grade} "{c.section}" - {c.tanda || 'Matutina'}
                    </option>
                  ))}
                </select>
              )}
            </>
          ) : (
            (() => {
              const activeCourse = state.courses.find((c) => c.id === filterId);
              return activeCourse ? (
                <div className="px-6 py-2.5 rounded-2xl bg-indigo-50 border border-indigo-150 text-indigo-700 text-[10px] font-black uppercase tracking-widest">
                  Curso: {activeCourse.grade} "{activeCourse.section}" - {activeCourse.tanda || 'Matutina'}
                </div>
              ) : null;
            })()
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Botones de Imprimir / Exportar directos */}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-sm transition-all no-print cursor-pointer"
          >
            <FileText size={14} className="text-indigo-600" />
            Imprimir / PDF
          </button>
          <button
            onClick={handleExportImage}
            className="flex items-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-sm transition-all no-print cursor-pointer"
          >
            <ImageIcon size={14} className="text-emerald-600" />
            Descargar Imagen
          </button>
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-sm transition-all no-print cursor-pointer"
          >
            <FileSpreadsheet size={14} className="text-amber-600" />
            Descargar Excel
          </button>

          {isAdminOrStaff && (
            <>
              {/* Botón Maestro de Blindaje de Horario */}
              <button
                onClick={toggleLockAllSchedule}
                className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-md transition-all no-print cursor-pointer ${
                  isAllLocked
                    ? 'bg-amber-500 hover:bg-amber-600 text-white ring-4 ring-amber-200'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
                title={
                  isAllLocked
                    ? 'Desbloquear todas las materias del horario'
                    : 'Bloquear y blindar todas las materias del horario contra cambios accidentales'
                }
              >
                {isAllLocked ? (
                  <>
                    <Lock size={15} className="text-white" />
                    <span>Horario Blindado 🔒</span>
                  </>
                ) : (
                  <>
                    <Unlock size={15} className="text-slate-500" />
                    <span>Blindar Horario</span>
                  </>
                )}
              </button>

              <label className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50/80 hover:bg-indigo-100/80 border border-indigo-200 rounded-2xl text-[10px] font-black uppercase text-indigo-900 cursor-pointer transition-all no-print select-none">
                <input
                  type="checkbox"
                  checked={!!state.avoidDeporteDuringAnyBreak}
                  onChange={(e) => setAvoidDeporteDuringAnyBreak(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <span>Bloquear Deporte en Recreo de cualquier ciclo</span>
              </label>

              <button
                onClick={handleRegenerate}
                disabled={isGenerating || isRepairing || isDeepRepairing || isAllLocked}
                className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {isGenerating ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Sparkles size={16} />
                )}
                {isGenerating ? 'Calculando...' : 'Regenerar'}
              </button>
              <button
                onClick={handleRepair}
                disabled={isGenerating || isRepairing || isDeepRepairing || isAllLocked}
                className="flex items-center gap-2 px-8 py-3 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-rose-700 transition-all disabled:opacity-50"
              >
                {isRepairing ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Wrench size={16} />
                )}
                {isRepairing ? 'Reparando...' : 'Reparar Choques'}
              </button>
              <button
                onClick={handleDeepRepair}
                disabled={isGenerating || isRepairing || isDeepRepairing || isAllLocked}
                className="flex items-center gap-2 px-8 py-3 bg-amber-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-amber-600 transition-all disabled:opacity-50"
              >
                {isDeepRepairing ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <AlertCircle size={16} />
                )}
                {isDeepRepairing
                  ? `Ajustando (${deepRepairAttempt}/5)...`
                  : 'Ajustar Horas Faltantes'}
              </button>
              <button
                onClick={() => setShowSwapModal(true)}
                disabled={isGenerating || isRepairing || isDeepRepairing}
                className="flex items-center gap-2 px-8 py-3 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-emerald-700 transition-all cursor-pointer"
              >
                <Zap size={16} className="text-amber-300 fill-amber-300" />
                Asistente de Intercambio Directo
              </button>
            </>
          )}
        </div>
      </div>

      {/* Banner de Horario Blindado */}
      {isAdminOrStaff && isAllLocked && (
        <div className="bg-amber-500 text-white px-6 py-4 rounded-[2rem] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 no-print mb-6 animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Lock size={18} />
            </div>
            <div>
              <p className="leading-tight text-sm font-black">Horario Terminado y Blindado contra Cambios</p>
              <p className="text-[10px] text-amber-100 font-bold tracking-normal normal-case mt-0.5">
                Todas las materias están protegidas. No se permiten regeneraciones ni alteraciones accidentales sin antes desbloquear el candado general.
              </p>
            </div>
          </div>
          <button
            onClick={toggleLockAllSchedule}
            className="bg-white text-amber-900 hover:bg-amber-50 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm shrink-0 cursor-pointer"
          >
            Desbloquear para Editar
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-indigo-50/50 p-6 rounded-[2.5rem] border border-indigo-100 shadow-sm mb-8 no-print">
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">
            Inicio Centro
          </span>
          <span className="text-xl font-black text-indigo-900">{fromMins(startT)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">
            Inicio Recreo
          </span>
          <span className="text-xl font-black text-indigo-900">{masterBPref.startTime}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">
            Duración Clase
          </span>
          <span className="text-xl font-black text-indigo-900">{isMorning ? 45 : 40} min</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">
            1ra Hora (Calculada)
          </span>
          <span className="text-xl font-black text-indigo-600">
            {slots.find((s) => !s.isBreak && s.label?.includes('1'))?.start || '---'}
          </span>
        </div>
      </div>

      {/* Torre de Control Global */}
      {isAdminOrStaff && (
        <div className="p-8 bg-slate-900 rounded-[3rem] shadow-2xl border border-slate-800 animate-in fade-in slide-in-from-top-4 duration-700 no-print">
          <div className="flex flex-col md:flex-row gap-10 items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="p-5 bg-indigo-500/20 rounded-[2rem] border border-indigo-500/30">
                <ShieldCheck size={36} className="text-indigo-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white tracking-tighter">
                  Estado del Centro
                </h2>
                <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-1">
                  Monitoreo de Carga Total
                </p>
              </div>
            </div>

            {(() => {
              let totalAssigned = 0;
              let totalPlaced = 0;
              const coursesWithMissingHours: { name: string; missing: number }[] = [];
              const teachersWithConflicts: Set<string> = new Set();

              const shiftBaseVal = selectedShift.toLowerCase().substring(0, 3);
              state.courses
                .filter((c: any) => {
                  const tStr = (c.tanda || '').toLowerCase();
                  const lvlStr = (c.level || '').toLowerCase();
                  if (shiftBaseVal === 'mat') {
                    return (
                      tStr.includes('mat') ||
                      tStr.includes('mañ') ||
                      tStr.includes('ext') ||
                      tStr.includes('com') ||
                      tStr === '' ||
                      ((lvlStr.includes('primar') || lvlStr.includes('ini')) &&
                        !tStr.includes('ves') &&
                        !tStr.includes('tar'))
                    );
                  } else {
                    return (
                      tStr.includes('ves') ||
                      tStr.includes('tar') ||
                      (tStr === '' && lvlStr.includes('secun'))
                    );
                  }
                })
                .forEach((course) => {
                  const courseAssignments = state.assignments.filter(
                    (a) => a.course_id === course.id || a.courseId === course.id
                  );
                  let courseHasMissing = false;
                  let courseMissingCount = 0;
                  courseAssignments.forEach((assign) => {
                    const weeklyHours =
                      Number(assign.hours_per_week || assign.hoursPerWeek || assign.weekly_hours) ||
                      0;
                    if (weeklyHours === 0) return; // ignorar asignaciones sin horas definidas
                    totalAssigned += weeklyHours;
                    const placedHours = state.schedule.filter(
                      (s: any) =>
                        s.course_id === course.id &&
                        s.subject_id === assign.subject_id &&
                        s.shift === selectedShift &&
                        s.school_year === selectedYear
                    ).length;
                    totalPlaced += placedHours;
                    if (placedHours < weeklyHours) {
                      courseHasMissing = true;
                      courseMissingCount += weeklyHours - placedHours;
                    }
                  });
                  if (courseHasMissing) {
                    const cKey = `${course.grade} ${course.section || ''}`.trim();
                    if (!coursesWithMissingHours.find((x) => x.name === cKey)) {
                      coursesWithMissingHours.push({ name: cKey, missing: courseMissingCount });
                    }
                  }
                });

              // Detectar conflictos de docentes (mismo docente, mismo bloque horario)
              const courseSchedules = state.schedule.filter(
                (s: any) => s.shift === selectedShift && s.school_year === selectedYear
              );
              const teacherSlotMap: Record<string, string[]> = {};
              courseSchedules.forEach((cell: any) => {
                if (!cell.teacher_id || !cell.day || !cell.start_time) return;
                const key = `${cell.teacher_id}-${cell.day}-${cell.start_time}`;
                if (!teacherSlotMap[key]) teacherSlotMap[key] = [];
                teacherSlotMap[key].push(cell.course_id);
              });
              Object.entries(teacherSlotMap).forEach(([key, cIds]) => {
                if (cIds.length > 1) {
                  const teacherId = key.split('-')[0];
                  const tObj = state.teachers.find((t: any) => t.id === teacherId);
                  if (tObj) teachersWithConflicts.add(tObj.name);
                }
              });

              const missingCount = coursesWithMissingHours.length;
              const conflictCount = teachersWithConflicts.size;
              const totalMissingHours = totalAssigned - totalPlaced;
              const coveragePct =
                totalAssigned > 0 ? Math.round((totalPlaced / totalAssigned) * 100) : null;

              // CASO 1: Sin carga académica registrada
              if (totalAssigned === 0) {
                return (
                  <div className="flex-1 md:max-w-2xl w-full">
                    <div className="bg-slate-700/40 border border-slate-600/30 p-6 rounded-[2.5rem] flex items-center gap-4">
                      <div className="p-2 bg-slate-600/30 rounded-full">
                        <Clock size={24} className="text-slate-400" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white uppercase tracking-tighter">
                          Sin Carga Académica
                        </p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">
                          No hay asignaciones registradas para esta tanda
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div className="flex-1 md:max-w-2xl w-full flex flex-col gap-3">
                  {/* ALERTA: Horas Faltantes */}
                  {missingCount > 0 && (
                    <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-[2rem] space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="text-amber-400 shrink-0" size={22} />
                          <div>
                            <p className="text-sm font-black text-white uppercase tracking-tighter">
                              {totalMissingHours} Hora{totalMissingHours !== 1 ? 's' : ''} Pendiente
                              {totalMissingHours !== 1 ? 's' : ''} — {coveragePct}% cubierto
                            </p>
                            <p className="text-[10px] text-amber-400 font-bold uppercase">
                              {totalPlaced} de {totalAssigned} horas colocadas en {missingCount}{' '}
                              curso{missingCount !== 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleDeepRepair}
                          disabled={isRepairing || isGenerating || isDeepRepairing}
                          className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-black uppercase text-[9px] tracking-widest transition-all disabled:opacity-50 whitespace-nowrap"
                        >
                          {isDeepRepairing
                            ? `Ajustando (${deepRepairAttempt}/5)...`
                            : 'Ajustar Horas Faltantes'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-amber-500/10">
                        {coursesWithMissingHours.map((c) => (
                          <span
                            key={c.name}
                            className="px-3 py-1 bg-amber-500/10 text-amber-300 rounded-lg text-[8px] font-black uppercase border border-amber-500/20"
                          >
                            ⏰ Faltan {c.missing}h: {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ALERTA: Conflictos de Docentes */}
                  {conflictCount > 0 && (
                    <div className="bg-rose-500/10 border border-rose-500/20 p-5 rounded-[2rem] space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="text-rose-400 shrink-0" size={22} />
                          <div>
                            <p className="text-sm font-black text-white uppercase tracking-tighter">
                              {conflictCount} Conflicto{conflictCount !== 1 ? 's' : ''} de Docentes
                            </p>
                            <p className="text-[10px] text-rose-400 font-bold uppercase">
                              Docente asignado a dos cursos en el mismo bloque
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleRepair}
                          disabled={isRepairing || isGenerating || isDeepRepairing}
                          className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black uppercase text-[9px] tracking-widest transition-all disabled:opacity-50 whitespace-nowrap"
                        >
                          {isRepairing ? 'Reparando...' : 'Reparar Choques'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-rose-500/10">
                        {[...teachersWithConflicts].map((tName) => (
                          <span
                            key={tName}
                            className="px-3 py-1 bg-rose-500/10 text-rose-300 rounded-lg text-[8px] font-black uppercase border border-rose-500/20"
                          >
                            ⚡ Choque: {tName}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ÉXITO: 100% */}
                  {missingCount === 0 && conflictCount === 0 && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-6 rounded-[2.5rem] flex items-center gap-4">
                      <div className="p-2 bg-emerald-500/20 rounded-full">
                        <CheckCircle size={24} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-white uppercase tracking-tighter">
                          Horario Perfecto
                        </p>
                        <p className="text-[10px] font-bold text-emerald-400 uppercase">
                          {totalPlaced}/{totalAssigned} horas — 100% de cobertura lograda
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Matrix Table */}
      <div
        ref={tableRef}
        className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden p-8 print-container"
      >
        {/* Título de Impresión (Solo visible al imprimir o exportar) */}
        <div className="print-only mb-6 border-b pb-4">
          <h1 className="text-xl font-black uppercase text-indigo-900 tracking-wider">
            Horario de Clases - Tanda {selectedShift}
          </h1>
          <p className="text-sm font-bold text-slate-600 mt-1 uppercase">
            {filterType === 'course' &&
              filterId &&
              (() => {
                const course = state.courses.find((c: any) => c.id === filterId);
                return `Curso: ${course?.grade || ''} ${course?.section || ''}`;
              })()}
            {filterType === 'teacher' &&
              filterId &&
              (() => {
                const teacher = state.teachers.find((t: any) => t.id === filterId);
                return `Docente: ${teacher?.name || ''}`;
              })()}
            {filterType === 'all' && 'Vista General (Todos los Cursos)'}
            {` | Año Escolar: ${selectedYear}`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-6 border-b-2 border-slate-900 pb-4 mb-6">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Bloque
              </div>
              {days.map((d) => (
                <div
                  key={d}
                  className="text-center text-[11px] font-black text-slate-900 uppercase tracking-[0.2em]"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="space-y-4">
              {slots.map((slot, sIdx) => (
                <div key={sIdx} className="grid grid-cols-6 items-center min-h-[90px]">
                  <div className="text-[10px] font-black text-indigo-600 pr-4">
                    <span className="text-slate-900">{slot.start}</span>
                    <br />
                    <span className="text-slate-300 font-medium">{slot.end}</span>
                  </div>

                  {days.map((day) => {
                    const slotMins = toMins(slot.start);
                    const entries = entriesBySlotAndDay.get(`${day}-${slot.start}`) || [];

                    // 1. BUSCAR EVENTO FIJO EN DB (Por Ciclo/Nivel)
                    const fixedEvent = state.fixedEvents?.find((fe) => {
                      const feStartMins = toMins(fe.start_time);
                      const feDayMatch = fe.day === 'Todos' || fe.day === day;
                      const feTimeMatch = Math.abs(feStartMins - slotMins) < 5; // Tolerancia de 5 minutos
                      if (!feDayMatch || !feTimeMatch) return false;

                      // Validación por curso
                      if (filterType === 'course' && filterId) {
                        const course = state.courses.find((c) => c.id === filterId);
                        const grade = course?.grade?.toLowerCase() || '';
                        const level = course?.level?.toLowerCase() || '';

                        const isFirstCycle =
                          /^[1-3]/.test(grade) ||
                          grade.includes('1') ||
                          grade.includes('2') ||
                          grade.includes('3') ||
                          grade.includes('primer') ||
                          (grade.includes('segundo') && !grade.includes('ciclo')) ||
                          grade.includes('tercer');
                        const isSecondCycle =
                          /^[4-6]/.test(grade) ||
                          grade.includes('4') ||
                          grade.includes('5') ||
                          grade.includes('6') ||
                          grade.includes('cuarto') ||
                          grade.includes('quinto') ||
                          grade.includes('sexto');

                        const feLevel = fe.level?.toLowerCase() || '';
                        const feCycle = fe.cycle?.toLowerCase() || '';

                        const levelMatch =
                          feLevel.includes('gen') ||
                          feLevel.includes(level.substring(0, 3)) ||
                          level.includes(feLevel.substring(0, 3));
                        const cycleMatch =
                          feCycle.includes('gen') ||
                          (isFirstCycle && (feCycle.includes('1') || feCycle.includes('primer'))) ||
                          (isSecondCycle &&
                            (feCycle.includes('2') ||
                              feCycle.includes('segundo') ||
                              feCycle.includes('4') ||
                              feCycle.includes('5') ||
                              feCycle.includes('6')));

                        return levelMatch && cycleMatch;
                      }
                      // Si filtramos por docente, NO mostrar eventos fijos porque pertenecen a los cursos, no a la agenda personal del docente
                      if (filterType === 'teacher') return false;

                      return true; // En vista general mostrar todos
                    });

                    // 2. ¿ES UN RECREO SEGÚN LA REJILLA DINÁMICA?
                    // Las franjas de recreo son inviolables y se muestran de Lunes a Viernes
                    const isRecreo = filterType === 'teacher' ? false : Boolean(slot.isBreak);
                    const blockName = (fixedEvent && entries.length === 0) ? fixedEvent.name : isRecreo ? (slot.label || 'RECREO') : null;

                    return (
                      <div key={day} className="px-2 h-full">
                        {blockName ? (
                          <div
                            className={`h-full rounded-2xl border-2 p-3 flex flex-col items-center justify-center shadow-sm ${isRecreo ? 'bg-amber-100 border-amber-300' : 'bg-rose-100 border-rose-300 animate-pulse'}`}
                          >
                            <p
                              className={`text-[10px] font-black uppercase tracking-tighter text-center leading-tight ${isRecreo ? 'text-amber-700' : 'text-rose-700'}`}
                            >
                              {isRecreo ? '🔔 ' : '⛪️ '}
                              {blockName}
                            </p>
                            {fixedEvent && fixedEvent.cycle !== 'General' && (
                              <p className="text-[8px] font-bold text-rose-500 uppercase mt-1">
                                Solo {fixedEvent.cycle}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="h-full bg-slate-50 rounded-2xl border border-slate-100 p-3 flex flex-col justify-center gap-1 hover:border-indigo-200 transition-all group">
                            {entries.length > 0 ? (
                              entries.map((e: any, i: number) => {
                                const subject = state.subjects.find((s) => s.id === e.subject_id);
                                const teacher = state.teachers.find((t) => t.id === e.teacher_id);
                                const course = state.courses.find((c) => c.id === e.course_id);
                                const courseName = course
                                  ? `${course.grade} ${course.section || ''}`.trim()
                                  : 'Curso';

                                return (
                                  <div
                                    key={i}
                                    className={`p-2.5 rounded-xl border shadow-sm group-hover:shadow-md transition-all relative ${
                                      lockedEntries.has(e.id) || lockedEntries.has(`${e.course_id}_${e.day}_${e.start_time}`)
                                        ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-400/50'
                        : 'bg-white border-slate-200'
                                    }`}
                                  >
                                    <div className="flex items-start justify-between gap-1">
                                      <p className="text-[10px] font-bold text-slate-800 leading-tight line-clamp-2 uppercase pr-4">
                                        {subject?.name || 'Materia'}
                                      </p>
                                      {isAdminOrStaff && (
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={(evt) => {
                                              evt.stopPropagation();
                                              toggleLock(e);
                                            }}
                                            title={
                                              lockedEntries.has(e.id) || lockedEntries.has(`${e.course_id}_${e.day}_${e.start_time}`)
                                                ? 'Clase Bloqueada 🔒 (Inviolable en reparación)'
                                                : 'Bloquear Clase 🔓'
                                            }
                                            className={`p-1 rounded-lg transition-all no-print cursor-pointer ${
                                              lockedEntries.has(e.id) || lockedEntries.has(`${e.course_id}_${e.day}_${e.start_time}`)
                                                ? 'bg-amber-500 text-white shadow-sm scale-110'
                                                : 'text-slate-300 hover:text-slate-600 hover:bg-slate-100'
                                            }`}
                                          >
                                            {lockedEntries.has(e.id) || lockedEntries.has(`${e.course_id}_${e.day}_${e.start_time}`) ? (
                                              <Lock size={12} />
                                            ) : (
                                              <Unlock size={12} />
                                            )}
                                          </button>
                                          <button
                                            onClick={async (evt) => {
                                              evt.stopPropagation();
                                              const isItemLocked =
                                                lockedEntries.has(e.id) ||
                                                lockedEntries.has(`${e.course_id}_${e.day}_${e.start_time}`);
                                              if (isItemLocked) {
                                                alert(
                                                  '🔒 CLASE BLOQUEADA\n\nEsta materia está protegida con candado. Haz clic en el candado 🔒 de la casilla para desbloquearla antes de eliminarla.'
                                                );
                                                return;
                                              }
                                              if (confirm(`¿Eliminar la clase de "${subject?.name || 'esta materia'}" de esta casilla?`)) {
                                                try {
                                                  const { error } = await supabase.from('schedule_entries').delete().eq('id', e.id);
                                                  if (error) throw error;
                                                  await refreshData(undefined, true);
                                                } catch (err: any) {
                                                  alert('Error al eliminar: ' + err.message);
                                                }
                                              }
                                            }}
                                            title="Eliminar esta clase 🗑️"
                                            className="p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-all no-print cursor-pointer"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    {filterType === 'teacher' ? (
                                      <p className="text-[9px] text-emerald-600 font-black mt-1 uppercase tracking-tighter">
                                        {courseName}
                                      </p>
                                    ) : filterType === 'course' ? (
                                      <p className="text-[9px] text-indigo-600 font-black mt-1 uppercase tracking-tighter">
                                        {teacher?.name || 'Docente'}
                                      </p>
                                    ) : (
                                      <div className="mt-1 flex flex-col gap-0.5 border-t border-slate-100 pt-1">
                                        <p className="text-[9px] text-emerald-600 font-black uppercase tracking-tighter">
                                          {courseName}
                                        </p>
                                        <p className="text-[9px] text-indigo-600 font-black uppercase tracking-tighter">
                                          {teacher?.name || 'Docente'}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              isAdminOrStaff ? (
                                <button
                                  onClick={() => {
                                    setDirectAssignModal({
                                      open: true,
                                      day,
                                      slot,
                                      courseId: filterType === 'course' ? filterId : '',
                                      subjectId: ''
                                    });
                                  }}
                                  className="w-full h-full min-h-[45px] rounded-xl border border-dashed border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 flex flex-col items-center justify-center gap-1 transition-all group/btn cursor-pointer"
                                  title={`Asignar materia a esta hora (${day} ${slot.start?.substring(0, 5)})`}
                                >
                                  <span className="text-[9px] font-black text-slate-300 group-hover/btn:text-emerald-600 transition-colors uppercase tracking-wider">
                                    + Asignar
                                  </span>
                                </button>
                              ) : (
                                <p className="text-[9px] text-slate-300 text-center italic opacity-0 group-hover:opacity-100 transition-opacity">
                                  Vacío
                                </p>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Auditoría de Carga Horaria (Solo cuando se filtra por curso) */}
      {filterType === 'course' && filterId && (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl p-8 animate-slide-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                Auditoría de Carga Horaria
              </h3>
              <p className="text-[10px] text-slate-400 font-medium uppercase">
                Verificación de horas colocadas vs asignadas
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {state.assignments
              .filter((a) => a.course_id === filterId || a.courseId === filterId)
              .map((a) => {
                const subject = state.subjects.find((s) => s.id === a.subject_id);

                // CONTAR SOLO LAS QUE SON VISIBLES EN LA MATRIZ
                const visibleEntries = filteredSchedule.filter((e) => {
                  if (e.subject_id !== a.subject_id) return false;
                  const eMins = toMins(e.start_time);
                  return slots.some((slot) => Math.abs(toMins(slot.start) - eMins) <= 25);
                });

                const placedHours = visibleEntries.length;
                const assignedHours = Number(a.hours_per_week || a.hoursPerWeek) || 0;
                const isComplete = placedHours === assignedHours;

                return (
                  <div
                    key={a.id}
                    className={`p-4 rounded-2xl border transition-all ${isComplete ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-200 shadow-lg animate-pulse'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-[10px] font-black uppercase text-slate-700 leading-tight pr-4">
                        {subject?.name}
                      </p>
                      {isComplete ? (
                        <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle size={14} className="text-rose-500 shrink-0" />
                      )}
                    </div>
                    <div className="flex items-end gap-2">
                      <span
                        className={`text-2xl font-black ${isComplete ? 'text-emerald-700' : 'text-rose-700'}`}
                      >
                        {placedHours}
                      </span>
                      <span className="text-xs font-bold text-slate-400 mb-1.5">
                        / {assignedHours} Horas
                      </span>
                    </div>
                    {!isComplete && (
                      <p className="text-[9px] font-black text-rose-600 mt-2 uppercase tracking-tighter italic">
                        ❌ Faltan {assignedHours - placedHours} horas por colocar
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* MODAL: ASISTENTE DE INTERCAMBIO DIRECTO */}
      {showSwapModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[999] flex items-center justify-center p-6 animate-fade-in no-print">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-8 max-w-2xl w-full flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                  <Zap size={22} className="fill-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">
                    Asistente de Intercambio Directo
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    Selecciona la materia faltante para ver sugerencias exactas sin choques
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSwapModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl px-3 py-1"
              >
                ✕
              </button>
            </div>

            {/* Selección de Curso, Materia y Posición Existente (si aplica) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  1. Seleccionar Curso
                </label>
                <select
                  value={swapCourseId}
                  onChange={(e) => {
                    setSwapCourseId(e.target.value);
                    setSwapSubjectId('');
                  }}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Elige un Curso --</option>
                  {state.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.level} {c.grade} "{c.section || ''}" - {c.tanda || 'Matutina'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  2. Seleccionar Materia
                </label>
                <select
                  value={swapSubjectId}
                  onChange={(e) => setSwapSubjectId(e.target.value)}
                  disabled={!swapCourseId}
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
                >
                  <option value="">-- Elige una Materia --</option>
                  {swapCourseId &&
                    state.assignments
                      .filter((a) => a.course_id === swapCourseId || a.courseId === swapCourseId)
                      .map((a) => {
                        const sub = state.subjects.find((s) => s.id === a.subject_id);
                        const assigned = Number(a.hours_per_week || a.hoursPerWeek) || 0;
                        const placed = state.schedule.filter(
                          (s) => s.course_id === swapCourseId && s.subject_id === a.subject_id
                        ).length;
                        const missing = assigned - placed;
                        return (
                          <option key={a.subject_id} value={a.subject_id}>
                            {sub?.name || 'Materia'} ({placed}/{assigned}h {missing > 0 ? `- FALTAN ${missing}h` : '✓ COMPLETO'})
                          </option>
                        );
                      })}
                </select>
              </div>
            </div>

            {/* Resultados y Sugerencias de Intercambio por Día */}
            {swapCourseId && swapSubjectId ? (
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                    💡 Sugerencias de Ubicación (Sin Choques)
                  </h4>

                  {/* Pestañas de Días de la Semana */}
                  <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                    {['Todos', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map((d) => (
                      <button
                        key={d}
                        onClick={() => setSwapDayFilter(d)}
                        className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                          swapDayFilter === d
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {(() => {
                  const allSuggestions = scheduleService.findSmartSwaps(
                    state,
                    swapCourseId,
                    swapSubjectId,
                    selectedShift,
                    Array.from(lockedEntries)
                  );

                  const suggestions = allSuggestions.filter(
                    (s) => swapDayFilter === 'Todos' || s.day === swapDayFilter
                  );

                  if (suggestions.length === 0) {
                    return (
                      <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl text-center text-amber-800 space-y-2">
                        <AlertCircle size={28} className="mx-auto text-amber-500" />
                        <p className="text-xs font-black uppercase tracking-tight">
                          No hay casillas libres para el {swapDayFilter === 'Todos' ? 'resto de la semana' : swapDayFilter}
                        </p>
                        <p className="text-[10px] text-slate-500 font-medium">
                          Intenta seleccionar otro día arriba o verifica en Preferencias de Docentes que el profesor no tenga bloqueo de agenda.
                        </p>
                      </div>
                    );
                  }

                  return suggestions.map((sugg, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 hover:bg-emerald-50/50 border border-slate-200 hover:border-emerald-300 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all"
                    >
                      <div className="space-y-1">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 text-[9px] font-black uppercase tracking-wider">
                          {sugg.type === 'empty' ? 'Casilla Libre' : 'Reemplazo Limpio'}
                        </span>
                        <p className="text-xs font-black text-slate-800 uppercase tracking-tight">
                          {sugg.title}
                        </p>
                        <p className="text-[10px] font-medium text-slate-500">
                          {sugg.description}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await scheduleService.applySmartSwap(
                              state,
                              profile,
                              swapCourseId,
                              swapSubjectId,
                              sugg,
                              selectedShift,
                              selectedYear
                            );
                            await refreshData(undefined, true);
                            alert('✅ ¡Clase ubicada exitosamente!');
                            setShowSwapModal(false);
                          } catch (err: any) {
                            alert('Error al aplicar ubicación: ' + err.message);
                          }
                        }}
                        className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl shadow-md transition-all shrink-0 cursor-pointer"
                      >
                        Colocar Clase Aquí
                      </button>
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 p-8 rounded-3xl text-center text-slate-400">
                <Clock size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold uppercase tracking-widest">
                  Selecciona un curso y materia arriba para ver las opciones de ubicación sin choques
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: ASIGNACIÓN DIRECTA DESDE CASILLA VACÍA */}
      {directAssignModal.open && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[999] flex items-center justify-center p-6 animate-fade-in no-print">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl p-8 max-w-xl w-full flex flex-col gap-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-emerald-100 text-emerald-700 rounded-2xl">
                  <Clock size={22} className="text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">
                    Asignar Clase a esta Casilla
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    📅 {directAssignModal.day} • ⏰ {directAssignModal.slot?.label || ''} ({directAssignModal.slot?.start?.substring(0, 5)} - {directAssignModal.slot?.end?.substring(0, 5)})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDirectAssignModal({ open: false, day: '', slot: null, courseId: '', subjectId: '' })}
                className="text-slate-400 hover:text-slate-600 font-bold text-xl px-3 py-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-4">
              {/* Selección de Curso si no está en vista de curso */}
              {filterType !== 'course' && (
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                    1. Seleccionar Curso
                  </label>
                  <select
                    value={directAssignModal.courseId}
                    onChange={(e) =>
                      setDirectAssignModal({ ...directAssignModal, courseId: e.target.value, subjectId: '' })
                    }
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Elige un Curso --</option>
                    {state.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.level} {c.grade} "{c.section || ''}" - {c.tanda || 'Matutina'}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Selección de Materia y Docente */}
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-500 mb-1">
                  {filterType !== 'course' ? '2. Seleccionar Materia / Docente' : 'Seleccionar Materia / Docente'}
                </label>
                {directAssignModal.courseId ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {state.assignments
                      .filter(
                        (a) =>
                          a.course_id === directAssignModal.courseId ||
                          a.courseId === directAssignModal.courseId
                      )
                      .map((a) => {
                        const subject = state.subjects.find((s) => s.id === a.subject_id);
                        const teacher = state.teachers.find((t) => t.id === a.teacher_id);
                        const assigned = Number(a.hours_per_week || a.hoursPerWeek) || 0;
                        const placed = (state.schedule || []).filter(
                          (s) =>
                            s.course_id === directAssignModal.courseId &&
                            s.subject_id === a.subject_id
                        ).length;
                        const missing = assigned - placed;

                        // Verificar si el docente tiene clase en otro curso a esta misma hora
                        const sStartM = toMins(directAssignModal.slot?.start);
                        const sEndM = toMins(directAssignModal.slot?.end);
                        const teacherClash = (state.schedule || []).find((s) => {
                          if (s.teacher_id !== a.teacher_id) return false;
                          if ((s.day || '').trim().toLowerCase() !== directAssignModal.day.toLowerCase()) return false;
                          const eStart = toMins(s.start_time);
                          const eEnd = toMins(s.end_time);
                          const overlap = Math.min(sEndM, eEnd) - Math.max(sStartM, eStart);
                          return overlap > 10;
                        });

                        const isSelected = directAssignModal.subjectId === a.subject_id;

                        return (
                          <div
                            key={a.id}
                            onClick={() => setDirectAssignModal({ ...directAssignModal, subjectId: a.subject_id })}
                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/20'
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                            }`}
                          >
                            <div className="space-y-0.5">
                              <p className="text-xs font-black text-slate-800 uppercase">
                                {subject?.name || 'Materia'}
                              </p>
                              <p className="text-[10px] font-bold text-indigo-600 uppercase">
                                👨‍🏫 {teacher?.name || 'Docente no asignado'}
                              </p>
                              {teacherClash && (
                                <p className="text-[9px] font-bold text-amber-600 uppercase">
                                  ⚠️ Docente con clase en otro curso a esta hora
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <span
                                className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg ${
                                  missing > 0
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                {placed}/{assigned}h {missing > 0 ? `(Falta ${missing}h)` : '✓ Completo'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">Selecciona un curso primero.</p>
                )}
              </div>

              {/* Botón de Confirmación */}
              <div className="pt-2">
                <button
                  disabled={!directAssignModal.courseId || !directAssignModal.subjectId}
                  onClick={async () => {
                    const assign = state.assignments.find(
                      (a) =>
                        (a.course_id === directAssignModal.courseId ||
                          a.courseId === directAssignModal.courseId) &&
                        a.subject_id === directAssignModal.subjectId
                    );
                    if (!assign) return;

                    try {
                      const { error } = await supabase.from('schedule_entries').insert([
                        {
                          center_id: profile.center_id,
                          course_id: directAssignModal.courseId,
                          subject_id: directAssignModal.subjectId,
                          teacher_id: assign.teacher_id,
                          day: directAssignModal.day,
                          shift: selectedShift,
                          start_time: directAssignModal.slot.start,
                          end_time: directAssignModal.slot.end,
                          school_year: selectedYear
                        }
                      ]);
                      if (error) throw error;
                      await refreshData(undefined, true);
                      alert('✅ ¡Clase asignada exitosamente!');
                      setDirectAssignModal({ open: false, day: '', slot: null, courseId: '', subjectId: '' });
                    } catch (err: any) {
                      alert('Error al asignar clase: ' + err.message);
                    }
                  }}
                  className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-emerald-600/20 cursor-pointer disabled:cursor-not-allowed"
                >
                  Asignar a esta Hora
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
