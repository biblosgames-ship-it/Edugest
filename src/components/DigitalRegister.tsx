/** VERSION 41.0 - FIX TOTAL DE REFERENCIAS (config.periods) **/
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import {
  Save,
  CheckCircle2,
  Loader2,
  BarChart3,
  Edit3,
  AlertCircle,
  Calendar,
  Printer,
  FileText,
  X,
  ScrollText,
  Lock,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CloudOff
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useGrades } from '../hooks/useGrades';
import { useStudents } from '../hooks/useStudents';
import { useCourses } from '../hooks/useCourses';
import { useSubjects } from '../hooks/useSubjects';
import { useAssignments } from '../hooks/useAssignments';
import { useTeacherIdentity } from '../utils/teacherUtils';
import { sortStudents, getStudentOrderNumber } from '../utils/studentSorter';
import { getReportTanda } from '../utils/courseSorter';

export const DigitalRegister = ({ onViewChange }: { onViewChange?: (view: string) => void }) => {
  const { state, profile, selectedYear, center } = useApp();
  const { isSameTeacher } = useTeacherIdentity();

  const currentTeacherRecord = useMemo(() => {
    if (
      (profile?.role === 'teacher' || profile?.role === 'management_teacher') &&
      profile?.teacher_id
    ) {
      return (state.teachers || []).find((t: any) => isSameTeacher(t.id, profile.teacher_id) || t.id === profile.teacher_id);
    }
    return null;
  }, [profile, state.teachers, isSameTeacher]);

  const isEditable = useMemo(() => {
    if (profile?.role === 'teacher' || profile?.role === 'management_teacher') {
      if (!profile?.teacher_id || !currentTeacherRecord) return false;
      return currentTeacherRecord.grades_editable !== false;
    }
    return true;
  }, [profile, currentTeacherRecord]);
  const { courses: allCourses } = useCourses();
  const { subjects: allSubjects } = useSubjects();
  const { assignments: allAssignments } = useAssignments();
  const { students: allStudents, isLoading: studentsLoading } = useStudents();

  const [selectedLevel, setSelectedLevel] = useState<string>('Todos');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'grades' | 'results'>('grades');
  const {
    grades: loadedGrades,
    isLoading: gradesLoading,
    isSaving,
    saveGrades,
    saveStatus
  } = useGrades(selectedCourseId, selectedSubjectId);
  const [localGrades, setLocalGrades] = useState<Record<string, any>>({});
  const [showSaveStatus, setShowSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [syncState, setSyncState] = useState<'synced' | 'local_saved' | 'saving' | 'offline_queued'>('synced');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [hideStudentNames, setHideStudentNames] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const [focusedStudentId, setFocusedStudentId] = useState<string | null>(null);

  // Advertir al docente si intenta cerrar la ventana o recargar sin haber guardado
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleHorizontalScroll = (direction: 'left' | 'right') => {
    if (!tableScrollRef.current) return;
    const scrollAmount = 360;
    tableScrollRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  // Estados para el resumen de notas consolidado (Boletín del alumno)
  const [selectedSummaryStudent, setSelectedSummaryStudent] = useState<any | null>(null);
  const [studentSummaryGrades, setStudentSummaryGrades] = useState<
    Record<string, Record<string, any>>
  >({});
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(false);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState<boolean>(false);
  const [summaryPeriodDivisor, setSummaryPeriodDivisor] = useState<number>(4);

  const levels = ['Todos', 'Inicial', 'Primario', 'Secundario'];

  const selectedCourse = (allCourses || []).find((c: any) => c.id === selectedCourseId);
  const selectedSubject = (allSubjects || []).find((s: any) => s.id === selectedSubjectId);

  const isSecundario = useMemo(() => {
    return selectedCourse?.level?.toLowerCase().includes('secund');
  }, [selectedCourse]);

  const minPassingGrade = isSecundario ? 70 : 65;

  const config = useMemo(
    () => ({
      year: selectedYear || '2026-2027',
      periods: ['P1', 'P2', 'P3', 'P4'],
      competencies: isSecundario
        ? [
            {
              id: 'c2',
              short: 'C1',
              name: 'Competencia Comunicativa',
              color: 'bg-emerald-100/40',
              rColor: 'bg-emerald-50/20'
            },
            {
              id: 'c3',
              short: 'C2',
              name: 'Competencia de Pensamiento Lógico, Creativo y Crítico',
              color: 'bg-amber-100/40',
              rColor: 'bg-amber-50/20'
            },
            {
              id: 'c1',
              short: 'C3',
              name: 'Competencia Ética y Ciudadana',
              color: 'bg-indigo-100/40',
              rColor: 'bg-indigo-50/20'
            },
            {
              id: 'c4',
              short: 'C4',
              name: 'Competencia Científica y Tecnológica',
              color: 'bg-rose-100/40',
              rColor: 'bg-rose-50/20'
            }
          ]
        : [
            {
              id: 'c1',
              short: 'C1',
              name: 'Comunicativa',
              color: 'bg-indigo-100/40',
              rColor: 'bg-indigo-50/20'
            },
            {
              id: 'c2',
              short: 'C2',
              name: 'Pensamiento Lógico, Creativo y Crítico; Resolución de Problemas; Científica y Tecnológica',
              color: 'bg-emerald-100/40',
              rColor: 'bg-emerald-50/20'
            },
            {
              id: 'c3',
              short: 'C3',
              name: 'Ética y Ciudadana; Desarrollo Personal y Espiritual; Ambiental y de la Salud',
              color: 'bg-amber-100/40',
              rColor: 'bg-emerald-50/20'
            }
          ]
    }),
    [selectedYear, isSecundario]
  );

  const filteredCourses = useMemo(() => {
    let baseCourses = allCourses || [];

    // Si el rol es docente, filtrar estrictamente solo sus cursos asignados
    if (profile?.role === 'teacher') {
      if (!profile?.teacher_id) {
        return [];
      }
      const assignedCourseIds = new Set(
        (allAssignments || [])
          .filter((a: any) => isSameTeacher(a.teacher_id || a.teacherId, profile.teacher_id) || (a.teacher_id || a.teacherId) === profile.teacher_id)
          .map((a: any) => a.course_id || a.courseId)
      );
      baseCourses = baseCourses.filter((c: any) => assignedCourseIds.has(c.id));
    }

    return baseCourses.filter(
      (c: any) =>
        selectedLevel === 'Todos' ||
        (c.level && c.level.toLowerCase().includes(selectedLevel.toLowerCase().substring(0, 5)))
    );
  }, [allCourses, selectedLevel, profile, allAssignments, isSameTeacher]);

  const courseSubjects = useMemo(() => {
    if (!selectedCourseId) return [];

    // Si el rol es docente, filtrar estrictamente solo sus asignaturas asignadas en este curso
    if (profile?.role === 'teacher') {
      if (!profile?.teacher_id) {
        return [];
      }
      const rawTeacherSubs = (allAssignments || [])
        .filter(
          (a: any) =>
            (isSameTeacher(a.teacher_id || a.teacherId, profile.teacher_id) || (a.teacher_id || a.teacherId) === profile.teacher_id) &&
            (a.course_id || a.courseId) === selectedCourseId
        )
        .map((a: any) =>
          (allSubjects || []).find((s: any) => s.id === (a.subject_id || a.subjectId))
        )
        .filter(Boolean);
      return Array.from(new Map(rawTeacherSubs.map((s: any) => [s.id, s])).values());
    }

    let subs = (allAssignments || [])
      .filter((a: any) => a.course_id === selectedCourseId)
      .map((a: any) => (allSubjects || []).find((s: any) => s.id === a.subject_id))
      .filter(Boolean);
    if (subs.length === 0 && selectedCourse) {
      const cLvl = (selectedCourse.level || '').toLowerCase();
      subs = (allSubjects || []).filter((s: any) =>
        (s.level || '').toLowerCase().includes(cLvl.substring(0, 5))
      );
    }
    if (subs.length === 0) subs = allSubjects || [];

    // Deduplicar materias por ID único
    const uniqueSubs = Array.from(new Map(subs.map((s: any) => [s.id, s])).values());

    return [...uniqueSubs]
      .filter(
        (s) =>
          !s.name.toLowerCase().includes('lecto') && !s.name.toLowerCase().includes('escritura')
      )
      .sort((a, b) => {
        const getIdx = (n: string) => {
          const name = n.toLowerCase();
          if (name.includes('lengua')) return 0;
          if (name.includes('matemática')) return 1;
          if (name.includes('sociales')) return 2;
          if (name.includes('natura')) return 3;
          if (name.includes('física')) return 4;
          if (name.includes('fihr')) return 5;
          if (name.includes('artística')) return 6;
          return 99;
        };
        return getIdx(a.name) - getIdx(b.name);
      });
  }, [selectedCourseId, allAssignments, allSubjects, selectedCourse, profile, isSameTeacher]);

  const allCourseSubjects = useMemo(() => {
    if (!selectedCourseId) return [];
    let subs = (allAssignments || [])
      .filter((a: any) => a.course_id === selectedCourseId)
      .map((a: any) => (allSubjects || []).find((s: any) => s.id === a.subject_id))
      .filter(Boolean);
    if (subs.length === 0 && selectedCourse) {
      const cLvl = (selectedCourse.level || '').toLowerCase();
      subs = (allSubjects || []).filter((s: any) =>
        (s.level || '').toLowerCase().includes(cLvl.substring(0, 5))
      );
    }
    if (subs.length === 0) subs = allSubjects || [];

    // Deduplicar materias por ID único
    const uniqueSubs = Array.from(new Map(subs.map((s: any) => [s.id, s])).values());

    return [...uniqueSubs]
      .filter(
        (s) =>
          !s.name.toLowerCase().includes('lecto') && !s.name.toLowerCase().includes('escritura')
      )
      .sort((a, b) => {
        const getIdx = (n: string) => {
          const name = n.toLowerCase();
          if (name.includes('lengua')) return 0;
          if (name.includes('matemática')) return 1;
          if (name.includes('sociales')) return 2;
          if (name.includes('natura')) return 3;
          if (name.includes('física')) return 4;
          if (name.includes('fihr')) return 5;
          if (name.includes('artística')) return 6;
          return 99;
        };
        return getIdx(a.name) - getIdx(b.name);
      });
  }, [selectedCourseId, allAssignments, allSubjects, selectedCourse]);

  const students = useMemo(() => {
    if (!selectedCourseId) return [];
    const list = (allStudents || []).filter(
      (s) => s.course_id === selectedCourseId || s.courseId === selectedCourseId
    );
    return sortStudents(list);
  }, [allStudents, selectedCourseId]);

  // Clave de persistencia local inmediata celda por celda (Local-First 0ms)
  const localDraftKey = useMemo(() => {
    const cid = profile?.center_id || center?.id || 'nocid';
    const yr = selectedYear || '2026-2027';
    if (!selectedCourseId || !selectedSubjectId) return null;
    return `edugens_grade_draft_${cid}_${yr}_${selectedCourseId}_${selectedSubjectId}`;
  }, [profile?.center_id, center?.id, selectedYear, selectedCourseId, selectedSubjectId]);

  // Sincronizar notas de la caché y borrador local al estado para edición evitando pérdida de datos
  const currentScopeRef = useRef<string>('');
  const activeScope = `${selectedCourseId}_${selectedSubjectId}`;

  useEffect(() => {
    let draftData: Record<string, any> = {};
    if (localDraftKey) {
      try {
        const raw = localStorage.getItem(localDraftKey);
        if (raw) draftData = JSON.parse(raw);
      } catch {}
    }

    if (currentScopeRef.current !== activeScope) {
      currentScopeRef.current = activeScope;
      const initial = { ...(loadedGrades || {}), ...draftData };
      setLocalGrades(initial);
      const hasDraft = Object.keys(draftData).length > 0;
      setHasUnsavedChanges(hasDraft);
      setSyncState(hasDraft ? 'local_saved' : 'synced');
      return;
    }
    setLocalGrades((prev) => {
      // Mantener las notas locales ya digitadas y rellenar las no editadas desde la caché o borrador
      return { ...(loadedGrades || {}), ...draftData, ...prev };
    });
  }, [loadedGrades, activeScope, localDraftKey]);

  const grades = localGrades;

  const handleGradeChange = (studentId: string, key: string, value: string) => {
    if (value !== '') {
      if (!/^\d+$/.test(value)) return;
      if (parseInt(value) > 100) return;
    }
    setLocalGrades((prev) => {
      const updated = { ...prev, [`${studentId}_${key}`]: value };
      // Guardado inmediato en el disco del dispositivo (0ms sin depender de internet)
      if (localDraftKey) {
        try {
          localStorage.setItem(localDraftKey, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
    setHasUnsavedChanges(true);
    setSyncState('local_saved');
    setLastSavedTime(new Date());
  };

  const getBestGrade = (studentId: string, cId: string, p: string) => {
    const pL = p.toLowerCase();
    const g = parseInt(grades[`${studentId}_${cId}_${pL}`]) || 0;
    const r = parseInt(grades[`${studentId}_${cId}_r${pL}`]) || 0;
    return Math.max(g, r);
  };

  const calculateCompAvg = (studentId: string, cId: string) => {
    const sum = config.periods.reduce((acc, p) => acc + getBestGrade(studentId, cId, p), 0);
    return sum > 0 ? sum / 4 : 0;
  };

  const calculateAreaFinal = (studentId: string) => {
    if (!config.competencies || config.competencies.length === 0) return 0;
    const sum = config.competencies.reduce((acc, c) => acc + calculateCompAvg(studentId, c.id), 0);
    return Math.round(sum / config.competencies.length);
  };

  // Importar promedios de Mi Aula bajo demanda (desde LocalStorage y Supabase)
  const handleImportFromMiAula = async () => {
    if (!selectedCourseId || !selectedSubjectId) {
      alert('Seleccione un curso y asignatura primero.');
      return;
    }
    const centerId = profile?.center_id || center?.id || 'default_center';
    const year = selectedYear || '2026-2027';
    const teacherId = profile?.teacher_id || profile?.id || 'default_teacher';

    let importedCount = 0;
    const newGrades = { ...localGrades };

    for (const p of config.periods) {
      const pL = p.toLowerCase();
      let scores: any = null;
      let activities: any = null;
      let calcMode: string = 'average';

      // 1. Probar lectura desde localStorage con claves flexibles
      const scopeKeysToTry = [
        `edugens_partials_${centerId}_${year}_${teacherId}_${selectedCourseId}_${selectedSubjectId}_${p}`,
        profile?.id ? `edugens_partials_${centerId}_${year}_${profile.id}_${selectedCourseId}_${selectedSubjectId}_${p}` : '',
        profile?.teacher_id ? `edugens_partials_${centerId}_${year}_${profile.teacher_id}_${selectedCourseId}_${selectedSubjectId}_${p}` : '',
        `edugens_partials_${centerId}_${year}_default_teacher_${selectedCourseId}_${selectedSubjectId}_${p}`
      ].filter(Boolean);

      for (const key of scopeKeysToTry) {
        const localSaved = localStorage.getItem(key);
        if (localSaved) {
          try {
            const parsed = JSON.parse(localSaved);
            if (parsed && parsed.scores && parsed.activities) {
              scores = parsed.scores;
              activities = parsed.activities;
              calcMode = parsed.calcMode || 'average';
              break;
            }
          } catch {}
        }
      }

      // Si no está por clave directa, buscar por coincidencia de curso_asignatura_periodo en localStorage
      if (!scores) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && k.startsWith('edugens_partials_') && k.endsWith(`_${selectedCourseId}_${selectedSubjectId}_${p}`)) {
            const val = localStorage.getItem(k);
            if (val) {
              try {
                const parsed = JSON.parse(val);
                if (parsed && parsed.scores && parsed.activities) {
                  scores = parsed.scores;
                  activities = parsed.activities;
                  calcMode = parsed.calcMode || 'average';
                  break;
                }
              } catch {}
            }
          }
        }
      }

      // 2. Si no hay datos en localStorage para este período, consultar Supabase en la nube
      if (!scores) {
        try {
          let query = supabase
            .from('student_partial_activities')
            .select('*')
            .eq('course_id', selectedCourseId)
            .eq('subject_id', selectedSubjectId)
            .eq('period', p)
            .eq('school_year', year)
            .order('updated_at', { ascending: false })
            .limit(1);

          if (centerId && centerId !== 'default_center') {
            query = query.eq('center_id', centerId);
          }

          const { data, error } = await query;
          if (!error && data && data.length > 0 && data[0].scores) {
            scores = data[0].scores.scores;
            activities = data[0].scores.activities;
            calcMode = data[0].scores.calcMode || 'average';
          }
        } catch (cloudErr) {
          console.warn(`Error al consultar nube para período ${p}:`, cloudErr);
        }
      }

      // 3. Procesar cálculo de notas
      if (scores && activities) {
        students.forEach((student: any) => {
          const studentScores = scores[student.id] || {};

          config.competencies.forEach((comp) => {
            const compActs = activities[comp.id] || [];
            const validVals = compActs
              .map((act: any) => studentScores[act.id])
              .filter((v: any) => typeof v === 'number' && !isNaN(v));

            if (validVals.length > 0) {
              let compScore = 0;
              if (calcMode === 'sum') {
                compScore = Math.min(100, Math.round(validVals.reduce((a: number, b: number) => a + b, 0)));
              } else {
                compScore = Math.round(validVals.reduce((a: number, b: number) => a + b, 0) / validVals.length);
              }
              newGrades[`${student.id}_${comp.id}_${pL}`] = String(compScore);
              importedCount++;
            }
          });
        });
      }
    }

    if (importedCount > 0) {
      setLocalGrades(newGrades);
      setHasUnsavedChanges(true);
      setShowSaveStatus('success');
      setTimeout(() => setShowSaveStatus('idle'), 3000);
      alert(`¡Se han importado exitosamente ${importedCount} notas desde Mi Aula (nube y local)! Recuerda pulsar "GUARDAR".`);
    } else {
      alert('No se encontraron parciales registrados en Mi Aula para este curso, asignatura y docente.');
    }
  };

  // Auto-guardado en segundo plano (Debounce de 2.5 segundos tras terminar de escribir)
  useEffect(() => {
    if (!hasUnsavedChanges || isSaving || !selectedCourseId || !selectedSubjectId) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      triggerSave(true);
    }, 2500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [localGrades, hasUnsavedChanges, isSaving, selectedCourseId, selectedSubjectId]);

  const triggerSave = async (
    isSilent = false,
    overrideCourseId?: string,
    overrideSubjectId?: string,
    overrideStudents?: any[]
  ) => {
    const targetCourseId = overrideCourseId || selectedCourseId;
    const targetSubjectId = overrideSubjectId || selectedSubjectId;
    const targetStudents = overrideStudents || students;
    if (!targetCourseId || !targetSubjectId || isSaving) return;
    try {
      if (isSilent) setSyncState('saving');
      const updates = [];
      const cid = profile?.center_id || center?.id;
      if (!cid) {
        if (!isSilent) alert('Error: No se encontró el centro escolar asociado a su perfil.');
        return;
      }
      for (const student of targetStudents) {
        for (const p of config.periods) {
          const pL = p.toLowerCase();
          config.competencies.forEach((c) => {
            const val = grades[`${student.id}_${c.id}_${pL}`];
            const rVal = grades[`${student.id}_${c.id}_r${pL}`];

            if (val !== undefined || rVal !== undefined) {
              const gradeVal = val !== '' && val !== undefined ? parseInt(val) : null;
              const recVal = rVal !== '' && rVal !== undefined ? parseInt(rVal) : null;

              updates.push({
                student_id: student.id,
                course_id: targetCourseId,
                subject_id: targetSubjectId,
                period: p,
                competency_id: c.id,
                grade: gradeVal,
                rp1: p === 'P1' ? recVal : null,
                rp2: p === 'P2' ? recVal : null,
                rp3: p === 'P3' ? recVal : null,
                rp4: p === 'P4' ? recVal : null,
                center_id: cid,
                school_year: config.year
              });
            }
          });
        }
        // Guardar Recuperaciones de Secundaria
        if (isSecundario) {
          ['comp', 'extra', 'esp1', 'esp2'].forEach((stage) => {
            const val = grades[`${student.id}_${stage}`];
            if (val !== undefined) {
              updates.push({
                student_id: student.id,
                course_id: targetCourseId,
                subject_id: targetSubjectId,
                period: stage.toUpperCase(),
                competency_id: 'sec',
                grade: val !== '' ? parseInt(val) : null,
                center_id: cid,
                school_year: config.year
              });
            }
          });
        }

        const fRec = grades[`${student.id}_final_rec`];
        if (fRec !== undefined) {
          updates.push({
            student_id: student.id,
            course_id: targetCourseId,
            subject_id: targetSubjectId,
            period: 'FINAL',
            competency_id: 'rec',
            grade: null,
            recovery_grade: fRec !== '' && fRec !== undefined ? parseInt(fRec) : null,
            center_id: cid,
            school_year: config.year
          });
        }
      }

      // 1. Guardar de inmediato en el disco del equipo (Local-First)
      if (localDraftKey) {
        try {
          localStorage.setItem(localDraftKey, JSON.stringify(grades));
        } catch {}
      }

      // 2. Enviar a Supabase
      if (updates.length > 0) {
        const res = await saveGrades(updates);
        if (res && res.offline) {
          setSyncState('offline_queued');
        } else {
          setSyncState('synced');
        }
      } else {
        setSyncState('synced');
      }

      setHasUnsavedChanges(false);
      setLastSavedTime(new Date());
      setShowSaveStatus('success');
      setTimeout(() => setShowSaveStatus('idle'), 3000);
    } catch (e) {
      console.warn('Error saving grades to cloud:', e);
      // Las notas ya están 100% protegidas en localStorage
      setSyncState('offline_queued');
      setShowSaveStatus(isSilent ? 'idle' : 'error');
    }
  };

  const save = async () => {
    await triggerSave(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, studentIdx: number, key: string) => {
    if (e.key === 'Enter' || e.key === 'ArrowDown') {
      if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        const prevIdx = studentIdx - 1;
        if (prevIdx >= 0) {
          const prevKey = `${students[prevIdx].id}_${key}`;
          inputRefs.current[prevKey]?.focus();
          inputRefs.current[prevKey]?.select();
        }
        return;
      }
      e.preventDefault();
      const nextIdx = studentIdx + 1;
      if (nextIdx < students.length) {
        const nextKey = `${students[nextIdx].id}_${key}`;
        inputRefs.current[nextKey]?.focus();
        inputRefs.current[nextKey]?.select();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevIdx = studentIdx - 1;
      if (prevIdx >= 0) {
        const prevKey = `${students[prevIdx].id}_${key}`;
        inputRefs.current[prevKey]?.focus();
        inputRefs.current[prevKey]?.select();
      }
    }
  };

  // Pegar calificaciones en columna directamente desde Excel o Google Sheets
  const handleGradePaste = (
    e: React.ClipboardEvent<HTMLInputElement>,
    startStudentIdx: number,
    baseKey: string
  ) => {
    const pasteData = e.clipboardData.getData('text');
    if (!pasteData) return;

    const rawLines = pasteData.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
    if (rawLines.length <= 1) return; // Un solo valor se maneja con el pegado nativo

    e.preventDefault();

    setLocalGrades((prev) => {
      const updated = { ...prev };
      rawLines.forEach((line, offset) => {
        const studentIdx = startStudentIdx + offset;
        if (studentIdx >= students.length) return;
        const student = students[studentIdx];
        if (!student) return;

        // Si la fila incluye varias columnas (tabs), tomamos la primera
        const firstCol = line.split('\t')[0].trim().replace(',', '.');
        const numVal = parseInt(firstCol, 10);

        if (!isNaN(numVal) && numVal >= 0 && numVal <= 100) {
          updated[`${student.id}_${baseKey}`] = numVal.toString();
        }
      });
      if (localDraftKey) {
        try {
          localStorage.setItem(localDraftKey, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
    setHasUnsavedChanges(true);
    setSyncState('local_saved');
    setLastSavedTime(new Date());
  };

  const printGradesPDF = () => {
    if (!selectedCourse || !selectedSubject) return;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'legal' });
    const pageWidth = doc.internal.pageSize.width;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('SÁBANA DE CALIFICACIONES Y RESULTADOS FINALES', pageWidth / 2, 12, {
      align: 'center'
    });

    doc.setFontSize(9);
    doc.text(
      `AÑO ESCOLAR: ${config.year}   |   CURSO: ${selectedCourse.level} ${selectedCourse.grade} ${selectedCourse.section} (${getReportTanda(selectedCourse.tanda, 'full')})   |   ASIGNATURA: ${selectedSubject.name}`,
      pageWidth / 2,
      18,
      { align: 'center' }
    );

    const head = [];
    const headerRow1: any[] = [
      { content: 'Nº', rowSpan: 2 },
      { content: 'ESTUDIANTE', rowSpan: 2 }
    ];

    const grayScales = [
      [220, 220, 220],
      [190, 190, 190],
      [160, 160, 160],
      [130, 130, 130]
    ];

    config.competencies.forEach((c, i) => {
      headerRow1.push({
        content: c.name.length > 30 ? c.short : c.name,
        colSpan: config.periods.length * 2,
        styles: {
          halign: 'center',
          fillColor: grayScales[i % grayScales.length],
          textColor: [0, 0, 0]
        }
      });
    });

    headerRow1.push({
      content: 'RESULTADOS FINALES',
      colSpan: config.competencies.length + 2,
      styles: { halign: 'center', fillColor: [30, 30, 30], textColor: [255, 255, 255] }
    });

    const headerRow2: any[] = [];
    config.competencies.forEach((c, i) => {
      config.periods.forEach((p) => {
        headerRow2.push({
          content: p,
          styles: {
            halign: 'center',
            fillColor: grayScales[i % grayScales.length],
            textColor: [0, 0, 0]
          }
        });
        headerRow2.push({
          content: 'R',
          styles: {
            halign: 'center',
            fillColor: grayScales[i % grayScales.length],
            textColor: [100, 100, 100]
          }
        });
      });
    });

    config.competencies.forEach((c) => {
      headerRow2.push({
        content: c.short,
        styles: { halign: 'center', fillColor: [70, 70, 70], textColor: [255, 255, 255] }
      });
    });
    headerRow2.push({
      content: 'FINAL',
      styles: { halign: 'center', fillColor: [15, 23, 42], textColor: [255, 255, 255] }
    });
    headerRow2.push({
      content: 'REC',
      styles: { halign: 'center', fillColor: [150, 0, 0], textColor: [255, 255, 255] }
    });

    head.push(headerRow1);
    head.push(headerRow2);

    const body = students.map((s, idx) => {
      const orderNum = (getStudentOrderNumber(s) ?? (idx + 1)).toString().padStart(2, '0');
      const surname = `${s.first_surname || s.lastName || s.last_name || s.apellidos || ''} ${s.second_surname || ''}`.trim();
      const names = s.names || s.firstName || s.first_name || s.name || '';
      const fullName = surname && names ? `${surname}, ${names}`.toUpperCase() : (surname || names || 'ESTUDIANTE').toUpperCase();
      const row: any[] = [
        orderNum,
        fullName
      ];

      config.competencies.forEach((c) => {
        config.periods.forEach((p) => {
          const pL = p.toLowerCase();
          row.push(grades[`${s.id}_${c.id}_${pL}`] || '');
          row.push(grades[`${s.id}_${c.id}_r${pL}`] || '');
        });
      });

      config.competencies.forEach((c) => {
        row.push(calculateCompAvg(s.id, c.id).toFixed(1));
      });
      row.push(calculateAreaFinal(s.id).toString());
      row.push(grades[`${s.id}_final_rec`] || '');

      return row;
    });

    autoTable(doc, {
      startY: 22,
      head: head,
      body: body,
      theme: 'grid',
      styles: { fontSize: 6, cellPadding: 0.8, halign: 'center', valign: 'middle' },
      columnStyles: { 0: { halign: 'center', cellWidth: 8 }, 1: { halign: 'left', cellWidth: 45 } },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index > 1) {
          let colIdx = data.column.index - 2;
          const colsPerComp = config.periods.length * 2;

          if (colIdx < config.competencies.length * colsPerComp) {
            const compIdx = Math.floor(colIdx / colsPerComp);
            const g = 250 - compIdx * 8;
            data.cell.styles.fillColor = [g, g, g];
          } else {
            colIdx -= config.competencies.length * colsPerComp;
            if (colIdx < config.competencies.length) {
              data.cell.styles.fillColor = [240, 240, 250];
              data.cell.styles.fontStyle = 'bold';
            } else if (colIdx === config.competencies.length) {
              data.cell.styles.fillColor = [220, 220, 245];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.fillColor = [255, 240, 240];
              data.cell.styles.textColor = [200, 0, 0];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      }
    });

    doc.save(
      `Sábana_${selectedCourse.grade}${selectedCourse.section}_${selectedSubject.name.replace(/ /g, '')}.pdf`
    );
  };

  const fetchStudentConsolidatedGrades = async (student: any) => {
    if (!student) return;
    setSelectedSummaryStudent(student);
    setIsLoadingSummary(true);
    setIsSummaryModalOpen(true);
    try {
      const activeYear = selectedYear || '2026-2027';

      // Cargar familiares del estudiante para obtener nombres de padre/madre
      const { data: fData } = await supabase
        .from('parents')
        .select('*')
        .eq('student_id', student.id);

      setSelectedSummaryStudent({ ...student, family: fData || [] });

      const { data: gData, error: gError } = await supabase
        .from('student_grades')
        .select('*')
        .eq('student_id', student.id)
        .eq('school_year', activeYear);

      if (gError) throw gError;

      const map: Record<string, Record<string, any>> = {};
      if (gData) {
        gData.forEach((g) => {
          if (!map[g.subject_id]) map[g.subject_id] = {};
          const sGrades = map[g.subject_id];
          const pL = g.period.toLowerCase();

          if (g.grade !== null) sGrades[`${g.competency_id}_${pL}`] = g.grade;
          if (g.rp1 !== null) sGrades[`${g.competency_id}_rp1`] = g.rp1;
          if (g.rp2 !== null) sGrades[`${g.competency_id}_rp2`] = g.rp2;
          if (g.rp3 !== null) sGrades[`${g.competency_id}_rp3`] = g.rp3;
          if (g.rp4 !== null) sGrades[`${g.competency_id}_rp4`] = g.rp4;
          if (g.recovery_grade !== null) sGrades[`final_rec`] = g.recovery_grade;
          if (g.period === 'COMP') sGrades['comp'] = g.grade;
          if (g.period === 'EXTRA') sGrades['extra'] = g.grade;
          if (g.period === 'ESP1') sGrades['esp1'] = g.grade;
          if (g.period === 'ESP2') sGrades['esp2'] = g.grade;
        });
      }
      setStudentSummaryGrades(map);
    } catch (error) {
      console.error('Error al obtener el resumen de calificaciones:', error);
      alert('Error al obtener el resumen de calificaciones.');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  const downloadSingleBoletinPDF = async (student: any) => {
    if (!student) return;
    const activeYear = selectedYear || '2026-2027';

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.width;

    const centerData = center || {
      name: 'CENTRO EDUCATIVO',
      address: '---',
      phone: '---',
      logo_url: null
    };

    let logoImg: HTMLImageElement | null = null;
    try {
      logoImg = new Image();
      logoImg.src = centerData.logo_url || '/Edugest2.png';
      await new Promise((resolve, reject) => {
        logoImg!.onload = resolve;
        logoImg!.onerror = reject;
      });
    } catch (e) {
      console.warn('No se pudo cargar el logo:', e);
      logoImg = null;
    }

    const getBestGradeForPDF = (sGrades: any, cId: string, p: string) => {
      const pL = p.toLowerCase();
      const g = parseInt(sGrades[`${cId}_${pL}`]) || 0;
      const r = parseInt(sGrades[`${cId}_r${pL}`]) || 0;
      return Math.max(g, r);
    };

    if (logoImg) {
      doc.addImage(logoImg, 'PNG', 14, 6, 15, 15);
    }

    // HEADER
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(centerData.name.toUpperCase(), pageWidth / 2, 10, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `${centerData.address || '---'} | Tel: ${centerData.phone || '---'}`,
      pageWidth / 2,
      14,
      {
        align: 'center'
      }
    );

    // Título del reporte
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('BOLETÍN DE CALIFICACIONES CONSOLIDADO', pageWidth / 2, 20, { align: 'center' });

    // Cargar familiares si no existen
    let family = student.family;
    if (!family || family.length === 0) {
      try {
        const { data: fData } = await supabase
          .from('parents')
          .select('*')
          .eq('student_id', student.id);
        family = fData || [];
      } catch (e) {
        family = [];
      }
    }

    let parentsName = 'No registrado';
    if (family && family.length > 0) {
      const parents = family.filter(
        (f: any) =>
          (f.relation || f.role)?.toLowerCase().includes('madre') ||
          (f.relation || f.role)?.toLowerCase().includes('padre')
      );
      if (parents.length > 0) {
        parentsName = parents.map((p: any) => p.name).join(' y ');
      } else {
        parentsName = family[0].name;
      }
    }

    const studentCourse = (allCourses || []).find((c: any) => c.id === student.course_id);
    const isStudentSecundario = studentCourse?.level?.toLowerCase().includes('secund');

    const courseDisplay = studentCourse
      ? `${studentCourse.level ? `${studentCourse.level} ` : ''}${studentCourse.grade} - ${studentCourse.section} (${getReportTanda(studentCourse.tanda, 'full')})`
      : '---';
    const levelDisplay = studentCourse?.level || '---';
    const studentCode =
      student.sigerd_code ||
      student.student_code ||
      student.rne ||
      student.id.substring(0, 7).toUpperCase();

    const studentIndex = (students || []).findIndex((s: any) => s.id === student.id);
    const orderNo = studentIndex !== -1 ? (studentIndex + 1).toString().padStart(2, '0') : '--';

    // CAJA DE DATOS ESTRUCTURADA
    const boxY = 24;
    const boxHeight = 16;
    doc.setDrawColor(220, 225, 230);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, boxY, pageWidth - 28, boxHeight, 3, 3, 'FD');

    // Fila 1 - Estudiante
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 120);
    doc.text('ESTUDIANTE:', 18, boxY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(
      `${student.names || ''} ${student.first_surname || ''} ${student.second_surname || ''}`
        .trim()
        .toUpperCase(),
      42,
      boxY + 5.5
    );

    // Fila 1 - Orden
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 120);
    doc.text('Nº DE ORDEN:', 150, boxY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(orderNo, 175, boxY + 5.5);

    // Fila 1 - Año Escolar
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 120);
    doc.text('AÑO ESCOLAR:', 210, boxY + 5.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(activeYear, 235, boxY + 5.5);

    // Fila 2 - Grado / Nivel
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 120);
    doc.text('GRADO / NIVEL:', 18, boxY + 11.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(`${courseDisplay} (${levelDisplay})`, 44, boxY + 11.5);

    // Fila 2 - Código
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 120);
    doc.text('CÓDIGO SIGERD:', 130, boxY + 11.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(studentCode, 158, boxY + 11.5);

    // Fila 2 - Padres o Tutor
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 110, 120);
    doc.text('PADRES / TUTOR:', 200, boxY + 11.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    const truncateParents =
      parentsName.length > 30 ? parentsName.substring(0, 27) + '...' : parentsName;
    doc.text(truncateParents.toUpperCase(), 228, boxY + 11.5);

    const mainTableStartY = boxY + boxHeight + 4;

    if (isStudentSecundario) {
      // --- LOGICA SECUNDARIA (34 Columnas) ---
      const mainHeadSecondary: any[] = [
        [
          {
            content: 'DESEMPEÑO INDIVIDUAL DEL/LA ESTUDIANTE',
            colSpan: 34,
            styles: {
              fillColor: [0, 112, 192],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 10
            }
          }
        ],
        [
          {
            content: 'Competencias\nFundamentales',
            rowSpan: 2,
            styles: { fillColor: [173, 216, 230], cellWidth: 32, fontSize: 6.5, halign: 'center', valign: 'middle' }
          },
          {
            content: 'Comunicativa',
            colSpan: 4,
            styles: { fillColor: [173, 216, 230], fontSize: 6.5, halign: 'center' }
          },
          {
            content: 'Pensamiento Lógico, Creativo y Crítico\nResolución de Problemas',
            colSpan: 4,
            styles: { fillColor: [173, 216, 230], fontSize: 6, halign: 'center' }
          },
          {
            content: 'Ética y Ciudadanía\nDesarrollo Personal y Espiritual',
            colSpan: 4,
            styles: { fillColor: [173, 216, 230], fontSize: 6, halign: 'center' }
          },
          {
            content: 'Científica y Tecnológica\nAmbiental y de la Salud',
            colSpan: 4,
            styles: { fillColor: [173, 216, 230], fontSize: 6, halign: 'center' }
          },
          {
            content: 'Promedio Grupo De\nCompetencias\nEspecíficas',
            colSpan: 4,
            styles: { fillColor: [173, 216, 230], fontSize: 6, halign: 'center' }
          },
          {
            content: '', // Calificación final de Área (Vertical text in didDrawCell)
            rowSpan: 2,
            styles: { fillColor: [173, 216, 230], cellWidth: 6.5 }
          },
          {
            content: 'Calificación Completivo',
            colSpan: 4,
            styles: { fillColor: [173, 216, 230], fontSize: 6, halign: 'center' }
          },
          {
            content: 'Calificación Extraordinaria',
            colSpan: 4,
            styles: { fillColor: [173, 216, 230], fontSize: 6, halign: 'center' }
          },
          {
            content: 'Evaluación\nEspecial',
            colSpan: 2,
            styles: { fillColor: [173, 216, 230], fontSize: 6, halign: 'center' }
          },
          {
            content: 'Situación\nFinal en la\nAsignatura',
            colSpan: 2,
            styles: { fillColor: [173, 216, 230], fontSize: 6, halign: 'center' }
          }
        ],
        [
          // Sub-columnas C1-C4 (16 col)
          { content: 'P1', styles: { fillColor: [240, 240, 240] } },
          { content: 'P2', styles: { fillColor: [240, 240, 240] } },
          { content: 'P3', styles: { fillColor: [240, 240, 240] } },
          { content: 'P4', styles: { fillColor: [240, 240, 240] } },
          { content: 'P1', styles: { fillColor: [240, 240, 240] } },
          { content: 'P2', styles: { fillColor: [240, 240, 240] } },
          { content: 'P3', styles: { fillColor: [240, 240, 240] } },
          { content: 'P4', styles: { fillColor: [240, 240, 240] } },
          { content: 'P1', styles: { fillColor: [240, 240, 240] } },
          { content: 'P2', styles: { fillColor: [240, 240, 240] } },
          { content: 'P3', styles: { fillColor: [240, 240, 240] } },
          { content: 'P4', styles: { fillColor: [240, 240, 240] } },
          { content: 'P1', styles: { fillColor: [240, 240, 240] } },
          { content: 'P2', styles: { fillColor: [240, 240, 240] } },
          { content: 'P3', styles: { fillColor: [240, 240, 240] } },
          { content: 'P4', styles: { fillColor: [240, 240, 240] } },
          // PC1-PC4 (4 col)
          { content: 'PC1', styles: { fillColor: [240, 240, 240] } },
          { content: 'PC2', styles: { fillColor: [240, 240, 240] } },
          { content: 'PC3', styles: { fillColor: [240, 240, 240] } },
          { content: 'PC4', styles: { fillColor: [240, 240, 240] } },
          // Completivo (4 col) - minCellHeight to ensure height for rotated text
          { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
          { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
          { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
          { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
          // Extraordinaria (4 col)
          { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
          { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
          { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
          { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
          // Especial (2 col)
          { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
          { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
          // Situación Final (2 col)
          { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } },
          { content: '', styles: { fillColor: [240, 240, 240], minCellHeight: 18 } }
        ]
      ];

      const bodySecondary: any[] = [];
      let sumC1 = 0,
        sumC2 = 0,
        sumC3 = 0,
        sumC4 = 0,
        sumFinal = 0;
      let count = 0;

      allCourseSubjects.forEach((sub) => {
        const sGrades = studentSummaryGrades[sub.id] || {};
        const row: any[] = [{ content: sub.name.toUpperCase(), styles: { halign: 'left' } }];

        // Competencia 1 (Comunicativa) -> database c2
        let p1c1 = getBestGradeForPDF(sGrades, 'c2', 'P1');
        row.push(p1c1 || '');
        let p2c1 = getBestGradeForPDF(sGrades, 'c2', 'P2');
        row.push(p2c1 || '');
        let p3c1 = getBestGradeForPDF(sGrades, 'c2', 'P3');
        row.push(p3c1 || '');
        let p4c1 = getBestGradeForPDF(sGrades, 'c2', 'P4');
        row.push(p4c1 || '');

        // Competencia 2 (Pensamiento Lógico...) -> database c3
        let p1c2 = getBestGradeForPDF(sGrades, 'c3', 'P1');
        row.push(p1c2 || '');
        let p2c2 = getBestGradeForPDF(sGrades, 'c3', 'P2');
        row.push(p2c2 || '');
        let p3c2 = getBestGradeForPDF(sGrades, 'c3', 'P3');
        row.push(p3c2 || '');
        let p4c2 = getBestGradeForPDF(sGrades, 'c3', 'P4');
        row.push(p4c2 || '');

        // Competencia 3 (Ética y Ciudadana...) -> database c1
        let p1c3 = getBestGradeForPDF(sGrades, 'c1', 'P1');
        row.push(p1c3 || '');
        let p2c3 = getBestGradeForPDF(sGrades, 'c1', 'P2');
        row.push(p2c3 || '');
        let p3c3 = getBestGradeForPDF(sGrades, 'c1', 'P3');
        row.push(p3c3 || '');
        let p4c3 = getBestGradeForPDF(sGrades, 'c1', 'P4');
        row.push(p4c3 || '');

        // Competencia 4 (Científica y Tecnológica...) -> database c4
        let p1c4 = getBestGradeForPDF(sGrades, 'c4', 'P1');
        row.push(p1c4 || '');
        let p2c4 = getBestGradeForPDF(sGrades, 'c4', 'P2');
        row.push(p2c4 || '');
        let p3c4 = getBestGradeForPDF(sGrades, 'c4', 'P3');
        row.push(p3c4 || '');
        let p4c4 = getBestGradeForPDF(sGrades, 'c4', 'P4');
        row.push(p4c4 || '');

        const getCompFinalVal = (p1: number, p2: number, p3: number, p4: number) => {
          let s = 0;
          if (summaryPeriodDivisor >= 1) s += p1;
          if (summaryPeriodDivisor >= 2) s += p2;
          if (summaryPeriodDivisor >= 3) s += p3;
          if (summaryPeriodDivisor >= 4) s += p4;
          return Math.round(s / summaryPeriodDivisor);
        };

        let fC1 = getCompFinalVal(p1c1, p2c1, p3c1, p4c1);
        let fC2 = getCompFinalVal(p1c2, p2c2, p3c2, p4c2);
        let fC3 = getCompFinalVal(p1c3, p2c3, p3c3, p4c3);
        let fC4 = getCompFinalVal(p1c4, p2c4, p3c4, p4c4);

        // Agregar promedios PC1-PC4
        row.push(fC1 || '');
        row.push(fC2 || '');
        row.push(fC3 || '');
        row.push(fC4 || '');

        // Calificación final de Área (promedio de las 4 competencias)
        let areaFinal = Math.round((fC1 + fC2 + fC3 + fC4) / 4);
        row.push(areaFinal || '');

        // Recuperación de Secundaria
        const cp = parseInt(sGrades['comp']) || 0;
        const ex = parseInt(sGrades['extra']) || 0;
        const e1 = parseInt(sGrades['esp1']) || 0;
        const e2 = parseInt(sGrades['esp2']) || 0;

        // Completivo (50% CF, CEC, 50% CEC, CCF)
        let cp50 = areaFinal < 70 ? Math.round(areaFinal * 0.5) : '';
        let cpExam = cp || '';
        let cpExam50 = cp > 0 ? Math.round(cp * 0.5) : '';
        let ccFinal = cp > 0 ? Math.round(areaFinal * 0.5 + cp * 0.5) : '';

        row.push(cp50);
        row.push(cpExam);
        row.push(cpExam50);
        row.push(ccFinal || '');

        // Extraordinario (30% CF, CEEX, 70% CEEX, CEXF)
        let ex30 = areaFinal < 70 ? Math.round(areaFinal * 0.3) : '';
        let exExam = ex || '';
        let exExam70 = ex > 0 ? Math.round(ex * 0.7) : '';
        let cexFinal = ex > 0 ? Math.round(areaFinal * 0.3 + ex * 0.7) : '';

        row.push(ex30);
        row.push(exExam);
        row.push(exExam70);
        row.push(cexFinal || '');

        // Especial (C.F, C.E)
        let espExam = e1 || e2 || '';
        let defFinal = areaFinal;
        if (areaFinal < 70) {
          if (cp > 0) {
            const cpFinal = Math.round(areaFinal * 0.5 + cp * 0.5);
            if (cpFinal >= 70) defFinal = cpFinal;
          }
          if (defFinal < 70 && ex > 0) {
            const exFinal = Math.round(areaFinal * 0.3 + ex * 0.7);
            if (exFinal >= 70) defFinal = exFinal;
          }
          if (defFinal < 70 && e1 >= 70) {
            defFinal = e1;
          }
          if (defFinal < 70 && e2 >= 70) {
            defFinal = e2;
          }
        }

        let espFinal = (e1 > 0 || e2 > 0) ? defFinal : '';
        row.push(espFinal);
        row.push(espExam);

        // Situación Final (A / R)
        let sitA = defFinal >= 70 ? defFinal : '';
        let sitR = (defFinal > 0 && defFinal < 70) ? defFinal : '';
        row.push(sitA);
        row.push(sitR);

        bodySecondary.push(row);

        if (defFinal > 0) {
          sumC1 += fC1;
          sumC2 += fC2;
          sumC3 += fC3;
          sumC4 += fC4;
          sumFinal += defFinal;
          count++;
        }
      });

      // Fila de Indice
      const idxRowSecondary: any[] = [{ content: 'Indice', colSpan: 17, styles: { halign: 'right', fontStyle: 'bold' } }];
      if (count > 0) {
        idxRowSecondary.push((sumC1 / count / 25).toFixed(2));
        idxRowSecondary.push((sumC2 / count / 25).toFixed(2));
        idxRowSecondary.push((sumC3 / count / 25).toFixed(2));
        idxRowSecondary.push((sumC4 / count / 25).toFixed(2));
        idxRowSecondary.push((sumFinal / count / 25).toFixed(2));
        for (let i = 0; i < 12; i++) {
          idxRowSecondary.push('');
        }
      } else {
        idxRowSecondary.push('0.00', '0.00', '0.00', '0.00', '0.00');
        for (let i = 0; i < 12; i++) {
          idxRowSecondary.push('');
        }
      }
      bodySecondary.push(idxRowSecondary);

      autoTable(doc, {
        startY: mainTableStartY,
        head: mainHeadSecondary,
        body: bodySecondary,
        theme: 'grid',
        styles: {
          fontSize: 5.5,
          halign: 'center',
          valign: 'middle',
          cellPadding: 0.5,
          textColor: [0, 0, 0],
          lineWidth: 0.15
        },
        headStyles: { textColor: [0, 0, 0], lineWidth: 0.15, fontSize: 6.5 },
        columnStyles: {
          0: { halign: 'left', cellWidth: 32 }
        },
        didDrawCell: (data) => {
          if (data.section === 'head') {
            if (data.row.index === 1 && data.column.index === 21) {
              doc.setTextColor(0, 0, 0);
              doc.setFontSize(5.5);
              doc.setFont('helvetica', 'bold');
              const x = data.cell.x + data.cell.width / 2 + 1;
              const y = data.cell.y + data.cell.height - 2;
              (doc as any).text('Calificación final de Área', x, y, { angle: 90 });
            } else if (data.row.index === 2) {
              doc.setTextColor(0, 0, 0);
              doc.setFontSize(5.5);
              doc.setFont('helvetica', 'bold');
              let text = '';
              const x = data.cell.x + data.cell.width / 2 + 1;
              const y = data.cell.y + data.cell.height - 2;

              if (data.column.index === 22) text = '50% C.F.';
              else if (data.column.index === 23) text = 'C.E.C';
              else if (data.column.index === 24) text = '50% C.E.C';
              else if (data.column.index === 25) text = 'C.C.F';
              else if (data.column.index === 26) text = '30% C.F.';
              else if (data.column.index === 27) text = 'C.E.EX';
              else if (data.column.index === 28) text = '70% C.E.EX';
              else if (data.column.index === 29) text = 'C.EX.F';
              else if (data.column.index === 30) text = 'C.F';
              else if (data.column.index === 31) text = 'C.E';
              else if (data.column.index === 32) text = 'A';
              else if (data.column.index === 33) text = 'R';

              if (text) {
                (doc as any).text(text, x, y, { angle: 90 });
              }
            }
          }
        },
        didParseCell: (data) => {
          if (data.section === 'body') {
            if (data.column.index >= 17) {
              data.cell.styles.fillColor = [240, 240, 245];
            }
          }
        }
      });
    } else {
      // --- LOGICA PRIMARIA (18 Columnas - Original) ---
      const compsPrimary = [
        { id: 'c1', short: 'C1', name: 'Comunicativa' },
        { id: 'c2', short: 'C2', name: 'Pensamiento Lógico' },
        { id: 'c3', short: 'C3', name: 'Ética y Ciudadana' }
      ];

      const mainHeadPrimary: any[] = [
        [
          {
            content: 'DESEMPEÑO INDIVIDUAL DEL/LA ESTUDIANTE',
            colSpan: 18,
            styles: {
              fillColor: [0, 112, 192],
              textColor: [255, 255, 255],
              fontStyle: 'bold',
              fontSize: 10
            }
          }
        ],
        [
          {
            content: 'Competencias\nFundamentales',
            rowSpan: 2,
            styles: { fillColor: [173, 216, 230], cellWidth: 35, fontSize: 7 }
          }
        ]
      ];

      compsPrimary.forEach((c) => {
        mainHeadPrimary[1].push({
          content: c.name,
          colSpan: 4,
          styles: { fillColor: [173, 216, 230], fontSize: 7 }
        });
      });

      mainHeadPrimary[1].push({
        content: 'Calificación final\npor Competencia',
        colSpan: compsPrimary.length,
        styles: { fillColor: [173, 216, 230], fontSize: 7 }
      });

      mainHeadPrimary[1].push(
        { content: '', rowSpan: 2, styles: { fillColor: [173, 216, 230], cellWidth: 8 } },
        { content: '', rowSpan: 2, styles: { fillColor: [173, 216, 230], cellWidth: 8 } }
      );

      const headerRow3Primary: any[] = [];
      compsPrimary.forEach(() => {
        headerRow3Primary.push(
          { content: 'P1', styles: { fillColor: [240, 240, 240] } },
          { content: 'P2', styles: { fillColor: [240, 240, 240] } },
          { content: 'P3', styles: { fillColor: [240, 240, 240] } },
          { content: 'P4', styles: { fillColor: [240, 240, 240] } }
        );
      });
      compsPrimary.forEach((c) => {
        headerRow3Primary.push({
          content: c.short,
          styles: { fillColor: [240, 240, 240] }
        });
      });

      mainHeadPrimary.push(headerRow3Primary);

      const bodyPrimary: any[] = [];
      let sumC1 = 0,
        sumC2 = 0,
        sumC3 = 0,
        sumFinal = 0;
      let count = 0;

      allCourseSubjects.forEach((sub) => {
        const sGrades = studentSummaryGrades[sub.id] || {};
        const row: any[] = [{ content: sub.name.toUpperCase(), styles: { halign: 'left' } }];

        compsPrimary.forEach((c) => {
          config.periods.forEach((p) => {
            row.push(getBestGradeForPDF(sGrades, c.id, p) || '');
          });
        });

        const getCompFinalVal = (cId: string) => {
          let sum = 0;
          config.periods.forEach((p, idx) => {
            if (summaryPeriodDivisor > idx) {
              sum += getBestGradeForPDF(sGrades, cId, p);
            }
          });
          return Math.round(sum / summaryPeriodDivisor);
        };

        const cfValues = compsPrimary.map((c) => getCompFinalVal(c.id));
        cfValues.forEach((val) => {
          row.push(val || '');
        });

        const finalArea =
          cfValues.length > 0 ? Math.round(cfValues.reduce((a, b) => a + b, 0) / cfValues.length) : 0;
        row.push(finalArea || '');

        const recFinal = parseInt(sGrades['final_rec']) || 0;
        row.push(recFinal || '');

        const defFinal = Math.max(finalArea, recFinal);
        row.push(defFinal || '');

        bodyPrimary.push(row);

        if (defFinal > 0) {
          sumC1 += cfValues[0] || 0;
          sumC2 += cfValues[1] || 0;
          sumC3 += cfValues[2] || 0;
          sumFinal += defFinal;
          count++;
        }
      });

      const idxRowPrimary: any[] = [{ content: 'Indice', colSpan: 13, styles: { halign: 'right', fontStyle: 'bold' } }];
      if (count > 0) {
        idxRowPrimary.push((sumC1 / count / 25).toFixed(2));
        idxRowPrimary.push((sumC2 / count / 25).toFixed(2));
        idxRowPrimary.push((sumC3 / count / 25).toFixed(2));
        idxRowPrimary.push((sumFinal / count / 25).toFixed(2));
        idxRowPrimary.push('');
      } else {
        idxRowPrimary.push('0.00', '0.00', '0.00', '0.00', '');
      }
      bodyPrimary.push(idxRowPrimary);

      autoTable(doc, {
        startY: mainTableStartY,
        head: mainHeadPrimary,
        body: bodyPrimary,
        theme: 'grid',
        styles: {
          fontSize: 8,
          halign: 'center',
          valign: 'middle',
          cellPadding: 1,
          textColor: [0, 0, 0],
          lineWidth: 0.2
        },
        headStyles: { textColor: [0, 0, 0], lineWidth: 0.2, fontSize: 8 },
        didDrawCell: (data) => {
          if (data.section === 'head' && data.row.index === 1) {
            const finalAreaIndex = 1 + compsPrimary.length * 4 + compsPrimary.length;
            if (data.column.index === finalAreaIndex || data.column.index === finalAreaIndex + 1) {
              doc.setTextColor(0, 0, 0);
              doc.setFontSize(6);
              const titles = ['Calif. Final', 'Recup. Final'];
              const textIdx = data.column.index - finalAreaIndex;
              (doc as any).text(
                titles[textIdx],
                data.cell.x + 3.5,
                data.cell.y + data.cell.height - 2,
                {
                  angle: 90
                }
              );
            }
          }
        },
        didParseCell: (data) => {
          const finalAreaIndex = 1 + compsPrimary.length * 4 + compsPrimary.length;
          if (data.section === 'body' && data.column.index >= finalAreaIndex) {
            data.cell.styles.fillColor = [240, 240, 245];
          }
        }
      });
    }

    let finalY = (doc as any).lastAutoTable.finalY + 5;

    // --- PANEL INFERIOR ---
    autoTable(doc, {
      startY: finalY,
      margin: { left: 14, right: 190 },
      body: [
        [
          {
            content: 'RESUMEN DE ASISTENCIA DEL ESTUDIANTE',
            colSpan: 5,
            styles: { fillColor: [173, 216, 230], fontStyle: 'bold' }
          }
        ],
        [
          { content: 'Periodos', rowSpan: 2 },
          { content: 'Asistencia', rowSpan: 2 },
          { content: 'Ausencia', rowSpan: 2 },
          { content: '% de Anual', colSpan: 2 }
        ],
        ['Asistencia', 'Ausencia'],
        ['P1', '', '', { content: '', rowSpan: 4 }, { content: '', rowSpan: 4 }],
        ['P2', '', ''],
        ['P3', '', ''],
        ['P4', '', '']
      ],
      theme: 'grid',
      styles: {
        fontSize: 8,
        halign: 'center',
        valign: 'middle',
        cellPadding: 1,
        textColor: [0, 0, 0],
        lineWidth: 0.2
      }
    });

    // 2. Panel Central (Leyenda para Secundaria / Escala Numérica para Primaria)
    if (isStudentSecundario) {
      autoTable(doc, {
        startY: finalY,
        margin: { left: 100, right: 90 },
        body: [
          [
            {
              content: 'LEYENDA',
              colSpan: 2,
              styles: { fillColor: [173, 216, 230], fontStyle: 'bold', halign: 'center' }
            }
          ],
          [{ content: '(P1) / (P2) / (P3) / (P4)', styles: { fontStyle: 'bold', fontSize: 5.5 } }, { content: 'Periodo 1 / Periodo 2 / Periodo 3 / Periodo 4', styles: { fontSize: 5.5 } }],
          [{ content: '(P.C.)', styles: { fontStyle: 'bold', fontSize: 5.5 } }, { content: 'Promedio grupo de competencias específicas', styles: { fontSize: 5.5 } }],
          [{ content: '(C.F.)', styles: { fontStyle: 'bold', fontSize: 5.5 } }, { content: 'Calificación Final', styles: { fontSize: 5.5 } }],
          [{ content: '(C.E.C.) / (C.C.F.)', styles: { fontStyle: 'bold', fontSize: 5.5 } }, { content: 'Calif. Eval. Competencia / Calif. Completiva Final', styles: { fontSize: 5.5 } }],
          [{ content: '(C.E.EX) / (C.EX.F)', styles: { fontStyle: 'bold', fontSize: 5.5 } }, { content: 'Calif. Eval. Extraordinaria / Calif. Extraordinaria Final', styles: { fontSize: 5.5 } }],
          [{ content: '(C.E.) / (A) / (R)', styles: { fontStyle: 'bold', fontSize: 5.5 } }, { content: 'Calificación Especial / Aprobado / Reprobado', styles: { fontSize: 5.5 } }]
        ],
        theme: 'grid',
        styles: {
          fontSize: 5.5,
          halign: 'left',
          valign: 'middle',
          cellPadding: 0.5,
          textColor: [0, 0, 0],
          lineWidth: 0.2
        },
        columnStyles: { 0: { cellWidth: 32, halign: 'center' } }
      });
    } else {
      autoTable(doc, {
        startY: finalY,
        margin: { left: 100, right: 90 },
        body: [
          [
            {
              content: 'Escala\nNumérica',
              styles: { fillColor: [173, 216, 230], fontStyle: 'bold' }
            },
            { content: 'Descripción', styles: { fillColor: [173, 216, 230], fontStyle: 'bold' } }
          ],
          [
            '89-100',
            'Evidencia de que el estudiante ha alcanzado un desempeño destacado con relación a los aspectos evaluados...'
          ],
          [
            '77-88',
            'Evidencia de que el estudiante ha logrado los aprendizajes esperados con relación a los aspectos evaluados...'
          ],
          [
            '65-76',
            'Evidencia de que el estudiante aún se encuentra en proceso con relación a los aspectos evaluados...'
          ],
          [
            'Menos de\n65',
            'Evidencia que el estudiante ha alcanzado un desempeño insuficiente con relación a los aspectos evaluados...'
          ]
        ],
        theme: 'grid',
        styles: {
          fontSize: 7,
          halign: 'center',
          valign: 'middle',
          cellPadding: 1,
          textColor: [0, 0, 0],
          lineWidth: 0.2
        },
        columnStyles: { 1: { halign: 'left' } }
      });
    }

    // 3. Situación y Observaciones
    doc.setDrawColor(0);
    doc.setLineWidth(0.2);
    doc.rect(195, finalY, 70, 36);

    doc.setFillColor(173, 216, 230);
    doc.rect(195, finalY, 70, 5, 'FD');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Situación del Estudiante | Promovido/a | Repitente', 197, finalY + 3.5);

    doc.line(195, finalY + 5, 265, finalY + 5);
    doc.line(195, finalY + 10, 265, finalY + 10);

    doc.setFontSize(8);
    doc.text('Observaciones', 230, finalY + 14, { align: 'center' });
    doc.line(197, finalY + 20, 263, finalY + 20);
    doc.line(197, finalY + 27, 263, finalY + 27);
    doc.line(197, finalY + 34, 263, finalY + 34);

    let sigY = finalY + 50;
    doc.setLineWidth(0.2);
    doc.line(180, sigY, 215, sigY);
    doc.line(225, sigY, 265, sigY);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('Maestro(a) encargado(a) del grado', 197.5, sigY + 3, { align: 'center' });
    doc.text('Director(a) del centro Educativo', 245, sigY + 3, { align: 'center' });

    doc.save(
      `Boletin_${student.names.replace(/ /g, '_')}_${student.first_surname.replace(/ /g, '_')}.pdf`
    );
  };

  if (profile?.role === 'teacher' && !profile?.teacher_id) {
    return (
      <div className="card p-12 text-center bg-white rounded-3xl border border-amber-200 shadow-xl max-w-xl mx-auto my-12 animate-fade-in">
        <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-200 text-amber-600">
          <Lock size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">
          Cuenta Docente No Vinculada
        </h2>
        <p className="text-slate-500 text-sm mt-3 leading-relaxed">
          Tu usuario no está vinculado a una ficha oficial de docente en este centro educativo.
          Por motivos de seguridad y confidencialidad académica, el acceso a las calificaciones y listas de estudiantes está restringido.
        </p>
        <div className="mt-6 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-600 text-left">
          <p className="font-bold text-slate-700 mb-1">¿Cómo habilitar mi acceso?</p>
          <p>Comunícate con el administrador o equipo de dirección de tu centro para que asigne tu perfil docente o te proporcione tu código de invitación oficial.</p>
        </div>
      </div>
    );
  }

  if (profile?.role === 'teacher' && filteredCourses.length === 0) {
    return (
      <div className="card p-12 text-center bg-white rounded-3xl border border-slate-200 shadow-xl max-w-xl mx-auto my-12 animate-fade-in">
        <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-indigo-200 text-indigo-600">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-wide">
          Sin Cursos Asignados
        </h2>
        <p className="text-slate-500 text-sm mt-3 leading-relaxed">
          Tu cuenta está vinculada a tu perfil docente, pero aún no tienes cursos ni asignaturas asignadas en el horario de este ciclo escolar.
        </p>
        <div className="mt-6 bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs text-slate-600 text-left">
          <p className="font-bold text-slate-700 mb-1">Información</p>
          <p>Si consideras que esto es un error, solicita al coordinador académico que registre tus asignaciones de materias en el sistema.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 text-text-main pb-20 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-indigo-600 p-4 px-6 rounded-3xl text-white shadow-xl">
        <div>
          <h2 className="text-lg font-black uppercase tracking-tight">Registro Digital</h2>
          <p className="text-[10px] font-bold text-indigo-200 uppercase tracking-widest">
            Gestión de Calificaciones
          </p>
        </div>
        {onViewChange && (
          <button
            onClick={() => {
              if (hasUnsavedChanges) {
                alert('⚠️ TIENES CALIFICACIONES PENDIENTES DE GUARDAR.\n\nPor favor, pulsa el botón "GUARDAR" antes de salir a los reportes para no perder los datos digitados.');
                return;
              }
              onViewChange('general-reports');
            }}
            className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black uppercase text-[10px] shadow-md flex items-center gap-2 transition-all border border-white/20"
          >
            <Printer size={14} /> Imprimir Boletines / Reportes
          </button>
        )}
      </div>

      {!isEditable && (
        <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50 px-5 py-4 rounded-[1.5rem] text-xs font-bold flex items-center gap-3 animate-pulse">
          <AlertCircle size={18} className="text-amber-600 dark:text-amber-400 shrink-0" />
          <span>
            La edición de calificaciones se encuentra temporalmente deshabilitada para su usuario.
            Por favor contacte al equipo de gestión.
          </span>
        </div>
      )}

      <div className="bg-surface p-4 rounded-3xl border border-border-main shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="flex gap-2 bg-slate-50 p-1 rounded-2xl">
              {levels.map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => {
                    if (hasUnsavedChanges && lvl !== selectedLevel) {
                      triggerSave(true);
                    }
                    setSelectedLevel(lvl);
                    setSelectedCourseId('');
                    setSelectedSubjectId('');
                  }}
                  className={`px-5 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${selectedLevel === lvl ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 rounded-2xl text-[10px] font-black uppercase">
              <Calendar size={14} /> {config.year}
            </div>
          </div>
          <select
            value={selectedCourseId}
            onChange={(e) => {
              const newCourseId = e.target.value;
              if (newCourseId === selectedCourseId) return;
              if (hasUnsavedChanges) {
                triggerSave(true, selectedCourseId, selectedSubjectId, students);
              }
              setSelectedCourseId(newCourseId);
              setSelectedSubjectId('');
            }}
            className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-2 text-[10px] font-black uppercase focus:border-indigo-500 outline-none"
          >
            <option value="">-- SELECCIONE EL GRADO --</option>
            {filteredCourses.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.level ? `${c.level} ` : ''}{c.grade} "{c.section}" - {getReportTanda(c.tanda, 'full')}
              </option>
            ))}
          </select>
        </div>
        {selectedCourseId && (
          <div className="flex flex-wrap gap-1 border-t border-slate-50 pt-3">
            {courseSubjects.map((s: any) => (
              <button
                key={s.id}
                onClick={() => {
                  if (s.id === selectedSubjectId) return;
                  if (hasUnsavedChanges) {
                    triggerSave(true, selectedCourseId, selectedSubjectId, students);
                  }
                  setSelectedSubjectId(s.id);
                }}
                className={`px-4 py-2 rounded-xl text-[8px] font-black uppercase transition-all border ${selectedSubjectId === s.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg scale-105' : 'bg-slate-50 text-slate-400 border-slate-100 hover:bg-white hover:text-slate-600'}`}
              >
                {s.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedSubjectId && (
        <div className="flex gap-2 bg-brand-bg p-1 rounded-2xl w-fit ml-auto shadow-sm">
          <button
            onClick={() => setActiveTab('grades')}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${activeTab === 'grades' ? 'bg-surface text-indigo-600 shadow-sm' : 'text-text-muted'}`}
          >
            <Edit3 size={14} /> Calificaciones
          </button>
          <button
            onClick={() => {
              if (hasUnsavedChanges && activeTab === 'grades') {
                alert('⚠️ TIENES CALIFICACIONES PENDIENTES DE GUARDAR.\n\nPor favor, pulsa el botón "GUARDAR" antes de cambiar a la pestaña de Actas y Resultados.');
                return;
              }
              setActiveTab('results');
            }}
            className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-2 transition-all ${activeTab === 'results' ? 'bg-surface text-emerald-600 shadow-sm' : 'text-text-muted'}`}
          >
            <BarChart3 size={14} /> Ver Promedios
          </button>
        </div>
      )}

      {selectedSubjectId && (
        <div className="bg-surface rounded-[2rem] border border-border-main shadow-2xl overflow-hidden animate-fade-in">
          {/* Barra de Protección Local-First y Auto-guardado */}
          <div className="mx-4 mt-3 mb-1 px-4 py-2.5 bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="flex h-2.5 w-2.5 relative shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              <span className="font-bold text-emerald-800 dark:text-emerald-300 text-[11px] truncate">
                🛡️ Modo Seguro Activo: Cada nota se guarda al instante en tu equipo (inmune a fallas de internet).
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {syncState === 'saving' && (
                <span className="text-indigo-600 dark:text-indigo-400 text-[10px] font-black uppercase flex items-center gap-1 animate-pulse">
                  <Loader2 size={13} className="animate-spin" /> Guardando en la nube...
                </span>
              )}
              {syncState === 'synced' && (
                <span className="text-emerald-700 dark:text-emerald-400 text-[10px] font-black uppercase flex items-center gap-1">
                  <CheckCircle2 size={13} /> Sincronizado en la nube
                </span>
              )}
              {syncState === 'local_saved' && (
                <span className="text-emerald-700 dark:text-emerald-300 text-[10px] font-black uppercase flex items-center gap-1">
                  <ShieldCheck size={14} className="text-emerald-600" /> A salvo en este equipo
                </span>
              )}
              {syncState === 'offline_queued' && (
                <span className="text-amber-700 dark:text-amber-400 text-[10px] font-black uppercase flex items-center gap-1">
                  <CloudOff size={13} /> Sin señal: Notas seguras localmente
                </span>
              )}
              {lastSavedTime && (
                <span className="text-slate-400 font-medium normal-case text-[9px]">
                  ({lastSavedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})
                </span>
              )}
              {hasUnsavedChanges && (
                <button
                  type="button"
                  onClick={save}
                  disabled={isSaving || !isEditable}
                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase shadow transition-all shrink-0 cursor-pointer"
                >
                  {isSaving ? 'Guardando...' : 'Sincronizar Ya'}
                </button>
              )}
            </div>
          </div>

          <div className="p-3 border-b border-border-main flex flex-wrap items-center justify-between gap-3 bg-surface">
            <div className="flex items-center gap-3">
              <h3 className="text-[10px] font-black uppercase text-text-main ml-2">
                {selectedSubject?.name}
              </h3>
              {/* Controles rápidos de scroll lateral */}
              <div className="flex items-center gap-1 bg-brand-bg px-2 py-1 rounded-xl border border-border-main">
                <button
                  type="button"
                  onClick={() => handleHorizontalScroll('left')}
                  className="p-1 rounded-lg hover:bg-surface text-text-muted hover:text-indigo-600 transition-colors cursor-pointer"
                  title="Desplazar tabla a la izquierda"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="text-[9px] font-black uppercase text-text-muted px-1 select-none">
                  Scroll
                </span>
                <button
                  type="button"
                  onClick={() => handleHorizontalScroll('right')}
                  className="p-1 rounded-lg hover:bg-surface text-text-muted hover:text-indigo-600 transition-colors cursor-pointer"
                  title="Desplazar tabla a la derecha"
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {showSaveStatus === 'success' && (
                <div className="flex items-center gap-1 text-emerald-600 text-[9px] font-black uppercase">
                  <CheckCircle2 size={14} /> ¡Guardado {config.year}!
                </div>
              )}
              {showSaveStatus === 'error' && (
                <div className="flex items-center gap-1 text-rose-600 text-[9px] font-black uppercase tracking-tighter">
                  <AlertCircle size={14} /> Error
                </div>
              )}
              <button
                type="button"
                onClick={() => setHideStudentNames((prev) => !prev)}
                className={`px-4 py-2.5 rounded-xl font-black uppercase text-[10px] shadow-sm flex items-center gap-1.5 transition-all cursor-pointer border ${
                  hideStudentNames
                    ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-500/20'
                    : 'bg-brand-bg hover:bg-slate-200 dark:hover:bg-slate-800 text-text-main border-border-main'
                }`}
                title={hideStudentNames ? 'Mostrar nombres completos de estudiantes' : 'Ocultar nombres para ver más columnas de notas en pantalla'}
              >
                {hideStudentNames ? <Eye size={15} /> : <EyeOff size={15} />}
                <span className="hidden sm:inline">{hideStudentNames ? 'Mostrar Nombres' : 'Ocultar Nombres'}</span>
                <span className="sm:hidden">{hideStudentNames ? 'Nombres' : 'Ocultar'}</span>
              </button>
              <button
                onClick={handleImportFromMiAula}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 transition-all cursor-pointer border border-purple-400/30"
                title="Importar promedios de parciales registrados en Mi Aula para este curso y asignatura"
              >
                <ScrollText size={16} /> JALAR NOTAS DE MI AULA
              </button>
              <button
                onClick={printGradesPDF}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 transition-all hover:bg-indigo-700"
              >
                <Printer size={16} /> IMPRIMIR PDF
              </button>
              <button
                onClick={save}
                disabled={isSaving || !isEditable}
                className={`px-8 py-2.5 rounded-xl font-black uppercase text-[10px] shadow-lg flex items-center gap-2 transition-all cursor-pointer ${
                  hasUnsavedChanges
                    ? 'bg-amber-600 hover:bg-amber-700 text-white ring-4 ring-amber-300 animate-pulse'
                    : 'bg-slate-900 hover:bg-slate-800 text-white'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}{' '}
                {hasUnsavedChanges ? 'GUARDAR CAMBIOS *' : 'GUARDAR'}
              </button>
            </div>
          </div>
          <div
            ref={tableScrollRef}
            className="overflow-x-auto w-full pb-2"
          >
            <table
              className={`w-full text-left border-collapse ${
                activeTab === 'grades' ? 'min-w-[1380px]' : 'min-w-[820px]'
              }`}
            >
              <thead>
                {activeTab === 'grades' ? (
                  <>
                    <tr className="bg-slate-900 text-white text-[7px] font-black uppercase tracking-tight">
                      <th
                        className={`p-2 border-r border-white/10 sticky left-0 bg-slate-900 z-40 text-center transition-all ${
                          hideStudentNames ? 'w-14 min-w-[56px]' : 'w-10 min-w-[40px]'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          <span>Nº</span>
                          <button
                            type="button"
                            onClick={() => setHideStudentNames((prev) => !prev)}
                            className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title={hideStudentNames ? 'Mostrar nombres de estudiantes' : 'Ocultar nombres para ver más columnas'}
                          >
                            {hideStudentNames ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
                          </button>
                        </div>
                      </th>
                      {!hideStudentNames && (
                        <th className="p-2 border-r border-white/10 sticky left-10 bg-slate-900 z-40 w-56 min-w-[220px] max-w-[220px] shadow-xl">
                          Estudiante
                        </th>
                      )}
                      {config.competencies.map((c) => (
                        <th
                          key={c.id}
                          colSpan={8}
                          className="p-1 text-center border-r border-white/10 align-middle leading-tight h-10 min-w-[340px]"
                        >
                          <div className="line-clamp-2 px-2 text-[9px] font-black">{c.name}</div>
                        </th>
                      ))}
                    </tr>
                    <tr className="bg-slate-50 text-[7px] font-black uppercase text-slate-400 text-center">
                      <th className={`p-0 border-r border-slate-200 sticky left-0 bg-slate-50 z-30 ${hideStudentNames ? 'w-14 min-w-[56px]' : 'w-10 min-w-[40px]'}`}></th>
                      {!hideStudentNames && (
                        <th className="p-0 border-r border-slate-200 sticky left-10 bg-slate-50 z-30 w-56 min-w-[220px] max-w-[220px]"></th>
                      )}
                      {config.competencies.map((c) =>
                        config.periods.map((p) => (
                          <React.Fragment key={`${c.id}_${p}`}>
                            <th
                              className={`p-1 border-r border-slate-200 ${c.color} text-slate-700 w-12 min-w-[46px] text-center font-black`}
                            >
                              {p}
                            </th>
                            <th
                              className={`p-1 border-r border-slate-200 ${c.rColor} text-slate-400 font-normal w-10 min-w-[38px] text-center`}
                            >
                              R
                            </th>
                          </React.Fragment>
                        ))
                      )}
                    </tr>
                  </>
                ) : (
                  <tr className="bg-slate-900 text-white text-[7px] font-black uppercase tracking-tight">
                    <th className={`p-2 border-r border-white/10 sticky left-0 bg-slate-900 z-40 text-center transition-all ${hideStudentNames ? 'w-14 min-w-[56px]' : 'w-10 min-w-[40px]'}`}>
                      <div className="flex items-center justify-center gap-0.5">
                        <span>Nº</span>
                        <button
                          type="button"
                          onClick={() => setHideStudentNames((prev) => !prev)}
                          className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title={hideStudentNames ? 'Mostrar nombres' : 'Ocultar nombres'}
                        >
                          {hideStudentNames ? <ChevronRight size={11} /> : <ChevronLeft size={11} />}
                        </button>
                      </div>
                    </th>
                    {!hideStudentNames && (
                      <th className="p-2 border-r border-white/10 sticky left-10 bg-slate-900 z-40 w-56 min-w-[220px] max-w-[220px] shadow-xl">
                        Estudiante
                      </th>
                    )}
                    {config.competencies.map((c) => (
                      <th key={`res_${c.id}`} className="p-2 text-center border-r border-white/10 min-w-[70px]">
                        {c.short}
                      </th>
                    ))}
                    <th className="p-2 text-center bg-indigo-800 border-r border-white/10 min-w-[70px]">PROM</th>
                    {isSecundario ? (
                      <>
                        <th className="p-2 text-center bg-amber-600 border-r border-white/10 w-14 min-w-[56px]">
                          CP
                        </th>
                        <th className="p-2 text-center bg-orange-700 border-r border-white/10 w-14 min-w-[56px]">
                          EX
                        </th>
                        <th className="p-2 text-center bg-rose-800 border-r border-white/10 w-14 min-w-[56px]">
                          E1
                        </th>
                        <th className="p-2 text-center bg-rose-900 w-14 min-w-[56px]">E2</th>
                      </>
                    ) : (
                      <th className="p-2 text-center bg-rose-800 min-w-[110px]">Recuperación Final</th>
                    )}
                    <th className="p-2 text-center bg-slate-950 min-w-[60px]">Final</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100 text-[10px] font-black">
                {students.map((s, idx) => {
                  const isSelected = focusedStudentId === s.id;

                  return (
                    <tr
                      key={s.id}
                      onClick={() => setFocusedStudentId(s.id)}
                      className={`transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/90 dark:bg-indigo-950/60 ring-2 ring-inset ring-indigo-500/50 dark:ring-indigo-400/50'
                          : 'hover:bg-brand-bg'
                      }`}
                    >
                      <td
                        className={`p-1 border-r border-border-main sticky left-0 z-10 text-center transition-all ${
                          isSelected
                            ? 'bg-indigo-100 dark:bg-indigo-900 border-l-4 border-l-indigo-600 text-indigo-950 dark:text-indigo-100'
                            : 'bg-surface'
                        } ${
                          hideStudentNames ? 'w-14 min-w-[56px]' : 'w-10 min-w-[40px]'
                        }`}
                        title={(() => {
                          const surname = `${s.first_surname || s.lastName || s.last_name || s.apellidos || ''} ${s.second_surname || ''}`.trim();
                          const names = s.names || s.firstName || s.first_name || s.name || '';
                          return surname && names ? `${surname}, ${names}` : surname || names || 'Estudiante';
                        })()}
                      >
                        {hideStudentNames ? (
                          <div className="flex items-center justify-center">
                            <span className={`inline-flex items-center justify-center min-w-[28px] h-6 px-1 rounded-lg font-mono text-[11px] font-black border ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-700'
                                : 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 border-indigo-100 dark:border-indigo-900'
                            }`}>
                              #{getStudentOrderNumber(s) ?? (idx + 1)}
                            </span>
                          </div>
                        ) : (
                          <span className={`${isSelected ? 'text-indigo-950 dark:text-indigo-100 font-black' : 'text-text-muted'} font-mono font-bold`}>
                            {(getStudentOrderNumber(s) ?? (idx + 1)).toString().padStart(2, '0')}
                          </span>
                        )}
                      </td>
                      {!hideStudentNames && (
                        <td className={`p-1 border-r border-border-main sticky left-10 z-10 font-black uppercase min-w-[220px] max-w-[220px] w-56 transition-all ${
                          isSelected
                            ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-950 dark:text-indigo-100'
                            : 'bg-surface text-text-main'
                        }`}>
                          <div className="flex items-center justify-between gap-2 w-full">
                            <span className="truncate">
                              {(() => {
                                const surname = `${s.first_surname || s.lastName || s.last_name || s.apellidos || ''} ${s.second_surname || ''}`.trim();
                                const names = s.names || s.firstName || s.first_name || s.name || '';
                                return surname && names ? `${surname}, ${names}` : surname || names || 'Estudiante';
                              })()}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                fetchStudentConsolidatedGrades(s);
                              }}
                              title="Ver Boletín de Calificaciones"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl transition-all flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 cursor-pointer"
                            >
                              <FileText size={12} />
                            </button>
                          </div>
                        </td>
                      )}
                      {activeTab === 'grades' ? (
                        config.competencies.map((c) =>
                          config.periods.map((p) => {
                            const pL = p.toLowerCase();
                            const kVal = `${c.id}_${pL}`;
                            const kRec = `${c.id}_r${pL}`;
                            return (
                              <React.Fragment key={`${s.id}_${c.id}_${p}`}>
                                <td className={`p-0 border-r border-border-main ${isSelected ? 'bg-indigo-100/40 dark:bg-indigo-950/40' : c.color} text-center align-middle w-12 min-w-[46px] transition-colors`}>
                                  <input
                                    ref={(el) => {
                                      inputRefs.current[`${s.id}_${kVal}`] = el;
                                    }}
                                    type="text"
                                    maxLength={3}
                                    value={grades[`${s.id}_${kVal}`] || ''}
                                    onChange={(e) => handleGradeChange(s.id, kVal, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, idx, kVal)}
                                    onPaste={(e) => handleGradePaste(e, idx, kVal)}
                                    onFocus={(e) => {
                                      e.target.select();
                                      setFocusedStudentId(s.id);
                                    }}
                                    onClick={() => setFocusedStudentId(s.id)}
                                    className={`w-full h-8 bg-transparent text-center px-0 text-xs leading-none outline-none focus:bg-surface focus:ring-1 focus:ring-indigo-500 rounded-none disabled:opacity-50 disabled:cursor-not-allowed ${
                                      grades[`${s.id}_${kVal}`] !== undefined && grades[`${s.id}_${kVal}`] !== '' && parseInt(grades[`${s.id}_${kVal}`]) < minPassingGrade
                                        ? 'text-rose-600 dark:text-rose-400 font-black'
                                        : 'font-black text-slate-900 dark:text-white'
                                    }`}
                                    placeholder=""
                                    disabled={!isEditable}
                                  />
                                </td>
                                <td className={`p-0 border-r border-border-main ${isSelected ? 'bg-indigo-100/30 dark:bg-indigo-950/30' : c.rColor} text-center align-middle w-10 min-w-[38px] transition-colors`}>
                                  <input
                                    ref={(el) => {
                                      inputRefs.current[`${s.id}_${kRec}`] = el;
                                    }}
                                    type="text"
                                    maxLength={3}
                                    value={grades[`${s.id}_${kRec}`] || ''}
                                    onChange={(e) => handleGradeChange(s.id, kRec, e.target.value)}
                                    onKeyDown={(e) => handleKeyDown(e, idx, kRec)}
                                    onPaste={(e) => handleGradePaste(e, idx, kRec)}
                                    onFocus={(e) => {
                                      e.target.select();
                                      setFocusedStudentId(s.id);
                                    }}
                                    onClick={() => setFocusedStudentId(s.id)}
                                    className={`w-full h-8 bg-transparent text-center px-0 text-[10px] leading-none outline-none focus:bg-surface focus:ring-1 focus:ring-indigo-500 rounded-none disabled:opacity-50 disabled:cursor-not-allowed ${
                                      grades[`${s.id}_${kRec}`] !== undefined && grades[`${s.id}_${kRec}`] !== '' && parseInt(grades[`${s.id}_${kRec}`]) < minPassingGrade
                                        ? 'text-rose-600 dark:text-rose-400 font-black'
                                        : 'font-bold text-text-muted'
                                    }`}
                                    placeholder=""
                                    disabled={!isEditable}
                                  />
                                </td>
                              </React.Fragment>
                            );
                          })
                        )
                      ) : (
                        <>
                          {config.competencies.map((c) => {
                            const compAvg = calculateCompAvg(s.id, c.id);
                            const isFail = compAvg > 0 && compAvg < minPassingGrade;
                            return (
                              <td
                                key={`res_val_${c.id}`}
                                className={`p-0 border-r border-border-main text-center h-8 leading-8 font-black transition-colors ${
                                  isSelected ? 'bg-indigo-100/50 dark:bg-indigo-900/40' : 'bg-surface'
                                } ${
                                  isFail ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-700 dark:text-indigo-400'
                                }`}
                              >
                                {compAvg.toFixed(0)}
                              </td>
                            );
                          })}
                          {(() => {
                            const finalVal = calculateAreaFinal(s.id);
                            const isFinalFail = finalVal > 0 && finalVal < minPassingGrade;
                            return (
                              <td className={`p-0 border-r border-border-main text-center text-sm font-black h-8 leading-8 transition-colors ${
                                isSelected ? 'bg-indigo-100/60 dark:bg-indigo-900/50' : 'bg-indigo-50/10'
                              } ${
                                isFinalFail ? 'text-rose-600 dark:text-rose-400' : 'text-indigo-500'
                              }`}>
                                {finalVal}
                              </td>
                            );
                          })()}

                          {isSecundario ? (
                            <>
                              {/* COMPLETIVO: 50/50 */}
                              <td className={`p-0 border-r border-border-main text-center transition-colors ${
                                isSelected ? 'bg-indigo-100/40 dark:bg-indigo-950/40' : 'bg-amber-50/10'
                              }`}>
                                <input
                                  ref={(el) => {
                                    inputRefs.current[`${s.id}_comp`] = el;
                                  }}
                                  type="text"
                                  maxLength={3}
                                  value={grades[`${s.id}_comp`] || ''}
                                  onChange={(e) => handleGradeChange(s.id, 'comp', e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, idx, 'comp')}
                                  onPaste={(e) => handleGradePaste(e, idx, 'comp')}
                                  onFocus={(e) => {
                                    e.target.select();
                                    setFocusedStudentId(s.id);
                                  }}
                                  onClick={() => setFocusedStudentId(s.id)}
                                  className={`w-full h-8 bg-transparent text-center outline-none focus:bg-surface font-black disabled:opacity-50 disabled:cursor-not-allowed ${
                                    grades[`${s.id}_comp`] && parseInt(grades[`${s.id}_comp`]) < 70 ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700'
                                  }`}
                                  placeholder="EX"
                                  disabled={!isEditable}
                                />
                              </td>
                              {/* EXTRAORDINARIO: 30/70 */}
                              <td className={`p-0 border-r border-border-main text-center transition-colors ${
                                isSelected ? 'bg-indigo-100/40 dark:bg-indigo-950/40' : 'bg-orange-50/10'
                              }`}>
                                <input
                                  ref={(el) => {
                                    inputRefs.current[`${s.id}_extra`] = el;
                                  }}
                                  type="text"
                                  maxLength={3}
                                  value={grades[`${s.id}_extra`] || ''}
                                  onChange={(e) => handleGradeChange(s.id, 'extra', e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, idx, 'extra')}
                                  onPaste={(e) => handleGradePaste(e, idx, 'extra')}
                                  onFocus={(e) => {
                                    e.target.select();
                                    setFocusedStudentId(s.id);
                                  }}
                                  onClick={() => setFocusedStudentId(s.id)}
                                  className={`w-full h-8 bg-transparent text-center outline-none focus:bg-surface font-black disabled:opacity-50 disabled:cursor-not-allowed ${
                                    grades[`${s.id}_extra`] && parseInt(grades[`${s.id}_extra`]) < 70 ? 'text-rose-600 dark:text-rose-400' : 'text-orange-700'
                                  }`}
                                  placeholder="EX"
                                  disabled={!isEditable}
                                />
                              </td>
                              {/* ESPECIAL 1 */}
                              <td className={`p-0 border-r border-border-main text-center transition-colors ${
                                isSelected ? 'bg-indigo-100/40 dark:bg-indigo-950/40' : 'bg-rose-50/10'
                              }`}>
                                <input
                                  ref={(el) => {
                                    inputRefs.current[`${s.id}_esp1`] = el;
                                  }}
                                  type="text"
                                  maxLength={3}
                                  value={grades[`${s.id}_esp1`] || ''}
                                  onChange={(e) => handleGradeChange(s.id, 'esp1', e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, idx, 'esp1')}
                                  onPaste={(e) => handleGradePaste(e, idx, 'esp1')}
                                  onFocus={(e) => {
                                    e.target.select();
                                    setFocusedStudentId(s.id);
                                  }}
                                  onClick={() => setFocusedStudentId(s.id)}
                                  className={`w-full h-8 bg-transparent text-center outline-none focus:bg-surface font-black disabled:opacity-50 disabled:cursor-not-allowed ${
                                    grades[`${s.id}_esp1`] && parseInt(grades[`${s.id}_esp1`]) < 70 ? 'text-rose-600 dark:text-rose-400' : 'text-rose-700'
                                  }`}
                                  disabled={!isEditable}
                                />
                              </td>
                              {/* ESPECIAL 2 */}
                              <td className={`p-0 border-r border-border-main text-center transition-colors ${
                                isSelected ? 'bg-indigo-100/40 dark:bg-indigo-950/40' : 'bg-rose-100/10'
                              }`}>
                                <input
                                  ref={(el) => {
                                    inputRefs.current[`${s.id}_esp2`] = el;
                                  }}
                                  type="text"
                                  maxLength={3}
                                  value={grades[`${s.id}_esp2`] || ''}
                                  onChange={(e) => handleGradeChange(s.id, 'esp2', e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, idx, 'esp2')}
                                  onPaste={(e) => handleGradePaste(e, idx, 'esp2')}
                                  onFocus={(e) => {
                                    e.target.select();
                                    setFocusedStudentId(s.id);
                                  }}
                                  onClick={() => setFocusedStudentId(s.id)}
                                  className={`w-full h-8 bg-transparent text-center outline-none focus:bg-surface font-black disabled:opacity-50 disabled:cursor-not-allowed ${
                                    grades[`${s.id}_esp2`] && parseInt(grades[`${s.id}_esp2`]) < 70 ? 'text-rose-600 dark:text-rose-400' : 'text-rose-900'
                                  }`}
                                  disabled={!isEditable}
                                />
                              </td>
                            </>
                          ) : (
                            <td className={`p-0 text-center border-r border-border-main transition-colors ${
                              isSelected ? 'bg-indigo-100/40 dark:bg-indigo-950/40' : 'bg-rose-50/10'
                            }`}>
                              <input
                                ref={(el) => {
                                  inputRefs.current[`${s.id}_final_rec`] = el;
                                }}
                                type="text"
                                maxLength={3}
                                value={grades[`${s.id}_final_rec`] || ''}
                                onChange={(e) => handleGradeChange(s.id, 'final_rec', e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, idx, 'final_rec')}
                                onPaste={(e) => handleGradePaste(e, idx, 'final_rec')}
                                onFocus={(e) => {
                                  e.target.select();
                                  setFocusedStudentId(s.id);
                                }}
                                onClick={() => setFocusedStudentId(s.id)}
                                className="w-full h-8 bg-transparent text-center text-rose-600 outline-none focus:bg-surface font-black disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!isEditable}
                              />
                            </td>
                          )}

                          {/* CALCULO NOTA FINAL DEFINITIVA */}
                          {(() => {
                            const areaFinal = parseInt(calculateAreaFinal(s.id).toString()) || 0;
                            let defFinal: number | string = '-';
                            let isDefFail = false;

                            if (!isSecundario) {
                              const recFinal = parseInt(grades[`${s.id}_final_rec`]) || 0;
                              defFinal = Math.max(areaFinal, recFinal) || '-';
                              if (typeof defFinal === 'number' && defFinal > 0 && defFinal < 65) {
                                isDefFail = true;
                              }
                            } else {
                              if (areaFinal >= 70) {
                                defFinal = areaFinal;
                              } else {
                                const cpExam = parseInt(grades[`${s.id}_comp`]) || 0;
                                if (cpExam > 0) {
                                  const cpFinal = Math.round(areaFinal * 0.5 + cpExam * 0.5);
                                  if (cpFinal >= 70) defFinal = cpFinal;
                                }
                                if (defFinal === '-' || typeof defFinal !== 'number' || defFinal < 70) {
                                  const exExam = parseInt(grades[`${s.id}_extra`]) || 0;
                                  if (exExam > 0) {
                                    const exFinal = Math.round(areaFinal * 0.3 + exExam * 0.7);
                                    if (exFinal >= 70) defFinal = exFinal;
                                  }
                                }
                                if (defFinal === '-' || typeof defFinal !== 'number' || defFinal < 70) {
                                  const esp1 = parseInt(grades[`${s.id}_esp1`]) || 0;
                                  if (esp1 >= 70) defFinal = esp1;
                                }
                                if (defFinal === '-' || typeof defFinal !== 'number' || defFinal < 70) {
                                  const esp2 = parseInt(grades[`${s.id}_esp2`]) || 0;
                                  if (esp2 >= 70) defFinal = esp2;
                                }
                                if (defFinal === '-' || typeof defFinal !== 'number') {
                                  defFinal = areaFinal > 0 ? areaFinal : '-';
                                }
                              }
                              if (typeof defFinal === 'number' && defFinal > 0 && defFinal < 70) {
                                isDefFail = true;
                              }
                            }

                            return (
                              <td className={`p-0 text-center font-black text-xs h-8 leading-8 transition-colors ${
                                isDefFail
                                  ? 'bg-rose-950 text-rose-300 ring-1 ring-rose-500'
                                  : isSelected
                                  ? 'bg-indigo-900 text-white'
                                  : 'bg-slate-900 text-white'
                              }`}>
                                {defFinal}
                              </td>
                            );
                          })()}
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isSummaryModalOpen && selectedSummaryStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 lg:pl-[280px] overflow-y-auto">
          <div className="relative bg-surface rounded-3xl w-full max-w-6xl shadow-2xl border border-border-main flex flex-col my-8 animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="p-6 border-b border-border-main flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 dark:bg-slate-800 dark:text-indigo-400 rounded-2xl">
                  <ScrollText size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-text-main">
                    Resumen de Calificaciones Consolidadas
                  </h3>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                    Boletín Académico
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase text-text-muted">
                    Periodos a promediar:
                  </span>
                  <select
                    value={summaryPeriodDivisor}
                    onChange={(e) => setSummaryPeriodDivisor(Number(e.target.value))}
                    className="bg-slate-50 border-2 border-slate-100 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase focus:border-indigo-500 outline-none"
                  >
                    <option value={1}>P1</option>
                    <option value={2}>P1 - P2</option>
                    <option value={3}>P1 - P3</option>
                    <option value={4}>P1 - P4</option>
                  </select>
                </div>

                <button
                  onClick={() => downloadSingleBoletinPDF(selectedSummaryStudent)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase text-[10px] shadow-md flex items-center gap-2 transition-all"
                >
                  <Printer size={14} /> Descargar PDF
                </button>

                <button
                  onClick={() => {
                    setIsSummaryModalOpen(false);
                    setSelectedSummaryStudent(null);
                  }}
                  className="p-2 text-text-muted hover:text-text-main rounded-xl hover:bg-slate-50 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Student Info Bar */}
            <div className="px-6 py-4 bg-slate-50 border-b border-border-main">
              {(() => {
                const family = selectedSummaryStudent.family || [];
                let parentsName = 'No registrado';
                if (family.length > 0) {
                  const parents = family.filter(
                    (f: any) =>
                      (f.relation || f.role)?.toLowerCase().includes('madre') ||
                      (f.relation || f.role)?.toLowerCase().includes('padre')
                  );
                  if (parents.length > 0) {
                    parentsName = parents.map((p: any) => p.name).join(' y ');
                  } else {
                    parentsName = family[0].name;
                  }
                }
                const studentCourse = (allCourses || []).find(
                  (c: any) => c.id === selectedSummaryStudent.course_id
                );
                const courseDisplay = studentCourse
                  ? `${studentCourse.level ? `${studentCourse.level} ` : ''}${studentCourse.grade} - ${studentCourse.section} (${getReportTanda(studentCourse.tanda, 'full')})`
                  : '';
                const levelDisplay = studentCourse?.level || '---';
                const studentCode =
                  selectedSummaryStudent.sigerd_code ||
                  selectedSummaryStudent.student_code ||
                  selectedSummaryStudent.rne ||
                  selectedSummaryStudent.id.substring(0, 7).toUpperCase();
                const studentIndex = (students || []).findIndex(
                  (s: any) => s.id === selectedSummaryStudent.id
                );
                const orderNo =
                  studentIndex !== -1 ? (studentIndex + 1).toString().padStart(2, '0') : '--';

                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-[10px] uppercase font-black">
                    <div className="p-3 bg-surface border border-border-main rounded-2xl flex flex-col justify-center shadow-sm">
                      <span className="text-text-muted text-[8px] tracking-wider mb-0.5">
                        Estudiante
                      </span>
                      <span className="text-indigo-600 text-xs font-black truncate">
                        {`${selectedSummaryStudent.names || ''} ${selectedSummaryStudent.first_surname || ''} ${selectedSummaryStudent.second_surname || ''}`
                          .trim()
                          .toUpperCase()}
                      </span>
                      <span className="text-text-muted text-[8px] mt-0.5">
                        Nº de Orden:{' '}
                        <span className="text-slate-800 dark:text-slate-200 font-black">
                          {orderNo}
                        </span>
                      </span>
                    </div>

                    <div className="p-3 bg-surface border border-border-main rounded-2xl flex flex-col justify-center shadow-sm">
                      <span className="text-text-muted text-[8px] tracking-wider mb-0.5">
                        Grado / Nivel
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 text-xs font-black truncate">
                        {courseDisplay}
                      </span>
                      <span className="text-text-muted text-[8px] mt-0.5">{levelDisplay}</span>
                    </div>

                    <div className="p-3 bg-surface border border-border-main rounded-2xl flex flex-col justify-center shadow-sm">
                      <span className="text-text-muted text-[8px] tracking-wider mb-0.5">
                        Código SIGERD / Año
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 text-xs font-black">
                        {studentCode}
                      </span>
                      <span className="text-text-muted text-[8px] mt-0.5">
                        Año Escolar:{' '}
                        <span className="text-slate-800 dark:text-slate-200 font-black">
                          {selectedYear || '2026-2027'}
                        </span>
                      </span>
                    </div>

                    <div className="p-3 bg-surface border border-border-main rounded-2xl flex flex-col justify-center shadow-sm">
                      <span className="text-text-muted text-[8px] tracking-wider mb-0.5">
                        Padres o Tutor(a)
                      </span>
                      <span
                        className="text-slate-800 dark:text-slate-200 text-xs font-black truncate"
                        title={parentsName}
                      >
                        {parentsName}
                      </span>
                      <span className="text-text-muted text-[8px] mt-0.5">
                        Relación: Madre/Padre
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Table Content */}
            <div className="p-6 overflow-x-auto max-h-[60vh]">
              {isLoadingSummary ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Loader2 className="animate-spin text-indigo-600" size={32} />
                  <span className="text-[10px] font-black uppercase text-text-muted">
                    Cargando Calificaciones Consolidadas...
                  </span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-wider">
                      <th className="p-3 border border-slate-800 w-1/4">
                        Área Curricular (Materia)
                      </th>
                      {(() => {
                        const studentCourse = (allCourses || []).find(
                          (c: any) => c.id === selectedSummaryStudent.course_id
                        );
                        const isStudentSecundario = studentCourse?.level
                          ?.toLowerCase()
                          .includes('secund');
                        const comps = isStudentSecundario
                          ? [
                              { short: 'C1', name: 'Comunicativa' },
                              { short: 'C2', name: 'Pensamiento Lógico' },
                              { short: 'C3', name: 'Ética y Ciudadana' },
                              { short: 'C4', name: 'Científica y Tec.' }
                            ]
                          : [
                              { short: 'C1', name: 'Comunicativa' },
                              { short: 'C2', name: 'Pensamiento Lógico' },
                              { short: 'C3', name: 'Ética y Ciudadana' }
                            ];
                        return (
                          <>
                            {comps.map((c) => (
                              <th
                                key={c.short}
                                className="p-3 border border-slate-800 text-center"
                                title={c.name}
                              >
                                {c.short}
                              </th>
                            ))}
                            <th className="p-3 border border-slate-800 text-center bg-indigo-800">
                              C.FA
                            </th>
                            {isStudentSecundario ? (
                              <>
                                <th className="p-3 border border-slate-800 text-center bg-amber-700 w-12">
                                  CP
                                </th>
                                <th className="p-3 border border-slate-800 text-center bg-orange-700 w-12">
                                  EX
                                </th>
                                <th className="p-3 border border-slate-800 text-center bg-rose-800 w-12">
                                  E1
                                </th>
                                <th className="p-3 border border-slate-800 text-center bg-rose-900 w-12">
                                  E2
                                </th>
                              </>
                            ) : (
                              <th className="p-3 border border-slate-800 text-center bg-rose-800 w-16">
                                RP
                              </th>
                            )}
                            <th className="p-3 border border-slate-800 text-center bg-slate-950 w-16">
                              C.D
                            </th>
                          </>
                        );
                      })()}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[10px] font-black text-text-main">
                    {(() => {
                      const studentCourse = (allCourses || []).find(
                        (c: any) => c.id === selectedSummaryStudent.course_id
                      );
                      const isStudentSecundario = studentCourse?.level
                        ?.toLowerCase()
                        .includes('secund');
                      const comps = isStudentSecundario
                        ? [
                            { id: 'c2', short: 'C1' },
                            { id: 'c3', short: 'C2' },
                            { id: 'c1', short: 'C3' },
                            { id: 'c4', short: 'C4' }
                          ]
                        : [
                            { id: 'c1', short: 'C1' },
                            { id: 'c2', short: 'C2' },
                            { id: 'c3', short: 'C3' }
                          ];

                      const getBestGradeForModal = (sGrades: any, cId: string, p: string) => {
                        const pL = p.toLowerCase();
                        const g = parseInt(sGrades[`${cId}_${pL}`]) || 0;
                        const r = parseInt(sGrades[`${cId}_r${pL}`]) || 0;
                        return Math.max(g, r);
                      };

                      const getCompFinalVal = (sGrades: any, cId: string) => {
                        let sum = 0;
                        config.periods.forEach((p, idx) => {
                          if (summaryPeriodDivisor > idx) {
                            sum += getBestGradeForModal(sGrades, cId, p);
                          }
                        });
                        return Math.round(sum / summaryPeriodDivisor) || 0;
                      };

                      let sumC1 = 0,
                        sumC2 = 0,
                        sumC3 = 0,
                        sumC4 = 0,
                        sumFinal = 0;
                      let count = 0;

                      const rows = allCourseSubjects.map((sub) => {
                        const sGrades = studentSummaryGrades[sub.id] || {};
                        const cfValues = comps.map((c) => getCompFinalVal(sGrades, c.id));
                        const finalArea =
                          cfValues.length > 0
                            ? Math.round(cfValues.reduce((a, b) => a + b, 0) / cfValues.length)
                            : 0;

                        let defFinal = finalArea;
                        let cp = 0,
                          ex = 0,
                          e1 = 0,
                          e2 = 0,
                          rp = 0;

                        if (isStudentSecundario) {
                          cp = parseInt(sGrades['comp']) || 0;
                          ex = parseInt(sGrades['extra']) || 0;
                          e1 = parseInt(sGrades['esp1']) || 0;
                          e2 = parseInt(sGrades['esp2']) || 0;

                          if (finalArea < 70) {
                            if (cp > 0) {
                              const cpFinal = Math.round(finalArea * 0.5 + cp * 0.5);
                              if (cpFinal >= 70) defFinal = cpFinal;
                            }
                            if (defFinal < 70 && ex > 0) {
                              const exFinal = Math.round(finalArea * 0.3 + ex * 0.7);
                              if (exFinal >= 70) defFinal = exFinal;
                            }
                            if (defFinal < 70 && e1 >= 70) {
                              defFinal = e1;
                            }
                            if (defFinal < 70 && e2 >= 70) {
                              defFinal = e2;
                            }
                          }
                        } else {
                          rp = parseInt(sGrades['final_rec']) || 0;
                          defFinal = Math.max(finalArea, rp);
                        }

                        if (defFinal > 0) {
                          sumFinal += defFinal;
                          count++;
                        }
                        if (finalArea > 0) {
                          sumC1 += cfValues[0] || 0;
                          sumC2 += cfValues[1] || 0;
                          sumC3 += cfValues[2] || 0;
                          if (isStudentSecundario) {
                            sumC4 += cfValues[3] || 0;
                          }
                        }

                        return (
                          <tr
                            key={sub.id}
                            className="hover:bg-slate-50 transition-all border-b border-slate-100"
                          >
                            <td className="p-3 border border-slate-100 font-bold uppercase">
                              {sub.name}
                            </td>
                            {cfValues.map((val, idx) => (
                              <td
                                key={idx}
                                className={`p-3 border border-slate-100 text-center ${
                                  val > 0 && val < (isStudentSecundario ? 70 : 65)
                                    ? 'text-rose-600 font-black'
                                    : ''
                                }`}
                              >
                                {val || '-'}
                              </td>
                            ))}
                            <td
                              className={`p-3 border border-slate-100 text-center bg-indigo-50/40 font-black ${
                                finalArea > 0 && finalArea < (isStudentSecundario ? 70 : 65)
                                  ? 'text-rose-600'
                                  : 'text-indigo-700'
                              }`}
                            >
                              {finalArea || '-'}
                            </td>
                            {isStudentSecundario ? (
                              <>
                                <td
                                  className={`p-3 border border-slate-100 text-center font-black ${
                                    cp > 0 && cp < 70 ? 'text-rose-600' : 'text-amber-700'
                                  }`}
                                >
                                  {cp || '-'}
                                </td>
                                <td
                                  className={`p-3 border border-slate-100 text-center font-black ${
                                    ex > 0 && ex < 70 ? 'text-rose-600' : 'text-orange-700'
                                  }`}
                                >
                                  {ex || '-'}
                                </td>
                                <td
                                  className={`p-3 border border-slate-100 text-center font-black ${
                                    e1 > 0 && e1 < 70 ? 'text-rose-600' : 'text-rose-700'
                                  }`}
                                >
                                  {e1 || '-'}
                                </td>
                                <td
                                  className={`p-3 border border-slate-100 text-center font-black ${
                                    e2 > 0 && e2 < 70 ? 'text-rose-600' : 'text-rose-900'
                                  }`}
                                >
                                  {e2 || '-'}
                                </td>
                              </>
                            ) : (
                              <td className={`p-3 border border-slate-100 text-center font-black ${
                                rp > 0 && rp < 65 ? 'text-rose-600' : 'text-rose-700'
                              }`}>
                                {rp || '-'}
                              </td>
                            )}
                            <td
                              className={`p-3 border border-slate-100 text-center font-black ${
                                defFinal > 0 && defFinal < (isStudentSecundario ? 70 : 65)
                                  ? 'bg-rose-950 text-rose-300 ring-1 ring-rose-500'
                                  : 'bg-slate-900 text-white'
                              }`}
                            >
                              {defFinal || '-'}
                            </td>
                          </tr>
                        );
                      });

                      const idxRow = (
                        <tr
                          key="idx-row"
                          className="bg-slate-50 text-[10px] font-black border-t-2 border-slate-200"
                        >
                          <td className="p-3 border border-slate-100 text-right text-indigo-600 uppercase font-black">
                            Índice Académico (GPA)
                          </td>
                          <td className="p-3 border border-slate-100 text-center text-indigo-600">
                            {count > 0 ? (sumC1 / count / 25).toFixed(2) : '0.00'}
                          </td>
                          <td className="p-3 border border-slate-100 text-center text-indigo-600">
                            {count > 0 ? (sumC2 / count / 25).toFixed(2) : '0.00'}
                          </td>
                          <td className="p-3 border border-slate-100 text-center text-indigo-600">
                            {count > 0 ? (sumC3 / count / 25).toFixed(2) : '0.00'}
                          </td>
                          {isStudentSecundario && (
                            <td className="p-3 border border-slate-100 text-center text-indigo-600">
                              {count > 0 ? (sumC4 / count / 25).toFixed(2) : '0.00'}
                            </td>
                          )}
                          <td className="p-3 border border-slate-100 text-center bg-indigo-50 text-indigo-700">
                            {count > 0 ? (sumFinal / count / 25).toFixed(2) : '0.00'}
                          </td>
                          {isStudentSecundario ? (
                            <>
                              <td className="p-3 border border-slate-100"></td>
                              <td className="p-3 border border-slate-100"></td>
                              <td className="p-3 border border-slate-100"></td>
                              <td className="p-3 border border-slate-100"></td>
                            </>
                          ) : (
                            <td className="p-3 border border-slate-100"></td>
                          )}
                          <td className="p-3 border border-slate-100 text-center bg-slate-900 text-white">
                            {count > 0 ? (sumFinal / count / 25).toFixed(2) : '0.00'}
                          </td>
                        </tr>
                      );

                      return [...rows, idxRow];
                    })()}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-border-main bg-slate-50 flex items-center justify-between text-[9px] text-text-muted font-bold uppercase rounded-b-3xl">
              <div>
                * Leyenda: C.FA = Calif. Final del Área | CP = Completivo | EX = Extraordinario |
                E1/E2 = Especial | RP = Recup. Final | C.D = Calif. Definitiva
              </div>
              <div>EduGens v41.0</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
