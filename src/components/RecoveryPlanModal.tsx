import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Plus,
  Trash2,
  Send,
  X,
  Layers,
  Sparkles,
  Users,
  Award,
  ChevronRight,
  Filter,
  Check,
  Building2,
  CheckSquare,
  Square,
  RefreshCw,
  Loader2,
  UserPlus
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useApp } from '../context/AppContext';
import { supabase, fetchAllRows } from '../lib/supabase';
import { recoveryPlanService, RecoveryPlan, RecoveryPlanStudent, RecoveryScheduleWeek } from '../services/recoveryPlanService';

interface RecoveryPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: any;
  allCourses?: any[];
  subjects?: any[];
  students?: any[];
  assignments?: any[];
  grades?: any;
  currentSubjectId?: string;
  centerId: string;
  schoolYear: string;
  activePeriod?: string;
  userId?: string;
}

export const RecoveryPlanModal: React.FC<RecoveryPlanModalProps> = ({
  isOpen,
  onClose,
  course,
  allCourses = [],
  subjects = [],
  students = [],
  assignments = [],
  grades = [],
  currentSubjectId,
  centerId,
  schoolYear = '2026-2027',
  activePeriod = 'P1',
  userId
}) => {
  const { state } = useApp();
  const [plans, setPlans] = useState<RecoveryPlan[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isCalculatingCandidates, setIsCalculatingCandidates] = useState(false);

  // Lista de cursos disponibles
  const availableCourses = useMemo(() => {
    if (allCourses && allCourses.length > 0) return allCourses;
    if (state?.courses && state.courses.length > 0) return state.courses;
    return course ? [course] : [];
  }, [allCourses, course, state?.courses]);

  // Modo de alcance: 'current' (solo este curso) o 'multi' (selección múltiple / todo el centro)
  const [targetScope, setTargetScope] = useState<'current' | 'multi'>('current');
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>(() => course?.id ? [course.id] : []);

  // Estado del formulario del nuevo plan
  const [period, setPeriod] = useState<string>(activePeriod || 'P1');
  const [title, setTitle] = useState<string>(`Plan de Recuperación - ${activePeriod || 'P1'}`);
  const [planMode, setPlanMode] = useState<'single' | 'weekly'>('weekly');
  const [singleStartDate, setSingleStartDate] = useState<string>('');
  const [singleEndDate, setSingleEndDate] = useState<string>('');

  // Semanas configuradas
  const [weeks, setWeeks] = useState<RecoveryScheduleWeek[]>([
    {
      weekNumber: 1,
      startDate: '',
      endDate: '',
      subjectIds: [],
      title: 'Semana 1'
    }
  ]);

  // Selección manual / automática de alumnos por materia
  const [candidateEntries, setCandidateEntries] = useState<Array<{
    courseId: string;
    courseName: string;
    studentId: string;
    studentName: string;
    subjectId: string;
    subjectName: string;
    originalScore: number;
    weekNumber: number;
    selected: boolean;
  }>>([]);

  // Formulario para agregar estudiante manualmente si hiciera falta
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualStudentId, setManualStudentId] = useState('');
  const [manualSubjectId, setManualSubjectId] = useState('');
  const [manualScore, setManualScore] = useState(60);

  // Cargar planes existentes al abrir
  useEffect(() => {
    if (!isOpen || !course?.id) return;
    loadCoursePlans();
  }, [isOpen, course?.id]);

  const loadCoursePlans = async () => {
    setLoading(true);
    try {
      const data = await recoveryPlanService.getPlans(course.id, schoolYear);
      setPlans(data);
    } catch (e) {
      console.warn('Error loading plans:', e);
    } finally {
      setLoading(false);
    }
  };

  // Calcular de forma exhaustiva y precisa qué alumnos están reprobados (<65 Primaria, <70 Secundaria)
  const loadAndComputeCandidates = async () => {
    const targetIds = targetScope === 'current' ? (course?.id ? [course.id] : []) : selectedCourseIds;
    if (!targetIds || targetIds.length === 0) {
      setCandidateEntries([]);
      return;
    }

    setIsCalculatingCandidates(true);
    try {
      // 1. Obtener cursos objetivo
      const targetCourses = availableCourses.filter((c) => targetIds.includes(c.id));
      if (targetCourses.length === 0 && course) targetCourses.push(course);

      // 2. Obtener estudiantes para estos cursos
      let poolStudents = (state?.students || []).filter((s: any) => targetIds.includes(s.course_id || s.courseId));
      if (poolStudents.length === 0 && students && students.length > 0) {
        poolStudents = students.filter((s: any) => targetIds.includes(s.course_id || s.courseId));
      }
      if (poolStudents.length === 0) {
        try {
          const { data: dbSt } = await fetchAllRows(() =>
            supabase
              .from('students')
              .select('*')
              .in('course_id', targetIds)
              .eq('school_year', schoolYear)
          );
          if (dbSt && dbSt.length > 0) {
            poolStudents = dbSt;
          }
        } catch (err) {
          console.warn('Error fetching students:', err);
        }
      }

      // 3. Consultar student_grades de la base de datos para todos los cursos seleccionados
      let dbGrades: any[] = [];
      try {
        const { data, error } = await fetchAllRows(() =>
          supabase
            .from('student_grades')
            .select('*')
            .in('course_id', targetIds)
            .eq('school_year', schoolYear)
        );
        if (!error && data) {
          dbGrades = data;
        }
      } catch (err) {
        console.warn('Error fetching student_grades for recovery plan:', err);
      }

      // 4. Construir mapa unificado de calificaciones [studentId][subjectId]
      const gradesMap: Record<string, Record<string, Record<string, any>>> = {};

      // 4a. Cargar desde la base de datos
      dbGrades.forEach((g: any) => {
        const stId = g.student_id;
        const subId = g.subject_id;
        if (!stId || !subId) return;

        if (!gradesMap[stId]) gradesMap[stId] = {};
        if (!gradesMap[stId][subId]) gradesMap[stId][subId] = {};

        const sGrades = gradesMap[stId][subId];
        const pL = (g.period || '').toLowerCase();
        const cId = (g.competency_id || '').toLowerCase();

        if (g.grade !== null && g.grade !== undefined && g.grade !== '') {
          sGrades[`${cId}_${pL}`] = Number(g.grade);
        }
        if (g.rp1 !== null && g.rp1 !== undefined && g.rp1 !== '') sGrades[`${cId}_rp1`] = Number(g.rp1);
        if (g.rp2 !== null && g.rp2 !== undefined && g.rp2 !== '') sGrades[`${cId}_rp2`] = Number(g.rp2);
        if (g.rp3 !== null && g.rp3 !== undefined && g.rp3 !== '') sGrades[`${cId}_rp3`] = Number(g.rp3);
        if (g.rp4 !== null && g.rp4 !== undefined && g.rp4 !== '') sGrades[`${cId}_rp4`] = Number(g.rp4);
        if (g.recovery_grade !== null && g.recovery_grade !== undefined && g.recovery_grade !== '') {
          sGrades['final_rec'] = Number(g.recovery_grade);
        }
      });

      // 4b. Fusionar calificaciones locales no guardadas del Registro Digital (para la materia activa `currentSubjectId`)
      if (currentSubjectId && grades && typeof grades === 'object' && !Array.isArray(grades)) {
        Object.keys(grades).forEach((k) => {
          const val = grades[k];
          if (val === undefined || val === null || val === '') return;

          const stMatch = poolStudents.find((st: any) => k.startsWith(`${st.id}_`));
          if (!stMatch) return;

          const restKey = k.substring(stMatch.id.length + 1).toLowerCase();
          if (!gradesMap[stMatch.id]) gradesMap[stMatch.id] = {};
          if (!gradesMap[stMatch.id][currentSubjectId]) gradesMap[stMatch.id][currentSubjectId] = {};

          gradesMap[stMatch.id][currentSubjectId][restKey] = Number(val);
        });
      }

      // 4c. Si grades vino como Array
      if (Array.isArray(grades) && grades.length > 0) {
        grades.forEach((g: any) => {
          const stId = g.student_id;
          const subId = g.subject_id;
          if (!stId || !subId) return;
          if (!gradesMap[stId]) gradesMap[stId] = {};
          if (!gradesMap[stId][subId]) gradesMap[stId][subId] = {};
          const sGrades = gradesMap[stId][subId];
          if (g.p1_final !== undefined) sGrades['p1'] = Number(g.p1_final);
          if (g.p2_final !== undefined) sGrades['p2'] = Number(g.p2_final);
          if (g.p3_final !== undefined) sGrades['p3'] = Number(g.p3_final);
          if (g.p4_final !== undefined) sGrades['p4'] = Number(g.p4_final);
          if (g.final_score !== undefined) sGrades['final'] = Number(g.final_score);
        });
      }

      // 5. Analizar cada curso y sus estudiantes
      const results: Array<{
        courseId: string;
        courseName: string;
        studentId: string;
        studentName: string;
        subjectId: string;
        subjectName: string;
        originalScore: number;
        weekNumber: number;
        selected: boolean;
      }> = [];

      targetCourses.forEach((cObj) => {
        const cId = cObj.id;
        const cName = `${cObj.grade || ''} ${cObj.section || ''}`.trim() || 'Curso';

        // Umbral específico: Primaria < 65, Secundaria < 70
        const lvl = (cObj.level || '').toLowerCase();
        const grd = (cObj.grade || '').toLowerCase();
        const isCoursePrimary = lvl.includes('prim') || grd.includes('prim');
        const passingThreshold = isCoursePrimary ? 65 : 70;

        // Estudiantes de este curso
        const cStudents = poolStudents.filter((s: any) => (s.course_id || s.courseId) === cId);

        // Asignaturas asociadas a este curso
        const courseAssignments = (assignments.length > 0 ? assignments : (state?.assignments || [])).filter(
          (a: any) => (a.course_id || a.courseId) === cId
        );
        let cSubjects = courseAssignments
          .map((a: any) => (subjects.length > 0 ? subjects : (state?.subjects || [])).find((s: any) => s.id === (a.subject_id || a.subjectId)))
          .filter(Boolean);

        if (cSubjects.length === 0) {
          cSubjects = (subjects.length > 0 ? subjects : (state?.subjects || [])).filter((s: any) =>
            (s.level || '').toLowerCase().includes(lvl.substring(0, 5))
          );
        }
        if (cSubjects.length === 0) {
          cSubjects = subjects.length > 0 ? subjects : (state?.subjects || []);
        }

        // Además, incluir materias que tengan notas registradas para alumnos de este curso en gradesMap
        cStudents.forEach((st: any) => {
          const stSubs = gradesMap[st.id] ? Object.keys(gradesMap[st.id]) : [];
          stSubs.forEach((subId) => {
            if (!cSubjects.some((s: any) => s.id === subId)) {
              const fSub = (subjects.length > 0 ? subjects : (state?.subjects || [])).find((s: any) => s.id === subId);
              if (fSub) cSubjects.push(fSub);
            }
          });
        });

        // Filtrar materias duplicadas o no académicas
        cSubjects = Array.from(new Map(cSubjects.map((s: any) => [s.id, s])).values()).filter(
          (s: any) => !s.name?.toLowerCase().includes('lecto') && !s.name?.toLowerCase().includes('escritura')
        );

        // 6. Evaluar cada estudiante en cada materia
        cStudents.forEach((st: any) => {
          const stName = `${st.first_surname || st.last_name || ''} ${st.names || st.first_name || ''}`.trim() || 'Estudiante';

          cSubjects.forEach((sub: any) => {
            const sGrades = gradesMap[st.id]?.[sub.id] || {};
            if (Object.keys(sGrades).length === 0) return; // No tiene calificaciones en esta materia

            const getBestGrade = (compKey: string, p: string) => {
              const pL = p.toLowerCase();
              const rawG = sGrades[`${compKey}_${pL}`];
              const rawR = sGrades[`${compKey}_r${pL}`];
              const g = (rawG !== undefined && rawG !== null && rawG !== '') ? Number(rawG) : -1;
              const r = (rawR !== undefined && rawR !== null && rawR !== '') ? Number(rawR) : -1;
              if (g === -1 && r === -1) return null;
              return Math.max(g === -1 ? 0 : g, r === -1 ? 0 : r);
            };

            let score = 0;
            let hasEvaluatedGrades = false;

            if (period === 'FINAL') {
              if (sGrades['final'] !== undefined) {
                score = Number(sGrades['final']);
                hasEvaluatedGrades = true;
              } else {
                const comps = isCoursePrimary ? ['c1', 'c2', 'c3'] : ['c1', 'c2', 'c3', 'c4'];
                let compFinals: number[] = [];
                comps.forEach((cId) => {
                  let pSum = 0;
                  let pCount = 0;
                  ['P1', 'P2', 'P3', 'P4'].forEach((p) => {
                    const best = getBestGrade(cId, p);
                    if (best !== null) {
                      pSum += best;
                      pCount++;
                    }
                  });
                  if (pCount > 0) compFinals.push(Math.round(pSum / pCount));
                });

                if (compFinals.length > 0) {
                  const finalArea = Math.round(compFinals.reduce((a, b) => a + b, 0) / compFinals.length);
                  const recGrade = sGrades['final_rec'] !== undefined ? Number(sGrades['final_rec']) : 0;
                  score = Math.max(finalArea, recGrade);
                  hasEvaluatedGrades = true;
                }
              }
            } else {
              // Período regular (P1, P2, P3, P4)
              const pL = period.toLowerCase();
              if (sGrades[pL] !== undefined) {
                score = Number(sGrades[pL]);
                hasEvaluatedGrades = true;
              } else {
                const comps = isCoursePrimary ? ['c1', 'c2', 'c3'] : ['c1', 'c2', 'c3', 'c4'];
                let compScores: number[] = [];

                comps.forEach((cId) => {
                  const best = getBestGrade(cId, period);
                  if (best !== null) compScores.push(best);
                });

                // Si no se encontraron por c1..c4 estándar, buscar claves con sufijo _pL
                if (compScores.length === 0) {
                  Object.keys(sGrades).forEach((k) => {
                    if (k.endsWith(`_${pL}`) && !k.includes('_r')) {
                      const compId = k.replace(`_${pL}`, '');
                      const best = getBestGrade(compId, period);
                      if (best !== null) compScores.push(best);
                    }
                  });
                }

                if (compScores.length > 0) {
                  score = Math.round(compScores.reduce((a, b) => a + b, 0) / compScores.length);
                  hasEvaluatedGrades = true;
                }
              }
            }

            // Comprobar umbral reprobatorio (< 65 en Primaria o < 70 en Secundaria)
            if (hasEvaluatedGrades && score < passingThreshold) {
              results.push({
                courseId: cObj.id,
                courseName: cName,
                studentId: st.id,
                studentName: stName,
                subjectId: sub.id,
                subjectName: sub.name,
                originalScore: score,
                weekNumber: 1,
                selected: true
              });
            }
          });
        });
      });

      // Ordenar por curso, estudiante y materia
      results.sort((a, b) => a.studentName.localeCompare(b.studentName));
      setCandidateEntries(results);
    } catch (err) {
      console.error('Error calculando candidatos de recuperación:', err);
      toast.error('Error al detectar candidatos de recuperación.');
    } finally {
      setIsCalculatingCandidates(false);
    }
  };

  // Recalcular candidatos al abrir creación, cambiar período, alcance o cursos seleccionados
  useEffect(() => {
    if (isOpen && isCreating) {
      const scopeLabel = targetScope === 'current' 
        ? `${course?.grade || ''} ${course?.section || ''}` 
        : `${selectedCourseIds.length} Cursos`;
      setTitle(`Plan de Recuperación ${period === 'FINAL' ? 'Final' : `Período ${period}`} - ${scopeLabel}`);
      loadAndComputeCandidates();
    }
  }, [isOpen, isCreating, period, targetScope, selectedCourseIds]);

  // Atajos para selección de cursos
  const handleSelectAllCourses = () => {
    setSelectedCourseIds(availableCourses.map((c) => c.id));
  };

  const handleSelectPrimaryCourses = () => {
    const primary = availableCourses.filter((c) => {
      const lvl = (c.level || '').toLowerCase();
      const grd = (c.grade || '').toLowerCase();
      return lvl.includes('prim') || grd.includes('prim');
    }).map((c) => c.id);
    setSelectedCourseIds(primary);
  };

  const handleSelectSecondaryCourses = () => {
    const secondary = availableCourses.filter((c) => {
      const lvl = (c.level || '').toLowerCase();
      const grd = (c.grade || '').toLowerCase();
      return lvl.includes('secun') || grd.includes('secun') || lvl.includes('media');
    }).map((c) => c.id);
    setSelectedCourseIds(secondary);
  };

  // Manejo de semanas
  const handleAddWeek = () => {
    const nextNum = weeks.length + 1;
    setWeeks((prev) => [
      ...prev,
      {
        weekNumber: nextNum,
        startDate: '',
        endDate: '',
        subjectIds: [],
        title: `Semana ${nextNum}`
      }
    ]);
  };

  const handleRemoveWeek = (weekNum: number) => {
    if (weeks.length <= 1) return;
    setWeeks((prev) => prev.filter((w) => w.weekNumber !== weekNum));
    setCandidateEntries((prev) =>
      prev.map((c) => (c.weekNumber === weekNum ? { ...c, weekNumber: 1 } : c))
    );
  };

  const handleWeekChange = (weekNumber: number, field: keyof RecoveryScheduleWeek, value: any) => {
    setWeeks((prev) =>
      prev.map((w) => (w.weekNumber === weekNumber ? { ...w, [field]: value } : w))
    );
  };

  // Agregar manualmente un alumno
  const handleManualAddStudent = () => {
    if (!manualStudentId || !manualSubjectId) {
      toast.error('Selecciona un estudiante y una materia.');
      return;
    }
    const poolStudents = (state?.students || []).concat(students || []);
    const stObj = poolStudents.find((s: any) => s.id === manualStudentId);
    const subObj = (subjects.length > 0 ? subjects : (state?.subjects || [])).find((s: any) => s.id === manualSubjectId);
    const cObj = availableCourses.find((c) => c.id === (stObj?.course_id || course?.id)) || course;

    if (!stObj || !subObj) {
      toast.error('Datos incompletos.');
      return;
    }

    const stName = `${stObj.first_surname || stObj.last_name || ''} ${stObj.names || stObj.first_name || ''}`.trim() || 'Estudiante';
    const cName = `${cObj?.grade || ''} ${cObj?.section || ''}`.trim() || 'Curso';

    setCandidateEntries((prev) => {
      const exists = prev.some((c) => c.studentId === manualStudentId && c.subjectId === manualSubjectId);
      if (exists) {
        toast.error('Este estudiante ya está en la lista para esta materia.');
        return prev;
      }
      return [
        ...prev,
        {
          courseId: cObj?.id || '',
          courseName: cName,
          studentId: manualStudentId,
          studentName: stName,
          subjectId: manualSubjectId,
          subjectName: subObj.name,
          originalScore: Number(manualScore) || 60,
          weekNumber: 1,
          selected: true
        }
      ];
    });

    toast.success(`${stName} agregado a la lista.`);
    setManualStudentId('');
    setShowManualAdd(false);
  };

  const handleSavePlan = async (status: 'draft' | 'active') => {
    if (!title.trim()) {
      toast.error('Ingresa un título para el plan.');
      return;
    }

    const selectedCandidates = candidateEntries.filter((c) => c.selected);
    if (selectedCandidates.length === 0) {
      toast.error('Selecciona al menos un estudiante y asignatura para el plan.');
      return;
    }

    // Preparar semanas
    let finalWeeks: RecoveryScheduleWeek[] = [];
    if (planMode === 'single') {
      if (!singleStartDate || !singleEndDate) {
        toast.error('Por favor ingresa las fechas de inicio y fin del plan.');
        return;
      }
      finalWeeks = [
        {
          weekNumber: 1,
          startDate: singleStartDate,
          endDate: singleEndDate,
          subjectIds: Array.from(new Set(selectedCandidates.map((c) => c.subjectId))),
          title: 'Período Completo de Recuperación'
        }
      ];
    } else {
      for (const w of weeks) {
        if (!w.startDate || !w.endDate) {
          toast.error(`Ingresa la fecha de inicio y fin para la Semana ${w.weekNumber}.`);
          return;
        }
      }
      finalWeeks = weeks.map((w) => ({
        ...w,
        subjectIds: Array.from(
          new Set(selectedCandidates.filter((c) => c.weekNumber === w.weekNumber).map((c) => c.subjectId))
        )
      }));
    }

    setLoading(true);
    try {
      // Cursos a los que se aplica el plan
      const targetCourseIds = targetScope === 'current' ? [course.id] : selectedCourseIds;

      // Crear o actualizar un plan por cada curso seleccionado
      for (const cId of targetCourseIds) {
        const cCandidates = selectedCandidates.filter((c) => c.courseId === cId);
        if (cCandidates.length === 0) continue;

        const cObj = availableCourses.find((c) => c.id === cId) || course;
        const cTitle = targetCourseIds.length > 1 
          ? `${title} (${cObj?.grade || ''} ${cObj?.section || ''})`
          : title;

        const planPayload: Partial<RecoveryPlan> = {
          center_id: centerId,
          course_id: cId,
          school_year: schoolYear,
          period,
          title: cTitle,
          description: `Plan de recuperación con ${cCandidates.length} registros reprobados.`,
          start_date: finalWeeks[0]?.startDate,
          end_date: finalWeeks[finalWeeks.length - 1]?.endDate,
          schedule_weeks: finalWeeks,
          status,
          created_by: userId
        };

        const studentsPayload: Partial<RecoveryPlanStudent>[] = cCandidates.map((c) => {
          const assignedWeek = finalWeeks.find((w) => w.weekNumber === c.weekNumber) || finalWeeks[0];
          return {
            student_id: c.studentId,
            subject_id: c.subjectId,
            original_score: c.originalScore,
            status: 'pending',
            week_number: c.weekNumber,
            start_date: assignedWeek?.startDate,
            end_date: assignedWeek?.endDate
          };
        });

        await recoveryPlanService.savePlan(planPayload, studentsPayload);
      }

      toast.success(
        status === 'active'
          ? `¡Plan de recuperación activado para ${targetCourseIds.length} curso(s)! Se sincronizó con la Agenda y las alertas para padres.`
          : `Plan guardado como borrador para ${targetCourseIds.length} curso(s).`
      );
      setIsCreating(false);
      await loadCoursePlans();
    } catch (e: any) {
      console.error('Error guardando plan masivo:', e);
      toast.error('No se pudo guardar el plan de recuperación.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-surface border border-border-main rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
        {/* ENCABEZADO */}
        <div className="p-6 sm:p-8 bg-gradient-to-r from-amber-500/10 via-brand-bg to-brand-blue/10 border-b border-border-main flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-md">
              <Award size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-text-main flex items-center gap-2">
                Plan de Recuperación Pedagógica
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                  Primaria (&lt;65) • Secundaria (&lt;70)
                </span>
              </h2>
              <p className="text-xs font-bold text-text-muted">
                {course ? `${course.grade} ${course.section}` : 'Gestión Institucional'} • Año Lectivo {schoolYear}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-brand-bg text-text-muted hover:text-text-main transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {!isCreating ? (
            /* VISTA DE PLANES EXISTENTES */
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-text-main uppercase tracking-wider">
                    Planes de Recuperación del Curso
                  </h3>
                  <p className="text-xs text-text-muted font-medium">
                    Consulta los planes activos, edítalos o crea uno nuevo para este período o para todo el centro.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="px-5 py-3 bg-brand-blue hover:bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-brand-blue/20 transition-all cursor-pointer active:scale-95"
                >
                  <Plus size={16} />
                  Crear Nuevo Plan
                </button>
              </div>

              {plans.length === 0 ? (
                <div className="p-12 text-center rounded-3xl border-2 border-dashed border-border-main space-y-3 bg-brand-bg/50">
                  <Award size={40} className="mx-auto text-amber-500/60 animate-bounce" />
                  <p className="text-sm font-bold text-text-main">No hay planes de recuperación activos</p>
                  <p className="text-xs text-text-muted max-w-md mx-auto">
                    Los planes permiten organizar a los estudiantes que no alcanzaron el puntaje mínimo (Primaria &lt;65, Secundaria &lt;70) en semanas de evaluación y tareas específicas.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plans.map((p) => (
                    <div
                      key={p.id}
                      className="p-5 rounded-2xl bg-brand-bg border border-border-main space-y-3 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600">
                          Período {p.period}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                            p.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-600'
                              : 'bg-slate-500/15 text-slate-500'
                          }`}
                        >
                          {p.status === 'active' ? '● Activo en Calendario' : '○ Borrador'}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-text-main">{p.title}</h4>
                      <p className="text-xs text-text-muted line-clamp-2">{p.description}</p>
                      
                      <div className="pt-2 border-t border-border-main flex items-center justify-between text-[11px] font-bold text-text-muted">
                        <span>{p.schedule_weeks?.length || 1} Semana(s) programada(s)</span>
                        {p.start_date && (
                          <span className="text-indigo-600 font-mono">
                            {p.start_date} al {p.end_date}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* FORMULARIO DE CREACIÓN DE PLAN */
            <div className="space-y-6">
              {/* SELECTOR DE ALCANCE: SOLO ESTE CURSO O MÚLTIPLES CURSOS */}
              <div className="p-4 bg-gradient-to-r from-indigo-50/80 via-surface to-blue-50/80 dark:from-slate-900/60 dark:via-slate-800/40 dark:to-slate-900/60 rounded-2xl border border-indigo-200/60 dark:border-indigo-900/40 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                      <Building2 size={14} />
                      Alcance del Plan de Recuperación
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-text-main">
                      ¿Deseas aplicar este plan solo a este curso o masivamente a varios cursos?
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5 bg-surface p-1 rounded-xl border border-border-main">
                    <button
                      type="button"
                      onClick={() => setTargetScope('current')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        targetScope === 'current' ? 'bg-indigo-600 text-white shadow-sm' : 'text-text-muted'
                      }`}
                    >
                      Solo {course?.grade || 'Este Curso'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetScope('multi');
                        if (selectedCourseIds.length === 0 && course?.id) {
                          setSelectedCourseIds([course.id]);
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        targetScope === 'multi' ? 'bg-indigo-600 text-white shadow-sm' : 'text-text-muted'
                      }`}
                    >
                      Múltiples Cursos
                    </button>
                  </div>
                </div>

                {targetScope === 'multi' && (
                  <div className="pt-2 border-t border-indigo-100 dark:border-indigo-900/60 space-y-2.5 animate-in fade-in duration-150">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-text-muted">
                        Selecciona los cursos que incluirán este plan ({selectedCourseIds.length} seleccionados):
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleSelectAllCourses}
                          className="px-2 py-1 rounded-lg bg-surface hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold text-indigo-600 border border-border-main cursor-pointer"
                        >
                          Todo el Centro
                        </button>
                        <button
                          type="button"
                          onClick={handleSelectPrimaryCourses}
                          className="px-2 py-1 rounded-lg bg-surface hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold text-indigo-600 border border-border-main cursor-pointer"
                        >
                          Toda Primaria
                        </button>
                        <button
                          type="button"
                          onClick={handleSelectSecondaryCourses}
                          className="px-2 py-1 rounded-lg bg-surface hover:bg-slate-200 dark:hover:bg-slate-700 text-[10px] font-bold text-indigo-600 border border-border-main cursor-pointer"
                        >
                          Toda Secundaria
                        </button>
                      </div>
                    </div>

                    <div className="max-h-36 overflow-y-auto p-2 bg-surface rounded-xl border border-border-main flex flex-wrap gap-1.5 custom-scrollbar">
                      {availableCourses.map((c) => {
                        const isChecked = selectedCourseIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCourseIds((prev) =>
                                isChecked ? prev.filter((id) => id !== c.id) : [...prev, c.id]
                              );
                            }}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                              isChecked
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-brand-bg text-text-muted border-border-main hover:text-text-main'
                            }`}
                          >
                            {isChecked ? <CheckSquare size={13} /> : <Square size={13} />}
                            <span>{c.grade} "{c.section}"</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* PASO 1: METADATOS BÁSICOS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Período a Recuperar
                  </label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-brand-bg border border-border-main rounded-xl text-xs font-bold text-text-main outline-none focus:ring-2 focus:ring-brand-blue"
                  >
                    <option value="P1">Período 1 (P1)</option>
                    <option value="P2">Período 2 (P2)</option>
                    <option value="P3">Período 3 (P3)</option>
                    <option value="P4">Período 4 (P4)</option>
                    <option value="FINAL">Fin de Año (Calificación Final)</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Título del Plan
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej. Plan de Recuperación Pedagógica P1"
                    className="w-full px-3.5 py-2.5 bg-brand-bg border border-border-main rounded-xl text-xs font-bold text-text-main outline-none focus:ring-2 focus:ring-brand-blue"
                  />
                </div>
              </div>

              {/* PASO 2: ESTRUCTURA DEL CALENDARIO (ÚNICO O POR SEMANAS) */}
              <div className="p-5 rounded-2xl bg-brand-bg border border-border-main space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-text-main flex items-center gap-2">
                      <Calendar size={14} className="text-amber-500" />
                      Cronograma y Fechas en el Calendario
                    </h4>
                    <p className="text-[11px] text-text-muted font-medium">
                      Define si las materias se recuperan en un único rango de fechas o escalonadas por semanas.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border-main">
                    <button
                      type="button"
                      onClick={() => setPlanMode('single')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        planMode === 'single' ? 'bg-brand-blue text-white shadow-sm' : 'text-text-muted'
                      }`}
                    >
                      Rango Único
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanMode('weekly')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        planMode === 'weekly' ? 'bg-brand-blue text-white shadow-sm' : 'text-text-muted'
                      }`}
                    >
                      Por Semanas
                    </button>
                  </div>
                </div>

                {planMode === 'single' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-text-muted">Fecha de Inicio</label>
                      <input
                        type="date"
                        value={singleStartDate}
                        onChange={(e) => setSingleStartDate(e.target.value)}
                        className="w-full px-3 py-2 bg-surface border border-border-main rounded-xl text-xs font-bold text-text-main outline-none focus:ring-2 focus:ring-brand-blue"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-text-muted">Fecha de Fin</label>
                      <input
                        type="date"
                        value={singleEndDate}
                        onChange={(e) => setSingleEndDate(e.target.value)}
                        className="w-full px-3 py-2 bg-surface border border-border-main rounded-xl text-xs font-bold text-text-main outline-none focus:ring-2 focus:ring-brand-blue"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    {weeks.map((w) => (
                      <div
                        key={w.weekNumber}
                        className="p-3.5 bg-surface rounded-xl border border-border-main flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-600 font-black text-xs flex items-center justify-center shrink-0">
                            {w.weekNumber}
                          </span>
                          <input
                            type="text"
                            placeholder={`Nombre (ej: Matemática y Sociales)`}
                            value={w.title || `Semana ${w.weekNumber}`}
                            onChange={(e) =>
                              setWeeks((prev) =>
                                prev.map((item) =>
                                  item.weekNumber === w.weekNumber ? { ...item, title: e.target.value } : item
                                )
                              )
                            }
                            className="px-2.5 py-1.5 bg-brand-bg border border-border-main rounded-lg text-xs font-bold text-text-main outline-none w-48 sm:w-56"
                          />
                        </div>

                        <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                          <input
                            type="date"
                            value={w.startDate}
                            onChange={(e) =>
                              setWeeks((prev) =>
                                prev.map((item) =>
                                  item.weekNumber === w.weekNumber ? { ...item, startDate: e.target.value } : item
                                )
                              )
                            }
                            className="w-full px-2.5 py-1.5 bg-brand-bg border border-border-main rounded-lg text-xs font-bold text-text-main outline-none"
                          />
                          <span className="text-text-muted text-xs">al</span>
                          <input
                            type="date"
                            value={w.endDate}
                            onChange={(e) =>
                              setWeeks((prev) =>
                                prev.map((item) =>
                                  item.weekNumber === w.weekNumber ? { ...item, endDate: e.target.value } : item
                                )
                              )
                            }
                            className="w-full px-2.5 py-1.5 bg-brand-bg border border-border-main rounded-lg text-xs font-bold text-text-main outline-none"
                          />
                        </div>

                        {weeks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveWeek(w.weekNumber)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAddWeek}
                      className="text-xs font-black uppercase text-brand-blue hover:text-blue-600 flex items-center gap-1.5 pt-1 cursor-pointer"
                    >
                      <Plus size={14} /> Agregar otra semana de evaluación
                    </button>
                  </div>
                )}
              </div>

              {/* PASO 3: ESTUDIANTES Y ASIGNATURAS DETECTADAS */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-text-main flex items-center gap-2">
                      <Users size={14} className="text-indigo-500" />
                      Alumnos Detectados por Debajo del Umbral ({candidateEntries.length})
                    </h4>
                    <p className="text-[11px] text-text-muted font-medium">
                      Alumnos de Primaria (&lt;65) y Secundaria (&lt;70) en {period}. Asigna a qué semana le corresponde evaluarse.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => loadAndComputeCandidates()}
                      disabled={isCalculatingCandidates}
                      className="px-3 py-1.5 rounded-xl border border-border-main bg-surface hover:bg-brand-bg text-[10px] font-black uppercase tracking-wider text-text-muted hover:text-text-main transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Volver a escanear calificaciones desde el registro"
                    >
                      <RefreshCw size={12} className={isCalculatingCandidates ? 'animate-spin text-amber-500' : ''} />
                      Re-escanear
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowManualAdd(!showManualAdd)}
                      className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-300 transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <UserPlus size={12} />
                      {showManualAdd ? 'Cancelar' : 'Agregar Manual'}
                    </button>
                  </div>
                </div>

                {/* FORMULARIO AGREGAR MANUALMENTE */}
                {showManualAdd && (
                  <div className="p-4 bg-indigo-50/50 dark:bg-slate-900/50 rounded-2xl border border-indigo-200 dark:border-indigo-900/40 space-y-3 animate-in fade-in duration-150">
                    <h5 className="text-[11px] font-black uppercase text-indigo-700 dark:text-indigo-300">
                      ➕ Agregar estudiante manualmente al plan de recuperación
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-text-muted block mb-1">Estudiante</label>
                        <select
                          value={manualStudentId}
                          onChange={(e) => setManualStudentId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-surface border border-border-main rounded-lg text-xs font-bold text-text-main outline-none"
                        >
                          <option value="">Seleccione estudiante...</option>
                          {(state?.students || students || [])
                            .filter((s: any) => targetScope === 'current' ? (s.course_id === course?.id || s.courseId === course?.id) : selectedCourseIds.includes(s.course_id || s.courseId))
                            .map((s: any) => (
                              <option key={s.id} value={s.id}>
                                {s.first_surname || s.last_name || ''} {s.names || s.first_name || ''}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-text-muted block mb-1">Asignatura</label>
                        <select
                          value={manualSubjectId}
                          onChange={(e) => setManualSubjectId(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-surface border border-border-main rounded-lg text-xs font-bold text-text-main outline-none"
                        >
                          <option value="">Seleccione asignatura...</option>
                          {(subjects.length > 0 ? subjects : (state?.subjects || [])).map((sub: any) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-text-muted block mb-1">Calificación Inicial</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={manualScore}
                            onChange={(e) => setManualScore(Number(e.target.value))}
                            className="w-20 px-2.5 py-1.5 bg-surface border border-border-main rounded-lg text-xs font-bold text-text-main outline-none"
                          />
                          <button
                            type="button"
                            onClick={handleManualAddStudent}
                            className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-black uppercase cursor-pointer"
                          >
                            Agregar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ACCIONES DE SELECCIÓN MASIVA */}
                {candidateEntries.length > 0 && !isCalculatingCandidates && (
                  <div className="flex items-center justify-between text-[11px] font-bold text-text-muted px-1">
                    <span>
                      {candidateEntries.filter((c) => c.selected).length} de {candidateEntries.length} alumnos seleccionados
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setCandidateEntries((prev) => prev.map((c) => ({ ...c, selected: true })))}
                        className="text-indigo-600 hover:underline cursor-pointer"
                      >
                        Seleccionar todos
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setCandidateEntries((prev) => prev.map((c) => ({ ...c, selected: false })))}
                        className="text-text-muted hover:underline cursor-pointer"
                      >
                        Deseleccionar todos
                      </button>
                    </div>
                  </div>
                )}

                {isCalculatingCandidates ? (
                  <div className="p-8 text-center rounded-2xl bg-brand-bg border border-border-main text-xs font-bold text-amber-600 space-y-2">
                    <Loader2 size={24} className="mx-auto text-amber-500 animate-spin" />
                    <p>Consultando calificaciones y analizando estudiantes reprobados para {period}...</p>
                    <p className="text-[10px] text-text-muted font-normal">
                      Verificando asignaturas y promedios por debajo de 65 (Primaria) y 70 (Secundaria)...
                    </p>
                  </div>
                ) : candidateEntries.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl bg-brand-bg border border-border-main text-xs font-bold text-emerald-600 space-y-2">
                    <CheckCircle2 size={24} className="mx-auto text-emerald-500" />
                    <p>¡Excelente! No se detectaron estudiantes por debajo del umbral mínimo en los cursos seleccionados para {period}.</p>
                    <p className="text-[10px] text-text-muted font-normal">
                      Si necesitas agregar a un estudiante puntualmente, usa el botón "Agregar Manual" arriba.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Botones de asignación masiva de materias a semanas */}
                    {planMode === 'weekly' && weeks.length > 1 && (
                      <div className="p-3 bg-brand-bg rounded-xl border border-border-main flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase text-text-muted">
                          ⚡ Asignación rápida por materia:
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {Array.from(new Set(candidateEntries.map((c) => c.subjectName))).map((sName) => (
                            <div key={sName} className="flex items-center gap-1 bg-surface px-2 py-1 rounded-lg border border-border-main text-[10px]">
                              <span className="font-bold text-text-main">{sName}</span>
                              <span className="text-text-muted">➜</span>
                              <select
                                onChange={(e) => {
                                  const targetW = Number(e.target.value);
                                  setCandidateEntries((prev) =>
                                    prev.map((item) =>
                                      item.subjectName === sName ? { ...item, weekNumber: targetW } : item
                                    )
                                  );
                                }}
                                className="bg-transparent font-black text-indigo-600 outline-none cursor-pointer"
                              >
                                {weeks.map((w) => (
                                  <option key={w.weekNumber} value={w.weekNumber}>
                                    Semana {w.weekNumber}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border border-border-main rounded-2xl overflow-hidden">
                      <div className="max-h-60 overflow-y-auto custom-scrollbar divide-y divide-border-main">
                        {candidateEntries.map((c, idx) => (
                        <div
                          key={`${c.courseId}_${c.studentId}_${c.subjectId}`}
                          className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface hover:bg-brand-bg/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={c.selected}
                              onChange={(e) =>
                                setCandidateEntries((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, selected: e.target.checked } : item
                                  )
                                )
                              }
                              className="w-4 h-4 rounded text-brand-blue cursor-pointer"
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-bold text-text-main">{c.studentName}</p>
                                {targetScope === 'multi' && (
                                  <span className="text-[9px] font-black uppercase px-2 py-0.2 rounded bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300">
                                    {c.courseName}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-text-muted font-medium">
                                {c.subjectName} • Calificación:{' '}
                                <span className="text-rose-500 font-bold">{c.originalScore} pts</span>
                              </p>
                            </div>
                          </div>

                          {planMode === 'weekly' && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-text-muted uppercase">Semana:</span>
                              <select
                                value={c.weekNumber}
                                onChange={(e) =>
                                  setCandidateEntries((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, weekNumber: Number(e.target.value) } : item
                                    )
                                  )
                                }
                                className="px-2 py-1 bg-brand-bg border border-border-main rounded-lg text-xs font-bold text-text-main outline-none cursor-pointer max-w-[200px]"
                              >
                                {weeks.map((w) => (
                                  <option key={w.weekNumber} value={w.weekNumber}>
                                    {w.title || `Semana ${w.weekNumber}`}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* BOTONES DE ACCIÓN */}
              <div className="pt-4 border-t border-border-main flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2.5 rounded-xl border border-border-main text-xs font-bold text-text-muted hover:text-text-main transition-colors cursor-pointer"
                >
                  Volver a Lista de Planes
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSavePlan('draft')}
                    className="px-4 py-2.5 rounded-xl border border-border-main bg-surface hover:bg-brand-bg text-xs font-black uppercase text-text-main transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Guardar Borrador
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSavePlan('active')}
                    className="px-5 py-2.5 bg-brand-blue hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-brand-blue/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Send size={15} />
                    Activar y Sincronizar Calendario
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
