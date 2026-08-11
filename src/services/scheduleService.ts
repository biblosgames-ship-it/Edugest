import { supabase } from '../lib/supabase';

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
    match = schedules.find((ls: any) => (ls.level || '').toLowerCase().substring(0, 3) === lNorm);
  }

  return match || schedules[0] || null;
};

export const scheduleService = {
  generateSchedule: async (
    state: any,
    profile: any,
    shift: 'Matutina' | 'Vespertina',
    year: string
  ) => {
    const centerId = profile?.center_id;
    if (!centerId) throw new Error('No se encontró el ID del centro');
    const schoolYear = year;

    const {
      courses: allCourses,
      assignments: allAssignments,
      teacherPreferences,
      breakPreferences,
      fixedEvents,
      levelSchedules
    } = state;
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

    // 1. Filtrar cursos y asignaciones con lógica flexible (Matutin/Vesperti)
    const shiftBaseVal = shift.toLowerCase().substring(0, 3);
    const courses = allCourses.filter((c: any) => {
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
          tStr.includes('ves') || tStr.includes('tar') || (tStr === '' && lvlStr.includes('secun'))
        );
      }
    });
    const courseIds = courses.map((c: any) => c.id);
    const assignments = allAssignments.filter((a: any) =>
      courseIds.includes(a.course_id || a.courseId)
    );

    const normalizeTime = (t: string) =>
      t?.replace(/\D/g, '').replace(/^0/, '').substring(0, 4) || '';

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

    const getCourseSlots = (course: any) => {
      const isMorning = shift === 'Matutina';
      const levelNorm = (course.level || '').toLowerCase();
      const official = findOfficialSchedule(levelSchedules, course.level, shift);

      const startT = toMins(official?.start_time || (isMorning ? '08:00' : '14:00'));
      const endT = toMins(official?.end_time || (isMorning ? '12:00' : '18:15'));

      const grade = (course.grade || '').toLowerCase();

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

      const applicableBPs = (breakPreferences || []).filter((bp: any) => {
        let bpMins = toMins(bp.startTime);
        if (!isMorning && bpMins < 420) bpMins += 720;
        const isBpMorning = bpMins < 780;
        if (isMorning !== isBpMorning) return false;

        const bpLevel = (bp.level || '').toLowerCase();
        if (!bpLevel || bpLevel.includes('gen') || bpLevel.includes('todo')) return true;
        return (
          bpLevel.substring(0, 3) === levelNorm.substring(0, 3) ||
          levelNorm.includes(bpLevel.substring(0, 3))
        );
      });

      let bPref = applicableBPs.find((bp: any) => {
        if (isFirstCycle && (bp.cycle || '').toLowerCase().includes('primer')) return true;
        if (isSecondCycle && (bp.cycle || '').toLowerCase().includes('segundo')) return true;
        return false;
      });

      if (!bPref) {
        bPref = applicableBPs.find(
          (bp: any) =>
            !bp.cycle || bp.cycle.toLowerCase() === 'general' || bp.cycle.toLowerCase() === 'gen'
        );
      }

      bPref = bPref || { startTime: isMorning ? '10:00' : '16:00', durationMinutes: 15 };

      let bStart = toMins(bPref.startTime);
      if (!isMorning && bStart < 420) bStart += 720;
      const bEnd = bStart + (Number(bPref.durationMinutes) || 15);

      const targetTotal = isMorning || levelNorm.includes('primar') ? 5 : 6;
      // 1. EVENTO FIJO DE APERTURA / ACTO DE BANDERA (100% Dinámico desde Preferencias de la DB)
      const dbActoEvent = (fixedEvents || []).find((fe: any) => {
        const feName = (fe.name || '').toLowerCase();
        return feName.includes('acto') || feName.includes('bandera') || feName.includes('apertura');
      });

      let classStart = official?.start_time ? startT : (isMorning && startT <= 480 ? 480 : startT);
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

      // CÁLCULO FLEXIBLE Y DINÁMICO ANTES DEL RECREO (40 a 45 minutos por clase)
      const preWindow = Math.max(0, bStart - classStart);
      let preCount = 2;
      if (preWindow >= 120) {
        preCount = 3;
      } else if (preWindow < 70) {
        preCount = 1;
      }

      let currTimePre = classStart;
      for (let i = 0; i < preCount; i++) {
        const remainingSlots = preCount - i;
        const remainingTime = bStart - currTimePre;
        let dur = 45;
        if (remainingSlots === 1) {
          dur = remainingTime;
        } else {
          dur = remainingTime >= remainingSlots * 40 + 5 ? 45 : 40;
        }
        let sTime = currTimePre;
        let eTime = i === preCount - 1 ? bStart : sTime + dur;
        currTimePre = eTime;

        slots.push({
          start: fromMins(sTime),
          end: fromMins(eTime),
          isBreak: false,
          label: `${i + 1}ra Hora`
        });
      }

      // RECREO
      slots.push({ start: fromMins(bStart), end: fromMins(bEnd), isBreak: true, label: 'RECREO' });

      // Eventos Fijos Post-Recreo (ej. Juego/Trabajo de 09:45 a 10:00 o Almuerzo)
      let currTimePost = bEnd;
      const postFixedEvents = (fixedEvents || []).filter((fe: any) => {
        const feName = (fe.name || '').toLowerCase();
        const isActo = feName.includes('acto') || feName.includes('bandera') || feName.includes('apertura');
        const feStartMins = toMins(fe.start_time);
        return !isActo && feStartMins >= bStart - 5 && feStartMins < endT;
      });

      postFixedEvents.forEach((fe: any) => {
        const feEndMins = toMins(fe.end_time);
        if (feEndMins > currTimePost) {
          slots.push({
            start: fe.start_time,
            end: fe.end_time,
            isBreak: true,
            label: fe.name
          });
          currTimePost = Math.max(currTimePost, feEndMins);
        }
      });

      // CÁLCULO FLEXIBLE Y DINÁMICO DESPUÉS DEL RECREO Y EVENTOS FIJOS HASTA LA HORA DE CIERRE (ej. 1:00 PM / 13:00)
      const postWindow = Math.max(0, endT - currTimePost);
      let postCount = Math.max(1, Math.round(postWindow / 45));

      for (let i = 0; i < postCount; i++) {
        const remainingSlots = postCount - i;
        const remainingTime = endT - currTimePost;
        let dur = remainingSlots === 1 ? remainingTime : (remainingTime >= remainingSlots * 40 + 5 ? 45 : 40);
        let sTime = currTimePost;
        let eTime = i === postCount - 1 ? endT : sTime + dur;
        currTimePost = eTime;

        slots.push({
          start: fromMins(sTime),
          end: fromMins(eTime),
          isBreak: false,
          label: `${preCount + i + 1}ra Hora`
        });
      }

      return slots.map((s, i) => ({ ...s, originalIdx: i }));
    };

    const allTasks: any[] = [];
    const taskSummary: Record<string, number> = {};

    courses.forEach((course: any) => {
      const levelKey = course.level || 'Desconocido';
      const courseAssignments = assignments.filter(
        (a: any) => a.course_id === course.id || a.courseId === course.id
      );

      if (courseAssignments.length === 0) {
        taskSummary[levelKey + ' (Sin Materias)'] =
          (taskSummary[levelKey + ' (Sin Materias)'] || 0) + 1;
      }

      courseAssignments.forEach((assign: any) => {
        let remaining = Number(assign.hours_per_week || assign.hoursPerWeek) || 0;
        taskSummary[levelKey] = (taskSummary[levelKey] || 0) + remaining;

        const subObj = state.subjects?.find((s: any) => s.id === assign.subject_id);
        const sName = subObj?.name?.toLowerCase() || '';
        const distType = subObj?.distributionType || subObj?.distribution_type;
        // Materias que requieren bloque doble (horas consecutivas)
        const requiresDouble =
          distType === 'together' ||
          sName.includes('matemática') ||
          sName.includes('matematica') ||
          sName.includes('lengua') ||
          sName.includes('español') ||
          sName.includes('espanol') ||
          sName.includes('ciencias') ||
          sName.includes('física') ||
          sName.includes('fisica') ||
          sName.includes('educación física') ||
          sName.includes('educacion fisica') ||
          sName.includes('deporte') ||
          sName.includes('recreo') ||
          sName.includes('artística') ||
          sName.includes('artistica');

        while (remaining > 0) {
          if (remaining >= 2 && requiresDouble) {
            allTasks.push({ course, assign, isDouble: true });
            remaining -= 2;
          } else {
            allTasks.push({ course, assign, isDouble: false });
            remaining -= 1;
          }
        }
      });
    });

    // 2. BOOST DE PRIORIDAD PARA GRADOS BAJOS (1ro, 2do)
    allTasks.forEach((task) => {
      const grade = (task.course.grade || '').toLowerCase();
      task.priorityBoost = 0;
      if (grade.includes('1') || grade.includes('primer')) task.priorityBoost = 1000;
      if (grade.includes('2') || grade.includes('segundo')) task.priorityBoost = 500;
    });

    const debugInfo = Object.entries(taskSummary)
      .map(([k, v]) => `${k}: ${v}h`)
      .join(' | ');

    const teacherLoad: Record<string, number> = {};
    assignments.forEach((a: any) => {
      teacherLoad[a.teacher_id] =
        (teacherLoad[a.teacher_id] || 0) + Number(a.hours_per_week || a.hoursPerWeek || 0);
    });

    const getPriority = (task: any) => {
      let score = task.priorityBoost || 0;

      const grade = task.course?.grade?.toLowerCase() || '';
      const cLevel =
        task.course?.level || (grade.includes('secundaria') ? 'Secundario' : 'Primario');
      const isFirstCycle =
        /^[1-3]/.test(grade) ||
        grade.includes('1') ||
        grade.includes('2') ||
        grade.includes('3') ||
        grade.includes('primer') ||
        (grade.includes('segundo') && !grade.includes('ciclo')) ||
        grade.includes('tercer');
      const cCycle = isFirstCycle ? 'Primer Ciclo' : 'Segundo Ciclo';

      const taskSubject = state.subjects?.find((s: any) => s.id === task.assign?.subject_id);
      const taskSubjectName = (taskSubject?.name || '').toLowerCase().trim();

      const manualPriority = (state.priorityPreferences || []).find((p: any) => {
        const matchLevel = !p.level || p.level === 'General' || p.level === cLevel;
        const matchCycle = !p.cycle || p.cycle === 'General' || p.cycle === cCycle;
        if (!matchLevel || !matchCycle) return false;

        if (p.targetType === 'subject') {
          if (p.targetId === task.assign?.subject_id) return true;
          const pSub = state.subjects?.find((s: any) => s.id === p.targetId);
          const pSubName = (pSub?.name || '').toLowerCase().trim();
          if (pSubName && taskSubjectName && pSubName === taskSubjectName) return true;
        }

        if (p.targetType === 'teacher' && p.targetId === task.assign?.teacher_id) return true;
        return false;
      });

      if (manualPriority) {
        score += (Number(manualPriority.score) || 100) * 100; // Multiplicar por 100 para dominar el ordenamiento
      } else {
        if (
          taskSubjectName.includes('matemática') ||
          taskSubjectName.includes('lengua') ||
          taskSubjectName.includes('español') ||
          taskSubjectName.includes('ciencias') ||
          taskSubjectName.includes('naturales') ||
          taskSubjectName.includes('sociales')
        )
          score += 200;
        if (taskSubjectName.includes('física') || taskSubjectName.includes('deporte')) score += 1500; // Prioridad ultra-alta por defecto
        if (taskSubjectName.includes('artística')) score += 300;
        if (
          taskSubjectName.includes('inglés') ||
          taskSubjectName.includes('francés') ||
          taskSubjectName.includes('idioma')
        )
          score += 80;
      }

      score += (teacherLoad[task.assign?.teacher_id] || 0) * 10;
      if (task.isDouble) score += 50;
      return score;
    };

    const attemptGeneration = () => {
      const currentTasks = [...allTasks].sort((a, b) => {
        const pA = getPriority(a);
        const pB = getPriority(b);
        if (pA !== pB) return pB - pA;
        if (a.isDouble !== b.isDouble) return b.isDouble ? -1 : 1;
        return Math.random() - 0.5;
      });

      const finalEntries: any[] = [];
      const dailyCount: Record<string, Record<string, Record<string, number>>> = {};

      const placeTask = (task: any, relaxedRules = false, superRelaxed = false) => {
        const { course, assign, isDouble } = task;
        const slots = getCourseSlots(course);
        const classSlots = slots.filter((s) => !s.isBreak);

        const teacherPref = (teacherPreferences || []).find(
          (p: any) => p.teacherId === assign.teacher_id
        );

        const workingDays =
          teacherPref?.workingDays && teacherPref.workingDays.length > 0
            ? teacherPref.workingDays
            : days;
        const shuffledDays = [...workingDays].sort(() => Math.random() - 0.5);

        for (const day of shuffledDays) {
          const daySubjectCount = dailyCount[course.id]?.[day]?.[assign.subject_id] || 0;

          if (!relaxedRules && daySubjectCount >= 2 && !isDouble) continue;
          if (!relaxedRules && daySubjectCount > 0 && isDouble) continue;

          let slotCombinations: any[][] = [];
          if (isDouble) {
            for (let i = 0; i < classSlots.length - 1; i++) {
              const endPrev = toMins(classSlots[i].end);
              const startNext = toMins(classSlots[i + 1].start);
              if (startNext === endPrev) {
                slotCombinations.push([classSlots[i], classSlots[i + 1]]);
              }
            }
          } else {
            for (let i = 0; i < classSlots.length; i++) {
              slotCombinations.push([classSlots[i]]);
            }
          }

          slotCombinations.sort(() => Math.random() - 0.5);

          for (const slotsToUse of slotCombinations) {
            if (!relaxedRules && daySubjectCount + slotsToUse.length > 2) continue;

            const existingSameSubject = finalEntries.filter(
              (e) => e.course_id === course.id && e.subject_id === assign.subject_id && e.day === day
            );
            if (existingSameSubject.length > 0) {
              const subObj = state.subjects?.find((s: any) => s.id === assign.subject_id);
              const sName = subObj?.name?.toLowerCase() || '';
              const distType = subObj?.distributionType || subObj?.distribution_type;
              const isTogetherSubject =
                distType === 'together' ||
                sName.includes('deporte') ||
                sName.includes('educación física') ||
                sName.includes('educacion fisica');

              if (!superRelaxed && isTogetherSubject) {
                const isAdjacent = slotsToUse.some((slot) => {
                  const pStart = toMins(slot.start);
                  const pEnd = toMins(slot.end);
                  return existingSameSubject.some((exist) => {
                    const eStart = toMins(exist.start_time);
                    const eEnd = toMins(exist.end_time);
                    return pStart === eEnd || pEnd === eStart;
                  });
                });
                if (!isAdjacent) continue;
              }
            }

            const hasConflict = slotsToUse.some((s) => {
              const sStart = toMins(s.start);
              const sEnd = toMins(s.end);

              const levelNorm = (course.level || '').toLowerCase();
              const official = (levelSchedules || []).find(
                (ls: any) =>
                  (ls.level || '').toLowerCase().startsWith(levelNorm.substring(0, 5)) &&
                  ls.shift === shift
              );

              const config = teacherPref?.dailyConfig?.[day] || {};
              const rawStartStr =
                shift === 'Matutina'
                  ? config.mStart || teacherPref?.morningStart || official?.start_time || '08:00'
                  : config.aStart || teacherPref?.afternoonStart || official?.start_time || '14:00';
              const rawEndStr =
                shift === 'Matutina'
                  ? config.mEnd || teacherPref?.morningEnd || official?.end_time || '12:00'
                  : config.aEnd || teacherPref?.afternoonEnd || official?.end_time || '18:15';
              const tStart = toMins(
                rawStartStr.length >= 3 ? rawStartStr : shift === 'Matutina' ? '08:00' : '14:00'
              );
              const tEnd = toMins(
                rawEndStr.length >= 3 ? rawEndStr : shift === 'Matutina' ? '12:00' : '18:15'
              );
              // Restricción de horario del docente:
              // - Pase 1 (strict): se respeta
              // - Pase 2 (relaxedRules): se respeta (solo se relajan los límites diarios)
              // - Pase 3 (superRelaxed): se ignora como último recurso
              if (!superRelaxed) {
                if (sStart < tStart - 5 || sEnd > tEnd + 5) return true;
              }

              const isBusy = finalEntries.some((e) => {
                if (e.day !== day) return false;

                const eStart = toMins(e.start_time);
                const eEnd = toMins(e.end_time);
                const timeOverlap = sStart < eEnd && sEnd > eStart;
                if (!timeOverlap) return false;

                // Un profesor no puede estar en dos sitios
                if (e.teacher_id === assign.teacher_id) return true;

                // Un curso no puede tener dos materias
                if (e.course_id === course.id) return true;

                return false;
              });
              if (isBusy) return true;

              const cLevelNorm = (course.level || '').toLowerCase();
              const cGradeNorm = (course.grade || '').toLowerCase();
              const isInicialLevel =
                cLevelNorm.includes('inic') ||
                cLevelNorm.includes('preesc') ||
                cLevelNorm.includes('kinder') ||
                cLevelNorm.includes('parvul') ||
                cGradeNorm.includes('inic') ||
                cGradeNorm.includes('kínder') ||
                cGradeNorm.includes('kinder') ||
                cGradeNorm.includes('párvulo') ||
                cGradeNorm.includes('parvulo') ||
                cGradeNorm.includes('pre-primario') ||
                cGradeNorm.includes('preprimario');

              if (!superRelaxed && state.avoidDeporteDuringAnyBreak && !isInicialLevel) {
                const sName = (
                  state.subjects?.find((sub: any) => sub.id === assign.subject_id)?.name || ''
                ).toLowerCase();
                if (
                  sName.includes('deporte') ||
                  sName.includes('educación física') ||
                  sName.includes('educacion fisica')
                ) {
                  const overlapsBreak = (breakPreferences || []).some((bp: any) => {
                    let bpStart = toMins(bp.startTime);
                    if (shift === 'Vespertina' && bpStart < 420) bpStart += 720;
                    const bpEnd = bpStart + (Number(bp.durationMinutes) || 15);
                    return sStart < bpEnd && sEnd > bpStart;
                  });
                  if (overlapsBreak) return true;
                }
              }

              const isFixed = (fixedEvents || []).some((fe: any) => {
                if (fe.day !== 'Todos' && fe.day !== day) return false;
                const feStart = toMins(fe.start_time);
                const defaultDuration = feStart < 480 ? 30 : 45;
                const feEnd = fe.end_time ? toMins(fe.end_time) : feStart + defaultDuration;

                if (sStart < feEnd && sEnd > feStart) {
                  const grade = (course.grade || '').toLowerCase();
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

                  const feCycle = (fe.cycle || '').toLowerCase();
                  const feLevel = (fe.level || '').toLowerCase();
                  const cLevel =
                    (course.level || '').toLowerCase() ||
                    (grade.includes('secundaria') ? 'secundari' : 'primari');

                  const levelMatch =
                    feLevel.includes('gen') ||
                    feLevel.includes(cLevel.substring(0, 3)) ||
                    cLevel.includes(feLevel.substring(0, 3));
                  if (!levelMatch) return false;

                  const cycleMatch =
                    feCycle.includes('gen') ||
                    (isFirstCycle && (feCycle.includes('1') || feCycle.includes('primer'))) ||
                    (isSecondCycle &&
                      (feCycle.includes('2') ||
                        feCycle.includes('segundo') ||
                        feCycle.includes('4') ||
                        feCycle.includes('5') ||
                        feCycle.includes('6')));

                  return cycleMatch;
                }
                return false;
              });

              return isFixed;
            });

            if (!hasConflict) {
              slotsToUse.forEach((s) => {
                finalEntries.push({
                  center_id: centerId,
                  course_id: course.id,
                  subject_id: assign.subject_id,
                  teacher_id: assign.teacher_id,
                  day,
                  shift,
                  start_time: s.start,
                  end_time: s.end,
                  school_year: schoolYear
                });
              });
              if (!dailyCount[course.id]) dailyCount[course.id] = {};
              if (!dailyCount[course.id][day]) dailyCount[course.id][day] = {};
              dailyCount[course.id][day][assign.subject_id] = daySubjectCount + slotsToUse.length;
              return true;
            }
          }
        }
        return false;
      };

      const pending1: any[] = [];
      for (const task of currentTasks) {
        if (!placeTask(task, false, false)) pending1.push(task);
      }

      let relaxedCount = 0;
      const pending2: any[] = [];
      for (const task of pending1) {
        if (placeTask(task, true, false)) {
          relaxedCount++;
        } else {
          pending2.push(task);
        }
      }

      let superRelaxedCount = 0;
      const pending3: any[] = [];
      for (const task of pending2) {
        if (placeTask(task, true, true)) {
          relaxedCount++;
          superRelaxedCount++;
        } else {
          pending3.push(task);
        }
      }

      const finalPending: any[] = [];
      for (const task of pending3) {
        if (task.isDouble) {
          const tSingle1 = { ...task, isDouble: false };
          const tSingle2 = { ...task, isDouble: false };
          const p1 = placeTask(tSingle1, true, true);
          const p2 = placeTask(tSingle2, true, true);
          if (p1 && p2) {
            relaxedCount += 2;
            superRelaxedCount += 2;
          } else if (p1) {
            relaxedCount++;
            superRelaxedCount++;
            finalPending.push(tSingle2);
          } else if (p2) {
            relaxedCount++;
            superRelaxedCount++;
            finalPending.push(tSingle1);
          } else {
            finalPending.push(task);
          }
        } else {
          finalPending.push(task);
        }
      }

      return { entries: finalEntries, pendingTasks: finalPending, relaxedCount, superRelaxedCount };
    };

    const MAX_ATTEMPTS = 2000;
    let bestResult: {
      entries: any[];
      pendingTasks: any[];
      relaxedCount: number;
      superRelaxedCount: number;
    } | null = null;
    let bestScore = Infinity;

    for (let i = 0; i < MAX_ATTEMPTS; i++) {
      const result = attemptGeneration();
      const score =
        result.pendingTasks.length * 100000 +
        result.superRelaxedCount * 1000 +
        result.relaxedCount * 1;
      if (score === 0) {
        bestResult = result;
        break;
      }
      if (score < bestScore) {
        bestScore = score;
        bestResult = result;
      }
    }

    const diagnostics: string[] = [];
    if (bestResult && bestResult.pendingTasks.length > 0) {
      const pendingCount: Record<string, number> = {};

      bestResult.pendingTasks.forEach((task) => {
        const tId = task.assign.teacher_id;
        const cId = task.course.id;
        const sId = task.assign.subject_id;
        const key = `${tId}|${cId}|${sId}`;
        pendingCount[key] = (pendingCount[key] || 0) + (task.isDouble ? 2 : 1);
      });

      for (const key in pendingCount) {
        const [tId, cId, sId] = key.split('|');
        const tName = state.teachers.find((t: any) => t.id === tId)?.name || 'Docente Desconocido';
        const cName = state.courses.find((c: any) => c.id === cId)?.grade || 'Curso Desconocido';
        const sName = state.subjects?.find((s: any) => s.id === sId)?.name || 'Materia Desconocida';
        const h = pendingCount[key];

        const courseRef = state.courses.find((c: any) => c.id === cId);
        const totalBlocks = courseRef
          ? getCourseSlots(courseRef).filter((s: any) => !s.isBreak).length * 5
          : 0;
        const totalAssignedToCourse = assignments
          .filter((a: any) => a.course_id === cId || a.courseId === cId)
          .reduce((acc: number, a: any) => acc + (Number(a.hours_per_week) || 0), 0);

        if (totalAssignedToCourse > totalBlocks) {
          diagnostics.push(
            `❌ El curso ${cName} tiene ${totalAssignedToCourse} horas asignadas, pero la semana solo tiene ${totalBlocks} huecos libres. Faltan ${h}h de ${sName}.`
          );
        } else {
          diagnostics.push(
            `⚠️ ${tName} no pudo colocar ${h}h de ${sName} en ${cName}. Conflicto de horario: O el docente no tiene disponibilidad en los días que el curso está libre, o hay un choque irresoluble con otras materias.`
          );
        }
      }
    }

    if (bestResult) {
      await supabase
        .from('schedule_entries')
        .delete()
        .eq('center_id', centerId)
        .eq('school_year', schoolYear)
        .eq('shift', shift);

      if (bestResult.entries && bestResult.entries.length > 0) {
        const entries = bestResult.entries;

        // Asegurar existencia de docentes en la tabla legacy 'teachers' para evitar violación de claves foráneas
        const uniqueTeacherIds = Array.from(new Set(entries.map((e) => e.teacher_id)));
        const teachersToUpsert = uniqueTeacherIds.map((tId) => {
          const tName = state.teachers?.find((t: any) => t.id === tId)?.name || 'Docente';
          return {
            id: tId,
            center_id: centerId,
            name: tName,
            hours_available: 40
          };
        });

        if (teachersToUpsert.length > 0) {
          const { error: upsertError } = await supabase
            .from('teachers')
            .upsert(teachersToUpsert, { onConflict: 'id' });
          if (upsertError) {
            console.error('Error al asegurar docentes en tabla teachers:', upsertError);
          }
        }

        const chunkSize = 500;
        for (let i = 0; i < entries.length; i += chunkSize) {
          const chunk = entries.slice(i, i + chunkSize).map((e) => {
            const { id, created_at, ...rest } = e;
            return rest;
          });
          const { error: insError } = await supabase.from('schedule_entries').insert(chunk);
          if (insError) throw new Error('Error guardando nuevo horario: ' + insError.message);
        }
      }
    }

    // 3. Auditoría Final de Seguridad Extrema (Materia por Materia)
    const finalAudit: string[] = [];
    let totalAssignedHours = 0;
    let totalPlacedHours = 0;

    assignments.forEach((a) => {
      const aCourseId = String(a.course_id || a.courseId);
      const aSubjectId = String(a.subject_id);
      const required = Number(a.hours_per_week || a.hoursPerWeek) || 0;
      totalAssignedHours += required;

      const placed = (bestResult?.entries || []).filter(
        (e) => String(e.course_id) === aCourseId && String(e.subject_id) === aSubjectId
      ).length;

      totalPlacedHours += placed;

      if (placed < required) {
        const cName = courses.find((c) => String(c.id) === aCourseId)?.grade || 'Curso';
        const sName =
          state.subjects?.find((s: any) => String(s.id) === aSubjectId)?.name || 'Materia';
        finalAudit.push(`❌ ${cName}: Faltan ${required - placed}h de ${sName}`);
      }
    });

    const realPercent =
      totalAssignedHours > 0 ? Math.round((totalPlacedHours / totalAssignedHours) * 100) : 0;

    if (finalAudit.length > 0) {
      finalAudit.unshift(
        `⚠️ Logrado: ${realPercent}% (${totalPlacedHours}/${totalAssignedHours}h). El sistema no pudo colocar todo.`
      );
    }

    return {
      entries: bestResult?.entries || [],
      diagnostics: finalAudit.length > 0 ? finalAudit : []
    };
  },

  repairSchedule: async (state: any, profile: any, shift: string, year: string) => {
    const centerId = profile.center_id;
    const schoolYear = year;

    const {
      courses: allCourses,
      assignments: allAssignments,
      levelSchedules,
      breakPreferences
    } = state;

    // 1. Identificar cursos (Lógica ultra-permisiva)
    const shiftBase = shift.toLowerCase().substring(0, 3); // 'mat' o 'ves'
    const courses = allCourses.filter((c: any) => {
      const tStr = (c.tanda || '').toLowerCase();
      const lvlStr = (c.level || '').toLowerCase();
      if (shiftBase === 'mat') {
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
          tStr.includes('ves') || tStr.includes('tar') || (tStr === '' && lvlStr.includes('secun'))
        );
      }
    });

    const courseIds = courses.map((c: any) => c.id);
    const assignments = allAssignments.filter((a: any) =>
      courseIds.includes(a.course_id || a.courseId)
    );

    const levelCounts: Record<string, number> = {};
    courses.forEach((c) => {
      levelCounts[c.level] = (levelCounts[c.level] || 0) + 1;
    });
    const levelInfo = `Niveles detectados: ${Object.entries(levelCounts)
      .map(([k, v]) => `${k} (${v})`)
      .join(', ')}`;

    const { data: currentSchedule } = await supabase
      .from('schedule_entries')
      .select('*')
      .eq('center_id', centerId)
      .eq('shift', shift)
      .eq('school_year', schoolYear);

    if (!currentSchedule || currentSchedule.length === 0) {
      return { diagnostics: ['No hay horario generado para reparar. Genera uno primero.'] };
    }

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

    const getCourseSlots = (course: any) => {
      const isMorning = shift === 'Matutina';
      const levelNorm = (course.level || '').toLowerCase();
      const official = findOfficialSchedule(levelSchedules, course.level, shift);

      const startT = toMins(official?.start_time || (isMorning ? '08:00:00' : '14:00:00'));
      const endT = toMins(official?.end_time || (isMorning ? '12:00:00' : '18:15:00'));
      const grade = (course.grade || '').toLowerCase();

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

      const applicableBPs = (breakPreferences || []).filter((bp: any) => {
        let bpMins = toMins(bp.startTime);
        if (!isMorning && bpMins < 420) bpMins += 720;
        const isBpMorning = bpMins < 780;
        if (isMorning !== isBpMorning) return false;

        const bpLevel = (bp.level || '').toLowerCase();
        if (!bpLevel || bpLevel.includes('gen') || bpLevel.includes('todo')) return true;
        return (
          bpLevel.substring(0, 3) === levelNorm.substring(0, 3) ||
          levelNorm.includes(bpLevel.substring(0, 3))
        );
      });

      let bPref = applicableBPs.find((bp: any) => {
        if (isFirstCycle && (bp.cycle || '').toLowerCase().includes('primer')) return true;
        if (isSecondCycle && (bp.cycle || '').toLowerCase().includes('segundo')) return true;
        return false;
      });

      if (!bPref) {
        bPref = applicableBPs.find(
          (bp: any) =>
            !bp.cycle || bp.cycle.toLowerCase() === 'general' || bp.cycle.toLowerCase() === 'gen'
        );
      }

      bPref = bPref || { startTime: isMorning ? '10:00:00' : '16:00:00', durationMinutes: 15 };

      let bStart = toMins(bPref.startTime);
      if (!isMorning && bStart < 420) bStart += 720;
      const bEnd = bStart + (Number(bPref.durationMinutes) || 15);
      
      // 1. EVENTO FIJO DE APERTURA / ACTO DE BANDERA (100% Dinámico desde Preferencias de la DB)
      const dbActoEvent = (state.fixedEvents || []).find((fe: any) => {
        const feName = (fe.name || '').toLowerCase();
        return feName.includes('acto') || feName.includes('bandera') || feName.includes('apertura');
      });

      let classStart = official?.start_time ? startT : (isMorning && startT <= 480 ? 480 : startT);
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

      const preWindow = Math.max(0, bStart - classStart);
      let preCount = preWindow >= 120 ? 3 : (preWindow < 70 ? 1 : 2);

      let currTimePre = classStart;
      for (let i = 0; i < preCount; i++) {
        const remainingSlots = preCount - i;
        const remainingTime = bStart - currTimePre;
        let dur = remainingSlots === 1 ? remainingTime : (remainingTime >= remainingSlots * 40 + 5 ? 45 : 40);
        let sTime = currTimePre;
        let eTime = i === preCount - 1 ? bStart : sTime + dur;
        currTimePre = eTime;

        slots.push({
          start: fromMins(sTime) + ':00',
          end: fromMins(eTime) + ':00',
          isBreak: false,
          label: `${i + 1}ra Hora`
        });
      }
      slots.push({ start: fromMins(bStart) + ':00', end: fromMins(bEnd) + ':00', isBreak: true, label: 'RECREO' });

      let currTimePost = bEnd;
      const postFixedEvents = (state.fixedEvents || []).filter((fe: any) => {
        const feName = (fe.name || '').toLowerCase();
        const isActo = feName.includes('acto') || feName.includes('bandera') || feName.includes('apertura');
        const feStartMins = toMins(fe.start_time);
        return !isActo && feStartMins >= bStart - 5 && feStartMins < endT;
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

      const postWindow = Math.max(0, endT - currTimePost);
      let postCount = Math.max(1, Math.round(postWindow / 45));

      for (let i = 0; i < postCount; i++) {
        const remainingSlots = postCount - i;
        const remainingTime = endT - currTimePost;
        let dur = remainingSlots === 1 ? remainingTime : (remainingTime >= remainingSlots * 40 + 5 ? 45 : 40);
        let sTime = currTimePost;
        let eTime = i === postCount - 1 ? endT : sTime + dur;
        currTimePost = eTime;

        slots.push({
          start: fromMins(sTime) + ':00',
          end: fromMins(eTime) + ':00',
          isBreak: false,
          label: `${preCount + i + 1}ra Hora`
        });
      }
      return slots;
    };

    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

    const isFixedEventConflict = (sStart: number, sEnd: number, day: string, course: any) => {
      return (state.fixedEvents || []).some((fe: any) => {
        if (fe.day !== 'Todos' && fe.day !== day) return false;
        const feStart = toMins(fe.start_time);
        const defaultDuration = feStart < 480 ? 30 : 45;
        const feEnd = fe.end_time ? toMins(fe.end_time) : feStart + defaultDuration;
        if (sStart < feEnd && sEnd > feStart) {
          const grade = (course.grade || '').toLowerCase();
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
          const feCycle = (fe.cycle || '').toLowerCase();
          const feLevel = (fe.level || '').toLowerCase();
          const cLevel = (course.level || '').toLowerCase();
          const levelMatch =
            feLevel.includes('gen') ||
            feLevel.includes(cLevel.substring(0, 3)) ||
            cLevel.includes(feLevel.substring(0, 3));
          if (!levelMatch) return false;
          const cycleMatch =
            feCycle.includes('gen') ||
            (isFirstCycle && (feCycle.includes('1') || feCycle.includes('primer'))) ||
            (isSecondCycle &&
              (feCycle.includes('2') ||
                feCycle.includes('segundo') ||
                feCycle.includes('4') ||
                feCycle.includes('5') ||
                feCycle.includes('6')));
          return cycleMatch;
        }
        return false;
      });
    };

    // --- MOTOR DE REPARACIÓN FIEL Y PROGRESIVA (LOYAL REPAIR ENGINE) ---
    const filteredAssignments = allAssignments.filter((a: any) =>
      courses.map((c: any) => c.id).includes(a.course_id || a.courseId)
    );

    // FASE 1: PRESERVACIÓN ESTRICTA (PINNING)
    const preservedEntries: any[] = [];
    const placedCount: Record<string, Record<string, number>> = {};
    const preservedDailyCount: Record<string, Record<string, Record<string, number>>> = {};

    (currentSchedule || []).forEach((e) => {
      const c = courses.find((course: any) => course.id === e.course_id);
      if (!c) return;

      const slots = getCourseSlots(c).filter((s) => !s.isBreak);
      const isSlotValid = slots.some((s) => s.start === e.start_time && s.end === e.end_time);
      if (!isSlotValid) return;

      const sStart = toMins(e.start_time);
      const sEnd = toMins(e.end_time);
      if (isFixedEventConflict(sStart, sEnd, e.day, c)) return;

      // Verificar que el docente trabaje este día preferido (workingDays)
      const teacherPref = (state.teacherPreferences || []).find(
        (p: any) => p.teacherId === e.teacher_id
      );
      const workingDays =
        teacherPref?.workingDays && teacherPref.workingDays.length > 0
          ? teacherPref.workingDays
          : days;
      if (!workingDays.includes(e.day)) return;

      // Verificar que el docente no esté duplicado en la misma hora en entradas ya preservadas
      const teacherBusy = preservedEntries.some(
        (pe) => pe.day === e.day && pe.teacher_id === e.teacher_id && pe.start_time === e.start_time
      );
      if (teacherBusy) return;

      // Verificar horas semanales requeridas
      const assign = filteredAssignments.find(
        (a) =>
          (a.course_id === e.course_id || a.courseId === e.course_id) &&
          a.subject_id === e.subject_id
      );
      if (!assign) return;
      const requiredHours = Number(assign.hours_per_week || assign.hoursPerWeek) || 0;

      if (!placedCount[e.course_id]) placedCount[e.course_id] = {};
      const currentPlaced = placedCount[e.course_id][e.subject_id] || 0;
      if (currentPlaced >= requiredHours) return;

      // Es válida y se preserva
      preservedEntries.push(e);
      placedCount[e.course_id][e.subject_id] = currentPlaced + 1;

      if (!preservedDailyCount[e.course_id]) preservedDailyCount[e.course_id] = {};
      if (!preservedDailyCount[e.course_id][e.day]) preservedDailyCount[e.course_id][e.day] = {};
      preservedDailyCount[e.course_id][e.day][e.subject_id] =
        (preservedDailyCount[e.course_id][e.day][e.subject_id] || 0) + 1;
    });

    // FASE 2: PREPARAR TAREAS FALTANTES
    const remainingTasksStrategy1: any[] = []; // Dobles intactos
    filteredAssignments.forEach((a) => {
      const course = courses.find((c) => c.id === (a.course_id || a.courseId));
      if (!course) return;

      const required = Number(a.hours_per_week || a.hoursPerWeek) || 0;
      const alreadyPlaced = placedCount[course.id]?.[a.subject_id] || 0;
      let remaining = required - alreadyPlaced;

      const subObj = state.subjects?.find((s: any) => s.id === a.subject_id);
      const sName = subObj?.name?.toLowerCase() || '';
      const distType = subObj?.distributionType || subObj?.distribution_type;
      const requiresDouble =
        distType === 'together' ||
        sName.includes('educación física') ||
        sName.includes('educacion fisica') ||
        sName.includes('deporte') ||
        sName.includes('matemática') ||
        sName.includes('matematica') ||
        sName.includes('lengua') ||
        sName.includes('español') ||
        sName.includes('espanol') ||
        sName.includes('ciencias') ||
        sName.includes('física') ||
        sName.includes('fisica') ||
        sName.includes('artística') ||
        sName.includes('artistica');

      while (remaining > 0) {
        if (remaining >= 2 && requiresDouble) {
          remainingTasksStrategy1.push({ course, assign: a, isDouble: true });
          remaining -= 2;
        } else {
          remainingTasksStrategy1.push({ course, assign: a, isDouble: false });
          remaining -= 1;
        }
      }
    });

    // Calcular carga total de cada docente para la heurística de dificultad
    const teacherLoadMap: Record<string, number> = {};
    filteredAssignments.forEach((a) => {
      teacherLoadMap[a.teacher_id] =
        (teacherLoadMap[a.teacher_id] || 0) + (Number(a.hours_per_week || a.hoursPerWeek) || 0);
    });

    // Helper de ordenamiento de máxima prioridad respetando preferencias del usuario (VIP) y bloques dobles
    const sortTasksPriority = (tasksList: any[]) => {
      return [...tasksList].sort((a, b) => {
        const scoreA = getPriority(a);
        const scoreB = getPriority(b);
        if (scoreA !== scoreB) return scoreB - scoreA;
        if (a.isDouble !== b.isDouble) return b.isDouble ? -1 : 1;
        return Math.random() - 0.5;
      });
    };

    // Motor de intentos de llenado sobre lo preservado
    const runRepairAttempt = (tasksToPlace: any[], relaxed = false) => {
      const currentTasks = sortTasksPriority(tasksToPlace);
      const finalEntries = [...preservedEntries];

      const dailyCount: Record<string, Record<string, Record<string, number>>> = {};
      for (const cId in preservedDailyCount) {
        dailyCount[cId] = {};
        for (const day in preservedDailyCount[cId]) {
          dailyCount[cId][day] = { ...preservedDailyCount[cId][day] };
        }
      }

      const placeTask = (task: any, relaxedRules = false, superRelaxed = false) => {
        const { course, assign, isDouble } = task;
        const slots = getCourseSlots(course).filter((s) => !s.isBreak);

        const teacherPref = (state.teacherPreferences || []).find(
          (p: any) => p.teacherId === assign.teacher_id
        );
        const workingDays =
          teacherPref?.workingDays && teacherPref.workingDays.length > 0
            ? teacherPref.workingDays
            : days;
        const searchDays = [...workingDays].sort(() => Math.random() - 0.5);

        for (const day of searchDays) {
          const dayCount = dailyCount[course.id]?.[day]?.[assign.subject_id] || 0;
          if (!relaxedRules && dayCount >= 2) continue;

          const combinations: any[][] = [];
          if (isDouble) {
            for (let i = 0; i < slots.length - 1; i++) {
              const endPrev = toMins(slots[i].end);
              const startNext = toMins(slots[i + 1].start);
              if (startNext === endPrev) {
                combinations.push([slots[i], slots[i + 1]]);
              }
            }
          } else {
            for (let i = 0; i < slots.length; i++) combinations.push([slots[i]]);
          }
          combinations.sort(() => Math.random() - 0.5);

          for (const toUse of combinations) {
            const existingSameSubject = finalEntries.filter(
              (e) => e.course_id === course.id && e.subject_id === assign.subject_id && e.day === day
            );
            if (existingSameSubject.length > 0) {
              const subObj = state.subjects?.find((s: any) => s.id === assign.subject_id);
              const sName = subObj?.name?.toLowerCase() || '';
              const distType = subObj?.distributionType || subObj?.distribution_type;
              const isTogetherSubject =
                distType === 'together' ||
                sName.includes('deporte') ||
                sName.includes('educación física') ||
                sName.includes('educacion fisica');

              if (!superRelaxed && isTogetherSubject) {
                const isAdjacent = toUse.some((slot) => {
                  const pStart = toMins(slot.start);
                  const pEnd = toMins(slot.end);
                  return existingSameSubject.some((exist) => {
                    const eStart = toMins(exist.start_time);
                    const eEnd = toMins(exist.end_time);
                    return pStart === eEnd || pEnd === eStart;
                  });
                });
                if (!isAdjacent) continue;
              }
            }
            const hasConflict = toUse.some((s) => {
              const sStart = toMins(s.start);
              const sEnd = toMins(s.end);

              const levelNorm = (course.level || '').toLowerCase();
              const official = (state.levelSchedules || []).find(
                (ls: any) =>
                  (ls.level || '').toLowerCase().startsWith(levelNorm.substring(0, 5)) &&
                  ls.shift === shift
              );

              const config = teacherPref?.dailyConfig?.[day] || {};
              const rawStartStr =
                shift === 'Matutina'
                  ? config.mStart || teacherPref?.morningStart || official?.start_time || '08:00'
                  : config.aStart || teacherPref?.afternoonStart || official?.start_time || '14:00';
              const rawEndStr =
                shift === 'Matutina'
                  ? config.mEnd || teacherPref?.morningEnd || official?.end_time || '12:00'
                  : config.aEnd || teacherPref?.afternoonEnd || official?.end_time || '18:15';
              const tStart = toMins(
                rawStartStr.length >= 3 ? rawStartStr : shift === 'Matutina' ? '08:00' : '14:00'
              );
              const tEnd = toMins(
                rawEndStr.length >= 3 ? rawEndStr : shift === 'Matutina' ? '12:00' : '18:15'
              );

              if (!superRelaxed) {
                if (sStart < tStart - 5 || sEnd > tEnd + 5) return true;
              }

              return (
                finalEntries.some((e) => {
                    if (e.day !== day) return false;
                    const eStart = toMins(e.start_time);
                    const eEnd = toMins(e.end_time);
                    return (
                      sStart < eEnd &&
                      sEnd > eStart &&
                      (e.teacher_id === assign.teacher_id || e.course_id === course.id)
                    );
                  }) ||
                  isFixedEventConflict(sStart, sEnd, day, course) ||
                  (!superRelaxed &&
                    state.avoidDeporteDuringAnyBreak &&
                    !/inic|preesc|kinder|parvul|kínder|párvulo|pre-primario|preprimario/.test(
                      ((course.level || '') + ' ' + (course.grade || '')).toLowerCase()
                    ) &&
                    (() => {
                      const sName = (
                        state.subjects?.find((sub: any) => sub.id === assign.subject_id)?.name || ''
                      ).toLowerCase();
                      if (
                        sName.includes('deporte') ||
                        sName.includes('educación física') ||
                        sName.includes('educacion fisica')
                      ) {
                        return (breakPreferences || []).some((bp: any) => {
                          let bpStart = toMins(bp.startTime);
                          if (shift === 'Vespertina' && bpStart < 420) bpStart += 720;
                          const bpEnd = bpStart + (Number(bp.durationMinutes) || 15);
                          return sStart < bpEnd && sEnd > bpStart;
                        });
                      }
                      return false;
                    })())
                );
              });

            if (!hasConflict) {
              toUse.forEach((s) => {
                finalEntries.push({
                  center_id: centerId,
                  course_id: course.id,
                  subject_id: assign.subject_id,
                  teacher_id: assign.teacher_id,
                  day,
                  shift,
                  start_time: s.start,
                  end_time: s.end,
                  school_year: schoolYear
                });
              });
              if (!dailyCount[course.id]) dailyCount[course.id] = {};
              if (!dailyCount[course.id][day]) dailyCount[course.id][day] = {};
              dailyCount[course.id][day][assign.subject_id] = dayCount + toUse.length;
              return true;
            }
          }
        }
        return false;
      };

      let relaxedCount = 0;
      let superRelaxedCount = 0;
      const pending1: any[] = [];
      for (const t of currentTasks) {
        if (!placeTask(t, false, false)) pending1.push(t);
      }
      const pending2: any[] = [];
      for (const t of pending1) {
        if (placeTask(t, true, false)) {
          relaxedCount++;
        } else {
          pending2.push(t);
        }
      }
      const pending3: any[] = [];
      for (const t of pending2) {
        if (placeTask(t, true, true)) {
          relaxedCount++;
          superRelaxedCount++;
        } else {
          pending3.push(t);
        }
      }
      return { entries: finalEntries, pendingTasks: pending3, relaxedCount, superRelaxedCount };
    };

    let bestResult = {
      entries: [...preservedEntries],
      pendingTasks: remainingTasksStrategy1,
      relaxedCount: Infinity,
      superRelaxedCount: Infinity
    };
    let bestScore = Infinity;

    for (let i = 0; i < 2000; i++) {
      const res = runRepairAttempt(remainingTasksStrategy1);
      const score =
        res.pendingTasks.length * 100000 + res.superRelaxedCount * 1000 + res.relaxedCount * 1;
      if (score === 0) {
        bestResult = res;
        break;
      }
      if (score < bestScore) {
        bestScore = score;
        bestResult = res;
      }
    }

    if (bestResult.pendingTasks.length > 0) {
      const remainingTasksStrategy2: any[] = [];
      remainingTasksStrategy1.forEach((t) => {
        const subObj = state.subjects?.find((s: any) => s.id === t.assign.subject_id);
        const sName = subObj?.name?.toLowerCase() || '';
        const distType = subObj?.distributionType || subObj?.distribution_type;
        const mustStayTogether =
          distType === 'together' ||
          sName.includes('educación física') ||
          sName.includes('educacion fisica') ||
          sName.includes('deporte');
        if (t.isDouble && !mustStayTogether) {
          remainingTasksStrategy2.push({ ...t, isDouble: false });
          remainingTasksStrategy2.push({ ...t, isDouble: false });
        } else {
          remainingTasksStrategy2.push(t);
        }
      });

      let bestFallbackResult = {
        entries: [...preservedEntries],
        pendingTasks: remainingTasksStrategy2,
        relaxedCount: Infinity,
        superRelaxedCount: Infinity
      };
      let bestFallbackScore = Infinity;

      for (let i = 0; i < 2000; i++) {
        const res = runRepairAttempt(remainingTasksStrategy2);
        const score =
          res.pendingTasks.length * 100000 + res.superRelaxedCount * 1000 + res.relaxedCount * 1;
        if (score === 0) {
          bestFallbackResult = res;
          break;
        }
        if (score < bestFallbackScore) {
          bestFallbackScore = score;
          bestFallbackResult = res;
        }
      }

      const getPendingHours = (res: any) =>
        res.pendingTasks.reduce((acc: number, t: any) => acc + (t.isDouble ? 2 : 1), 0);
      const getScoreVal = (res: any) =>
        getPendingHours(res) * 100000 +
        (res.superRelaxedCount || 0) * 1000 +
        (res.relaxedCount || 0) * 1;

      if (getScoreVal(bestFallbackResult) < getScoreVal(bestResult)) {
        bestResult = bestFallbackResult;
      }
    }

    if (bestResult.pendingTasks.length > 0) {
      const originalSlotPref: Record<string, { day: string; start: string }> = {};
      (currentSchedule || []).forEach((e) => {
        const key = `${e.course_id}|${e.subject_id}|${e.teacher_id}`;
        originalSlotPref[key] = { day: e.day, start: e.start_time };
      });

      const allTasksFlexible: any[] = [];
      filteredAssignments.forEach((a) => {
        const course = courses.find((c) => c.id === (a.course_id || a.courseId));
        if (!course) return;
        let remaining = Number(a.hours_per_week || a.hoursPerWeek) || 0;
        const subObj = state.subjects?.find((s: any) => s.id === a.subject_id);
        const sName = subObj?.name?.toLowerCase() || '';
        const distType = subObj?.distributionType || subObj?.distribution_type;
        const requiresDouble =
          distType === 'together' ||
          sName.includes('educación física') ||
          sName.includes('educacion fisica') ||
          sName.includes('deporte') ||
          sName.includes('matemática') ||
          sName.includes('matematica') ||
          sName.includes('lengua') ||
          sName.includes('español') ||
          sName.includes('espanol') ||
          sName.includes('ciencias') ||
          sName.includes('física') ||
          sName.includes('fisica') ||
          sName.includes('artística') ||
          sName.includes('artistica');
        while (remaining > 0) {
          if (remaining >= 2 && requiresDouble) {
            allTasksFlexible.push({ course, assign: a, isDouble: true });
            remaining -= 2;
          } else {
            allTasksFlexible.push({ course, assign: a, isDouble: false });
            remaining -= 1;
          }
        }
      });

      const runFlexibleAttemptCustom = (taskListFlexible: any[]) => {
        const currentTasks = sortTasksPriority(taskListFlexible);
        const finalEntries: any[] = [];
        const dailyCount: Record<string, Record<string, Record<string, number>>> = {};

        const placeTask = (task: any, relaxedRules = false, superRelaxed = false) => {
          const { course, assign, isDouble } = task;
          const slots = getCourseSlots(course).filter((s) => !s.isBreak);
          const pref = originalSlotPref[`${course.id}|${assign.subject_id}|${assign.teacher_id}`];

          const teacherPref = (state.teacherPreferences || []).find(
            (p: any) => p.teacherId === assign.teacher_id
          );
          const workingDays =
            teacherPref?.workingDays && teacherPref.workingDays.length > 0
              ? teacherPref.workingDays
              : days;

          const validPrefDay = pref && workingDays.includes(pref.day) ? pref.day : null;
          const searchDays = validPrefDay
            ? [
                validPrefDay,
                ...workingDays.filter((d) => d !== validPrefDay).sort(() => Math.random() - 0.5)
              ]
            : [...workingDays].sort(() => Math.random() - 0.5);

          for (const day of searchDays) {
            const dayCount = dailyCount[course.id]?.[day]?.[assign.subject_id] || 0;
            if (!relaxedRules && dayCount >= 2) continue;

            const combinations: any[][] = [];
            if (isDouble) {
              for (let i = 0; i < slots.length - 1; i++) {
                const endPrev = toMins(slots[i].end);
                const startNext = toMins(slots[i + 1].start);
                if (startNext === endPrev) {
                  combinations.push([slots[i], slots[i + 1]]);
                }
              }
            } else {
              for (let i = 0; i < slots.length; i++) combinations.push([slots[i]]);
            }

            combinations.sort((a, b) => {
              const aHasPref = pref && day === pref.day && a.some((s) => s.start === pref.start);
              const bHasPref = pref && day === pref.day && b.some((s) => s.start === pref.start);
              if (aHasPref && !bHasPref) return -1;
              if (!aHasPref && bHasPref) return 1;
              return Math.random() - 0.5;
            });

            for (const toUse of combinations) {
              const existingSameSubject = finalEntries.filter(
                (e) => e.course_id === course.id && e.subject_id === assign.subject_id && e.day === day
              );
              if (existingSameSubject.length > 0) {
                const subObj = state.subjects?.find((s: any) => s.id === assign.subject_id);
                const sName = subObj?.name?.toLowerCase() || '';
                const distType = subObj?.distributionType || subObj?.distribution_type;
                const isTogetherSubject =
                  distType === 'together' ||
                  sName.includes('deporte') ||
                  sName.includes('educación física') ||
                  sName.includes('educacion fisica');

                if (!superRelaxed && isTogetherSubject) {
                  const isAdjacent = toUse.some((slot) => {
                    const pStart = toMins(slot.start);
                    const pEnd = toMins(slot.end);
                    return existingSameSubject.some((exist) => {
                      const eStart = toMins(exist.start_time);
                      const eEnd = toMins(exist.end_time);
                      return pStart === eEnd || pEnd === eStart;
                    });
                  });
                  if (!isAdjacent) continue;
                }
              }
              const hasConflict = toUse.some((s) => {
                const sStart = toMins(s.start);
                const sEnd = toMins(s.end);

                if (!superRelaxed && teacherPref) {
                  const levelNorm = (course.level || '').toLowerCase();
                  const official = (state.levelSchedules || []).find(
                    (ls: any) =>
                      (ls.level || '').toLowerCase().startsWith(levelNorm.substring(0, 5)) &&
                      ls.shift === shift
                  );
                  const config = teacherPref.dailyConfig?.[day] || {};
                  const rawStartStr =
                    shift === 'Matutina'
                      ? config.mStart || teacherPref.morningStart || official?.start_time || '08:00'
                      : config.aStart ||
                        teacherPref.afternoonStart ||
                        official?.start_time ||
                        '14:00';
                  const rawEndStr =
                    shift === 'Matutina'
                      ? config.mEnd || teacherPref.morningEnd || official?.end_time || '12:00'
                      : config.aEnd || teacherPref.afternoonEnd || official?.end_time || '18:15';
                  const tStart = toMins(
                    rawStartStr.length >= 3 ? rawStartStr : shift === 'Matutina' ? '08:00' : '14:00'
                  );
                  const tEnd = toMins(
                    rawEndStr.length >= 3 ? rawEndStr : shift === 'Matutina' ? '12:00' : '18:15'
                  );
                  if (sStart < tStart - 5 || sEnd > tEnd + 5) return true;
                }

                return (
                  finalEntries.some((e) => {
                      if (e.day !== day) return false;
                      const eStart = toMins(e.start_time);
                      const eEnd = toMins(e.end_time);
                      return (
                        sStart < eEnd &&
                        sEnd > eStart &&
                        (e.teacher_id === assign.teacher_id || e.course_id === course.id)
                      );
                    }) ||
                    isFixedEventConflict(sStart, sEnd, day, course) ||
                    (!superRelaxed &&
                      state.avoidDeporteDuringAnyBreak &&
                      !/inic|preesc|kinder|parvul|kínder|párvulo|pre-primario|preprimario/.test(
                        ((course.level || '') + ' ' + (course.grade || '')).toLowerCase()
                      ) &&
                      (() => {
                        const sName = (
                          state.subjects?.find((sub: any) => sub.id === assign.subject_id)?.name || ''
                        ).toLowerCase();
                        if (
                          sName.includes('deporte') ||
                          sName.includes('educación física') ||
                          sName.includes('educacion fisica')
                        ) {
                          return (breakPreferences || []).some((bp: any) => {
                            let bpStart = toMins(bp.startTime);
                            if (shift === 'Vespertina' && bpStart < 420) bpStart += 720;
                            const bpEnd = bpStart + (Number(bp.durationMinutes) || 15);
                            return sStart < bpEnd && sEnd > bpStart;
                          });
                        }
                        return false;
                      })())
                  );
                });

              if (!hasConflict) {
                toUse.forEach((s) => {
                  finalEntries.push({
                    center_id: centerId,
                    course_id: course.id,
                    subject_id: assign.subject_id,
                    teacher_id: assign.teacher_id,
                    day,
                    shift,
                    start_time: s.start,
                    end_time: s.end,
                    school_year: schoolYear
                  });
                });
                if (!dailyCount[course.id]) dailyCount[course.id] = {};
                if (!dailyCount[course.id][day]) dailyCount[course.id][day] = {};
                dailyCount[course.id][day][assign.subject_id] = dayCount + toUse.length;
                return true;
              }
            }
          }
          return false;
        };

        let relaxedCount = 0;
        let superRelaxedCount = 0;
        const pending1: any[] = [];
        for (const t of currentTasks) {
          if (!placeTask(t, false, false)) pending1.push(t);
        }
        const pending2: any[] = [];
        for (const t of pending1) {
          if (placeTask(t, true, false)) {
            relaxedCount++;
          } else {
            pending2.push(t);
          }
        }
        const pending3: any[] = [];
        for (const t of pending2) {
          if (placeTask(t, true, true)) {
            relaxedCount++;
            superRelaxedCount++;
          } else {
            pending3.push(t);
          }
        }
        const pending4: any[] = [];
        for (const t of pending3) {
          if (t.isDouble) {
            const tSingle1 = { ...t, isDouble: false };
            const tSingle2 = { ...t, isDouble: false };
            const p1 = placeTask(tSingle1, true, true);
            const p2 = placeTask(tSingle2, true, true);
            if (p1 && p2) {
              relaxedCount += 2;
              superRelaxedCount += 2;
            } else if (p1) {
              relaxedCount++;
              superRelaxedCount++;
              pending4.push(tSingle2);
            } else if (p2) {
              relaxedCount++;
              superRelaxedCount++;
              pending4.push(tSingle1);
            } else {
              pending4.push(t);
            }
          } else {
            pending4.push(t);
          }
        }
        return { entries: finalEntries, pendingTasks: pending4, relaxedCount, superRelaxedCount };
      };

      let bestFlexibleResult = {
        entries: [],
        pendingTasks: allTasksFlexible,
        relaxedCount: Infinity,
        superRelaxedCount: Infinity
      };
      let bestFlexibleScore = Infinity;

      for (let i = 0; i < 2000; i++) {
        const res = runFlexibleAttemptCustom(allTasksFlexible);
        const score =
          res.pendingTasks.length * 100000 + res.superRelaxedCount * 1000 + res.relaxedCount * 1;
        if (score === 0) {
          bestFlexibleResult = res;
          break;
        }
        if (score < bestFlexibleScore) {
          bestFlexibleScore = score;
          bestFlexibleResult = res;
        }
      }

      if (bestFlexibleResult.pendingTasks.length > 0) {
        const allTasksFlexibleSplit: any[] = [];
        allTasksFlexible.forEach((t) => {
          const subObj = state.subjects?.find((s: any) => s.id === t.assign.subject_id);
          const sName = subObj?.name?.toLowerCase() || '';
          const distType = subObj?.distributionType || subObj?.distribution_type;
          const mustStayTogether =
            distType === 'together' ||
            sName.includes('educación física') ||
            sName.includes('educacion fisica') ||
            sName.includes('deporte');
          if (t.isDouble && !mustStayTogether) {
            allTasksFlexibleSplit.push({ ...t, isDouble: false });
            allTasksFlexibleSplit.push({ ...t, isDouble: false });
          } else {
            allTasksFlexibleSplit.push(t);
          }
        });

        let bestFlexibleSplitResult = {
          entries: [],
          pendingTasks: allTasksFlexibleSplit,
          relaxedCount: Infinity,
          superRelaxedCount: Infinity
        };
        let bestFlexibleSplitScore = Infinity;

        for (let i = 0; i < 2000; i++) {
          const res = runFlexibleAttemptCustom(allTasksFlexibleSplit);
          const score =
            res.pendingTasks.length * 100000 + res.superRelaxedCount * 1000 + res.relaxedCount * 1;
          if (score === 0) {
            bestFlexibleSplitResult = res;
            break;
          }
          if (score < bestFlexibleSplitScore) {
            bestFlexibleSplitScore = score;
            bestFlexibleSplitResult = res;
          }
        }

        const getPendingHoursFlex = (res: any) =>
          res.pendingTasks.reduce((acc: number, t: any) => acc + (t.isDouble ? 2 : 1), 0);
        const getScoreValFlex = (res: any) =>
          getPendingHoursFlex(res) * 100000 +
          (res.superRelaxedCount || 0) * 1000 +
          (res.relaxedCount || 0) * 1;

        if (getScoreValFlex(bestFlexibleSplitResult) < getScoreValFlex(bestFlexibleResult)) {
          bestFlexibleResult = bestFlexibleSplitResult;
        }
      }

      const getPendingHoursFlex = (res: any) =>
        res.pendingTasks.reduce((acc: number, t: any) => acc + (t.isDouble ? 2 : 1), 0);
      const getPendingHoursStrict = (res: any) =>
        res.pendingTasks.reduce((acc: number, t: any) => acc + (t.isDouble ? 2 : 1), 0);

      const getScoreValFlex = (res: any) =>
        getPendingHoursFlex(res) * 100000 +
        (res.superRelaxedCount || 0) * 1000 +
        (res.relaxedCount || 0) * 1;
      const getScoreValStrict = (res: any) =>
        getPendingHoursStrict(res) * 100000 +
        (res.superRelaxedCount || 0) * 1000 +
        (res.relaxedCount || 0) * 1;

      if (getScoreValFlex(bestFlexibleResult) < getScoreValStrict(bestResult)) {
        bestResult = bestFlexibleResult;
      }
    }

    if (bestResult.entries.length > 0) {
      const entries = bestResult.entries;

      // Asegurar existencia de docentes en la tabla legacy 'teachers' para evitar violación de claves foráneas
      const uniqueTeacherIds = Array.from(new Set(entries.map((e) => e.teacher_id)));
      const teachersToUpsert = uniqueTeacherIds.map((tId) => {
        const tName = state.teachers?.find((t: any) => t.id === tId)?.name || 'Docente';
        return {
          id: tId,
          center_id: centerId,
          name: tName,
          hours_available: 40
        };
      });

      if (teachersToUpsert.length > 0) {
        const { error: upsertError } = await supabase
          .from('teachers')
          .upsert(teachersToUpsert, { onConflict: 'id' });
        if (upsertError) {
          console.error('Error al asegurar docentes en tabla teachers:', upsertError);
        }
      }

      const { error: delError } = await supabase
        .from('schedule_entries')
        .delete()
        .eq('center_id', centerId)
        .eq('shift', shift)
        .eq('school_year', schoolYear);
      if (delError) throw new Error('Error al limpiar para reparar: ' + delError.message);

      const chunkSize = 500;
      for (let i = 0; i < entries.length; i += chunkSize) {
        const chunk = entries.slice(i, i + chunkSize).map((e: any) => {
          const { id, created_at, ...rest } = e;
          return rest;
        });
        const { error: insError } = await supabase.from('schedule_entries').insert(chunk);
        if (insError) throw new Error('Error al guardar reparación: ' + insError.message);
      }
    }

    const finalAudit: string[] = [];
    courses.forEach((c) => {
      const required = assignments
        .filter((a) => a.course_id === c.id || a.courseId === c.id)
        .reduce((acc, a) => acc + (Number(a.hours_per_week) || 0), 0);
      const placed = bestResult.entries.filter((e) => e.course_id === c.id).length;
      if (placed < required) {
        finalAudit.push(`❌ ${c.grade}: ${placed}/${required}h.`);
      }
    });

    if (finalAudit.length === 0) {
      finalAudit.push(
        `✅ Reparación Exitosa al 100%. Se han guardado ${bestResult.entries.length} periodos preservando posiciones.`
      );
    } else {
      finalAudit.unshift(
        `⚠️ Reparación Parcial: Quedaron horas sin ubicar por choques de docentes o falta de disponibilidad.`
      );
    }

    return { entries: bestResult.entries, diagnostics: finalAudit };
  }
};
