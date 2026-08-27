import { supabase } from '../lib/supabase';

const findOfficialSchedule = (schedules: any[], levelName: string, shiftName: string) => {
  if (!schedules || schedules.length === 0) return null;
  const lNorm = (levelName || '').toLowerCase().substring(0, 3);
  const sNorm = (shiftName || '').toLowerCase().substring(0, 3);

  // 1. Coincidencia exacta de Nivel y Tanda
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

  // 2. Si no hay match exacto de nivel, buscar cualquier horario de la MISMA tanda
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

  // NUNCA mezclar tandas (si es Vespertina, no devolver un horario de Matutina y viceversa)
  return match || null;
};

const isCourseInicial = (course: any) => {
  const cGrade = (course?.grade || '').toLowerCase();
  const cLevel = (course?.level || '').toLowerCase();
  return (
    cLevel.includes('inic') ||
    cLevel.includes('preesc') ||
    cLevel.includes('kinder') ||
    cLevel.includes('parvul') ||
    cGrade.includes('inic') ||
    cGrade.includes('kínder') ||
    cGrade.includes('kinder') ||
    cGrade.includes('párvulo') ||
    cGrade.includes('parvulo') ||
    cGrade.includes('pre-primario') ||
    cGrade.includes('preprimario') ||
    cGrade.includes('maternal')
  );
};

const isCourseSecundaria = (course: any) => {
  if (isCourseInicial(course)) return false;
  const cGrade = (course?.grade || '').toLowerCase();
  const cLevel = (course?.level || '').toLowerCase();
  return (
    cLevel.includes('secun') ||
    cGrade.includes('secun') ||
    cGrade.includes('bachill') ||
    cGrade.includes('media')
  );
};

const isCoursePrimaria = (course: any) => {
  if (isCourseInicial(course) || isCourseSecundaria(course)) return false;
  return true;
};

const isDeporteSubject = (sName: string) => {
  const n = (sName || '').toLowerCase().trim();
  return (
    n.includes('deporte') ||
    n.includes('educación física') ||
    n.includes('educacion fisica') ||
    n.includes('ed. física') ||
    n.includes('ed. fisica') ||
    n.includes('ed física') ||
    n.includes('ed fisica')
  );
};

const isFirstCycleCourse = (course: any) => {
  const cGrade = (course?.grade || '').toLowerCase();
  const cCycle = (course?.cycle || '').toLowerCase();
  if (cCycle.includes('primer') || cCycle.includes('1er') || cCycle.includes('1')) return true;
  if (cCycle.includes('segundo') || cCycle.includes('2do') || cCycle.includes('2')) return false;

  if (
    cGrade.includes('segundo ciclo') ||
    cGrade.includes('2do ciclo') ||
    cGrade.includes('2do. ciclo') ||
    cGrade.includes('2do.ciclo')
  ) {
    return false;
  }
  if (
    cGrade.includes('primer ciclo') ||
    cGrade.includes('1er ciclo') ||
    cGrade.includes('1er. ciclo') ||
    cGrade.includes('1er.ciclo')
  ) {
    return true;
  }

  return (
    /^[1-3]/.test(cGrade) ||
    cGrade.includes('1ro') ||
    cGrade.includes('2do') ||
    cGrade.includes('3ro') ||
    cGrade.includes('1°') ||
    cGrade.includes('2°') ||
    cGrade.includes('3°') ||
    cGrade.includes('primero') ||
    (cGrade.includes('segundo') && !cGrade.includes('ciclo')) ||
    cGrade.includes('tercero') ||
    cGrade.includes('primer') ||
    cGrade.includes('tercer') ||
    cGrade.includes('7mo') ||
    cGrade.includes('8vo') ||
    cGrade.includes('9no') ||
    cGrade.includes('septimo') ||
    cGrade.includes('séptimo') ||
    cGrade.includes('octavo') ||
    cGrade.includes('noveno')
  );
};

const isSecondCycleCourse = (course: any) => {
  const cGrade = (course?.grade || '').toLowerCase();
  const cCycle = (course?.cycle || '').toLowerCase();
  if (cCycle.includes('segundo') || cCycle.includes('2do') || cCycle.includes('2')) return true;
  if (cCycle.includes('primer') || cCycle.includes('1er') || cCycle.includes('1')) return false;

  if (
    cGrade.includes('segundo ciclo') ||
    cGrade.includes('2do ciclo') ||
    cGrade.includes('2do. ciclo') ||
    cGrade.includes('2do.ciclo')
  ) {
    return true;
  }
  if (
    cGrade.includes('primer ciclo') ||
    cGrade.includes('1er ciclo') ||
    cGrade.includes('1er. ciclo') ||
    cGrade.includes('1er.ciclo')
  ) {
    return false;
  }

  return (
    /^[4-6]/.test(cGrade) ||
    cGrade.includes('4to') ||
    cGrade.includes('5to') ||
    cGrade.includes('6to') ||
    cGrade.includes('4°') ||
    cGrade.includes('5°') ||
    cGrade.includes('6°') ||
    cGrade.includes('cuarto') ||
    cGrade.includes('quinto') ||
    cGrade.includes('sexto') ||
    cGrade.includes('10mo') ||
    cGrade.includes('11mo') ||
    cGrade.includes('12mo') ||
    cGrade.includes('decimo') ||
    cGrade.includes('décimo')
  );
};

const doesOverlapCourseBreak = (
  sStart: number,
  sEnd: number,
  course: any,
  breakPreferences: any[],
  shift: string,
  toMins: (t: string) => number
) => {
  const isInicial = isCourseInicial(course);
  const isSec = isCourseSecundaria(course);
  const isPri = isCoursePrimaria(course);
  const isCFirstCycle = isFirstCycleCourse(course);
  const isCSecondCycle = isSecondCycleCourse(course);

  return (breakPreferences || []).some((bp: any) => {
    let bpMins = toMins(bp.startTime);
    if (shift === 'Vespertina' && bpMins < 420) bpMins += 720;
    const isBpMorning = bpMins < 780;
    if ((shift === 'Matutina') !== isBpMorning) return false;

    const bpLevel = (bp.level || '').toLowerCase();
    const bpCycle = (bp.cycle || '').toLowerCase();

    // Si el curso es de Nivel Inicial:
    if (isInicial) {
      const matchIni =
        bpLevel.includes('ini') ||
        bpLevel.includes('pre') ||
        bpLevel.includes('parv') ||
        bpLevel.includes('kínder') ||
        bpLevel.includes('kinder') ||
        bpCycle.includes('ini');
      if (!matchIni && bpLevel && !bpLevel.includes('gen') && !bpLevel.includes('todo')) {
        return false;
      }
    } else {
      // Si el curso NO es inicial pero el recreo es exclusivo de Inicial, ignorarlo
      const isBpInicial =
        bpLevel.includes('ini') ||
        bpLevel.includes('pre') ||
        bpLevel.includes('parv') ||
        bpLevel.includes('kínder') ||
        bpLevel.includes('kinder') ||
        bpCycle.includes('ini');
      if (isBpInicial) return false;

      // Verificar nivel
      if (bpLevel && !bpLevel.includes('gen') && !bpLevel.includes('todo')) {
        if (isPri && !bpLevel.includes('prim')) return false;
        if (isSec && !bpLevel.includes('sec')) return false;
      }

      // Verificar ciclo
      if (bpCycle && !bpCycle.includes('gen') && !bpCycle.includes('todo')) {
        if (isCFirstCycle && (bpCycle.includes('segundo') || bpCycle.includes('2do') || bpCycle.includes('2')))
          return false;
        if (isCSecondCycle && (bpCycle.includes('primer') || bpCycle.includes('1er') || bpCycle.includes('1')))
          return false;
      }
    }

    const bpStart = bpMins;
    const bpEnd = bpStart + (Number(bp.durationMinutes) || 15);
    return sStart < bpEnd && sEnd > bpStart;
  });
};

const doesOverlapSportsBreak = (
  sStart: number,
  sEnd: number,
  course: any,
  breakPreferences: any[],
  shift: string,
  toMins: (t: string) => number
) => {
  // Nivel Inicial tiene patio propio e independiente:
  // Solo respeta su propio recreo de Inicial y no interfiere con Primaria/Secundaria
  if (isCourseInicial(course)) {
    return doesOverlapCourseBreak(sStart, sEnd, course, breakPreferences, shift, toMins);
  }

  // Para Primaria y Secundaria (Patio Compartido):
  // Se prohíbe Deporte / Educación Física durante el recreo de CUALQUIER ciclo de Primaria (1er o 2do) o Secundaria.
  // Los recreos de Nivel Inicial se omiten expresamente porque Inicial tiene otro patio.
  return (breakPreferences || []).some((bp: any) => {
    let bpMins = toMins(bp.startTime);
    if (shift === 'Vespertina' && bpMins < 420) bpMins += 720;
    const isBpMorning = bpMins < 780;
    if ((shift === 'Matutina') !== isBpMorning) return false;

    const bpLevel = (bp.level || '').toLowerCase();
    const bpCycle = (bp.cycle || '').toLowerCase();

    const isBpInicial =
      bpLevel.includes('ini') ||
      bpLevel.includes('pre') ||
      bpLevel.includes('parv') ||
      bpLevel.includes('kínder') ||
      bpLevel.includes('kinder') ||
      bpCycle.includes('ini');

    // Nivel Inicial NO bloquea el patio de Primaria/Secundaria
    if (isBpInicial) return false;

    // Cualquier recreo de Primaria, Secundaria o General bloquea el patio
    const bpStart = bpMins;
    const bpEnd = bpStart + (Number(bp.durationMinutes) || 15);
    return sStart < bpEnd && sEnd > bpStart;
  });
};

export const computeTaskPriority = (task: any, state: any, teacherLoadMap: Record<string, number> = {}) => {
  let score = task.priorityBoost || 0;

  if (task.isTitularMondayFirst) {
    score += 25000000; // Prioridad VIP Suprema (25 millones): colocar la clase del Docente Titular los Lunes a 1ra hora antes de cualquier otra materia
  }

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

  const distType = taskSubject?.distributionType || taskSubject?.distribution_type;
  const isStrictTogether =
    distType === 'together' ||
    taskSubjectName.includes('deporte') ||
    taskSubjectName.includes('educación física') ||
    taskSubjectName.includes('educacion fisica');

  if (isStrictTogether) {
    score += 10000000; // Prioridad global (10 millones): ubicar PE de TODOS los cursos antes que materias regulares
  }

  if (manualPriority) {
    score += (Number(manualPriority.score) || 100) * 100;
  } else {
    if (
      taskSubjectName.includes('matemática') ||
      taskSubjectName.includes('matematica') ||
      taskSubjectName.includes('lengua') ||
      taskSubjectName.includes('español') ||
      taskSubjectName.includes('espanol') ||
      taskSubjectName.includes('ciencias') ||
      taskSubjectName.includes('naturales') ||
      taskSubjectName.includes('sociales')
    )
      score += 200;

    if (
      taskSubjectName.includes('artística') ||
      taskSubjectName.includes('artistica')
    )
      score += 150;

    if (
      taskSubjectName.includes('inglés') ||
      taskSubjectName.includes('ingles') ||
      taskSubjectName.includes('francés') ||
      taskSubjectName.includes('frances') ||
      taskSubjectName.includes('idioma')
    )
      score += 100;
  }

  score += (teacherLoadMap[task.assign?.teacher_id] || 0) * 10;

  if (task.isDouble) score += 50;
  return score;
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
      const tStr = (c.tanda || '').toLowerCase().trim();
      const lvlStr = (c.level || '').toLowerCase().trim();
      if (shiftBaseVal === 'mat') {
        if (tStr.includes('mat') || tStr.includes('mañ') || tStr.includes('ext') || tStr.includes('com')) return true;
        if (tStr === '') return true;
        return !tStr.includes('ves') && !tStr.includes('tar');
      } else {
        return (
          tStr.includes('ves') || tStr.includes('tar') || (tStr === '' && lvlStr.includes('secun'))
        );
      }
    });
    const courseIdSet = new Set(courses.map((c: any) => String(c.id)));
    const assignments = allAssignments.filter((a: any) =>
      courseIdSet.has(String(a.course_id || a.courseId))
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
      const grade = (course.grade || '').toLowerCase();

      const isFirstCycle = isFirstCycleCourse(course);
      const isSecondCycle = isSecondCycleCourse(course);

      let startT = official?.start_time ? toMins(official.start_time) : (isMorning ? 480 : 840);
      if (!isMorning && startT < 720 && startT > 0) startT += 720;
      let endT = official?.end_time ? toMins(official.end_time) : (isMorning ? 720 : 1095);
      if (!isMorning && endT < 720 && endT > 0) endT += 720;

      const applicableBPs = (breakPreferences || []).filter((bp: any) => {
        let bpMins = toMins(bp.startTime);
        if (!isMorning && bpMins < 720) bpMins += 720;
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
        const bpCyc = (bp.cycle || '').toLowerCase();
        if (isFirstCycle && (bpCyc.includes('primer') || bpCyc.includes('1er') || bpCyc.includes('1'))) return true;
        if (isSecondCycle && (bpCyc.includes('segundo') || bpCyc.includes('2do') || bpCyc.includes('2'))) return true;
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
      if (!isMorning && bStart < 720 && bStart > 0) bStart += 720;
      if (!isMorning && (bStart <= startT || bStart >= endT)) bStart = 960;
      const bEnd = bStart + (Number(bPref.durationMinutes) || 15);

      const isPrimariaOrInicial = levelNorm.includes('primar') || levelNorm.includes('ini');
      const isSecundaria = levelNorm.includes('secun');
      const targetTotal = isSecundaria ? 6 : 5; // Primaria/Inicial: 5 bloques/día. Secundaria: 6 bloques/día

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

      const calculateSlotDurations = (totalMins: number, preferredCount: number) => {
        if (totalMins <= 0 || preferredCount <= 0) return [];
        let count = preferredCount;

        // Regla estricta: Cada bloque debe durar entre 33 y 45 minutos.
        // Si el conteo preferido hace que las clases duren menos de 33 min, reducir el número de bloques.
        while (count > 1 && totalMins / count < 33) {
          count--;
        }
        // Si el conteo hace que las clases duren más de 45 min, aumentar el número de bloques.
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
      let preCount = targetTotal === 5 ? 2 : 3;
      if (preWindow / preCount < 33) {
        preCount = Math.max(1, Math.floor(preWindow / 33));
      }

      const preDurs = calculateSlotDurations(preWindow, preCount);
      preCount = preDurs.length;

      let currTimePre = classStart;
      for (let i = 0; i < preCount; i++) {
        let dur = preDurs[i];
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

      // Eventos Fijos Post-Recreo (ej. Juego/Trabajo de 09:45 a 10:00 o Almuerzo filtrados por ciclo y nivel)
      let currTimePost = bEnd;
      const postFixedEvents = (fixedEvents || []).filter((fe: any) => {
        const feName = (fe.name || '').toLowerCase();
        const isActo = feName.includes('acto') || feName.includes('bandera') || feName.includes('apertura');
        const feStartMins = toMins(fe.start_time);
        if (isActo || feStartMins < bStart - 5 || feStartMins >= endT) return false;

        const feLevel = (fe.level || '').toLowerCase();
        const feCycle = (fe.cycle || '').toLowerCase();
        const levelMatch =
          !feLevel || feLevel.includes('gen') || feLevel.substring(0, 3) === levelNorm.substring(0, 3);
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
          slots.push({
            start: fe.start_time,
            end: fe.end_time,
            isBreak: true,
            label: fe.name
          });
          currTimePost = Math.max(currTimePost, feEndMins);
        }
      });

      // CÁLCULO FLEXIBLE Y DINÁMICO DESPUÉS DEL RECREO Y EVENTOS FIJOS HASTA LA HORA DE CIERRE
      const postWindow = Math.max(0, endT - currTimePost);
      let postCount = Math.max(1, targetTotal - preCount);
      const postDurs = calculateSlotDurations(postWindow, postCount);

      for (let i = 0; i < postCount; i++) {
        let dur = postDurs[i];
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
          sName.includes('educación física') ||
          sName.includes('educacion fisica') ||
          sName.includes('deporte') ||
          sName.includes('laboratorio') ||
          sName.includes('artística') ||
          sName.includes('artistica');

        // Detectar si el docente es titular del curso y desea abrir semana los lunes
        const isTitular =
          (course.titular_teacher_id && course.titular_teacher_id === assign.teacher_id) ||
          (course.titularTeacherId && course.titularTeacherId === assign.teacher_id);
        const isTitularSubject =
          isTitular &&
          (!course.titular_subject_id || course.titular_subject_id === assign.subject_id);
        const wantsMondayFirst =
          isTitularSubject && course.titular_monday_first_hour !== false;

        let createdDouble = false;
        let titularMondayAssigned = false;
        while (remaining > 0) {
          const isTitularTask = wantsMondayFirst && !titularMondayAssigned;
          if (
            remaining >= 2 &&
            (requiresDouble || (!createdDouble && remaining >= 4 && distType !== 'separate'))
          ) {
            allTasks.push({ course, assign, isDouble: true, isTitularMondayFirst: isTitularTask });
            remaining -= 2;
            createdDouble = true;
            if (isTitularTask) titularMondayAssigned = true;
          } else {
            allTasks.push({ course, assign, isDouble: false, isTitularMondayFirst: isTitularTask });
            remaining -= 1;
            if (isTitularTask) titularMondayAssigned = true;
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

    const teacherLoad: Record<string, number> = {};
    assignments.forEach((a: any) => {
      teacherLoad[a.teacher_id] =
        (teacherLoad[a.teacher_id] || 0) + Number(a.hours_per_week || a.hoursPerWeek || 0);
    });

    const getPriority = (task: any) => computeTaskPriority(task, state, teacherLoad);

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
        let shuffledDays = [...workingDays].sort(() => Math.random() - 0.5);

        // Si es la tarea del Docente Titular para Lunes 1ra hora, evaluar Lunes prioritariamente
        if (task.isTitularMondayFirst && workingDays.includes('Lunes')) {
          shuffledDays = ['Lunes', ...shuffledDays.filter((d) => d !== 'Lunes')];
        }

        for (const day of shuffledDays) {
          const daySubjectCount = dailyCount[course.id]?.[day]?.[assign.subject_id] || 0;

          if (!relaxedRules && daySubjectCount >= 2 && !isDouble) continue;
          if (!relaxedRules && daySubjectCount > 0 && isDouble) continue;

          const subObj = state.subjects?.find((s: any) => s.id === assign.subject_id);
          const sName = subObj?.name?.toLowerCase() || '';
          const distType = subObj?.distributionType || subObj?.distribution_type;
          const isDeporte = isDeporteSubject(sName);
          const isTogetherSubject = distType === 'together' || isDeporte;

          let slotCombinations: any[][] = [];
          if (isDouble) {
            const strictPairs: any[][] = [];
            const recessPairs: any[][] = [];
            for (let i = 0; i < classSlots.length - 1; i++) {
              const endPrev = toMins(classSlots[i].end);
              const startNext = toMins(classSlots[i + 1].start);
              const gap = startNext - endPrev;
              if (gap === 0) {
                strictPairs.push([classSlots[i], classSlots[i + 1]]);
              } else if (gap > 0 && gap <= 35) {
                recessPairs.push([classSlots[i], classSlots[i + 1]]);
              }
            }
            strictPairs.sort(() => Math.random() - 0.5);
            recessPairs.sort(() => Math.random() - 0.5);
            // Únicamente Deporte / Educación Física tiene prohibido partirse por el recreo
            if (isDeporte) {
              slotCombinations = [...strictPairs];
            } else {
              slotCombinations = [...strictPairs, ...recessPairs];
            }
          } else {
            for (let i = 0; i < classSlots.length; i++) {
              slotCombinations.push([classSlots[i]]);
            }
            slotCombinations.sort(() => Math.random() - 0.5);
          }

          // Priorizar la primera hora lectiva disponible de los lunes para el docente titular
          if (task.isTitularMondayFirst && day === 'Lunes') {
            if (isDouble && slotCombinations.length > 0 && classSlots.length > 0) {
              const firstPair = slotCombinations.find(
                (pair) => pair[0]?.start === classSlots[0]?.start
              );
              if (firstPair) {
                slotCombinations = [firstPair, ...slotCombinations.filter((p) => p !== firstPair)];
              }
            } else if (!isDouble && slotCombinations.length > 0 && classSlots.length > 0) {
              const firstSingle = slotCombinations.find(
                (s) => s[0]?.start === classSlots[0]?.start
              );
              if (firstSingle) {
                slotCombinations = [
                  firstSingle,
                  ...slotCombinations.filter((s) => s !== firstSingle)
                ];
              }
            }
          }

          for (const slotsToUse of slotCombinations) {
            // REGLA ESTRICTA Y ABSOLUTA: JAMÁS PERMITIR MÁS DE 2 HORAS DE LA MISMA MATERIA EL MISMO DÍA
            if (daySubjectCount + slotsToUse.length > 2) continue;

            const existingSameSubject = finalEntries.filter(
              (e) => e.course_id === course.id && e.subject_id === assign.subject_id && e.day === day
            );
            if (existingSameSubject.length > 0) {
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
                const isOfficialDefault = tEnd >= 1080;
                const marginEnd = (shift === 'Vespertina' && isOfficialDefault) ? 20 : 5;
                if (sStart < tStart - 5 || sEnd > tEnd + marginEnd) return true;
              }

              const isBusy = finalEntries.some((e) => {
                if (e.day !== day) return false;

                const eStart = toMins(e.start_time);
                const eEnd = toMins(e.end_time);
                const overlapMins = Math.min(sEnd, eEnd) - Math.max(sStart, eStart);
                if (overlapMins <= 0) return false;

                // Un curso no puede tener dos materias a la vez
                if (e.course_id === course.id) return true;

                // Un profesor no puede estar en dos cursos a la vez (tolerancia de 10 min por recreos escalonados entre ciclos)
                if (e.teacher_id === assign.teacher_id && overlapMins > 10) return true;

                return false;
              });
              if (isBusy) return true;

              // NINGUNA materia debe colocarse sobre la hora del recreo del propio curso
              const overlapsBreak = doesOverlapCourseBreak(
                sStart,
                sEnd,
                course,
                breakPreferences,
                shift,
                toMins
              );
              if (overlapsBreak) return true;

              // REGLA DE PATIO: Exclusivamente para Educación Física / Deporte en Primaria o Secundaria
              if (isDeporte) {
                const overlapsPatio = doesOverlapSportsBreak(
                  sStart,
                  sEnd,
                  course,
                  breakPreferences,
                  shift,
                  toMins
                );
                if (overlapsPatio) return true;
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
          // FALLBACK INSTANTÁNEO PARA MATERIAS COMO ARTE O BLOQUES DOBLES:
          // Si no cupo como bloque doble de 2 horas seguidas, desglosarlo en 2 horas sueltas
          const subObj = state.subjects?.find((s: any) => s.id === task.assign?.subject_id);
          const sName = subObj?.name?.toLowerCase() || '';
          const distType = subObj?.distributionType || subObj?.distribution_type;
          const isStrictTogether =
            distType === 'together' ||
            sName.includes('deporte') ||
            sName.includes('educación física') ||
            sName.includes('educacion fisica');

          if (task.isDouble && !isStrictTogether) {
            const single1 = { ...task, isDouble: false };
            const single2 = { ...task, isDouble: false };
            const p1 = placeTask(single1, true, true);
            const p2 = placeTask(single2, true, true);
            if (p1) {
              relaxedCount++;
              superRelaxedCount++;
            }
            if (p2) {
              relaxedCount++;
              superRelaxedCount++;
            }
            if (!p1 || !p2) pending3.push(task);
          } else {
            pending3.push(task);
          }
        }
      }

      const finalPending: any[] = [];
      for (const task of pending3) {
        const subObj = state.subjects?.find((s: any) => s.id === task.assign?.subject_id);
        const sName = subObj?.name?.toLowerCase() || '';
        const distType = subObj?.distributionType || subObj?.distribution_type;
        const isStrictTogether =
          distType === 'together' ||
          sName.includes('deporte') ||
          sName.includes('educación física') ||
          sName.includes('educacion fisica');

        if (task.isDouble && !isStrictTogether) {
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
          let { error: insError } = await supabase.from('schedule_entries').insert(chunk);
          if (insError && (insError.message?.includes('is_locked') || insError.code === 'PGRST204')) {
            const fallbackChunk = chunk.map(({ is_locked, ...noLock }: any) => noLock);
            const { error: retryErr } = await supabase.from('schedule_entries').insert(fallbackChunk);
            insError = retryErr;
          }
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

  repairSchedule: async (state: any, profile: any, shift: string, year: string, lockedKeys: string[] = []) => {
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
      const tStr = (c.tanda || '').toLowerCase().trim();
      const lvlStr = (c.level || '').toLowerCase().trim();
      if (shiftBase === 'mat') {
        if (tStr.includes('mat') || tStr.includes('mañ') || tStr.includes('ext') || tStr.includes('com')) return true;
        if (tStr === '') return true;
        return !tStr.includes('ves') && !tStr.includes('tar');
      } else {
        return (
          tStr.includes('ves') || tStr.includes('tar') || (tStr === '' && lvlStr.includes('secun'))
        );
      }
    });

    const courseIdSet = new Set(courses.map((c: any) => String(c.id)));
    const assignments = allAssignments.filter((a: any) =>
      courseIdSet.has(String(a.course_id || a.courseId))
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
      const grade = (course.grade || '').toLowerCase();

      const isFirstCycle = isFirstCycleCourse(course);
      const isSecondCycle = isSecondCycleCourse(course);

      let startT = official?.start_time ? toMins(official.start_time) : (isMorning ? 480 : 840);
      if (!isMorning && startT < 720 && startT > 0) startT += 720;
      let endT = official?.end_time ? toMins(official.end_time) : (isMorning ? 720 : 1095);
      if (!isMorning && endT < 720 && endT > 0) endT += 720;

      const applicableBPs = (breakPreferences || []).filter((bp: any) => {
        let bpMins = toMins(bp.startTime);
        if (!isMorning && bpMins < 720) bpMins += 720;
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
        const bpCyc = (bp.cycle || '').toLowerCase();
        if (isFirstCycle && (bpCyc.includes('primer') || bpCyc.includes('1er') || bpCyc.includes('1'))) return true;
        if (isSecondCycle && (bpCyc.includes('segundo') || bpCyc.includes('2do') || bpCyc.includes('2'))) return true;
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
      if (!isMorning && bStart < 720 && bStart > 0) bStart += 720;
      if (!isMorning && (bStart <= startT || bStart >= endT)) bStart = 960;
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

      const isPrimariaOrInicial = levelNorm.includes('primar') || levelNorm.includes('ini');
      const isSecundaria = levelNorm.includes('secun');
      const targetTotal = isSecundaria ? 6 : 5; // Primaria/Inicial: 5 bloques/día. Secundaria: 6 bloques/día

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

      const preWindow = Math.max(0, bStart - classStart);
      let preCount = targetTotal === 5 ? 2 : 3;
      if (preWindow / preCount < 33) {
        preCount = Math.max(1, Math.floor(preWindow / 33));
      }

      const preDurs = calculateSlotDurations(preWindow, preCount);
      preCount = preDurs.length;

      let currTimePre = classStart;
      for (let i = 0; i < preCount; i++) {
        let dur = preDurs[i];
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
        if (isActo || feStartMins < bStart - 5 || feStartMins >= endT) return false;

        const feLevel = (fe.level || '').toLowerCase();
        const feCycle = (fe.cycle || '').toLowerCase();
        const levelMatch =
          !feLevel || feLevel.includes('gen') || feLevel.substring(0, 3) === levelNorm.substring(0, 3);
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

      const postWindow = Math.max(0, endT - currTimePost);
      let postCount = Math.max(1, targetTotal - preCount);
      const postDurs = calculateSlotDurations(postWindow, postCount);

      for (let i = 0; i < postDurs.length; i++) {
        let dur = postDurs[i];
        let sTime = currTimePost;
        let eTime = i === postDurs.length - 1 ? endT : sTime + dur;
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
      courseIdSet.has(String(a.course_id || a.courseId))
    );

    // FASE 1: PRESERVACIÓN FIEL E INTELIGENTE (PINNING SELECTIVO)
    // No fijamos materias con Alta Prioridad VIP ni Educación Física para permitir que el motor las ubique al principio como Bloques Dobles indivisibles.
    const preservedEntries: any[] = [];
    const placedCount: Record<string, Record<string, number>> = {};
    const preservedDailyCount: Record<string, Record<string, Record<string, number>>> = {};

    (currentSchedule || []).forEach((e) => {
      const c = courses.find((course: any) => course.id === e.course_id);
      if (!c) return;

      const assign = filteredAssignments.find(
        (a) =>
          (a.course_id === e.course_id || a.courseId === e.course_id) &&
          a.subject_id === e.subject_id
      );
      if (!assign) return;

      // CANDADO DE SEGURIDAD 🔒: Si la clase fue bloqueada expresamente por el usuario, se preserva sin excepción.
      const entryKey1 = e.id;
      const entryKey2 = `${e.course_id}_${e.day}_${e.start_time}`;
      const isLockedByUser = (lockedKeys || []).includes(entryKey1) || (lockedKeys || []).includes(entryKey2);

      if (isLockedByUser) {
        preservedEntries.push(e);
        if (!placedCount[e.course_id]) placedCount[e.course_id] = {};
        placedCount[e.course_id][e.subject_id] = (placedCount[e.course_id][e.subject_id] || 0) + 1;
        if (!preservedDailyCount[e.course_id]) preservedDailyCount[e.course_id] = {};
        if (!preservedDailyCount[e.course_id][e.day]) preservedDailyCount[e.course_id][e.day] = {};
        preservedDailyCount[e.course_id][e.day][e.subject_id] =
          (preservedDailyCount[e.course_id][e.day][e.subject_id] || 0) + 1;
        return;
      }

      const subObj = state.subjects?.find((s: any) => s.id === e.subject_id);
      const sName = (subObj?.name || '').toLowerCase();
      const distType = subObj?.distributionType || subObj?.distribution_type;
      const isEdFisicaOrVIP =
        distType === 'together' ||
        sName.includes('deporte') ||
        sName.includes('educación física') ||
        sName.includes('educacion fisica') ||
        (state.priorityPreferences || []).some(
          (p: any) => p.targetId === e.subject_id || p.targetId === e.teacher_id
        );

      // Si es Educación Física o materia con Prioridad VIP, NO la fijamos en Fase 1 si no tiene candado.
      if (isEdFisicaOrVIP) return;

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

      const isTitular =
        (course.titular_teacher_id && course.titular_teacher_id === a.teacher_id) ||
        (course.titularTeacherId && course.titularTeacherId === a.teacher_id);
      const isTitularSubject =
        isTitular &&
        (!course.titular_subject_id || course.titular_subject_id === a.subject_id);
      const wantsMondayFirst =
        isTitularSubject && course.titular_monday_first_hour !== false;

      let titularMondayAssigned = false;
      while (remaining > 0) {
        const isTitularTask = wantsMondayFirst && !titularMondayAssigned;
        if (remaining >= 2 && requiresDouble) {
          remainingTasksStrategy1.push({
            course,
            assign: a,
            isDouble: true,
            isTitularMondayFirst: isTitularTask
          });
          remaining -= 2;
          if (isTitularTask) titularMondayAssigned = true;
        } else {
          remainingTasksStrategy1.push({
            course,
            assign: a,
            isDouble: false,
            isTitularMondayFirst: isTitularTask
          });
          remaining -= 1;
          if (isTitularTask) titularMondayAssigned = true;
        }
      }
    });

    // Calcular carga total de cada docente para la heurística de dificultad
    const teacherLoadMap: Record<string, number> = {};
    filteredAssignments.forEach((a) => {
      teacherLoadMap[a.teacher_id] =
        (teacherLoadMap[a.teacher_id] || 0) + (Number(a.hours_per_week || a.hoursPerWeek) || 0);
    });

    const getPriority = (task: any) => computeTaskPriority(task, state, teacherLoadMap);

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
        let searchDays = [...workingDays].sort(() => Math.random() - 0.5);

        if (task.isTitularMondayFirst && workingDays.includes('Lunes')) {
          searchDays = ['Lunes', ...searchDays.filter((d) => d !== 'Lunes')];
        }

        for (const day of searchDays) {
          const dayCount = dailyCount[course.id]?.[day]?.[assign.subject_id] || 0;
          if (!relaxedRules && dayCount >= 2) continue;

          const subObj = state.subjects?.find((s: any) => s.id === assign.subject_id);
          const sName = subObj?.name?.toLowerCase() || '';
          const distType = subObj?.distributionType || subObj?.distribution_type;
          const isDeporte = isDeporteSubject(sName);
          const isTogetherSubject = distType === 'together' || isDeporte;

          let combinations: any[][] = [];
          if (isDouble) {
            const strictPairs: any[][] = [];
            const recessPairs: any[][] = [];
            for (let i = 0; i < slots.length - 1; i++) {
              const endPrev = toMins(slots[i].end);
              const startNext = toMins(slots[i + 1].start);
              const gap = startNext - endPrev;
              if (gap === 0) {
                strictPairs.push([slots[i], slots[i + 1]]);
              } else if (gap > 0 && gap <= 35) {
                recessPairs.push([slots[i], slots[i + 1]]);
              }
            }
            strictPairs.sort(() => Math.random() - 0.5);
            recessPairs.sort(() => Math.random() - 0.5);
            // Únicamente Deporte / Educación Física tiene prohibido partirse por el recreo
            if (isDeporte) {
              combinations.push(...strictPairs);
            } else {
              combinations.push(...strictPairs, ...recessPairs);
            }
          } else {
            for (let i = 0; i < slots.length; i++) combinations.push([slots[i]]);
            combinations.sort(() => Math.random() - 0.5);
          }

          if (task.isTitularMondayFirst && day === 'Lunes') {
            if (isDouble && combinations.length > 0 && slots.length > 0) {
              const firstPair = combinations.find((pair) => pair[0]?.start === slots[0]?.start);
              if (firstPair) {
                combinations = [firstPair, ...combinations.filter((p) => p !== firstPair)];
              }
            } else if (!isDouble && combinations.length > 0 && slots.length > 0) {
              const firstSingle = combinations.find((s) => s[0]?.start === slots[0]?.start);
              if (firstSingle) {
                combinations = [firstSingle, ...combinations.filter((s) => s !== firstSingle)];
              }
            }
          }

          for (const toUse of combinations) {
            // REGLA ESTRICTA Y ABSOLUTA: JAMÁS PERMITIR 4 O MÁS HORAS DE LA MISMA MATERIA EL MISMO DÍA
            if (dayCount + toUse.length >= 4) continue;
            const existingSameSubject = finalEntries.filter(
              (e) => e.course_id === course.id && e.subject_id === assign.subject_id && e.day === day
            );
            if (existingSameSubject.length > 0) {
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
                const isOfficialDefault = tEnd >= 1080;
                const marginEnd = (shift === 'Vespertina' && isOfficialDefault) ? 20 : 5;
                if (sStart < tStart - 5 || sEnd > tEnd + marginEnd) return true;
              }

              return (
                finalEntries.some((e) => {
                    if (e.day !== day) return false;
                    const eStart = toMins(e.start_time);
                    const eEnd = toMins(e.end_time);
                    const overlapMins = Math.min(sEnd, eEnd) - Math.max(sStart, eStart);
                    if (overlapMins <= 0) return false;

                    if (e.course_id === course.id) return true;
                    if (e.teacher_id === assign.teacher_id && overlapMins > 10) return true;

                    return false;
                  }) ||
                  isFixedEventConflict(sStart, sEnd, day, course) ||
                  doesOverlapCourseBreak(sStart, sEnd, course, breakPreferences, shift, toMins) ||
                  (isDeporte && doesOverlapSportsBreak(sStart, sEnd, course, breakPreferences, shift, toMins))
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
          const subObj = state.subjects?.find((s: any) => s.id === t.assign?.subject_id);
          const sName = subObj?.name?.toLowerCase() || '';
          const distType = subObj?.distributionType || subObj?.distribution_type;
          const isStrictTogether =
            distType === 'together' ||
            sName.includes('deporte') ||
            sName.includes('educación física') ||
            sName.includes('educacion fisica');

          if (t.isDouble && !isStrictTogether) {
            const single1 = { ...t, isDouble: false };
            const single2 = { ...t, isDouble: false };
            const p1 = placeTask(single1, true, true);
            const p2 = placeTask(single2, true, true);
            if (p1) {
              relaxedCount++;
              superRelaxedCount++;
            }
            if (p2) {
              relaxedCount++;
              superRelaxedCount++;
            }
            if (!p1 || !p2) pending3.push(t);
          } else {
            pending3.push(t);
          }
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

    for (let i = 0; i < 500; i++) {
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

      for (let i = 0; i < 500; i++) {
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

        const isTitular =
          (course.titular_teacher_id && course.titular_teacher_id === a.teacher_id) ||
          (course.titularTeacherId && course.titularTeacherId === a.teacher_id);
        const isTitularSubject =
          isTitular &&
          (!course.titular_subject_id || course.titular_subject_id === a.subject_id);
        const wantsMondayFirst =
          isTitularSubject && course.titular_monday_first_hour !== false;

        let titularMondayAssigned = false;
        while (remaining > 0) {
          const isTitularTask = wantsMondayFirst && !titularMondayAssigned;
          if (remaining >= 2 && requiresDouble) {
            allTasksFlexible.push({
              course,
              assign: a,
              isDouble: true,
              isTitularMondayFirst: isTitularTask
            });
            remaining -= 2;
            if (isTitularTask) titularMondayAssigned = true;
          } else {
            allTasksFlexible.push({
              course,
              assign: a,
              isDouble: false,
              isTitularMondayFirst: isTitularTask
            });
            remaining -= 1;
            if (isTitularTask) titularMondayAssigned = true;
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
          let searchDays = validPrefDay
            ? [
                validPrefDay,
                ...workingDays.filter((d) => d !== validPrefDay).sort(() => Math.random() - 0.5)
              ]
            : [...workingDays].sort(() => Math.random() - 0.5);

          if (task.isTitularMondayFirst && workingDays.includes('Lunes')) {
            searchDays = ['Lunes', ...searchDays.filter((d) => d !== 'Lunes')];
          }

          for (const day of searchDays) {
            const dayCount = dailyCount[course.id]?.[day]?.[assign.subject_id] || 0;
            if (!relaxedRules && dayCount >= 2) continue;

          const subObj = state.subjects?.find((s: any) => s.id === assign.subject_id);
          const sName = subObj?.name?.toLowerCase() || '';
          const distType = subObj?.distributionType || subObj?.distribution_type;
          const isDeporte = isDeporteSubject(sName);
          const isTogetherSubject = distType === 'together' || isDeporte;

          let combinations: any[][] = [];
          if (isDouble) {
            const strictPairs: any[][] = [];
            const recessPairs: any[][] = [];
            for (let i = 0; i < slots.length - 1; i++) {
              const endPrev = toMins(slots[i].end);
              const startNext = toMins(slots[i + 1].start);
              const gap = startNext - endPrev;
              if (gap === 0) {
                strictPairs.push([slots[i], slots[i + 1]]);
              } else if (gap > 0 && gap <= 35) {
                recessPairs.push([slots[i], slots[i + 1]]);
              }
            }
            strictPairs.sort((a, b) => {
              const aHasPref = pref && day === pref.day && a.some((s) => s.start === pref.start);
              const bHasPref = pref && day === pref.day && b.some((s) => s.start === pref.start);
              if (aHasPref && !bHasPref) return -1;
              if (!aHasPref && bHasPref) return 1;
              return Math.random() - 0.5;
            });
            recessPairs.sort(() => Math.random() - 0.5);
            // Únicamente Deporte / Educación Física tiene prohibido partirse por el recreo
            if (isDeporte) {
              combinations.push(...strictPairs);
            } else {
              combinations.push(...strictPairs, ...recessPairs);
            }
          } else {
            for (let i = 0; i < slots.length; i++) combinations.push([slots[i]]);
            combinations.sort((a, b) => {
              const aHasPref = pref && day === pref.day && a[0].start === pref.start;
              const bHasPref = pref && day === pref.day && b[0].start === pref.start;
              if (aHasPref && !bHasPref) return -1;
              if (!aHasPref && bHasPref) return 1;
              return Math.random() - 0.5;
            });
          }

          if (task.isTitularMondayFirst && day === 'Lunes') {
            if (isDouble && combinations.length > 0 && slots.length > 0) {
              const firstPair = combinations.find((pair) => pair[0]?.start === slots[0]?.start);
              if (firstPair) {
                combinations = [firstPair, ...combinations.filter((p) => p !== firstPair)];
              }
            } else if (!isDouble && combinations.length > 0 && slots.length > 0) {
              const firstSingle = combinations.find((s) => s[0]?.start === slots[0]?.start);
              if (firstSingle) {
                combinations = [firstSingle, ...combinations.filter((s) => s !== firstSingle)];
              }
            }
          }

          for (const toUse of combinations) {
            const existingSameSubject = finalEntries.filter(
              (e) => e.course_id === course.id && e.subject_id === assign.subject_id && e.day === day
            );
            if (existingSameSubject.length > 0) {
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
                    const overlapMins = Math.min(sEnd, eEnd) - Math.max(sStart, eStart);
                    if (overlapMins <= 0) return false;

                    if (e.course_id === course.id) return true;
                    if (e.teacher_id === assign.teacher_id && overlapMins > 10) return true;

                    return false;
                  }) ||
                  isFixedEventConflict(sStart, sEnd, day, course) ||
                  doesOverlapCourseBreak(sStart, sEnd, course, breakPreferences, shift, toMins) ||
                  (isDeporte && doesOverlapSportsBreak(sStart, sEnd, course, breakPreferences, shift, toMins))
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
          const subObj = state.subjects?.find((s: any) => s.id === t.assign?.subject_id);
          const sName = subObj?.name?.toLowerCase() || '';
          const distType = subObj?.distributionType || subObj?.distribution_type;
          const isStrictTogether =
            distType === 'together' ||
            sName.includes('deporte') ||
            sName.includes('educación física') ||
            sName.includes('educacion fisica');

          if (t.isDouble && !isStrictTogether) {
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

        for (let i = 0; i < 500; i++) {
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
          const entryKey1 = e.id;
          const entryKey2 = `${e.course_id}_${e.day}_${e.start_time}`;
          const isLocked = Boolean(
            e.is_locked ||
              (lockedKeys || []).includes(entryKey1) ||
              (lockedKeys || []).includes(entryKey2)
          );
          return {
            ...rest,
            is_locked: isLocked
          };
        });
        let { error: insError } = await supabase.from('schedule_entries').insert(chunk);
        if (insError && (insError.message?.includes('is_locked') || insError.code === 'PGRST204')) {
          const fallbackChunk = chunk.map(({ is_locked, ...noLock }: any) => noLock);
          const { error: retryErr } = await supabase.from('schedule_entries').insert(fallbackChunk);
          insError = retryErr;
        }
        if (insError) throw new Error('Error al guardar reparación: ' + insError.message);
      }
    }

    const finalAudit: string[] = [];
    let totalAssignedHours = 0;
    let totalPlacedHours = 0;

    filteredAssignments.forEach((a) => {
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
        `⚠️ Logrado: ${realPercent}% (${totalPlacedHours}/${totalAssignedHours}h). Quedaron horas pendientes.`
      );
    } else {
      finalAudit.push(
        `✅ Reparación Exitosa al 100%. Se han guardado ${bestResult.entries.length} periodos preservando posiciones.`
      );
    }

    return { entries: bestResult.entries, diagnostics: finalAudit };
  },

  findSmartSwaps: (
    state: any,
    targetCourseId: string,
    targetSubjectId: string,
    shift: string,
    lockedKeys: string[] = []
  ) => {
    const { courses, subjects, assignments, schedule, levelSchedules, breakPreferences } = state;
    const course = (courses || []).find((c: any) => c.id === targetCourseId);
    const subject = (subjects || []).find((s: any) => s.id === targetSubjectId);
    if (!course || !subject) return [];

    const assign = (assignments || []).find(
      (a: any) => (a.course_id === targetCourseId || a.courseId === targetCourseId) && a.subject_id === targetSubjectId
    );
    if (!assign) return [];

    const teacherId = assign.teacher_id;
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const currentSchedule = schedule || [];

    const toMins = (val: string) => {
      const [h, m] = (val || '').replace(/[^0-9:]/g, '').split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const fromMins = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    };

    const isMorning = shift === 'Matutina';
    const courseOfficial = findOfficialSchedule(levelSchedules, course.level, shift);
    const isFirstCycle = isFirstCycleCourse(course);
    const isSecondCycle = isSecondCycleCourse(course);

    const startT = toMins(courseOfficial?.start_time || (isMorning ? '08:00' : '14:00'));
    const endT = toMins(courseOfficial?.end_time || (isMorning ? '12:00' : '18:15'));

    // Recreo del curso
    const applicableBPs = (breakPreferences || []).filter((bp: any) => {
      let bpMins = toMins(bp.startTime);
      if (!isMorning && bpMins < 420) bpMins += 720;
      const isBpMorning = bpMins < 780;
      if (isMorning !== isBpMorning) return false;

      const bpLevel = (bp.level || '').toLowerCase();
      const levelNorm = (course.level || '').toLowerCase();
      if (!bpLevel || bpLevel.includes('gen') || bpLevel.includes('todo')) return true;
      return (
        bpLevel.substring(0, 3) === levelNorm.substring(0, 3) ||
        levelNorm.includes(bpLevel.substring(0, 3))
      );
    });

    let bPref = applicableBPs.find((bp: any) => {
      const bpCyc = (bp.cycle || '').toLowerCase();
      if (isFirstCycle && (bpCyc.includes('primer') || bpCyc.includes('1er') || bpCyc.includes('1'))) return true;
      if (isSecondCycle && (bpCyc.includes('segundo') || bpCyc.includes('2do') || bpCyc.includes('2'))) return true;
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

    const isSecundaria = (course.level || '').toLowerCase().includes('secun');
    const targetTotal = isSecundaria ? 6 : 5;

    let classStart = courseOfficial?.start_time ? startT : (isMorning && startT <= 480 ? 480 : startT);
    const preWindow = Math.max(0, bStart - classStart);
    let preCount = targetTotal === 5 ? 2 : 3;
    if (preWindow / preCount < 33) {
      preCount = Math.max(1, Math.floor(preWindow / 33));
    }

    const calculateSlotDurations = (totalMins: number, preferredCount: number) => {
      if (totalMins <= 0 || preferredCount <= 0) return [];
      let count = preferredCount;
      while (count > 1 && totalMins / count < 33) count--;
      while (totalMins / count > 45 && count < 6) count++;
      const base = Math.floor(totalMins / count);
      let rem = totalMins - base * count;
      const durs = new Array(count).fill(base);
      for (let idx = 0; idx < count && rem > 0; idx++) {
        durs[idx] += 1;
        rem -= 1;
      }
      return durs;
    };

    const preDurs = calculateSlotDurations(preWindow, preCount);
    preCount = preDurs.length;

    const slotTimes: any[] = [];
    let currTimePre = classStart;
    for (let i = 0; i < preCount; i++) {
      let dur = preDurs[i];
      let sTime = currTimePre;
      let eTime = i === preCount - 1 ? bStart : sTime + dur;
      currTimePre = eTime;
      slotTimes.push({
        start: fromMins(sTime),
        end: fromMins(eTime),
        label: `${i + 1}ra Hora`
      });
    }

    let currTimePost = bEnd;
    const postWindow = Math.max(0, endT - currTimePost);
    let postCount = Math.max(1, targetTotal - preCount);
    const postDurs = calculateSlotDurations(postWindow, postCount);
    for (let i = 0; i < postDurs.length; i++) {
      let dur = postDurs[i];
      let sTime = currTimePost;
      let eTime = i === postDurs.length - 1 ? endT : sTime + dur;
      currTimePost = eTime;
      slotTimes.push({
        start: fromMins(sTime),
        end: fromMins(eTime),
        label: `${preCount + i + 1}ra Hora`
      });
    }

    const suggestions: any[] = [];

    days.forEach((day) => {
      const dayEntries = currentSchedule.filter(
        (e: any) => e.course_id === targetCourseId && (e.day || '').trim().toLowerCase() === day.toLowerCase()
      );

      // REGLA ABSOLUTA 1: Si el curso ya tiene 2 o más horas de esta materia este día, no sugerir añadir más
      const existingSameSubjectCount = dayEntries.filter((e: any) => e.subject_id === targetSubjectId).length;
      if (existingSameSubjectCount >= 2) return;

      const teacherOtherCourseEntries = currentSchedule.filter(
        (e: any) =>
          e.teacher_id === teacherId &&
          (e.day || '').trim().toLowerCase() === day.toLowerCase() &&
          e.course_id !== targetCourseId
      );

      slotTimes.forEach((slot) => {
        const slotStartMins = toMins(slot.start);
        const slotEndMins = toMins(slot.end);

        // REGLA ABSOLUTA 2: JAMÁS sugerir colocar una clase en el horario de Recreo del curso
        const overlapsBreak = doesOverlapCourseBreak(
          slotStartMins,
          slotEndMins,
          course,
          breakPreferences,
          shift,
          toMins
        );
        if (overlapsBreak) return;

        const subName = (subject?.name || '').toLowerCase();
        const isDeporte =
          subName.includes('deporte') ||
          subName.includes('educación física') ||
          subName.includes('educacion fisica');

        if (isDeporte) {
          const overlapsPatio = doesOverlapSportsBreak(
            slotStartMins,
            slotEndMins,
            course,
            breakPreferences,
            shift,
            toMins
          );
          if (overlapsPatio) return;
        }

        // ¿Docente ocupado en otro curso a esta hora?
        const busyElsewhereEntries = teacherOtherCourseEntries.filter((e: any) => {
          const eStart = toMins(e.start_time);
          const eEnd = toMins(e.end_time);
          return slotStartMins < eEnd && slotEndMins > eStart;
        });
        const isTeacherBusyElsewhere = busyElsewhereEntries.length > 0;

        // Buscar entrada en este curso comparando minutos
        const currentEntry = dayEntries.find((e: any) => {
          const eStart = toMins(e.start_time);
          return Math.abs(eStart - slotStartMins) < 20;
        });

        const isLocked = currentEntry && (lockedKeys.includes(currentEntry.id) || lockedKeys.includes(`${targetCourseId}_${day}_${slot.start}`));
        if (isLocked) return;

        if (!currentEntry) {
          // CASILLA VACÍA
          if (isTeacherBusyElsewhere) {
            // Intentar detectar si esa clase en el otro curso se puede mover a otro hueco libre del otro curso (Ripple Swap)
            let rippleFound = false;
            const obstructingEntry = busyElsewhereEntries[0];
            const otherCourse = courses.find((c: any) => c.id === obstructingEntry?.course_id);
            const otherCourseSlots = otherCourse ? getCourseSlots(otherCourse) : [];

            if (otherCourse && !lockedKeys.includes(obstructingEntry.id)) {
              for (const altDay of days) {
                const otherDayEntries = currentSchedule.filter(
                  (e: any) => e.course_id === otherCourse.id && (e.day || '').trim().toLowerCase() === altDay.toLowerCase()
                );
                for (const altSlot of otherCourseSlots) {
                  if (altSlot.isBreak) continue;
                  const altStartMins = toMins(altSlot.start);
                  const altEndMins = toMins(altSlot.end);
                  const altOverlapsBreak = doesOverlapCourseBreak(altStartMins, altEndMins, otherCourse, breakPreferences, shift, toMins);
                  if (altOverlapsBreak) continue;

                  const isAltSlotOccupied = otherDayEntries.some((e: any) => Math.abs(toMins(e.start_time) - altStartMins) < 20);
                  if (!isAltSlotOccupied) {
                    // Verificar si el docente está libre en ese altDay y altSlot en todos los demás cursos
                    const isDocenteFreeAtAlt = !currentSchedule.some((e: any) => {
                      if (e.id === obstructingEntry.id) return false;
                      if (e.teacher_id !== teacherId) return false;
                      if ((e.day || '').trim().toLowerCase() !== altDay.toLowerCase()) return false;
                      const eS = toMins(e.start_time);
                      const eE = toMins(e.end_time);
                      return altStartMins < eE && altEndMins > eS;
                    });

                    if (isDocenteFreeAtAlt) {
                      const otherSub = (subjects || []).find((s: any) => s.id === obstructingEntry.subject_id);
                      const otherSubName = otherSub?.name || 'Materia';
                      const otherCourseLabel = `${otherCourse.grade || ''} "${otherCourse.section || ''}"`;

                      suggestions.push({
                        type: 'ripple',
                        priority: 2,
                        day,
                        slot,
                        title: `⚡ En Cadena: Mover ${otherSubName} (${otherCourseLabel}) al ${altDay} (${altSlot.label || altSlot.start.substring(0, 5)})`,
                        description: `Despeja el choque del profesor en ${otherCourseLabel} moviendo esa hora a un espacio vacío de ese mismo grado y coloca la materia aquí automáticamente.`,
                        targetSlot: slot,
                        swapWithEntry: null,
                        rippleMove: {
                          entryId: obstructingEntry.id,
                          newDay: altDay,
                          newStart: altSlot.start,
                          newEnd: altSlot.end
                        }
                      });
                      rippleFound = true;
                      break;
                    }
                  }
                }
                if (rippleFound) break;
              }
            }

            if (!rippleFound) {
              const obsCourse = courses.find((c: any) => c.id === obstructingEntry?.course_id);
              const obsLabel = obsCourse ? `${obsCourse.grade} "${obsCourse.section || ''}"` : 'otro grado';
              suggestions.push({
                type: 'warning',
                priority: 4,
                day,
                slot,
                title: `⚠️ Colocar el ${day} (${slot.label} ${slot.start.substring(0, 5)}) - Ocupado en ${obsLabel}`,
                description: `Casilla libre en este curso, pero el docente ya imparte clase en ${obsLabel} a esta misma hora.`,
                targetSlot: slot,
                swapWithEntry: null
              });
            }
          } else {
            suggestions.push({
              type: 'empty',
              priority: 1,
              day,
              slot,
              title: `🟢 Casilla VACÍA el ${day} (${slot.label} ${slot.start.substring(0, 5)})`,
              description: `El espacio está totalmente libre en el curso y el docente está 100% disponible.`,
              targetSlot: slot,
              swapWithEntry: null
            });
          }
        } else {
          // CASILLA OCUPADA POR OTRA MATERIA EN EL MISMO CURSO
          if (currentEntry.subject_id === targetSubjectId) return; // Ya es esta misma materia
          const existingSub = (subjects || []).find((s: any) => s.id === currentEntry.subject_id);
          const existingSubName = existingSub?.name || 'otra materia';

          suggestions.push({
            type: 'swap',
            priority: 3,
            day,
            slot,
            title: `🔄 Reemplazar a ${existingSubName} el ${day} (${slot.label} ${slot.start.substring(0, 5)})`,
            description: `Vaciará ${existingSubName} de esta hora y colocará la nueva materia de forma única.`,
            targetSlot: slot,
            swapWithEntry: currentEntry
          });
        }
      });
    });

    // 2. Construir la cuadrícula semanal completa del docente (Teacher Availability Heatmap)
    const teacherScheduleGrid: Record<string, Record<string, { status: 'free' | 'busy_other' | 'busy_this' | 'break'; label: string }>> = {};
    days.forEach((day) => {
      teacherScheduleGrid[day] = {};
      slotTimes.forEach((slot) => {
        const slotStartMins = toMins(slot.start);
        const slotEndMins = toMins(slot.end);

        const overlapsBreak = doesOverlapCourseBreak(slotStartMins, slotEndMins, course, breakPreferences, shift, toMins);
        if (overlapsBreak) {
          teacherScheduleGrid[day][slot.start] = { status: 'break', label: 'Recreo' };
          return;
        }

        const entriesThisSlot = currentSchedule.filter((e: any) => {
          if (e.teacher_id !== teacherId) return false;
          if ((e.day || '').trim().toLowerCase() !== day.toLowerCase()) return false;
          const eS = toMins(e.start_time);
          const eE = toMins(e.end_time);
          return slotStartMins < eE && slotEndMins > eS;
        });

        if (entriesThisSlot.length === 0) {
          teacherScheduleGrid[day][slot.start] = { status: 'free', label: 'Libre' };
        } else {
          const entry = entriesThisSlot[0];
          if (entry.course_id === targetCourseId) {
            const sub = (subjects || []).find((s: any) => s.id === entry.subject_id);
            teacherScheduleGrid[day][slot.start] = { status: 'busy_this', label: sub?.name || 'En este curso' };
          } else {
            const cObj = (courses || []).find((c: any) => c.id === entry.course_id);
            const cLabel = cObj ? `${cObj.grade || ''} ${cObj.section || ''}` : 'Otro grado';
            teacherScheduleGrid[day][slot.start] = { status: 'busy_other', label: cLabel };
          }
        }
      });
    });

    const teacherName = teacherObj?.name || teacherObj?.full_name || 'Docente';
    const teacherAssignments = (allAssignments || []).filter((a: any) => (a.teacher_id || a.teacherId) === teacherId);
    const teacherTotalAssigned = teacherAssignments.reduce((acc: number, a: any) => acc + (Number(a.hours_per_week || a.hoursPerWeek) || 0), 0);
    const teacherTotalPlaced = currentSchedule.filter((e: any) => e.teacher_id === teacherId).length;

    // Ordenar sugerencias: 1: Vacías -> 2: En Cadena (Ripple) -> 3: Reemplazo local -> 4: Advertencias
    const sortedSuggestions = suggestions.sort((a, b) => a.priority - b.priority);

    return {
      suggestions: sortedSuggestions,
      teacherGrid: teacherScheduleGrid,
      teacherName,
      teacherTotalAssigned,
      teacherTotalPlaced,
      slotTimes
    };
  },

  applySmartSwap: async (
    state: any,
    profile: any,
    targetCourseId: string,
    targetSubjectId: string,
    suggestion: any,
    shift: string,
    schoolYear: string
  ) => {
    const assign = (state.assignments || []).find(
      (a: any) => (a.course_id === targetCourseId || a.courseId === targetCourseId) && a.subject_id === targetSubjectId
    );
    if (!assign) throw new Error('No se encontró la asignación académica.');

    const toMins = (val: string) => {
      const [h, m] = (val || '').replace(/[^0-9:]/g, '').split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const targetStartMins = toMins(suggestion.targetSlot.start);

    // 1. Si es un Intercambio en Cadena (Ripple Swap), mover la materia del otro curso
    if (suggestion.rippleMove) {
      const { entryId, newDay, newStart, newEnd } = suggestion.rippleMove;
      const sStart = newStart.length === 5 ? newStart + ':00' : newStart;
      const sEnd = newEnd.length === 5 ? newEnd + ':00' : newEnd;
      await supabase
        .from('schedule_entries')
        .update({ day: newDay, start_time: sStart, end_time: sEnd })
        .eq('id', entryId);
    }

    // 2. Si existe una entrada previa explícita a eliminar en la casilla de este curso
    if (suggestion.swapWithEntry?.id) {
      await supabase.from('schedule_entries').delete().eq('id', suggestion.swapWithEntry.id);
    }

    // 3. Limpieza de aproximación: Eliminar cualquier entrada del curso en ese día que coincida en horario (+-20 min)
    const { data: existingSlots } = await supabase
      .from('schedule_entries')
      .select('id, start_time')
      .eq('center_id', profile.center_id)
      .eq('course_id', targetCourseId)
      .eq('day', suggestion.day)
      .eq('shift', shift)
      .eq('school_year', schoolYear);

    if (existingSlots && existingSlots.length > 0) {
      const idsToDelete = existingSlots
        .filter((e) => Math.abs(toMins(e.start_time) - targetStartMins) < 20)
        .map((e) => e.id);
      if (idsToDelete.length > 0) {
        await supabase.from('schedule_entries').delete().in('id', idsToDelete);
      }
    }

    // 4. Si se estaba moviendo una clase que ya estaba en otra hora, eliminar su posición vieja
    if (suggestion.fromEntryId) {
      await supabase.from('schedule_entries').delete().eq('id', suggestion.fromEntryId);
    }

    // 5. Formatear hora de inicio y fin en formato HH:MM:SS
    const sStart = suggestion.targetSlot.start.length === 5 ? suggestion.targetSlot.start + ':00' : suggestion.targetSlot.start;
    const sEnd = suggestion.targetSlot.end.length === 5 ? suggestion.targetSlot.end + ':00' : suggestion.targetSlot.end;

    // 6. Insertar la nueva clase de forma limpia
    const { error: insErr } = await supabase.from('schedule_entries').insert([
      {
        center_id: profile.center_id,
        course_id: targetCourseId,
        subject_id: targetSubjectId,
        teacher_id: assign.teacher_id,
        day: suggestion.day,
        shift,
        start_time: sStart,
        end_time: sEnd,
        school_year: schoolYear
      }
    ]);

    if (insErr) throw new Error('Error al guardar la nueva clase: ' + insErr.message);
    return true;
  },

  // MOTOR DE RELLENO ASISTIDO ULTRARRÁPIDO Y SANITIZADOR DE HORAS FALTANTES
  fastTargetedFill: async (
    state: any,
    profile: any,
    shift: string,
    year: string,
    lockedKeys: string[] = []
  ) => {
    const centerId = profile.center_id;
    const schoolYear = year;
    const { courses: allCourses, assignments: allAssignments, subjects: allSubjects, levelSchedules, breakPreferences } = state;

    const shiftBase = shift.toLowerCase().substring(0, 3);
    const courses = allCourses.filter((c: any) => {
      const tStr = (c.tanda || '').toLowerCase().trim();
      const lvlStr = (c.level || '').toLowerCase().trim();
      if (shiftBase === 'mat') {
        if (tStr.includes('mat') || tStr.includes('mañ') || tStr.includes('ext') || tStr.includes('com')) return true;
        if (tStr === '') return true;
        return !tStr.includes('ves') && !tStr.includes('tar');
      } else {
        return tStr.includes('ves') || tStr.includes('tar') || (tStr === '' && lvlStr.includes('secun'));
      }
    });

    const courseIdSet = new Set(courses.map((c: any) => String(c.id)));
    const assignments = allAssignments.filter((a: any) => courseIdSet.has(String(a.course_id || a.courseId)));

    // 1. Cargar horario actual de la base de datos
    const { data: rawSchedule, error: fetchErr } = await supabase
      .from('schedule_entries')
      .select('*')
      .eq('center_id', centerId)
      .eq('shift', shift)
      .eq('school_year', schoolYear);

    if (fetchErr || !rawSchedule) {
      throw new Error('No se pudo consultar el horario actual: ' + (fetchErr?.message || 'Error desconocido'));
    }

    const toMins = (val: string) => {
      const [h, m] = (val || '').replace(/[^0-9:]/g, '').split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const fromMins = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
    };

    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

    // 2. FASE 0: SANITIZACIÓN Y LIMPIEZA DE ENTRADAS DUPLICADAS EN DB
    const idsToDelete: string[] = [];
    const seenCourseSlotKeys = new Set<string>();
    const countByCourseSubject: Record<string, number> = {};

    // Mapear requerimiento máximo por materia en cada curso
    const requiredHoursMap: Record<string, number> = {};
    assignments.forEach((a: any) => {
      const cId = String(a.course_id || a.courseId);
      const sId = String(a.subject_id);
      const req = Number(a.hours_per_week || a.hoursPerWeek) || 0;
      requiredHoursMap[`${cId}_${sId}`] = req;
    });

    rawSchedule.forEach((e: any) => {
      const cId = String(e.course_id);
      const sId = String(e.subject_id);
      const day = (e.day || '').trim().toLowerCase();
      const sTime = e.start_time;

      const slotKey = `${cId}_${day}_${sTime}`;
      const csKey = `${cId}_${sId}`;

      // Si la misma casilla en el mismo curso ya está ocupada por otra fila (duplicado idéntico)
      if (seenCourseSlotKeys.has(slotKey)) {
        idsToDelete.push(e.id);
        return;
      }
      seenCourseSlotKeys.add(slotKey);

      // Si ya se superó la cantidad de horas asignadas para esta materia
      const maxReq = requiredHoursMap[csKey] ?? 99;
      const currentCount = countByCourseSubject[csKey] || 0;
      if (currentCount >= maxReq) {
        idsToDelete.push(e.id);
        return;
      }
      countByCourseSubject[csKey] = currentCount + 1;
    });

    if (idsToDelete.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < idsToDelete.length; i += chunkSize) {
        const chunk = idsToDelete.slice(i, i + chunkSize);
        await supabase.from('schedule_entries').delete().in('id', chunk);
      }
    }

    const workingSchedule = rawSchedule.filter((e: any) => !idsToDelete.includes(e.id));

    // 3. GENERADOR DINÁMICO DE SLOTS OFICIALES POR CURSO
    const getSlotsForCourse = (course: any) => {
      const isMorning = shiftBase === 'mat';
      const official = (levelSchedules || []).find(
        (ls: any) =>
          ls.level === course.level &&
          (ls.shift === (isMorning ? 'Matutina' : 'Vespertina') || !ls.shift)
      );

      let startT = official?.start_time ? toMins(official.start_time) : isMorning ? 480 : 840;
      if (!isMorning && startT < 720 && startT > 0) startT += 720;
      let endT = official?.end_time ? toMins(official.end_time) : isMorning ? 720 : 1095;
      if (!isMorning && endT < 720 && endT > 0) endT += 720;

      const firstRelevantBreak = (breakPreferences || []).find((bp: any) => {
        let bpMins = toMins(bp.startTime);
        if (!isMorning && bpMins < 720) bpMins += 720;
        const isBpMorning = bpMins < 780;
        return isMorning === isBpMorning;
      });

      const rawMasterStart = firstRelevantBreak?.startTime || (isMorning ? '10:00:00' : '16:00:00');
      let masterStartMins = toMins(rawMasterStart);
      if (!isMorning && masterStartMins < 720 && masterStartMins > 0) masterStartMins += 720;
      if (!isMorning && (masterStartMins <= startT || masterStartMins >= endT)) masterStartMins = 960;

      const bStart = masterStartMins;
      const bDuration = firstRelevantBreak ? Number(firstRelevantBreak.durationMinutes) : isMorning ? 30 : 15;
      const bEnd = bStart + bDuration;

      const slots: any[] = [];
      const preWindow = Math.max(0, bStart - startT);
      let preCount = preWindow >= 85 ? 3 : preWindow < 50 ? 1 : 2;
      const preDur = Math.floor(preWindow / preCount);

      let currPre = startT;
      for (let i = 0; i < preCount; i++) {
        let e = i === preCount - 1 ? bStart : currPre + preDur;
        slots.push({
          start: fromMins(currPre),
          end: fromMins(e),
          isBreak: false,
          label: `${i + 1}ra Hora`
        });
        currPre = e;
      }

      const postWindow = Math.max(0, endT - bEnd);
      let postCount = postWindow >= 85 ? 3 : postWindow < 50 ? 1 : 2;
      const postDur = Math.floor(postWindow / postCount);

      let currPost = bEnd;
      for (let i = 0; i < postCount; i++) {
        let e = i === postCount - 1 ? endT : currPost + postDur;
        slots.push({
          start: fromMins(currPost),
          end: fromMins(e),
          isBreak: false,
          label: `${preCount + i + 1}ra Hora`
        });
        currPost = e;
      }

      return slots;
    };

    // 4. IDENTIFICAR MATERIAS FALTANTES REALES
    const missingTasks: any[] = [];
    assignments.forEach((a: any) => {
      const cId = String(a.course_id || a.courseId);
      const sId = String(a.subject_id);
      const required = Number(a.hours_per_week || a.hoursPerWeek) || 0;
      const placed = workingSchedule.filter(
        (e: any) => String(e.course_id) === cId && String(e.subject_id) === sId
      ).length;
      const missing = required - placed;
      for (let k = 0; k < missing; k++) {
        missingTasks.push({
          courseId: cId,
          subjectId: sId,
          teacherId: a.teacher_id || a.teacherId,
          assign: a
        });
      }
    });

    const newEntriesToInsert: any[] = [];
    let placedCount = 0;

    // Helper de validación de casilla
    const isSlotValidForTeacherAndCourse = (
      cId: string,
      tId: string,
      sId: string,
      day: string,
      sStartMins: number,
      sEndMins: number,
      courseObj: any
    ) => {
      // 1. Recreo del curso
      if (doesOverlapCourseBreak(sStartMins, sEndMins, courseObj, breakPreferences, shift, toMins)) return false;

      // 2. Deporte en recreo
      const sub = allSubjects.find((s: any) => s.id === sId);
      const sName = (sub?.name || '').toLowerCase();
      if (sName.includes('deporte') || sName.includes('educación física') || sName.includes('educacion fisica')) {
        if (doesOverlapSportsBreak(sStartMins, sEndMins, courseObj, breakPreferences, shift, toMins)) return false;
      }

      // 3. Máximo 2 horas al día de la misma materia
      const sameSubjectInDay = workingSchedule.filter(
        (e: any) =>
          String(e.course_id) === String(cId) &&
          (e.day || '').trim().toLowerCase() === day.toLowerCase() &&
          String(e.subject_id) === String(sId)
      ).length;
      if (sameSubjectInDay >= 2) return false;

      // 4. Curso ocupado a esa hora
      const courseBusy = workingSchedule.some((e: any) => {
        if (String(e.course_id) !== String(cId)) return false;
        if ((e.day || '').trim().toLowerCase() !== day.toLowerCase()) return false;
        const eS = toMins(e.start_time);
        const eE = toMins(e.end_time);
        return sStartMins < eE && sEndMins > eS;
      });
      if (courseBusy) return false;

      // 5. Docente ocupado en cualquier otro curso a esa hora
      if (tId) {
        const teacherBusy = workingSchedule.some((e: any) => {
          if (String(e.teacher_id) !== String(tId)) return false;
          if ((e.day || '').trim().toLowerCase() !== day.toLowerCase()) return false;
          const eS = toMins(e.start_time);
          const eE = toMins(e.end_time);
          return sStartMins < eE && sEndMins > eS;
        });
        if (teacherBusy) return false;
      }

      return true;
    };

    // 5. FASE 1: COLOCACIÓN DIRECTA EN CASILLAS LIBRES
    for (const task of missingTasks) {
      const courseObj = courses.find((c: any) => String(c.id) === String(task.courseId));
      if (!courseObj) continue;

      const courseSlots = getSlotsForCourse(courseObj);
      let taskPlaced = false;

      for (const day of days) {
        for (const slot of courseSlots) {
          if (slot.isBreak) continue;
          const sStartMins = toMins(slot.start);
          const sEndMins = toMins(slot.end);

          if (isSlotValidForTeacherAndCourse(task.courseId, task.teacherId, task.subjectId, day, sStartMins, sEndMins, courseObj)) {
            const newEntry = {
              center_id: centerId,
              course_id: task.courseId,
              subject_id: task.subjectId,
              teacher_id: task.teacherId,
              day,
              shift,
              start_time: slot.start,
              end_time: slot.end,
              school_year: schoolYear
            };
            workingSchedule.push(newEntry);
            newEntriesToInsert.push(newEntry);
            placedCount++;
            taskPlaced = true;
            break;
          }
        }
        if (taskPlaced) break;
      }
    }

    // 6. FASE 2: INTERCAMBIOS EN CADENA (RIPPLE MOVES) PARA HORAS BLOQUEADAS
    for (const task of missingTasks) {
      // Si la tarea ya fue colocada en Fase 1, saltar
      const currentPlaced = workingSchedule.filter(
        (e: any) => String(e.course_id) === String(task.courseId) && String(e.subject_id) === String(task.subjectId)
      ).length;
      const req = Number(task.assign.hours_per_week || task.assign.hoursPerWeek) || 0;
      if (currentPlaced >= req) continue;

      const courseObj = courses.find((c: any) => String(c.id) === String(task.courseId));
      if (!courseObj || !task.teacherId) continue;

      const courseSlots = getSlotsForCourse(courseObj);

      for (const day of days) {
        let placedRipple = false;
        for (const slot of courseSlots) {
          if (slot.isBreak) continue;
          const sStartMins = toMins(slot.start);
          const sEndMins = toMins(slot.end);

          // Verificar si el curso destino tiene libre esta hora
          const courseBusy = workingSchedule.some((e: any) => {
            if (String(e.course_id) !== String(task.courseId)) return false;
            if ((e.day || '').trim().toLowerCase() !== day.toLowerCase()) return false;
            const eS = toMins(e.start_time);
            const eE = toMins(e.end_time);
            return sStartMins < eE && sEndMins > eS;
          });
          if (courseBusy) continue;

          // Buscar la clase del docente en el otro curso que genera el choque
          const conflictingEntries = workingSchedule.filter((e: any) => {
            if (String(e.teacher_id) !== String(task.teacherId)) return false;
            if ((e.day || '').trim().toLowerCase() !== day.toLowerCase()) return false;
            if (String(e.course_id) === String(task.courseId)) return false;
            const eS = toMins(e.start_time);
            const eE = toMins(e.end_time);
            return sStartMins < eE && sEndMins > eS;
          });

          if (conflictingEntries.length === 1) {
            const otherEntry = conflictingEntries[0];
            const otherCourseObj = courses.find((c: any) => String(c.id) === String(otherEntry.course_id));
            if (!otherCourseObj) continue;

            const otherCourseSlots = getSlotsForCourse(otherCourseObj);

            // Buscar si la otra clase puede moverse a otro slot libre en su propio curso
            for (const altDay of days) {
              for (const altSlot of otherCourseSlots) {
                if (altSlot.isBreak) continue;
                const altStartMins = toMins(altSlot.start);
                const altEndMins = toMins(altSlot.end);

                // Evitar el mismo slot original
                if (altDay.toLowerCase() === day.toLowerCase() && altStartMins === sStartMins) continue;

                // Verificar si el otro curso y el docente están libres en altSlot
                const otherSlotOccupied = workingSchedule.some((e: any) => {
                  if (String(e.course_id) !== String(otherEntry.course_id)) return false;
                  if ((e.day || '').trim().toLowerCase() !== altDay.toLowerCase()) return false;
                  const eS = toMins(e.start_time);
                  const eE = toMins(e.end_time);
                  return altStartMins < eE && altEndMins > eS;
                });
                if (otherSlotOccupied) continue;

                const teacherBusyInAlt = workingSchedule.some((e: any) => {
                  if (String(e.id) === String(otherEntry.id)) return false;
                  if (String(e.teacher_id) !== String(task.teacherId)) return false;
                  if ((e.day || '').trim().toLowerCase() !== altDay.toLowerCase()) return false;
                  const eS = toMins(e.start_time);
                  const eE = toMins(e.end_time);
                  return altStartMins < eE && altEndMins > eS;
                });
                if (teacherBusyInAlt) continue;

                // ¡REUBICACIÓN EN CADENA FACTIBLE!
                // 1. Mover la otra clase en la base de datos
                if (otherEntry.id) {
                  await supabase
                    .from('schedule_entries')
                    .update({ day: altDay, start_time: altSlot.start, end_time: altSlot.end })
                    .eq('id', otherEntry.id);
                }
                otherEntry.day = altDay;
                otherEntry.start_time = altSlot.start;
                otherEntry.end_time = altSlot.end;

                // 2. Colocar la materia pendiente en la casilla liberada
                const newEntry = {
                  center_id: centerId,
                  course_id: task.courseId,
                  subject_id: task.subjectId,
                  teacher_id: task.teacherId,
                  day,
                  shift,
                  start_time: slot.start,
                  end_time: slot.end,
                  school_year: schoolYear
                };
                workingSchedule.push(newEntry);
                newEntriesToInsert.push(newEntry);
                placedCount++;
                placedRipple = true;
                break;
              }
              if (placedRipple) break;
            }
          }
          if (placedRipple) break;
        }
        if (placedRipple) break;
      }
    }

    // 7. Guardar nuevas inserciones en Supabase
    if (newEntriesToInsert.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < newEntriesToInsert.length; i += chunkSize) {
        const chunk = newEntriesToInsert.slice(i, i + chunkSize);
        const { error: insErr } = await supabase.from('schedule_entries').insert(chunk);
        if (insErr) throw new Error('Error al guardar nuevas clases: ' + insErr.message);
      }
    }

    // Recalcular métricas finales
    let totalAssignedHours = 0;
    let finalPlacedHours = 0;
    assignments.forEach((a: any) => {
      const cId = String(a.course_id || a.courseId);
      const sId = String(a.subject_id);
      const req = Number(a.hours_per_week || a.hoursPerWeek) || 0;
      totalAssignedHours += req;
      const placedCount = workingSchedule.filter(
        (e: any) => String(e.course_id) === cId && String(e.subject_id) === sId
      ).length;
      finalPlacedHours += Math.min(placedCount, req);
    });

    const totalCleaned = idsToDelete.length;
    const remainingMissing = Math.max(0, totalAssignedHours - finalPlacedHours);
    const coveragePct = totalAssignedHours > 0 ? Math.round((finalPlacedHours / totalAssignedHours) * 100) : 100;

    let msg = '';
    if (totalCleaned > 0 && placedCount > 0) {
      msg = `🧹 Se eliminaron ${totalCleaned} registros duplicados/excedentes y se colocaron ${placedCount} hora(s) faltante(s) con éxito.\n\n📊 Horario Actual: ${finalPlacedHours} de ${totalAssignedHours} horas (${coveragePct}% de cobertura).`;
    } else if (placedCount > 0) {
      msg = `✅ ¡Se colocaron ${placedCount} hora(s) faltante(s) exitosamente!\n\n📊 Horario Actual: ${finalPlacedHours} de ${totalAssignedHours} horas (${coveragePct}% de cobertura).`;
    } else if (totalCleaned > 0) {
      msg = `🧹 Se limpiaron ${totalCleaned} registros duplicados de la base de datos.\n\n📊 Horario Actual: ${finalPlacedHours} de ${totalAssignedHours} horas (${coveragePct}% de cobertura).`;
    } else {
      msg = `📊 Horario Actual: ${finalPlacedHours} de ${totalAssignedHours} horas (${coveragePct}% cubierto).\n\nQuedan ${remainingMissing} hora(s) que requieren ajustes de disponibilidad docente. Usa el Asistente de Intercambio Directo para ver las sugerencias.`;
    }

    return {
      cleanedCount: totalCleaned,
      addedCount: placedCount,
      remainingMissing,
      totalPlaced: finalPlacedHours,
      totalAssigned: totalAssignedHours,
      message: msg
    };
  }
};

