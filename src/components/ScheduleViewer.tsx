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
  Wrench
} from 'lucide-react';
import html2canvas from 'html2canvas-pro';
import * as XLSX from 'xlsx';
import { SEO } from './SEO';

import { scheduleService } from '../services/scheduleService';

export const ScheduleViewer = () => {
  const { state, profile, refreshData, selectedYear } = useApp();

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
    // FILTRO CRÍTICO POR AÑO Y TANDA
    list = list.filter((s: any) => s.shift === selectedShift && s.school_year === selectedYear);

    if (filterType === 'teacher' && filterId)
      list = list.filter((s: any) => s.teacher_id === filterId);
    if (filterType === 'course' && filterId)
      list = list.filter((s: any) => s.course_id === filterId);
    return list;
  }, [state.schedule, filterType, filterId, selectedShift, selectedYear]);

  const timeSlots = useMemo(() => {
    let startT = isMorning ? 480 : 840; // 08:00 o 14:00
    let endT = isMorning ? 720 : 1095; // 18:15 default

    const findOfficialSchedule = (schedules: any[], levelName: string, shiftName: string) => {
      if (!schedules || schedules.length === 0) return null;
      const lNorm = (levelName || '').toLowerCase().substring(0, 3);
      const sNorm = (shiftName || '').toLowerCase().substring(0, 3);

      let match = schedules.find((ls: any) => {
        const lsLvl = (ls.level || '').toLowerCase();
        const lsShift = (ls.shift || '').toLowerCase();
        const lvlMatch = lsLvl.substring(0, 3) === lNorm || lNorm.includes(lsLvl.substring(0, 3));
        const shiftMatch =
          lsShift.substring(0, 3) === sNorm ||
          (sNorm === 'mat' && (lsShift.includes('mañ') || lsShift.includes('ext') || lsShift.includes('com')));
        return lvlMatch && shiftMatch;
      });

      if (!match) {
        match = schedules.find((ls: any) => {
          const lsLvl = (ls.level || '').toLowerCase();
          return lsLvl.substring(0, 3) === lNorm || lNorm.includes(lsLvl.substring(0, 3));
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
          startT = toMins(official.start_time);
          endT = toMins(official.end_time);
        }
      }
    } else if (filterType === 'all') {
      // En vista general, buscamos el horario más común o el de Primaria por defecto
      const primaryOfficial = findOfficialSchedule(state.levelSchedules, 'Primario', selectedShift) || (state.levelSchedules || [])[0];
      if (primaryOfficial) {
        startT = toMins(primaryOfficial.start_time);
        endT = toMins(primaryOfficial.end_time);
      }
    }

    // Bloque maestro de recreo (priorizando el nivel del contexto actual)
    // Encontrar el recreo maestro de forma ultra-permisiva (por hora)
    const firstRelevantBreak = (state.breakPreferences || []).find((bp: any) => {
      let bpMins = toMins(bp.startTime);
      if (!isMorning && bpMins < 420) bpMins += 720;
      const isBpMorning = bpMins < 780; // Antes de la 1 PM es mañana
      return isMorning === isBpMorning;
    });

    const rawMasterStart = firstRelevantBreak?.startTime || (isMorning ? '10:00:00' : '16:00:00');
    let masterStartMins = toMins(rawMasterStart);
    if (!isMorning && masterStartMins < 420) masterStartMins += 720;
    const masterBPref = {
      startTime: fromMins(masterStartMins),
      durationMinutes: firstRelevantBreak?.durationMinutes || 30
    };

    const getSlotsForCourse = (course: any) => {
      const courseOfficial = findOfficialSchedule(state.levelSchedules, course.level, selectedShift);
      const courseStartT = courseOfficial?.start_time ? toMins(courseOfficial.start_time) : startT;
      const courseEndT = courseOfficial?.end_time ? toMins(courseOfficial.end_time) : endT;

      const grade = course.grade?.toLowerCase() || '';
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
        if (isFirstCycle && (bp.cycle || '').includes('Primer')) return true;
        if (isSecondCycle && (bp.cycle || '').includes('Segundo')) return true;
        return false;
      });

      if (!bPref) {
        bPref = applicableBPs.find((bp: any) => !bp.cycle || bp.cycle === 'General');
      }

      bPref = bPref || masterBPref;

      let bStart = toMins(bPref.startTime);
      if (!isMorning && bStart < 420) bStart += 720;
      const bEnd = bStart + (Number(bPref.durationMinutes) || masterBPref.durationMinutes);

      // DURACIONES UNIFICADAS CON EL MOTOR
      const dbActoEvent = (state.fixedEvents || []).find((fe: any) => {
        const feName = (fe.name || '').toLowerCase();
        return feName.includes('acto') || feName.includes('bandera') || feName.includes('apertura');
      });

      let classStart = courseOfficial?.start_time ? courseStartT : (isMorning && startT <= 480 ? 480 : startT);
      if (isMorning) {
        if (dbActoEvent && dbActoEvent.end_time) {
          const feEndMins = toMins(dbActoEvent.end_time);
          if (feEndMins > 0) classStart = Math.max(classStart, feEndMins);
        } else if (startT <= 450) {
          classStart = 470; // 07:50 AM por defecto tras Acto de Bandera
        }
      }

      const slots = [];

      if (!dbActoEvent) {
        if (isMorning && classStart > 450 && classStart <= 480) {
          slots.push({ start: '07:30:00', end: fromMins(classStart) + ':00', isBreak: true, label: 'ACTO APERTURA' });
        } else if (isMorning && startT <= 450) {
          slots.push({ start: '07:30:00', end: '07:50:00', isBreak: true, label: 'ACTO APERTURA' });
        }
      }

      // CÁLCULO FLEXIBLE Y DINÁMICO ANTES DEL RECREO (40 a 45 minutos por clase)
      const preWindow = Math.max(0, bStart - classStart);
      let preCountLocal = 2;
      if (preWindow >= 120) {
        preCountLocal = 3;
      } else if (preWindow < 70) {
        preCountLocal = 1;
      }

      let currTimePre = classStart;
      for (let i = 0; i < preCountLocal; i++) {
        const remainingSlots = preCountLocal - i;
        const remainingTime = bStart - currTimePre;
        let dur = 45;
        if (remainingSlots === 1) {
          dur = remainingTime;
        } else {
          dur = remainingTime >= remainingSlots * 40 + 5 ? 45 : 40;
        }
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
      slots.push({ start: fromMins(bStart), end: fromMins(bEnd), isBreak: true, label: 'RECREO' });

      // CÁLCULO PROPORCIONAL DESPUÉS DEL RECREO
      const postDuration = Math.floor((endT - bEnd) / postCountLocal);
      for (let i = 0; i < postCountLocal; i++) {
        let sTime = bEnd + i * postDuration;
        let eTime = i === postCountLocal - 1 ? endT : sTime + postDuration;
        slots.push({
          start: fromMins(sTime),
          end: fromMins(eTime),
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
            return hasEntry || slot.isBreak;
          });
        }

        return { slots: mergedSlots, startT, endT, masterBPref };
      }
    }

    // VISTA GENERAL: Generar periodos estándar alineados al Recreo Maestro
    const slots = [];
    let bStartMaster = toMins(masterBPref.startTime);
    if (!isMorning && bStartMaster < 420) bStartMaster += 720;
    const bEndMaster = bStartMaster + (Number(masterBPref.durationMinutes) || 20);

    // Inicio de clases según Hora Oficial (si existe) o a las 08:00 (por defecto)
    const hasOfficial = (state.levelSchedules || []).find(
      (ls: any) => ls.shift === selectedShift && ls.start_time
    );
    let classStart = hasOfficial ? startT : isMorning && startT <= 480 ? 480 : startT;

    // Evitar duplicar si la DB ya tiene un Evento Fijo para Acto de Bandera/Apertura
    const hasDbActo = (state.fixedEvents || []).some((fe: any) => {
      const feName = (fe.name || '').toLowerCase();
      return feName.includes('acto') || feName.includes('bandera') || feName.includes('apertura');
    });

    if (!hasDbActo) {
      if (isMorning && classStart > 450 && classStart <= 480) {
        slots.push({ start: '07:30:00', end: fromMins(classStart) + ':00', isBreak: true, label: 'ACTO APERTURA' });
      } else if (isMorning && startT <= 450) {
        slots.push({ start: '07:30:00', end: '08:00:00', isBreak: true, label: 'ACTO APERTURA' });
      }
    }
    const targetTotalGen = isMorning ? 5 : 6;
    const totalAvailableGen = Math.max(1, bStartMaster - classStart + (endT - bEndMaster));
    const preCountGen = Math.min(
      targetTotalGen - 1,
      Math.max(1, Math.round(((bStartMaster - classStart) / totalAvailableGen) * targetTotalGen))
    );
    const postCountGen = targetTotalGen - preCountGen;

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

      const eMins = toMins(entry.start_time);

      // Find the slot that is closest to entry's start time
      let closestSlot = null;
      let minDiff = Infinity;

      slots.forEach((slot) => {
        const slotMins = toMins(slot.start);
        const diff = Math.abs(eMins - slotMins);
        if (diff < minDiff) {
          minDiff = diff;
          closestSlot = slot;
        }
      });

      // We only assign it to the closest slot if the difference is within 25 minutes
      if (closestSlot && minDiff <= 25) {
        const key = `${entry.day}-${closestSlot.start}`;
        map.get(key)?.push(entry);
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
    if (!confirm(`¿Generar nuevo horario para Tanda ${selectedShift}?`)) return;
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
    if (!confirm(`¿Intentar reparar los choques actuales del horario ${selectedShift}?`)) return;
    setIsRepairing(true);
    await new Promise((r) => setTimeout(r, 100));
    try {
      const { diagnostics } = await scheduleService.repairSchedule(
        state,
        profile,
        selectedShift,
        selectedYear
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
          selectedYear
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
                      {c.grade} {c.section}
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
                  Curso: {activeCourse.grade} "{activeCourse.section}"
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
              <button
                onClick={handleRegenerate}
                disabled={isGenerating || isRepairing || isDeepRepairing}
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
                disabled={isGenerating || isRepairing || isDeepRepairing}
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
                disabled={isGenerating || isRepairing || isDeepRepairing}
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
            </>
          )}
        </div>
      </div>

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
                    // En vista de DOCENTE: si hay clases en este bloque (ej. docente de Deporte
                    // que enseña en varios ciclos con distintos recreos), las clases tienen
                    // prioridad sobre el recreo — nunca se ocultan detrás del banner de recreo.
                    const isRecreoRaw = slot.isBreak;
                    const isRecreo =
                      isRecreoRaw && !(filterType === 'teacher' && entries.length > 0);
                    const blockName = fixedEvent ? fixedEvent.name : isRecreo ? (slot.label || 'RECREO') : null;

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
                                    className="bg-white p-2 rounded-xl border border-slate-200 shadow-sm group-hover:shadow-md transition-shadow"
                                  >
                                    <p className="text-[10px] font-bold text-slate-800 leading-tight line-clamp-2 uppercase">
                                      {subject?.name || 'Materia'}
                                    </p>
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
                              <p className="text-[9px] text-slate-300 text-center italic opacity-0 group-hover:opacity-100 transition-opacity">
                                Vacío
                              </p>
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
    </div>
  );
};
