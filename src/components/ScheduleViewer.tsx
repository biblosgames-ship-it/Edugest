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
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SEO } from './SEO';

import { scheduleService } from '../services/scheduleService';
import { supabase } from '../lib/supabase';

export const ScheduleViewer = () => {
  const {
    state,
    profile,
    refreshData,
    selectedYear,
    setAvoidDeporteDuringAnyBreak,
    deleteAssignment,
    setAppState
  } = useApp();

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

    // 2. Cargar y migrar automáticamente desde TODAS las claves anteriores de localStorage
    try {
      // Clave exacta actual
      const saved = localStorage.getItem(lockStorageKey);
      if (saved) {
        JSON.parse(saved).forEach((k: string) => combinedSet.add(k));
      }

      // Claves de versiones anteriores para no perder ningún candado previo
      const oldKeys = [
        `edugens_locked_entries_${profile?.center_id || 'default'}`,
        `edugens_locked_entries_${profile?.center_id || ''}`,
        `edugens_locked_entries_default`,
        `edugens_locked_entries_${profile?.center_id || 'default'}_${selectedShift}`
      ];
      oldKeys.forEach((oldKey) => {
        const oldSaved = localStorage.getItem(oldKey);
        if (oldSaved) {
          try {
            JSON.parse(oldSaved).forEach((k: string) => combinedSet.add(k));
          } catch {}
        }
      });

      // Escanear cualquier clave que empiece con edugens_locked_entries en el navegador
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('edugens_locked_entries')) {
          try {
            const raw = localStorage.getItem(k);
            if (raw) {
              JSON.parse(raw).forEach((entryKey: string) => combinedSet.add(entryKey));
            }
          } catch {}
        }
      }

      // Guardar la combinación en la clave actual para que quede permanentemente fijada
      if (combinedSet.size > 0) {
        localStorage.setItem(lockStorageKey, JSON.stringify(Array.from(combinedSet)));
      }
    } catch {}

    setLockedEntries(combinedSet);
  }, [lockStorageKey, state.schedule, selectedShift, selectedYear, profile?.center_id]);

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
      (s: any) =>
        s.shift === selectedShift &&
        (!selectedYear || !s.school_year || s.school_year === selectedYear)
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
      (s: any) =>
        s.shift === selectedShift &&
        (!selectedYear || !s.school_year || s.school_year === selectedYear)
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
        await supabase
          .from('schedule_entries')
          .update({ is_locked: newLockState })
          .eq('center_id', profile.center_id)
          .eq('shift', selectedShift);
      }
    } catch (err) {
      console.warn('Nota de guardado en DB de blindaje:', err);
    }

    if (newLockState) {
      alert(
        `🔒 HORARIO ${selectedShift.toUpperCase()} BLINDADO CON ÉXITO\n\nTodas las materias están aseguradas con candado y protegidas contra cualquier cambio o movimiento accidental.\n\nLos botones automáticos (Regenerar, Reparar y Rellenar) han quedado protegidos.`
      );
    } else {
      alert(
        `🔓 HORARIO ${selectedShift.toUpperCase()} DESBLOQUEADO\n\nLas materias han sido liberadas para permitir modificaciones.`
      );
    }
  };

  // Asistente de Intercambio Directo Modal State
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapCourseId, setSwapCourseId] = useState('');
  const [swapSubjectId, setSwapSubjectId] = useState('');
  const [swapDayFilter, setSwapDayFilter] = useState('Todos');
  const [isFastFilling, setIsFastFilling] = useState(false);
  const [showBottleneckModal, setShowBottleneckModal] = useState(false);

  const getCourseSubjectsAndAssignments = (targetCourseId: string) => {
    if (!targetCourseId) return [];
    const directAssignments = (state.assignments || []).filter(
      (a: any) => String(a.course_id || a.courseId) === String(targetCourseId)
    );

    const map = new Map<string, any>();

    // 1. Asignaciones directas del curso
    directAssignments.forEach((a: any) => {
      const sId = String(a.subject_id);
      const req = Number(a.hours_per_week || a.hoursPerWeek) || 0;
      map.set(sId, {
        id: a.id || `assign-${sId}`,
        subject_id: sId,
        teacher_id: a.teacher_id || a.teacherId,
        assignedHours: req,
        assign: a
      });
    });

    // 2. Si hay materias ya colocadas en el horario de este curso en la cuadrícula
    (state.schedule || []).forEach((s: any) => {
      if (String(s.course_id || s.courseId) === String(targetCourseId)) {
        const sId = String(s.subject_id);
        if (!map.has(sId)) {
          const sub = state.subjects.find((sub: any) => String(sub.id) === sId);
          const subName = (sub?.name || '').toLowerCase();
          let defaultHours = 2;
          if (subName.includes('matem')) defaultHours = 6;
          else if (subName.includes('español') || subName.includes('lengua')) defaultHours = 5;
          else if (subName.includes('social') || subName.includes('natur')) defaultHours = 4;
          else if (subName.includes('ingl') || subName.includes('franc')) defaultHours = 2;

          // Contar horas reales colocadas en el horario para esta materia
          const countPlaced = (state.schedule || []).filter(
            (sc: any) =>
              String(sc.course_id || sc.courseId) === String(targetCourseId) &&
              String(sc.subject_id) === sId
          ).length;

          map.set(sId, {
            id: `sched-subject-${sId}`,
            subject_id: sId,
            teacher_id: s.teacher_id,
            assignedHours: Math.max(defaultHours, countPlaced),
            assign: {
              id: `sched-${sId}`,
              course_id: targetCourseId,
              subject_id: sId,
              teacher_id: s.teacher_id,
              hours_per_week: Math.max(defaultHours, countPlaced)
            }
          });
        }
      }
    });

    // 3. Materias del currículo oficial para este nivel si faltasen en DB
    const courseObj = state.courses.find((c: any) => String(c.id) === String(targetCourseId));
    const levelStr = (courseObj?.level || '').toLowerCase();
    const isSecundaria = levelStr.includes('secun');

    (state.subjects || []).forEach((sub: any) => {
      const sId = String(sub.id);
      if (map.has(sId)) return;

      const sName = (sub.name || '').toLowerCase();
      let shouldInclude = false;
      let defaultHours = 2;

      if (isSecundaria) {
        if (sName.includes('matem')) { shouldInclude = true; defaultHours = 6; }
        else if (sName.includes('español') || sName.includes('lengua')) { shouldInclude = true; defaultHours = 5; }
        else if (sName.includes('social')) { shouldInclude = true; defaultHours = 4; }
        else if (sName.includes('natur')) { shouldInclude = true; defaultHours = 4; }
        else if (sName.includes('ingl') || sName.includes('english')) { shouldInclude = true; defaultHours = 2; }
        else if (sName.includes('franc')) { shouldInclude = true; defaultHours = 2; }
        else if (sName.includes('art')) { shouldInclude = true; defaultHours = 2; }
        else if (sName.includes('físic') || sName.includes('fisic') || sName.includes('deport')) { shouldInclude = true; defaultHours = 2; }
        else if (sName.includes('human') || sName.includes('relig') || sName.includes('fihr')) { shouldInclude = true; defaultHours = 2; }
      }

      if (shouldInclude) {
        const tchAssign = (state.assignments || []).find(
          (a: any) =>
            String(a.subject_id) === sId &&
            String(a.course_id || a.courseId) === String(targetCourseId)
        );
        const generalTchAssign = (state.assignments || []).find(
          (a: any) => String(a.subject_id) === sId && (a.teacher_id || a.teacherId)
        );
        const teacherId =
          tchAssign?.teacher_id ||
          generalTchAssign?.teacher_id ||
          (state.teachers[0]?.id || '');

        map.set(sId, {
          id: `curric-${sId}`,
          subject_id: sId,
          teacher_id: teacherId,
          assignedHours: defaultHours,
          assign: {
            id: `temp-${sId}`,
            course_id: targetCourseId,
            subject_id: sId,
            teacher_id: teacherId,
            hours_per_week: defaultHours
          }
        });
      }
    });

    return Array.from(map.values());
  };

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

  // Sincronizar reactivamente el filtro de grado si cambia el perfil del alumno/padre o docente
  useEffect(() => {
    if (isStudentOrParent) {
      setFilterType('course');
      const activeId =
        profile?.role === 'student'
          ? profile.course_id || profile.course_code || ''
          : localStorage.getItem('selected_course_id') || profile?.parent_course_ids?.[0] || '';
      setFilterId(activeId);
    } else if (profile?.role === 'teacher') {
      setFilterType('teacher');
      const tId = profile.teacher_id || profile.id || '';
      if (tId) setFilterId(tId);
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
      const activeCourse = state.courses.find((c) => String(c.id) === String(filterId));
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

  const activeCourse = useMemo(() => {
    if (filterType === 'course' && filterId) {
      return state.courses.find((c) => String(c.id) === String(filterId)) || null;
    }
    return null;
  }, [filterType, filterId, state.courses]);

  const effectiveShift: 'Matutina' | 'Vespertina' = useMemo(() => {
    if (activeCourse?.tanda) {
      const t = activeCourse.tanda.toLowerCase();
      if (t.includes('ves') || t.includes('tar')) return 'Vespertina';
      if (t.includes('mat') || t.includes('mañ') || t.includes('ext') || t.includes('com')) return 'Matutina';
    }
    return selectedShift;
  }, [activeCourse, selectedShift]);

  const isMorning = effectiveShift === 'Matutina';
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

  const format12h = (timeStr: string): string => {
    if (!timeStr) return '';
    const clean = timeStr.trim();
    const parts = clean.split(':');
    if (parts.length < 2) return clean;
    let h = parseInt(parts[0], 10);
    const m = parts[1].substring(0, 2);
    if (isNaN(h)) return clean;
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${m}`;
  };

  const filteredSchedule = useMemo(() => {
    const list = [...(state.schedule || [])];
    const shiftBase = selectedShift.toLowerCase().substring(0, 3);

    if (filterType === 'course' && filterId) {
      return list.filter((s: any) => {
        const sCid = s.course_id || s.courseId;
        return String(sCid) === String(filterId);
      });
    }

    if (filterType === 'teacher' && filterId) {
      return list.filter((s: any) => {
        if (String(s.teacher_id) === String(filterId)) return true;
        if (!s.teacher_id) {
          return (state.assignments || []).some(
            (a: any) =>
              String(a.teacher_id || a.teacherId) === String(filterId) &&
              String(a.course_id || a.courseId) === String(s.course_id || s.courseId) &&
              String(a.subject_id) === String(s.subject_id)
          );
        }
        return false;
      });
    }

    // Vista general (Todos los cursos)
    return list.filter((s: any) => {
      const sShift = (s.shift || '').toLowerCase();
      const shiftMatch = !sShift || sShift.includes(shiftBase) || shiftBase.includes(sShift.substring(0, 3));
      let yearMatch = true;
      if (selectedYear) {
        yearMatch = !s.school_year || s.school_year === '' || s.school_year === selectedYear;
      }
      return shiftMatch && yearMatch;
    });
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
      const course = state.courses.find((c) => String(c.id) === String(filterId));
      if (course) {
        const official = findOfficialSchedule(state.levelSchedules, course.level, effectiveShift);
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
      const primaryOfficial = findOfficialSchedule(state.levelSchedules, 'Primario', effectiveShift);
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
      const courseOfficial = findOfficialSchedule(state.levelSchedules, course?.level, effectiveShift);
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

      const cycleBPref = (state.breakPreferences || []).find((bp: any) => {
        let bpMins = toMins(bp.startTime);
        if (!isMorning && bpMins < 720) bpMins += 720;
        const isBpMorning = bpMins < 780;
        if (isMorning !== isBpMorning) return false;

        const bpLevel = (bp.level || '').toLowerCase();
        const levelNorm = (course?.level || '').toLowerCase();
        if (!bpLevel || bpLevel.includes('gen') || bpLevel.includes('todo')) return true;
        return (
          bpLevel.substring(0, 3) === levelNorm.substring(0, 3) ||
          levelNorm.includes(bpLevel.substring(0, 3))
        );
      });

      const effectiveBPref = cycleBPref || masterBPref;
      let bStart = toMins(effectiveBPref.startTime);
      if (!isMorning && bStart < 720 && bStart > 0) bStart += 720;
      if (!isMorning && (bStart <= courseStartT || bStart >= courseEndT)) bStart = 960;
      const bDuration = Number(effectiveBPref.durationMinutes) || (isMorning ? 30 : 15);
      const bEnd = bStart + bDuration;

      // Evento de Acto Cívico/Apertura
      const dbActoEvent = (state.fixedEvents || []).find((fe: any) => {
        const feName = (fe.name || '').toLowerCase();
        const isActo = feName.includes('acto') || feName.includes('bandera') || feName.includes('apertura');
        if (!isActo) return false;
        const feLevel = (fe.level || '').toLowerCase();
        const levelNorm = (course?.level || '').toLowerCase();
        return !feLevel || feLevel.includes('gen') || feLevel.includes(levelNorm.substring(0, 3));
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

      const levelNormCourse = (course?.level || '').toLowerCase();
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
          start: fromMins(sTime),
          end: fromMins(eTime),
          isBreak: false,
          label: `${i + 1}ra Hora`
        });
      }

      // EL RECREO
      slots.push({ start: fromMins(bStart), end: fromMins(bEnd), isBreak: true, label: 'RECREO' });

      // Eventos Fijos Post-Recreo (filtrados por nivel y ciclo)
      let currTimePost = bEnd;
      const postFixedEvents = (state.fixedEvents || []).filter((fe: any) => {
        const feName = (fe.name || '').toLowerCase();
        const isActo = feName.includes('acto') || feName.includes('bandera') || feName.includes('apertura');
        const feStartMins = toMins(fe.start_time);
        if (isActo || feStartMins < bStart - 5 || feStartMins >= courseEndT) return false;

        const feLevel = (fe.level || '').toLowerCase();
        const levelNorm = (course?.level || '').toLowerCase();
        return !feLevel || feLevel.includes('gen') || feLevel.includes(levelNorm.substring(0, 3));
      });

      // CÁLCULO FLEXIBLE Y DINÁMICO DESPUÉS DEL RECREO
      const postWindow = Math.max(0, courseEndT - currTimePost);
      let postCountLocal = Math.max(1, targetTotalLocal - preCountLocal);
      const postDurs = calculateSlotDurations(postWindow, postCountLocal);
      for (let i = 0; i < postDurs.length; i++) {
        let dur = postDurs[i];
        let sTime = currTimePost;
        let eTime = i === postDurs.length - 1 ? courseEndT : sTime + dur;

        const intersectingEvent = postFixedEvents.find((fe: any) => {
          const feStartMins = toMins(fe.start_time);
          return Math.abs(feStartMins - sTime) < 5;
        });

        if (intersectingEvent) {
          slots.push({
            start: fromMins(sTime),
            end: fromMins(toMins(intersectingEvent.end_time)),
            isBreak: true,
            label: intersectingEvent.name
          });
          currTimePost = toMins(intersectingEvent.end_time);
        } else {
          currTimePost = eTime;
          slots.push({
            start: fromMins(sTime),
            end: fromMins(eTime),
            isBreak: false,
            label: `${preCountLocal + i + 1}ra Hora`
          });
        }
      }

      return slots;
    };

    // Si estamos filtrando por un curso específico, usamos sus slots exactos
    if (filterType === 'course' && filterId) {
      const course = state.courses.find((c) => String(c.id) === String(filterId));
      if (course) {
        const slotsForCourse = getSlotsForCourse(course);
        return { slots: slotsForCourse, startT, endT, masterBPref };
      }
    }

    // VISTA DE DOCENTE: construir grilla unificada desde todos los cursos que enseña
    if (filterType === 'teacher' && filterId) {
      const shiftBaseTeacher = effectiveShift.toLowerCase().substring(0, 3);
      // Obtener los cursos asignados a este docente en este turno
      const teacherAssignmentCourseIds = [
        ...new Set(
          (state.assignments || [])
            .filter((a: any) => String(a.teacher_id || a.teacherId) === String(filterId))
            .map((a: any) => String(a.course_id || a.courseId))
        )
      ];
      const teacherCourses = (state.courses || []).filter((c: any) => {
        if (!teacherAssignmentCourseIds.includes(String(c.id))) return false;
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
            String(s.teacher_id) === String(filterId) &&
            s.shift === effectiveShift &&
            (!selectedYear || !s.school_year || s.school_year === selectedYear)
        );
        if (teacherSchedule.length > 0) {
          mergedSlots = mergedSlots.filter((slot) => {
            if (slot.isBreak) return true;
            return teacherSchedule.some((entry: any) => {
              const eMins = toMins(entry.start_time);
              const slotMins = toMins(slot.start);
              return Math.abs(slotMins - eMins) <= 25;
            });
          });
        }

        return { slots: mergedSlots, startT, endT, masterBPref };
      }
    }

    // VISTA GENERAL (O CURSO SIN HORARIOS OFICIALES)
    const slots: any[] = [];
    let bStartMaster = toMins(masterBPref.startTime);
    if (!isMorning && bStartMaster < 720 && bStartMaster > 0) bStartMaster += 720;
    if (!isMorning && (bStartMaster <= startT || bStartMaster >= endT)) bStartMaster = 960;
    const bEndMaster = bStartMaster + (Number(masterBPref.durationMinutes) || (isMorning ? 20 : 15));

    // Evento de Acto Cívico/Apertura General
    const dbActoEvent = (state.fixedEvents || []).find((fe: any) => {
      const feName = (fe.name || '').toLowerCase();
      const isActo = feName.includes('acto') || feName.includes('bandera') || feName.includes('apertura');
      if (!isActo) return false;
      const feLevel = (fe.level || '').toLowerCase();
      return !feLevel || feLevel.includes('gen');
    });

    let classStart = isMorning && startT <= 480 ? 480 : startT;
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
      if (bStartMaster - classStart >= 120) preCountGen = 3;
      else if (bStartMaster - classStart < 80) preCountGen = 1;
    } else {
      if (bStartMaster - classStart >= 120) preCountGen = 3;
      else if (bStartMaster - classStart < 70) preCountGen = 1;
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
    effectiveShift,
    isMorning,
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

    const normStr = (str: string) =>
      (str || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    const normalizeEntryMinutes = (timeStr: string, isMorn: boolean) => {
      let mins = toMins(timeStr);
      if (mins <= 0) return 0;
      if (!isMorn) {
        if (mins < 420) {
          // Formato 12h (ej: 02:00 = 120 min -> 840 min / 14:00)
          mins += 720;
        } else if (mins >= 420 && mins < 780) {
          // Horas guardadas en base matutina (ej: 08:00 = 480 min -> +360 = 840 min / 14:00)
          mins += 360;
        }
      }
      return mins;
    };

    filteredSchedule.forEach((entry) => {
      if (!entry.day || !entry.start_time) return;

      const normDay = normStr(entry.day);
      const matchedDay = days.find((d) => normStr(d) === normDay) || days[0];
      const eMins = normalizeEntryMinutes(entry.start_time, isMorning);

      let closestSlot: any = null;
      let minDiff = Infinity;

      slots.forEach((slot) => {
        let slotMins = toMins(slot.start);
        if (!isMorning && slotMins < 720 && slotMins > 0) {
          slotMins += 720;
        }
        const diff = Math.abs(eMins - slotMins);
        if (diff < minDiff) {
          minDiff = diff;
          closestSlot = slot;
        }
      });

      // Asociar si la entrada corresponde al slot más cercano
      if (closestSlot && minDiff <= 60) {
        const key = `${matchedDay}-${closestSlot.start}`;
        if (!map.has(key)) map.set(key, []);
        const listInSlot = map.get(key)!;

        // Evitar duplicados exactos en la casilla
        const isDup = listInSlot.some(
          (existing: any) =>
            String(existing.id) === String(entry.id) ||
            (String(existing.course_id || existing.courseId) === String(entry.course_id || entry.courseId) &&
              String(existing.subject_id) === String(entry.subject_id) &&
              normStr(existing.day) === normDay &&
              existing.start_time === entry.start_time)
        );
        if (!isDup) listInSlot.push(entry);
      }
    });

    return map;
  }, [filteredSchedule, slots, days, isMorning]);

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

    const currentShiftEntries = (state.schedule || []).filter(
      (s: any) =>
        s.shift === selectedShift &&
        (!selectedYear || !s.school_year || s.school_year === selectedYear)
    );

    if (currentShiftEntries.length > 0 && lockedEntries.size > 0) {
      if (
        !confirm(
          `⚠️ ATENCIÓN: El botón "Regenerar" recalcula y crea un horario nuevo desde cero.\n\n👉 Si lo que deseas es mantener tus materias con candado y únicamente rellenar las horas pendientes, presiona "Cancelar" y usa el botón "Ajustar Horas Faltantes".\n\n¿Estás completamente seguro de que deseas regenerar todo el horario desde cero?`
        )
      )
        return;
    } else {
      if (!confirm(`¿Generar horario completo para Tanda ${selectedShift}?`)) return;
    }

    // Limpiar candados antiguos si el horario estaba vacío
    if (currentShiftEntries.length === 0) {
      setLockedEntries(new Set());
      try {
        localStorage.removeItem(lockStorageKey);
      } catch {}
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
          '⚠️ Horario generado (Casi Completo)\n\nEl sistema evaluó las combinaciones posibles:\n\n' +
            diagnostics.join('\n\n')
        );
      } else {
        alert('✅ ¡Horario generado al 100% con éxito!');
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

    const currentShiftEntries = (state.schedule || []).filter(
      (s: any) =>
        s.shift === selectedShift &&
        (!selectedYear || !s.school_year || s.school_year === selectedYear)
    );

    // Si no hay horario base, redirigir a generar
    if (currentShiftEntries.length === 0) {
      handleRegenerate();
      return;
    }

    if (
      !confirm(
        `¿Ajustar horas faltantes del horario ${selectedShift} respetando las materias con candado?`
      )
    )
      return;
    setIsDeepRepairing(true);
    setDeepRepairAttempt(1);
    await new Promise((r) => setTimeout(r, 50));
    try {
      const { diagnostics } = await scheduleService.repairSchedule(
        state,
        profile,
        selectedShift,
        selectedYear,
        Array.from(lockedEntries)
      );
      await refreshData(undefined, true);
      const isPerfect = (diagnostics || []).some(
        (d: string) => d.includes('100%') || d.includes('Exitosa al 100')
      );
      if (isPerfect) {
        alert(
          '✅ ¡Horario ajustado al 100%! Todas las horas faltantes fueron colocadas exitosamente.'
        );
      } else if (diagnostics && diagnostics.length > 0) {
        alert(
          '⚠️ Ajuste Realizado\n\nEl sistema colocó las horas posibles respetando tus candados. Quedan los siguientes avisos:\n\n' +
            diagnostics.join('\n\n')
        );
      } else {
        alert('✅ ¡Horario ajustado exitosamente!');
      }
    } catch (e: any) {
      alert('Error durante el ajuste: ' + e.message);
    } finally {
      setIsDeepRepairing(false);
      setDeepRepairAttempt(0);
    }
  };

  const handleFastFill = async () => {
    if (isAllLocked) {
      alert(
        '🔒 HORARIO BLINDADO\n\nTodas las materias están protegidas. Desbloquea el blindaje general si deseas rellenar horas faltantes.'
      );
      return;
    }
    setIsFastFilling(true);
    try {
      const targetCourseId = filterType === 'course' && filterId ? filterId : undefined;
      const res = await scheduleService.fastTargetedFill(
        state,
        profile,
        effectiveShift || selectedShift,
        selectedYear,
        Array.from(lockedEntries),
        targetCourseId,
        slots
      );
      await refreshData(undefined, true);
      alert(res.message);
    } catch (e: any) {
      alert('Error en relleno asistido: ' + e.message);
    } finally {
      setIsFastFilling(false);
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
      const rowData: string[] = [`${format12h(slot.start)} - ${format12h(slot.end)}`];
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
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  };

  const handleExportDataPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const shiftCourses = state.courses.filter((c: any) => {
        const sBase = selectedShift.toLowerCase().substring(0, 3);
        const tStr = (c.tanda || '').toLowerCase();
        const lvlStr = (c.level || '').toLowerCase();
        if (sBase === 'mat') {
          return !tStr.includes('ves') && !tStr.includes('tar');
        } else {
          return tStr.includes('ves') || tStr.includes('tar') || (tStr === '' && lvlStr.includes('secun'));
        }
      });

      const targetCourses = filterType === 'course' && filterId
        ? shiftCourses.filter((c: any) => String(c.id) === String(filterId))
        : shiftCourses;

      if (targetCourses.length === 0) {
        alert('No hay cursos disponibles para exportar en esta tanda.');
        return;
      }

      const centerName = profile?.center?.name || 'CENTRO EDUCATIVO JUAN PABLO DUARTE';

      targetCourses.forEach((course: any, idx: number) => {
        if (idx > 0) {
          doc.addPage('a4', 'landscape');
        }

        // Header Superior Elegante
        doc.setFillColor(30, 41, 59); // slate-800
        doc.rect(0, 0, 297, 18, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text(centerName.toUpperCase(), 14, 11);

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(`TANDA ${selectedShift.toUpperCase()} | AÑO ESCOLAR: ${selectedYear || '2026-2027'}`, 283, 11, { align: 'right' });

        // Título del Curso
        doc.setTextColor(15, 23, 42); // slate-900
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        const courseTitle = `HORARIO: ${course.grade} "${course.section || ''}" - NIVEL ${course.level || ''}`;
        doc.text(courseTitle.toUpperCase(), 14, 28);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`Generado oficialmente a través de Edugest`, 14, 33);

        const tableDays = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

        const tableBody = slots.map((slot: any) => {
          const timeLabel = `${format12h(slot.start)}\n${format12h(slot.end)}`;
          
          if (slot.isBreak) {
            return [
              timeLabel,
              {
                content: `🔔 ${slot.label || 'RECREO'}`,
                colSpan: 5,
                styles: { halign: 'center', fillColor: [254, 243, 199], textColor: [180, 83, 9], fontStyle: 'bold' }
              }
            ];
          }

          const dayCols = tableDays.map((day) => {
            const entries = (state.schedule || []).filter((s: any) => {
              if (String(s.course_id || s.courseId) !== String(course.id)) return false;
              if ((s.day || '').trim().toLowerCase() !== day.toLowerCase()) return false;
              const sM = toMins(slot.start);
              const eM = toMins(s.start_time);
              return Math.abs(sM - eM) <= 25;
            });

            if (entries.length === 0) return '';

            return entries.map((e: any) => {
              const sub = state.subjects.find((s: any) => String(s.id) === String(e.subject_id));
              const teacher = state.teachers.find((t: any) => String(t.id) === String(e.teacher_id));
              return `${(sub?.name || 'Materia').toUpperCase()}\n${teacher?.name || 'Docente'}`;
            }).join('\n---\n');
          });

          return [timeLabel, ...dayCols];
        });

        autoTable(doc, {
          startY: 37,
          head: [['BLOQUE / HORA', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES']],
          body: tableBody,
          theme: 'grid',
          headStyles: {
            fillColor: [79, 70, 229],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 9,
            cellPadding: 3
          },
          bodyStyles: {
            fontSize: 8,
            cellPadding: 3,
            valign: 'middle',
            textColor: [30, 41, 59]
          },
          columnStyles: {
            0: { halign: 'center', fontStyle: 'bold', cellWidth: 26, fillColor: [248, 250, 252] },
            1: { cellWidth: 48, halign: 'center' },
            2: { cellWidth: 48, halign: 'center' },
            3: { cellWidth: 48, halign: 'center' },
            4: { cellWidth: 48, halign: 'center' },
            5: { cellWidth: 48, halign: 'center' }
          },
          margin: { left: 14, right: 14 }
        });
      });

      const filename = filterType === 'course' && filterId
        ? `Horario_${targetCourses[0]?.grade}_${targetCourses[0]?.section || ''}_${selectedShift}`.replace(/\s+/g, '_')
        : `Horarios_Todos_los_Grados_${selectedShift}`.replace(/\s+/g, '_');

      doc.save(`${filename}.pdf`);
    } catch (err: any) {
      alert('Error al generar PDF: ' + err.message);
    }
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
          {(() => {
            const matCount = (state.schedule || []).filter((s: any) => {
              const sh = (s.shift || '').toLowerCase();
              return sh.includes('mat') || sh.includes('mañ') || sh === '';
            }).length;
            const vesCount = (state.schedule || []).filter((s: any) => {
              const sh = (s.shift || '').toLowerCase();
              return sh.includes('ves') || sh.includes('tar');
            }).length;

            return (
              <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <button
                  onClick={() => setSelectedShift('Matutina')}
                  className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                    selectedShift === 'Matutina'
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Matutina</span>
                  {matCount > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                        selectedShift === 'Matutina'
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {matCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setSelectedShift('Vespertina')}
                  className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${
                    selectedShift === 'Vespertina'
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>Vespertina</span>
                  {vesCount > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${
                        selectedShift === 'Vespertina'
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {vesCount}
                    </span>
                  )}
                </button>
              </div>
            );
          })()}
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
                  onChange={(e) => {
                    const val = e.target.value;
                    setFilterId(val);
                    if (val) {
                      const c = state.courses.find((cr) => String(cr.id) === String(val));
                      if (c?.tanda) {
                        const t = c.tanda.toLowerCase();
                        if (t.includes('ves') || t.includes('tar')) {
                          setSelectedShift('Vespertina');
                        } else {
                          setSelectedShift('Matutina');
                        }
                      }
                    }
                  }}
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
            onClick={handleExportDataPDF}
            className="flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-md transition-all no-print cursor-pointer"
            title="Descargar documento PDF con cada grado por separado en base a los datos"
          >
            <Download size={14} className="text-white" />
            Descargar PDF Oficial
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
                onClick={handleFastFill}
                disabled={isGenerating || isRepairing || isDeepRepairing || isFastFilling || isAllLocked}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-blue-700 transition-all disabled:opacity-50 cursor-pointer"
                title="Rellena horas faltantes en 1 segundo sin tocar ni borrar ninguna hora ya colocada"
              >
                {isFastFilling ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Zap size={16} className="text-amber-300 fill-amber-300" />
                )}
                {isFastFilling
                  ? filterType === 'course' && filterId
                    ? 'Rellenando Curso...'
                    : 'Rellenando...'
                  : filterType === 'course' && filterId
                  ? `⚡ Rellenar ${state.courses.find((c) => c.id === filterId)?.grade || 'Curso'} ${state.courses.find((c) => c.id === filterId)?.section || ''}`
                  : '⚡ Relleno Rápido de Huecos'}
              </button>
              <button
                onClick={handleDeepRepair}
                disabled={isGenerating || isRepairing || isDeepRepairing || isFastFilling || isAllLocked}
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
                onClick={() => {
                  if (filterType === 'course' && filterId) {
                    setSwapCourseId(filterId);
                  }
                  setShowSwapModal(true);
                }}
                disabled={isGenerating || isRepairing || isDeepRepairing || isFastFilling}
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
          <span className="text-xl font-black text-indigo-900">{format12h(fromMins(startT))}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">
            Inicio Recreo
          </span>
          <span className="text-xl font-black text-indigo-900">{format12h(masterBPref.startTime)}</span>
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
              const coursesToAudit =
                filterType === 'course' && filterId
                  ? state.courses.filter((c: any) => c.id === filterId)
                  : state.courses.filter((c: any) => {
                      const tStr = (c.tanda || '').toLowerCase().trim();
                      if (shiftBaseVal === 'mat') {
                        return !tStr.includes('ves') && !tStr.includes('tar');
                      } else {
                        return tStr.includes('ves') || tStr.includes('tar');
                      }
                    });

              coursesToAudit.forEach((course: any) => {
                const courseItems = getCourseSubjectsAndAssignments(course.id);
                let courseHasMissing = false;
                let courseMissingCount = 0;
                courseItems.forEach((item: any) => {
                  const weeklyHours = Number(item.assignedHours) || 0;
                  if (weeklyHours === 0) return;
                  totalAssigned += weeklyHours;

                  let uniquePlaced = 0;
                  if (filterType === 'course' && filterId) {
                    days.forEach((d) => {
                      slots.forEach((slot) => {
                        if (slot.isBreak) return;
                        const entriesInSlot = entriesBySlotAndDay.get(`${d}-${slot.start}`) || [];
                        if (entriesInSlot.some((e: any) => String(e.subject_id) === String(item.subject_id))) {
                          uniquePlaced++;
                        }
                      });
                    });
                  } else {
                    const placedEntries = state.schedule.filter(
                      (s: any) =>
                        String(s.course_id || s.courseId) === String(course.id) &&
                        String(s.subject_id) === String(item.subject_id) &&
                        (!selectedYear || !s.school_year || s.school_year === selectedYear)
                    );
                    const uniqueSlotKeys = new Set(
                      placedEntries.map((s: any) => `${(s.day || '').trim().toLowerCase()}_${s.start_time}`)
                    );
                    uniquePlaced = uniqueSlotKeys.size;
                  }

                  const effectivePlaced = Math.min(uniquePlaced, weeklyHours);
                  totalPlaced += effectivePlaced;

                  if (uniquePlaced < weeklyHours) {
                    courseHasMissing = true;
                    courseMissingCount += weeklyHours - uniquePlaced;
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
              const courseIdSet = new Set(coursesToAudit.map((c: any) => c.id));
              const courseSchedules = state.schedule.filter(
                (s: any) =>
                  courseIdSet.has(s.course_id) &&
                  (!selectedYear || !s.school_year || s.school_year === selectedYear)
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

              const totalMissingHours = Math.max(0, totalAssigned - totalPlaced);
              const missingCount = coursesWithMissingHours.length > 0 ? coursesWithMissingHours.length : (totalMissingHours > 0 ? 1 : 0);
              const conflictCount = teachersWithConflicts.size;
              const coveragePct =
                totalAssigned > 0 ? Math.round((totalPlaced / totalAssigned) * 100) : 0;

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
                const course = state.courses.find((c: any) => String(c.id) === String(filterId));
                return `Curso: ${course?.grade || ''} ${course?.section || ''}`;
              })()}
            {filterType === 'teacher' &&
              filterId &&
              (() => {
                const teacher = state.teachers.find((t: any) => String(t.id) === String(filterId));
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
                    <span className="text-slate-900">{format12h(slot.start)}</span>
                    <br />
                    <span className="text-slate-400 font-medium">{format12h(slot.end)}</span>
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
                        const course = state.courses.find((c) => String(c.id) === String(filterId));
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
                    // Las franjas de recreo son inviolables y se muestran si no hay clases
                    const isRecreo = filterType === 'teacher' ? false : Boolean(slot.isBreak);
                    const blockName = entries.length === 0 ? (fixedEvent ? fixedEvent.name : isRecreo ? (slot.label || 'RECREO') : null) : null;

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
                                const subject = state.subjects.find((s) => String(s.id) === String(e.subject_id));
                                const teacher = state.teachers.find((t) => String(t.id) === String(e.teacher_id));
                                const course = state.courses.find((c) => String(c.id) === String(e.course_id));
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
                                  title={`Asignar materia a esta hora (${day} ${format12h(slot.start)})`}
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
            {getCourseSubjectsAndAssignments(filterId).map((item) => {
              const subject = state.subjects.find((s) => String(s.id) === String(item.subject_id));
              let placedHours = 0;
              days.forEach((d) => {
                slots.forEach((slot) => {
                  if (slot.isBreak) return;
                  const entriesInSlot = entriesBySlotAndDay.get(`${d}-${slot.start}`) || [];
                  if (entriesInSlot.some((e: any) => String(e.subject_id) === String(item.subject_id))) {
                    placedHours++;
                  }
                });
              });
              const assignedHours = Number(item.assignedHours) || 0;
              const isComplete = placedHours >= assignedHours && assignedHours > 0;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all ${isComplete ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-200 shadow-lg animate-pulse'}`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-[10px] font-black uppercase text-slate-700 leading-tight pr-4">
                      {subject?.name || 'Materia'}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isAdminOrStaff && item.assign?.id && placedHours === 0 && (
                        <button
                          onClick={async (evt) => {
                            evt.stopPropagation();
                            if (
                              confirm(
                                `¿Eliminar la asignación de "${subject?.name || 'esta materia'}" de este curso porque no corresponde a este grado?`
                              )
                            ) {
                              try {
                                await deleteAssignment(item.assign.id);
                                alert(`✅ Asignación de ${subject?.name || 'materia'} eliminada de este curso.`);
                              } catch (err: any) {
                                alert('Error al eliminar asignación: ' + err.message);
                              }
                            }
                          }}
                          title="Eliminar asignación que no corresponde a este grado 🗑️"
                          className="p-1 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-100 transition-all cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                      {isComplete ? (
                        <CheckCircle size={14} className="text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle size={14} className="text-rose-500 shrink-0" />
                      )}
                    </div>
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
                  {state.courses
                    .filter((c: any) => {
                      const sBase = selectedShift.toLowerCase().substring(0, 3);
                      const tStr = (c.tanda || '').toLowerCase();
                      const lvlStr = (c.level || '').toLowerCase();
                      if (sBase === 'mat') {
                        return !tStr.includes('ves') && !tStr.includes('tar');
                      } else {
                        return tStr.includes('ves') || tStr.includes('tar') || (tStr === '' && lvlStr.includes('secun'));
                      }
                    })
                    .map((c: any) => (
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
                    getCourseSubjectsAndAssignments(swapCourseId).map((item: any) => {
                      const sub = state.subjects.find((s: any) => String(s.id) === String(item.subject_id));
                      const assigned = Number(item.assignedHours) || 0;
                      let placed = 0;
                      days.forEach((d) => {
                        slots.forEach((slot) => {
                          if (slot.isBreak) return;
                          const entriesInSlot = entriesBySlotAndDay.get(`${d}-${slot.start}`) || [];
                          if (entriesInSlot.some((e: any) => String(e.subject_id) === String(item.subject_id))) {
                            placed++;
                          }
                        });
                      });
                      const missing = Math.max(0, assigned - placed);
                      return (
                        <option key={item.subject_id} value={item.subject_id}>
                          {sub?.name || 'Materia'} ({placed}/{assigned}h {missing > 0 ? `❌ FALTAN ${missing}h` : '✓ COMPLETO'})
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
                  const swapData = scheduleService.findSmartSwaps(
                    state,
                    swapCourseId,
                    swapSubjectId,
                    selectedShift,
                    Array.from(lockedEntries),
                    slots
                  );

                  const {
                    suggestions: allSuggestions = [],
                    teacherGrid = {},
                    teacherName = 'Docente',
                    teacherTotalAssigned = 0,
                    teacherTotalPlaced = 0,
                    slotTimes = []
                  } = swapData || {};

                  const suggestions = allSuggestions.filter(
                    (s: any) => swapDayFilter === 'Todos' || s.day === swapDayFilter
                  );

                  return (
                    <div className="flex flex-col gap-4">
                      {/* BANNER DE DISPONIBILIDAD EN TIEMPO REAL DEL DOCENTE */}
                      <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col gap-3 shadow-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
                          <div>
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">
                              Disponibilidad Semanal del Docente
                            </span>
                            <h4 className="text-sm font-black uppercase text-white tracking-tight">
                              👨‍🏫 {teacherName}
                            </h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-slate-800 text-slate-300">
                              Carga: {teacherTotalPlaced}/{teacherTotalAssigned}h ({Math.round((teacherTotalPlaced / (teacherTotalAssigned || 1)) * 100)}%)
                            </span>
                          </div>
                        </div>

                        {/* CUADRÍCULA INTERACTIVA DE DISPONIBILIDAD SEMANAL */}
                        <div className="overflow-x-auto">
                          <table className="w-full text-center border-collapse">
                            <thead>
                              <tr>
                                <th className="p-1 text-[8px] font-black uppercase text-slate-400">Hora</th>
                                {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map((d) => (
                                  <th key={d} className="p-1 text-[9px] font-black uppercase text-slate-300">
                                    {d.substring(0, 3)}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {slotTimes.map((slot: any, sIdx: number) => (
                                <tr key={sIdx} className="border-t border-slate-800/60">
                                  <td className="p-1 text-[8px] font-black text-slate-400 whitespace-nowrap">
                                    {slot.label || format12h(slot.start)}
                                  </td>
                                  {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map((day) => {
                                    const cell = teacherGrid[day]?.[slot.start] || { status: 'free', label: 'Libre' };
                                    let bg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30 cursor-pointer';
                                    let text = 'LIBRE';

                                    if (cell.status === 'break') {
                                      bg = 'bg-slate-800/50 text-slate-500 border-slate-800';
                                      text = 'Recreo';
                                    } else if (cell.status === 'busy_other') {
                                      bg = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
                                      text = cell.label;
                                    } else if (cell.status === 'busy_this') {
                                      bg = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                                      text = 'En este curso';
                                    }

                                    return (
                                      <td key={day} className="p-0.5">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (cell.status === 'free') {
                                              setSwapDayFilter(day);
                                            }
                                          }}
                                          disabled={cell.status !== 'free'}
                                          className={`w-full py-1 px-1 rounded-lg border text-[8px] font-black uppercase transition-all truncate block ${bg}`}
                                          title={`Docente el ${day} (${format12h(slot.start)}): ${cell.label}`}
                                        >
                                          {text}
                                        </button>
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* LISTADO DE SUGERENCIAS */}
                      {suggestions.length === 0 ? (
                        <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl text-center text-amber-800 space-y-2">
                          <AlertCircle size={28} className="mx-auto text-amber-500" />
                          <p className="text-xs font-black uppercase tracking-tight">
                            No hay casillas libres para el {swapDayFilter === 'Todos' ? 'resto de la semana' : swapDayFilter}
                          </p>
                          <p className="text-[10px] text-slate-500 font-medium">
                            Intenta seleccionar otro día arriba o haz clic en una de las casillas verdes de la cuadrícula de disponibilidad.
                          </p>
                        </div>
                      ) : (
                        suggestions.map((sugg: any, idx: number) => {
                          const isRipple = sugg.type === 'ripple';
                          const isEmpty = sugg.type === 'empty';
                          const isSwap = sugg.type === 'swap';
                          const isWarning = sugg.type === 'warning';

                          return (
                            <div
                              key={idx}
                              className={`border p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
                                isRipple
                                  ? 'bg-purple-50 hover:bg-purple-100/60 border-purple-200 hover:border-purple-400'
                                  : isEmpty
                                  ? 'bg-emerald-50/60 hover:bg-emerald-100/60 border-emerald-200 hover:border-emerald-400'
                                  : isSwap
                                  ? 'bg-amber-50/60 hover:bg-amber-100/60 border-amber-200 hover:border-amber-400'
                                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                              }`}
                            >
                              <div className="space-y-1">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                                    isRipple
                                      ? 'bg-purple-600 text-white'
                                      : isEmpty
                                      ? 'bg-emerald-600 text-white'
                                      : isSwap
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-slate-400 text-white'
                                  }`}
                                >
                                  {isRipple
                                    ? '⚡ Intercambio en Cadena (Sin Choques)'
                                    : isEmpty
                                    ? '🟢 Casilla Libre Directa'
                                    : isSwap
                                    ? '🔄 Reemplazo Local'
                                    : '⚠️ Advertencia'}
                                </span>
                                <p className="text-xs font-black text-slate-900 uppercase tracking-tight">
                                  {sugg.title}
                                </p>
                                <p className="text-[10px] font-medium text-slate-600">
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
                                className={`px-5 py-2.5 font-black text-[10px] uppercase tracking-widest rounded-xl shadow-md transition-all shrink-0 cursor-pointer text-white ${
                                  isRipple
                                    ? 'bg-purple-600 hover:bg-purple-700'
                                    : isEmpty
                                    ? 'bg-emerald-600 hover:bg-emerald-700'
                                    : 'bg-amber-600 hover:bg-amber-700'
                                }`}
                              >
                                {isRipple ? 'Aplicar en Cadena' : 'Colocar Clase Aquí'}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  );
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
                    📅 {directAssignModal.day} • ⏰ {directAssignModal.slot?.label || ''} ({format12h(directAssignModal.slot?.start)} - {format12h(directAssignModal.slot?.end)})
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
                    {(() => {
                      const courseItems = getCourseSubjectsAndAssignments(directAssignModal.courseId);
                      const courseObj = state.courses.find((c: any) => String(c.id) === String(directAssignModal.courseId));
                      const isSec = (courseObj?.level || '').toLowerCase().includes('secun');

                      const displayedList = [...courseItems];
                      (state.subjects || []).forEach((sub: any) => {
                        const sId = String(sub.id);
                        if (!displayedList.some((it) => String(it.subject_id) === sId)) {
                          const sName = (sub.name || '').toLowerCase();
                          let isRelevant = false;
                          if (isSec) {
                            isRelevant =
                              sName.includes('matem') ||
                              sName.includes('español') ||
                              sName.includes('lengua') ||
                              sName.includes('social') ||
                              sName.includes('natur') ||
                              sName.includes('ingl') ||
                              sName.includes('franc') ||
                              sName.includes('art') ||
                              sName.includes('físic') ||
                              sName.includes('fisic') ||
                              sName.includes('human') ||
                              sName.includes('relig');
                          } else {
                            isRelevant = true;
                          }
                          if (isRelevant) {
                            const genTch = (state.assignments || []).find(
                              (a: any) => String(a.subject_id) === sId && (a.teacher_id || a.teacherId)
                            );
                            displayedList.push({
                              id: `opt-${sId}`,
                              subject_id: sId,
                              teacher_id: genTch?.teacher_id || (state.teachers[0]?.id || ''),
                              assignedHours: 2,
                              assign: null
                            });
                          }
                        }
                      });

                      return displayedList.map((item) => {
                        const subject = state.subjects.find((s) => String(s.id) === String(item.subject_id));
                        const teacherId = item.teacher_id;
                        const teacher = state.teachers.find((t) => String(t.id) === String(teacherId));
                        const assigned = Number(item.assignedHours) || 0;
                        let placed = 0;
                        days.forEach((d) => {
                          slots.forEach((slot) => {
                            if (slot.isBreak) return;
                            const entriesInSlot = entriesBySlotAndDay.get(`${d}-${slot.start}`) || [];
                            if (entriesInSlot.some((e: any) => String(e.subject_id) === String(item.subject_id))) {
                              placed++;
                            }
                          });
                        });
                        const missing = Math.max(0, assigned - placed);

                        // Verificar si el docente tiene clase en otro curso a esta misma hora
                        const sStartM = toMins(directAssignModal.slot?.start);
                        const sEndM = toMins(directAssignModal.slot?.end);
                        const teacherClash = (state.schedule || []).find((s) => {
                          if (!teacherId || String(s.teacher_id) !== String(teacherId)) return false;
                          if ((s.day || '').trim().toLowerCase() !== directAssignModal.day.toLowerCase()) return false;
                          const eStart = toMins(s.start_time);
                          let eEnd = toMins(s.end_time);
                          if (eEnd <= eStart) eEnd = eStart + 45;
                          const overlap = Math.min(sEndM, eEnd) - Math.max(sStartM, eStart);
                          return overlap > 10;
                        });

                        const isSelected = String(directAssignModal.subjectId) === String(item.subject_id);

                        return (
                          <div
                            key={item.id}
                            onClick={() => setDirectAssignModal({ ...directAssignModal, subjectId: item.subject_id })}
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
                                👨‍🏫 {teacher?.name || 'Docente de la Materia'}
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
                      });
                    })()}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    Selecciona un curso primero para ver sus materias
                  </p>
                )}
              </div>

              {/* Botón de Confirmación */}
              <div className="pt-2">
                <button
                  disabled={!directAssignModal.courseId || !directAssignModal.subjectId}
                  onClick={async () => {
                    const items = getCourseSubjectsAndAssignments(directAssignModal.courseId);
                    const assignItem = items.find(
                      (a) => String(a.subject_id) === String(directAssignModal.subjectId)
                    );

                    // Si no tiene teacher_id específico, buscar si hay algún docente asignado a esta materia
                    let finalTeacherId = assignItem?.teacher_id;
                    if (!finalTeacherId) {
                      const otherAssign = (state.assignments || []).find(
                        (a: any) => String(a.subject_id) === String(directAssignModal.subjectId)
                      );
                      finalTeacherId =
                        otherAssign?.teacher_id ||
                        otherAssign?.teacherId ||
                        (state.teachers[0]?.id || '');
                    }

                    const targetCourse = state.courses.find((c) => String(c.id) === String(directAssignModal.courseId));
                    const cTandaStr = (targetCourse?.tanda || '').toLowerCase();
                    const isCourseVespertina = cTandaStr.includes('ves') || cTandaStr.includes('tar');
                    const targetShift = isCourseVespertina ? 'Vespertina' : (effectiveShift || selectedShift);

                    const finalYear = selectedYear || state.currentYear || '2026-2027';
                    const sStart = directAssignModal.slot.start.length === 5 ? directAssignModal.slot.start + ':00' : directAssignModal.slot.start;
                    const sEnd = directAssignModal.slot.end.length === 5 ? directAssignModal.slot.end + ':00' : directAssignModal.slot.end;

                    try {
                      const entryPayload = {
                        center_id: profile.center_id,
                        course_id: directAssignModal.courseId,
                        subject_id: directAssignModal.subjectId,
                        teacher_id: finalTeacherId,
                        day: directAssignModal.day,
                        shift: targetShift,
                        start_time: sStart,
                        end_time: sEnd,
                        school_year: finalYear
                      };

                      const { data: insertedData, error } = await supabase
                        .from('schedule_entries')
                        .insert([entryPayload])
                        .select();

                      if (error) throw error;

                      if (insertedData && insertedData.length > 0) {
                        setAppState((prev: any) => ({
                          ...prev,
                          schedule: [...(prev.schedule || []), ...insertedData]
                        }));
                      }

                      if (isCourseVespertina && selectedShift !== 'Vespertina') {
                        setSelectedShift('Vespertina');
                      }

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
