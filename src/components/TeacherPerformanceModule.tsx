import React, { useState, useEffect, useMemo } from 'react';
import { useApp, useSupabase } from '../context/AppContext';
import { supabase, fetchAllRows } from '../lib/supabase';
import { TeacherRecordForm } from './TeacherRecordForm';
import {
  staffEvaluationService,
  StaffEvaluationGroup,
  EvaluationPeriod,
  EvaluationRubricTemplate,
  StaffEvaluationRecord,
  ActiveSurveyBroadcast,
  calculateLevelFromAverage,
  getDefaultRubricTemplates
} from '../services/staffEvaluationService';
import { getCurrentPeriod } from '../utils/dateUtils';
import {
  BarChart3,
  Users,
  ShieldCheck,
  Briefcase,
  UserCheck,
  HeartHandshake,
  ClipboardCheck,
  Send,
  Sliders,
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Pencil,
  Eye,
  X,
  Search,
  Award,
  TrendingUp,
  RotateCcw,
  Sparkles,
  Calendar,
  BookOpen,
  Layers,
  MessageSquare,
  Printer,
  Clock,
  ArrowUpDown,
  ArrowDown,
  RefreshCw
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-hot-toast';

type MainTab =
  | 'dashboard'
  | 'teacher'
  | 'management'
  | 'administrative'
  | 'support'
  | 'surveys'
  | 'rubrics'
  | 'attendance';

type PeriodFilter = 'ALL' | 'P1' | 'P2' | 'P3' | 'P4' | 'COMPARE';

const GROUP_LABELS: Record<
  StaffEvaluationGroup,
  { title: string; short: string; color: string; icon: any; badgeClass: string }
> = {
  teacher: {
    title: 'Equipo Docente',
    short: 'Docentes',
    color: '#4f46e5',
    icon: Briefcase,
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  management: {
    title: 'Equipo de Gestión / Directivo',
    short: 'Gestión',
    color: '#059669',
    icon: ShieldCheck,
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  administrative: {
    title: 'Equipo Administrativo',
    short: 'Administrativo',
    color: '#2563eb',
    icon: UserCheck,
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  support: {
    title: 'Personal de Apoyo y Planta Física',
    short: 'Apoyo',
    color: '#0d9488',
    icon: HeartHandshake,
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200'
  }
};

export const TeacherPerformanceModule: React.FC = () => {
  const { state, center, selectedYear } = useApp();
  const { profile, user } = useSupabase();
  const centerId = center?.id || profile?.center_id || 'default';
  const schoolYear = selectedYear || '2026-2027';

  const [activeTab, setActiveTab] = useState<MainTab>('dashboard');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>(() => getCurrentPeriod() as PeriodFilter);
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'Primaria' | 'Secundaria'>('ALL');
  const [comparePeriodA, setComparePeriodA] = useState<EvaluationPeriod>(() => getCurrentPeriod() as EvaluationPeriod);
  const [comparePeriodB, setComparePeriodB] = useState<EvaluationPeriod>('P2');
  const [searchQuery, setSearchQuery] = useState('');

  const [rubrics, setRubrics] = useState<Record<string, EvaluationRubricTemplate>>(() =>
    getDefaultRubricTemplates(centerId, center?.name || 'Centro Educativo Cristiano Génesis')
  );
  const [evaluations, setEvaluations] = useState<StaffEvaluationRecord[]>([]);
  const [broadcasts, setBroadcasts] = useState<ActiveSurveyBroadcast[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal de Aplicación de Ficha de Evaluación
  const [evaluatingStaff, setEvaluatingStaff] = useState<{
    staff: any;
    group: StaffEvaluationGroup;
    period: EvaluationPeriod;
    academicLevel?: 'Primaria' | 'Secundaria' | 'General';
    existingRecord?: StaffEvaluationRecord;
  } | null>(null);
  const [formAcademicLevel, setFormAcademicLevel] = useState<'Primaria' | 'Secundaria' | 'General'>('Primaria');
  const [formScores, setFormScores] = useState<Record<string, number>>({});
  const [formCriteriaObservations, setFormCriteriaObservations] = useState<Record<string, string>>(
    {}
  );
  const [formReflectiveAnswers, setFormReflectiveAnswers] = useState<Record<string, string>>({});
  const [showDidacticSequence, setShowDidacticSequence] = useState(false);
  const [formDidacticAnswers, setFormDidacticAnswers] = useState<Record<string, string>>({});
  const [formDidacticObservations, setFormDidacticObservations] = useState('');
  const [formCourseId, setFormCourseId] = useState('');
  const [formCourseName, setFormCourseName] = useState('');
  const [formSubjectName, setFormSubjectName] = useState('');
  const [formAppliedDate, setFormAppliedDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [formAppliedTime, setFormAppliedTime] = useState('');
  const [formCoordinatorName, setFormCoordinatorName] = useState('');
  const [formStrengths, setFormStrengths] = useState('');
  const [formImprovements, setFormImprovements] = useState('');
  const [formCommitments, setFormCommitments] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSavingEval, setIsSavingEval] = useState(false);

  // Modal de Reporte Individual Detallado
  const [viewingStaffDetail, setViewingStaffDetail] = useState<{
    staff: any;
    group: StaffEvaluationGroup;
  } | null>(null);

  // Estado para Editor de Instrumentos / Rúbricas
  const [selectedRubricKey, setSelectedRubricKey] = useState<string>('teacher');
  const [editingRubric, setEditingRubric] = useState<EvaluationRubricTemplate | null>(null);
  const [isSavingRubric, setIsSavingRubric] = useState(false);

  // Estado para Nueva Convocatoria de Encuesta a Alumnos y Padres
  const [newBroadcastTitle, setNewBroadcastTitle] = useState(
    'Evaluación de Desempeño Docente por Alumnos y Familias'
  );
  const [newBroadcastDesc, setNewBroadcastDesc] = useState(
    'Por favor valora de forma objetiva y respetuosa el desempeño de cada uno de tus profesores durante este período de clases.'
  );
  const [newBroadcastPeriod, setNewBroadcastPeriod] = useState<EvaluationPeriod>(() => getCurrentPeriod() as EvaluationPeriod);
  const [newBroadcastAudience, setNewBroadcastAudience] = useState<('student' | 'parent')[]>([
    'student',
    'parent'
  ]);
  const [newBroadcastCourses, setNewBroadcastCourses] = useState<string[]>([]);
  const [isSendingSurvey, setIsSendingSurvey] = useState(false);

  const loadAllModuleData = async () => {
    setLoading(true);
    try {
      const [loadedRubrics, loadedEvals, loadedBroadcasts] = await Promise.all([
        staffEvaluationService.getRubrics(
          centerId,
          center?.name || 'Centro Educativo Cristiano Génesis'
        ),
        staffEvaluationService.getEvaluations(centerId, schoolYear),
        staffEvaluationService.getSurveyBroadcasts(centerId)
      ]);
      setRubrics(loadedRubrics);
      setEvaluations(loadedEvals);
      setBroadcasts(loadedBroadcasts);
      if (!editingRubric && loadedRubrics[selectedRubricKey]) {
        setEditingRubric(JSON.parse(JSON.stringify(loadedRubrics[selectedRubricKey])));
      }
    } catch (e) {
      console.error('Error cargando datos de seguimiento de personal:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllModuleData();
    const onEvalUpdate = () => loadAllModuleData();
    window.addEventListener('staffEvaluationsUpdated', onEvalUpdate);
    return () => window.removeEventListener('staffEvaluationsUpdated', onEvalUpdate);
  }, [centerId, schoolYear]);

  useEffect(() => {
    if (rubrics[selectedRubricKey]) {
      setEditingRubric(JSON.parse(JSON.stringify(rubrics[selectedRubricKey])));
    }
  }, [selectedRubricKey, rubrics]);

  // Cargar registros de asistencia / bitácora rápida
  useEffect(() => {
    const fetchAttendance = async () => {
      if (!center?.id) return;
      try {
        const { data } = await fetchAllRows(() =>
          supabase.from('attendance_records').select('*').eq('center_id', center.id)
        );
        setAttendanceRecords(data || []);
      } catch {}
    };
    fetchAttendance();
  }, [center?.id]);

  // Clasificar personal por cada uno de los 4 grupos
  const staffByGroup = useMemo(() => {
    const all = state.teachers || [];
    return {
      teacher: all.filter(
        (p: any) =>
          p.role === 'teacher' ||
          p.role === 'docente' ||
          p.role === 'Maestro' ||
          p.role === 'management_teacher' ||
          !p.role
      ),
      management: all.filter(
        (p: any) =>
          p.role === 'management' ||
          p.role === 'management_teacher' ||
          p.role === 'coordinator' ||
          p.role === 'director'
      ),
      administrative: all.filter(
        (p: any) =>
          p.role === 'administrative' ||
          p.role === 'cashier' ||
          p.role === 'finance' ||
          p.role === 'secretaria'
      ),
      support: all.filter((p: any) => p.role === 'support' || p.role === 'conserje')
    };
  }, [state.teachers]);

  // Evaluaciones Internas vs Encuestas de Alumnos/Padres
  const internalEvaluations = useMemo(
    () => evaluations.filter((e) => e.source === 'internal'),
    [evaluations]
  );

  const surveyEvaluations = useMemo(
    () => evaluations.filter((e) => e.source === 'student_survey' || e.source === 'parent_survey'),
    [evaluations]
  );

  // Filtrar evaluaciones internas según el filtro de período activo y nivel
  const filteredInternalEvals = useMemo(() => {
    let list = internalEvaluations;
    if (periodFilter !== 'ALL' && periodFilter !== 'COMPARE') {
      list = list.filter((e) => e.period === periodFilter);
    }
    if (levelFilter !== 'ALL') {
      list = list.filter((e) => {
        if (e.staffRole !== 'teacher') return true;
        const eLvl = e.academicLevel || (e.courseName?.toLowerCase().includes('sec') ? 'Secundaria' : 'Primaria');
        return eLvl === levelFilter;
      });
    }
    return list;
  }, [internalEvaluations, periodFilter, levelFilter]);

  // Estadísticas Globales de Salud del Centro
  const centerHealthStats = useMemo(() => {
    const groups: StaffEvaluationGroup[] = ['teacher', 'management', 'administrative', 'support'];

    const groupSummaries = groups.map((g) => {
      const members = staffByGroup[g] || [];
      const groupEvals = filteredInternalEvals.filter((e) => e.staffRole === g);

      const evaluatedStaffIds = new Set(groupEvals.map((e) => e.staffId));
      const avgScore =
        groupEvals.length > 0
          ? Number(
              (
                groupEvals.reduce((acc, cur) => acc + cur.averageScore, 0) / groupEvals.length
              ).toFixed(2)
            )
          : 0;
      const avgPercentage =
        groupEvals.length > 0
          ? Math.round(groupEvals.reduce((acc, cur) => acc + cur.percentage, 0) / groupEvals.length)
          : 0;

      const levelInfo = calculateLevelFromAverage(avgScore || 0);

      // Promedio por criterio dentro del grupo
      const rubric = rubrics[g];
      const criteriaStats = (rubric?.criteria || []).map((crit) => {
        const vals = groupEvals
          .map((ev) => ev.criteriaAverages?.[crit.id])
          .filter((v): v is number => typeof v === 'number' && v > 0);
        const cAvg =
          vals.length > 0
            ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
            : 0;
        const cPct = cAvg > 0 ? Math.round((cAvg / 4) * 100) : 0;
        return {
          id: crit.id,
          number: crit.number,
          title: crit.title,
          shortTitle:
            crit.title.length > 26 ? `${crit.number}. ${crit.title.substring(0, 24)}...` : `${crit.number}. ${crit.title}`,
          average: cAvg,
          percentage: cPct
        };
      });

      return {
        group: g,
        label: GROUP_LABELS[g].title,
        shortLabel: GROUP_LABELS[g].short,
        color: GROUP_LABELS[g].color,
        totalMembers: members.length,
        evaluatedMembers: evaluatedStaffIds.size,
        coveragePct:
          members.length > 0 ? Math.round((evaluatedStaffIds.size / members.length) * 100) : 0,
        evaluationsCount: groupEvals.length,
        avgScore,
        avgPercentage,
        levelInfo,
        criteriaStats
      };
    });

    const allWithEvals = filteredInternalEvals;
    const globalAvgScore =
      allWithEvals.length > 0
        ? Number(
            (
              allWithEvals.reduce((acc, cur) => acc + cur.averageScore, 0) / allWithEvals.length
            ).toFixed(2)
          )
        : 0;
    const globalPercentage =
      allWithEvals.length > 0
        ? Math.round(
            allWithEvals.reduce((acc, cur) => acc + cur.percentage, 0) / allWithEvals.length
          )
        : 0;

    // Distribución por escala (Excelente, Bueno, En desarrollo, Insuficiente)
    const scaleDistribution = [
      {
        name: 'Excelente (3.5 - 4.0)',
        value: allWithEvals.filter((e) => e.averageScore >= 3.5).length,
        color: '#10b981'
      },
      {
        name: 'Bueno (2.75 - 3.49)',
        value: allWithEvals.filter((e) => e.averageScore >= 2.75 && e.averageScore < 3.5).length,
        color: '#3b82f6'
      },
      {
        name: 'En desarrollo (2.0 - 2.74)',
        value: allWithEvals.filter((e) => e.averageScore >= 2.0 && e.averageScore < 2.75).length,
        color: '#f59e0b'
      },
      {
        name: 'Insuficiente (< 2.0)',
        value: allWithEvals.filter((e) => e.averageScore > 0 && e.averageScore < 2.0).length,
        color: '#ef4444'
      }
    ];

    return {
      groupSummaries,
      globalAvgScore,
      globalPercentage,
      globalLevel: calculateLevelFromAverage(globalAvgScore),
      totalEvaluations: allWithEvals.length,
      scaleDistribution
    };
  }, [staffByGroup, filteredInternalEvals, rubrics]);

  // Función para cargar los datos de evaluación de un nivel y período específicos
  const loadEvaluationForStaffLevel = (
    staff: any,
    group: StaffEvaluationGroup,
    activePeriod: EvaluationPeriod,
    targetLevel: 'Primaria' | 'Secundaria' | 'General'
  ) => {
    const rubric = rubrics[group];
    if (!rubric) return;

    setFormAcademicLevel(targetLevel);

    const existing = internalEvaluations.find(
      (e) =>
        e.staffId === staff.id &&
        e.staffRole === group &&
        e.period === activePeriod &&
        (group !== 'teacher' ||
          (e.academicLevel || (e.courseName?.toLowerCase().includes('sec') ? 'Secundaria' : 'Primaria')) === targetLevel)
    );

    const todayIso = new Date().toISOString().split('T')[0];
    const defaultCoordName =
      profile?.full_name || profile?.name || user?.email || 'Coordinador(a) / Equipo de Gestión';

    if (existing) {
      setFormScores({ ...existing.scores });
      setFormCriteriaObservations({ ...(existing.criteriaObservations || {}) });
      setFormReflectiveAnswers({ ...(existing.reflectiveAnswers || {}) });
      const hasDidactic = !!(
        existing.appliesDidacticSequence ||
        (existing.didacticSequenceAnswers &&
          Object.keys(existing.didacticSequenceAnswers).length > 0) ||
        existing.didacticSequenceObservations
      );
      setShowDidacticSequence(hasDidactic);
      setFormDidacticAnswers({ ...(existing.didacticSequenceAnswers || {}) });
      setFormDidacticObservations(existing.didacticSequenceObservations || '');
      setFormCourseId(existing.courseId || '');
      setFormCourseName(existing.courseName || '');
      setFormSubjectName(existing.subjectName || '');
      setFormAppliedDate(existing.appliedDate || todayIso);
      setFormAppliedTime(existing.appliedTime || '');
      setFormCoordinatorName(existing.coordinatorName || existing.evaluatorName || defaultCoordName);
      setFormStrengths(existing.strengths || '');
      setFormImprovements(existing.improvementAreas || '');
      setFormCommitments(existing.commitments || '');
      setFormNotes(existing.generalNotes || '');
    } else {
      const defaults: Record<string, number> = {};
      rubric.criteria.forEach((c) => {
        c.indicators.forEach((ind) => {
          defaults[ind.id] = 4;
        });
      });
      setFormScores(defaults);
      setFormCriteriaObservations({});
      setFormReflectiveAnswers({});
      setShowDidacticSequence(false);
      setFormDidacticAnswers({});
      setFormDidacticObservations('');

      // Pre-seleccionar el primer grado asignado al docente para el nivel objetivo
      const teacherAssigns = (state.assignments || []).filter(
        (a: any) => (a.teacherId || a.teacher_id) === staff.id
      );
      const teacherCourses = (state.courses || []).filter((c: any) =>
        teacherAssigns.some((a: any) => (a.courseId || a.course_id) === c.id)
      );
      const levelMatches = teacherCourses.filter((c: any) => {
        if (targetLevel === 'Secundaria') {
          return (c.level || '').toLowerCase().includes('secun') || (c.level || '').toLowerCase().includes('med');
        }
        if (targetLevel === 'Primaria') {
          return (c.level || '').toLowerCase().includes('prim');
        }
        return true;
      });
      const assignedCourse = levelMatches[0] || teacherCourses[0] || null;
      const assignedSubject = assignedCourse
        ? (state.subjects || []).find((s: any) =>
            teacherAssigns.some(
              (a: any) =>
                (a.courseId || a.course_id) === assignedCourse.id &&
                (a.subjectId || a.subject_id) === s.id
            )
          )
        : null;

      setFormCourseId(assignedCourse ? assignedCourse.id : '');
      setFormCourseName(
        assignedCourse ? `${assignedCourse.grade} "${assignedCourse.section || ''}"`.trim() : ''
      );
      setFormSubjectName(assignedSubject ? assignedSubject.name : staff.position || '');
      setFormAppliedDate(todayIso);
      setFormAppliedTime('');
      setFormCoordinatorName(defaultCoordName);
      setFormStrengths('');
      setFormImprovements('');
      setFormCommitments('');
      setFormNotes('');
    }

    setEvaluatingStaff({
      staff,
      group,
      period: activePeriod,
      academicLevel: targetLevel,
      existingRecord: existing
    });
  };

  // Abrir modal de evaluación para un miembro del personal
  const handleOpenEvaluationModal = (
    staff: any,
    group: StaffEvaluationGroup,
    periodOverride?: EvaluationPeriod,
    levelOverride?: 'Primaria' | 'Secundaria' | 'General'
  ) => {
    const activePeriod: EvaluationPeriod =
      periodOverride ||
      (periodFilter === 'ALL' || periodFilter === 'COMPARE' ? 'P1' : periodFilter);

    // Detectar cursos asignados al docente
    const teacherAssigns = (state.assignments || []).filter(
      (a: any) => (a.teacherId || a.teacher_id) === staff.id
    );
    const teacherCourses = (state.courses || []).filter((c: any) =>
      teacherAssigns.some((a: any) => (a.courseId || a.course_id) === c.id)
    );
    const hasPrimaria = teacherCourses.some((c: any) => (c.level || '').toLowerCase().includes('prim'));
    const hasSecundaria = teacherCourses.some(
      (c: any) => (c.level || '').toLowerCase().includes('secun') || (c.level || '').toLowerCase().includes('med')
    );

    let targetLevel: 'Primaria' | 'Secundaria' | 'General' = 'General';
    if (group === 'teacher') {
      if (levelOverride) {
        targetLevel = levelOverride;
      } else if (levelFilter !== 'ALL') {
        targetLevel = levelFilter;
      } else if (hasSecundaria && !hasPrimaria) {
        targetLevel = 'Secundaria';
      } else {
        targetLevel = 'Primaria';
      }
    }
    setFormAcademicLevel(targetLevel);
    loadEvaluationForStaffLevel(staff, group, activePeriod, targetLevel);
  };

  // Guardar ficha de evaluación interna (con opción de imprimir inmediatamente al guardar)
  const handleSaveEvaluation = async (e?: React.FormEvent, printAfterSave = false) => {
    if (e) e.preventDefault();
    if (!evaluatingStaff) return;

    const rubric = rubrics[evaluatingStaff.group];
    if (!rubric) return;

    const allIndicators = rubric.criteria.flatMap((c) => c.indicators);
    const missing = allIndicators.filter((ind) => !formScores[ind.id]);
    if (missing.length > 0) {
      toast.error(`Faltan ${missing.length} indicadores por calificar.`);
      return;
    }

    setIsSavingEval(true);
    try {
      const criteriaAverages: Record<string, number> = {};
      let totalScore = 0;
      let totalIndicators = 0;

      rubric.criteria.forEach((crit) => {
        let critSum = 0;
        crit.indicators.forEach((ind) => {
          const val = Number(formScores[ind.id] || 0);
          critSum += val;
          totalScore += val;
          totalIndicators++;
        });
        criteriaAverages[crit.id] =
          crit.indicators.length > 0
            ? Number((critSum / crit.indicators.length).toFixed(2))
            : 0;
      });

      const maxScore = totalIndicators * 4;
      const averageScore =
        totalIndicators > 0 ? Number((totalScore / totalIndicators).toFixed(2)) : 0;
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
      const levelInfo = calculateLevelFromAverage(averageScore);

      const levelTag =
        evaluatingStaff.group === 'teacher' ? `_${(formAcademicLevel || 'primaria').toLowerCase()}` : '';
      const recordId =
        evaluatingStaff.existingRecord?.id ||
        `eval_${evaluatingStaff.group}_${evaluatingStaff.period}_${evaluatingStaff.staff.id}${levelTag}`;

      const staffName =
        evaluatingStaff.staff.full_name || evaluatingStaff.staff.name || 'Colaborador';

      const cleanedObservations: Record<string, string> = {};
      Object.entries(formCriteriaObservations).forEach(([critId, obsText]) => {
        if (obsText && obsText.trim()) {
          cleanedObservations[critId] = obsText.trim();
        }
      });

      const cleanedReflectiveAnswers: Record<string, string> = {};
      Object.entries(formReflectiveAnswers).forEach(([qId, ansText]) => {
        if (ansText && ansText.trim()) {
          cleanedReflectiveAnswers[qId] = ansText.trim();
        }
      });

      const cleanedDidacticAnswers: Record<string, string> = {};
      if (showDidacticSequence) {
        Object.entries(formDidacticAnswers).forEach(([qId, ansText]) => {
          if (ansText && ansText.trim()) {
            cleanedDidacticAnswers[qId] = ansText.trim();
          }
        });
      }

      // Registrar automáticamente la hora exacta al momento de guardar
      const recordedTime = new Date().toLocaleTimeString('es-DO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      const recordedDate = formAppliedDate || new Date().toISOString().split('T')[0];

      const newRecord: StaffEvaluationRecord = {
        id: recordId,
        centerId,
        schoolYear,
        period: evaluatingStaff.period,
        staffId: evaluatingStaff.staff.id,
        staffName,
        staffRole: evaluatingStaff.group,
        academicLevel: evaluatingStaff.group === 'teacher' ? formAcademicLevel : 'General',
        evaluatorId: user?.id || profile?.id || 'admin',
        evaluatorName:
          formCoordinatorName.trim() ||
          profile?.full_name ||
          user?.email ||
          'Coordinador(a) / Equipo de Gestión',
        evaluatorRole: profile?.role || 'admin',
        coordinatorName:
          formCoordinatorName.trim() ||
          profile?.full_name ||
          user?.email ||
          'Coordinador(a) / Equipo de Gestión',
        source: 'internal',
        courseId: formCourseId || undefined,
        courseName: formCourseName.trim() || 'General / No especificado',
        subjectName: formSubjectName.trim() || undefined,
        appliedDate: recordedDate,
        appliedTime: recordedTime,
        scores: formScores,
        criteriaAverages,
        criteriaObservations: cleanedObservations,
        reflectiveAnswers: cleanedReflectiveAnswers,
        appliesDidacticSequence: showDidacticSequence,
        didacticSequenceAnswers: cleanedDidacticAnswers,
        didacticSequenceObservations: showDidacticSequence ? formDidacticObservations.trim() : '',
        totalScore,
        maxScore,
        averageScore,
        percentage,
        levelLabel: levelInfo.label,
        strengths: formStrengths.trim(),
        improvementAreas: formImprovements.trim(),
        commitments: formCommitments.trim(),
        generalNotes: formNotes.trim(),
        createdAt: evaluatingStaff.existingRecord?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await staffEvaluationService.saveEvaluation(newRecord, user?.id);
      toast.success(
        `¡Evaluación de ${staffName} (${evaluatingStaff.period}${evaluatingStaff.group === 'teacher' ? ` - ${formAcademicLevel}` : ''}) guardada a las ${recordedTime}! (${percentage}% - ${levelInfo.label})`
      );
      setEvaluatingStaff(null);
      await loadAllModuleData();

      if (printAfterSave) {
        printEvaluationRecords(
          [newRecord],
          true,
          `Formulario_Evaluacion_${staffName.replace(/\s+/g, '_')}_${newRecord.period}.pdf`
        );
      }
    } catch (err) {
      console.error('Error guardando evaluación:', err);
      toast.error('Ocurrió un error al guardar la evaluación.');
    } finally {
      setIsSavingEval(false);
    }
  };

  // Generador unificado de Formularios Imprimibles con Resultados y Firmas (Individual o Masivo)
  const printEvaluationRecords = (
    recordsToPrint: StaffEvaluationRecord[],
    openPrintDialog = false,
    customFileName?: string
  ) => {
    if (!recordsToPrint || recordsToPrint.length === 0) {
      toast.error('No hay evaluaciones registradas para imprimir en el filtro seleccionado.');
      return;
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const regionalText = center?.regional || 'Regional Educativa';
    const districtText = center?.district || 'Distrito Educativo';
    const codeText = center?.center_code ? ` | Código: ${center.center_code}` : '';

    recordsToPrint.forEach((ev, index) => {
      if (index > 0) doc.addPage();

      const rubric = rubrics[ev.staffRole];
      const staffName = ev.staffName || 'Colaborador';
      const formattedDate = ev.appliedDate
        ? ev.appliedDate.split('-').reverse().join('/')
        : new Date(ev.updatedAt).toLocaleDateString('es-DO');
      const formattedTime =
        ev.appliedTime ||
        new Date(ev.updatedAt).toLocaleTimeString('es-DO', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      const coordSigner =
        ev.coordinatorName || ev.evaluatorName || 'Coordinador(a) / Equipo de Gestión';

      // ENCABEZADO OFICIAL DEL CENTRO, REGIONAL Y DISTRITO
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(
        'MINISTERIO DE EDUCACIÓN DE LA REPÚBLICA DOMINICANA (MINERD)',
        pageWidth / 2,
        12,
        { align: 'center' }
      );
      doc.text(
        `Regional Educativa: ${regionalText}   •   Distrito Educativo: ${districtText}${codeText}`,
        pageWidth / 2,
        16.5,
        { align: 'center' }
      );

      doc.setFontSize(14);
      doc.setTextColor(15, 23, 42);
      doc.text((center?.name || 'Centro Educativo Cristiano Génesis').toUpperCase(), pageWidth / 2, 23, {
        align: 'center'
      });

      if (center?.address || center?.phone || center?.slogan) {
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        const subHeaderParts = [center?.slogan, center?.address, center?.phone].filter(Boolean);
        doc.text(subHeaderParts.join('  |  '), pageWidth / 2, 27.5, { align: 'center' });
      }

      doc.setFontSize(10.5);
      doc.setTextColor(79, 70, 229);
      doc.text(
        (rubric?.title || 'INSTRUMENTO DE EVALUACIÓN DEL RENDIMIENTO').toUpperCase(),
        pageWidth / 2,
        33.5,
        { align: 'center' }
      );

      // TABLA DE DATOS DE APLICACIÓN (GRADO, FECHA, HORA, PERÍODO Y RESULTADO GLOBAL)
      autoTable(doc, {
        startY: 37,
        head: [
          [
            {
              content: 'DATOS DE APLICACIÓN DEL INSTRUMENTO Y RESULTADO GENERAL',
              colSpan: 4,
              styles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' }
            }
          ]
        ],
        body: [
          [
            `Evaluado(a): ${staffName.toUpperCase()}`,
            `Estamento: ${GROUP_LABELS[ev.staffRole]?.title || ev.staffRole}`,
            `Nivel Académico: ${ev.academicLevel || (ev.courseName?.toLowerCase().includes('sec') ? 'Secundaria' : 'Primaria')}${ev.shift ? ` (${ev.shift})` : ''}`,
            `Fecha: ${formattedDate}`
          ],
          [
            `Grado / Curso: ${ev.courseName || 'General / No especificado'}`,
            `Asignatura / Área: ${ev.subjectName || 'General'}`,
            `Período: ${ev.period} (${ev.schoolYear})`,
            `Resultado: ${ev.averageScore.toFixed(2)}/4.00 (${ev.percentage}% - ${ev.levelLabel})`
          ],
          [
            {
              content: `Coordinador(a) / Acompañante Evaluador(a): ${coordSigner}  •  Hora registrada: ${formattedTime}`,
              colSpan: 4,
              styles: { fillColor: [248, 250, 252], textColor: [30, 41, 59] }
            }
          ]
        ],
        theme: 'grid',
        bodyStyles: { fontSize: 8, fontStyle: 'bold' },
        margin: { left: 14, right: 14 }
      });

      let currentY = (doc as any).lastAutoTable.finalY + 5;

      // Resumen por Criterios Generales
      const critRows = (rubric?.criteria || []).map((c) => {
        const cAvg = ev.criteriaAverages?.[c.id] || 0;
        const cPct = Math.round((cAvg / 4) * 100);
        const lvl = calculateLevelFromAverage(cAvg);
        return [`${c.number}. ${c.title}`, `${cAvg.toFixed(2)} / 4.00`, `${cPct}%`, lvl.label];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Dimensión / Criterio General Evaluado', 'Promedio (1-4)', 'Porcentaje', 'Valoración']],
        body: critRows,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
        bodyStyles: { fontSize: 7.5 },
        margin: { left: 14, right: 14 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 6;

      // Detalle de indicadores y observación por criterio
      (rubric?.criteria || []).forEach((crit) => {
        if (currentY > 245) {
          doc.addPage();
          currentY = 20;
        }
        const indRows: any[] = crit.indicators.map((ind, idx) => {
          const val = ev.scores?.[ind.id] || 0;
          const label =
            val === 4
              ? '4 - Excelente'
              : val === 3
              ? '3 - Bueno'
              : val === 2
              ? '2 - En desarrollo'
              : '1 - Insuficiente';
          return [`${crit.number}.${idx + 1}`, ind.text, label];
        });

        const critObs = ev.criteriaObservations?.[crit.id];
        if (critObs && critObs.trim()) {
          indRows.push([
            {
              content: `Observación del Criterio ${crit.number}: ${critObs.trim()}`,
              colSpan: 3,
              styles: {
                fillColor: [238, 242, 255],
                textColor: [49, 46, 129],
                fontStyle: 'italic'
              }
            }
          ]);
        }

        autoTable(doc, {
          startY: currentY,
          head: [
            [
              {
                content: `${crit.number}. ${crit.title.toUpperCase()} (Promedio: ${(
                  ev.criteriaAverages?.[crit.id] || 0
                ).toFixed(2)})`,
                colSpan: 3,
                styles: { fillColor: [241, 245, 249], textColor: [30, 41, 59], fontStyle: 'bold' }
              }
            ],
            ['#', 'Indicador Específico', 'Calificación']
          ],
          body: indRows,
          theme: 'grid',
          headStyles: { fillColor: [100, 116, 139], fontSize: 7.5 },
          bodyStyles: { fontSize: 7.5 },
          columnStyles: {
            0: { cellWidth: 12, halign: 'center' },
            2: { cellWidth: 32, halign: 'center' }
          },
          margin: { left: 14, right: 14 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 5;
      });

      // Diálogo reflexivo con el docente
      const reflQuestions = rubric?.reflectiveQuestions || [];
      if (
        reflQuestions.length > 0 &&
        ev.reflectiveAnswers &&
        Object.keys(ev.reflectiveAnswers).length > 0
      ) {
        if (currentY > 225) {
          doc.addPage();
          currentY = 20;
        }
        const reflRows = reflQuestions.map((q) => [
          `${q.number}. ${q.question}`,
          ev.reflectiveAnswers?.[q.id] || 'Sin respuesta registrada'
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [['Diálogo Reflexivo con el Docente', 'Respuesta / Reflexión del Docente']],
          body: reflRows,
          theme: 'grid',
          headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
          bodyStyles: { fontSize: 7.5 },
          columnStyles: {
            0: { cellWidth: 78, fontStyle: 'bold' }
          },
          margin: { left: 14, right: 14 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 6;
      }

      // Cuestionario opcional: Diálogo reflexivo sobre la implementación de las secuencias didácticas
      const didQuestions = rubric?.didacticSequenceQuestions || [];
      const hasDidAnswers =
        ev.appliesDidacticSequence ||
        (ev.didacticSequenceAnswers && Object.keys(ev.didacticSequenceAnswers).length > 0) ||
        (ev.didacticSequenceObservations && ev.didacticSequenceObservations.trim());

      if (didQuestions.length > 0 && hasDidAnswers) {
        if (currentY > 215) {
          doc.addPage();
          currentY = 20;
        }
        const didRows: any[] = didQuestions.map((q) => [
          `${q.number}. ${q.question}`,
          ev.didacticSequenceAnswers?.[q.id] || 'Sin respuesta registrada'
        ]);
        if (ev.didacticSequenceObservations && ev.didacticSequenceObservations.trim()) {
          didRows.push([
            'Observaciones (Secuencias Didácticas)',
            ev.didacticSequenceObservations.trim()
          ]);
        }

        autoTable(doc, {
          startY: currentY,
          head: [
            [
              {
                content:
                  'DIÁLOGO REFLEXIVO SOBRE LA IMPLEMENTACIÓN DE LAS SECUENCIAS DIDÁCTICAS (Acompañamiento a los docentes)',
                colSpan: 2,
                styles: { fillColor: [13, 148, 136], textColor: [255, 255, 255], fontStyle: 'bold' }
              }
            ],
            ['Pregunta de Diálogo con el Docente', 'Respuesta / Valoración']
          ],
          body: didRows,
          theme: 'grid',
          headStyles: { fillColor: [15, 118, 110], fontSize: 7.5 },
          bodyStyles: { fontSize: 7.5 },
          columnStyles: {
            0: { cellWidth: 78, fontStyle: 'bold' }
          },
          margin: { left: 14, right: 14 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 6;
      }

      // Acuerdos y observaciones cualitativas
      if (currentY > 215) {
        doc.addPage();
        currentY = 20;
      }
      autoTable(doc, {
        startY: currentY,
        head: [['Acompañamiento Cualitativo, Fortalezas y Compromisos de Mejora']],
        body: [
          [`Fortalezas evidenciadas: ${ev.strengths || 'Sin observaciones adicionales'}`],
          [`Oportunidades de mejora: ${ev.improvementAreas || 'Sin observaciones adicionales'}`],
          [`Acuerdos y compromisos asumidos: ${ev.commitments || 'Sin acuerdos adicionales'}`]
        ],
        theme: 'grid',
        headStyles: { fillColor: [16, 185, 129], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 }
      });
      currentY = (doc as any).lastAutoTable.finalY + 22;

      if (currentY > 260) {
        doc.addPage();
        currentY = 45;
      }

      // BLOQUE DE FIRMAS DE CONFORMIDAD (COORDINADOR Y DOCENTE/COLABORADOR)
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text('____________________________________________', 22, currentY);
      doc.text('Firma del Coordinador(a) / Evaluador(a)', 28, currentY + 5);
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(coordSigner, 28, currentY + 9.5);

      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      doc.text('____________________________________________', pageWidth - 96, currentY);
      doc.text('Firma del Docente / Colaborador(a) Evaluado(a)', pageWidth - 92, currentY + 5);
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(staffName, pageWidth - 92, currentY + 9.5);

      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(
        `Constancia oficial de evaluación • Aplicada el ${formattedDate} a las ${formattedTime} • Grado/Área: ${
          ev.courseName || 'General'
        }`,
        pageWidth / 2,
        currentY + 18,
        { align: 'center' }
      );
    });

    const finalName =
      customFileName ||
      `Formularios_Evaluacion_${periodFilter === 'ALL' ? 'Consolidado' : periodFilter}_${schoolYear}.pdf`;

    if (openPrintDialog) {
      doc.autoPrint();
      const blobUrl = doc.output('bloburl');
      const win = window.open(blobUrl, '_blank');
      if (!win) {
        doc.save(finalName);
      }
    } else {
      doc.save(finalName);
    }
  };

  // Exportar o Imprimir Ficha Individual de un miembro del personal
  const exportIndividualStaffPDF = (
    staff: any,
    group: StaffEvaluationGroup,
    periodTarget?: EvaluationPeriod,
    openPrintDialog = false,
    levelTarget?: 'Primaria' | 'Secundaria' | 'General'
  ) => {
    const staffName = staff.full_name || staff.name || 'Colaborador';
    const evalsForStaff = internalEvaluations.filter(
      (e) =>
        e.staffId === staff.id &&
        e.staffRole === group &&
        (!periodTarget || e.period === periodTarget) &&
        (!levelTarget ||
          levelTarget === 'General' ||
          (e.academicLevel || (e.courseName?.toLowerCase().includes('sec') ? 'Secundaria' : 'Primaria')) === levelTarget)
    );

    if (evalsForStaff.length === 0) {
      toast.error('Este colaborador aún no tiene evaluaciones registradas en el nivel o período seleccionado.');
      return;
    }

    const cleanName = staffName.replace(/\s+/g, '_');
    const levelSuffix = levelTarget && levelTarget !== 'General' ? `_${levelTarget}` : '';
    printEvaluationRecords(
      evalsForStaff,
      openPrintDialog,
      `Evaluacion_${cleanName}_${periodTarget || 'Consolidado'}${levelSuffix}_${schoolYear}.pdf`
    );
  };

  // Exportar o Imprimir TODOS los formularios evaluados de un grupo o de todo el centro
  const exportGroupEvaluationsPDF = (
    groupTarget?: StaffEvaluationGroup,
    openPrintDialog = true
  ) => {
    const records = filteredInternalEvals.filter(
      (e) => !groupTarget || e.staffRole === groupTarget
    );
    if (records.length === 0) {
      toast.error(
        'No hay formularios evaluados en el período actual para imprimir. Evalúa al menos a un miembro del personal primero.'
      );
      return;
    }
    const label = groupTarget ? GROUP_LABELS[groupTarget].short.replace(/\s+/g, '_') : 'Todo_El_Personal';
    printEvaluationRecords(
      records,
      openPrintDialog,
      `Formularios_Para_Firmar_${label}_${periodFilter}_${schoolYear}.pdf`
    );
  };

  // Descargar e Imprimir Formulario en Blanco (Modelo para Revisión y Aprobación Institucional)
  const exportBlankEvaluationFormPDF = (
    groupTarget: StaffEvaluationGroup = activeGroupTab,
    openPrintDialog = true
  ) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const rubric =
      rubrics[groupTarget] ||
      (selectedRubricKey === groupTarget ? editingRubric : null) ||
      getDefaultRubricTemplates(center?.name || 'Centro Educativo Cristiano Génesis')[groupTarget];

    const groupInfo = GROUP_LABELS[groupTarget] || { title: 'Personal', short: 'Personal' };
    const regionalText = center?.regional || 'Regional Educativa';
    const districtText = center?.district || 'Distrito Educativo';
    const codeText = center?.center_code ? ` | Código: ${center.center_code}` : '';

    // ENCABEZADO OFICIAL MINERD Y CENTRO
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text(
      'MINISTERIO DE EDUCACIÓN DE LA REPÚBLICA DOMINICANA (MINERD)',
      pageWidth / 2,
      12,
      { align: 'center' }
    );
    doc.text(
      `Regional Educativa: ${regionalText}   •   Distrito Educativo: ${districtText}${codeText}`,
      pageWidth / 2,
      16.5,
      { align: 'center' }
    );

    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text((center?.name || 'Centro Educativo Cristiano Génesis').toUpperCase(), pageWidth / 2, 23, {
      align: 'center'
    });

    if (center?.address || center?.phone || center?.slogan) {
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const subHeaderParts = [center?.slogan, center?.address, center?.phone].filter(Boolean);
      doc.text(subHeaderParts.join('  |  '), pageWidth / 2, 27.5, { align: 'center' });
    }

    doc.setFontSize(11);
    doc.setTextColor(79, 70, 229);
    doc.text(
      (rubric?.title || `INSTRUMENTO DE EVALUACIÓN DEL DESEMPEÑO - ${groupInfo.title.toUpperCase()}`).toUpperCase(),
      pageWidth / 2,
      33.5,
      { align: 'center' }
    );

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      'INSTRUMENTO OFICIAL PARA REVISIÓN, VALIDACIÓN, APROBACIÓN Y APLICACIÓN',
      pageWidth / 2,
      37.5,
      { align: 'center' }
    );

    // TABLA DE METADATOS EN BLANCO (PARA LLENAR)
    autoTable(doc, {
      startY: 40,
      head: [
        [
          {
            content: 'DATOS DE IDENTIFICACIÓN Y APLICACIÓN DE LA EVALUACIÓN',
            colSpan: 4,
            styles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: 'bold' }
          }
        ]
      ],
      body: [
        [
          'Colaborador(a) / Evaluado(a): __________________________________',
          `Estamento: ${groupInfo.title}`,
          'Fecha: _____ / _____ / ________',
          'Hora: ____:____  [  ] AM  [  ] PM'
        ],
        [
          'Grado / Sección: __________________________________',
          'Asignatura / Área: __________________________________',
          `Año Escolar: ${schoolYear}`,
          'Período: [  ] P1   [  ] P2   [  ] P3   [  ] P4'
        ],
        [
          {
            content:
              'Acompañante / Evaluador(a): ____________________________________________________________________   Cargo: ___________________________',
            colSpan: 4,
            styles: { fillColor: [248, 250, 252], textColor: [30, 41, 59] }
          }
        ]
      ],
      theme: 'grid',
      bodyStyles: { fontSize: 8, fontStyle: 'bold' },
      margin: { left: 14, right: 14 }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 4;

    // ESCALA DE VALORACIÓN
    autoTable(doc, {
      startY: currentY,
      body: [
        [
          {
            content:
              'ESCALA DE VALORACIÓN:   [4] Excelente / Siempre (Totalmente logrado)    [3] Bueno / Frecuentemente (Logrado)    [2] Regular / En Proceso (Requiere mejora)    [1] Insuficiente / Rara Vez (No logrado)',
            styles: {
              fillColor: [238, 242, 255],
              textColor: [67, 56, 202],
              fontStyle: 'bold',
              fontSize: 7.5,
              halign: 'center'
            }
          }
        ]
      ],
      theme: 'plain',
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 4;

    // MATRIZ DE CRITERIOS E INDICADORES EN BLANCO
    (rubric?.criteria || []).forEach((crit) => {
      if (currentY > 230) {
        doc.addPage();
        currentY = 16;
      }

      const tableRows: any[] = [];
      crit.indicators.forEach((ind, iIdx) => {
        tableRows.push([
          `${crit.number}.${iIdx + 1}`,
          ind.text,
          '[   ]',
          '[   ]',
          '[   ]',
          '[   ]'
        ]);
      });

      // Fila para Observaciones en blanco del criterio
      tableRows.push([
        {
          content:
            `Observaciones del Criterio ${crit.number}: ___________________________________________________________________________________________________________________`,
          colSpan: 6,
          styles: { fontStyle: 'italic', textColor: [100, 116, 139], fontSize: 7, fillColor: [250, 250, 250] }
        }
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [
          [
            {
              content: `${crit.number}. ${crit.title.toUpperCase()}`,
              colSpan: 2,
              styles: { fillColor: [49, 46, 129], textColor: [255, 255, 255], fontStyle: 'bold' }
            },
            { content: '1', styles: { halign: 'center', cellWidth: 9, fillColor: [239, 68, 68], textColor: [255, 255, 255] } },
            { content: '2', styles: { halign: 'center', cellWidth: 9, fillColor: [245, 158, 11], textColor: [255, 255, 255] } },
            { content: '3', styles: { halign: 'center', cellWidth: 9, fillColor: [59, 130, 246], textColor: [255, 255, 255] } },
            { content: '4', styles: { halign: 'center', cellWidth: 9, fillColor: [16, 185, 129], textColor: [255, 255, 255] } }
          ],
          [
            { content: '#', styles: { halign: 'center', cellWidth: 8, fontStyle: 'bold' } },
            { content: `Indicadores de Logro: ${crit.description || ''}`, colSpan: 5, styles: { fontStyle: 'italic', textColor: [71, 85, 105] } }
          ]
        ],
        body: tableRows,
        theme: 'grid',
        headStyles: { fontSize: 8 },
        bodyStyles: { fontSize: 7.5 },
        columnStyles: {
          0: { halign: 'center', cellWidth: 8, fontStyle: 'bold' },
          1: { halign: 'left' },
          2: { halign: 'center', cellWidth: 9 },
          3: { halign: 'center', cellWidth: 9 },
          4: { halign: 'center', cellWidth: 9 },
          5: { halign: 'center', cellWidth: 9 }
        },
        margin: { left: 14, right: 14 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 4;
    });

    // DIÁLOGO REFLEXIVO CON EL DOCENTE (PREGUNTAS ABIERTAS EN BLANCO)
    const reflQuestions = rubric?.reflectiveQuestions || [];
    if (reflQuestions.length > 0) {
      if (currentY > 210) {
        doc.addPage();
        currentY = 16;
      }

      const reflRows: any[] = [];
      reflQuestions.forEach((q) => {
        reflRows.push([
          {
            content: `${q.number}. ${q.question}\n\nRespuesta / Reflexión:\n_____________________________________________________________________________________________________________________________________\n_____________________________________________________________________________________________________________________________________`,
            styles: { fontSize: 7.5 }
          }
        ]);
      });

      autoTable(doc, {
        startY: currentY,
        head: [['DIÁLOGO REFLEXIVO CON EL DOCENTE (PREGUNTAS DE RESPUESTA ABIERTA)']],
        body: reflRows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], fontSize: 8.5, fontStyle: 'bold' },
        bodyStyles: { cellPadding: 3 },
        margin: { left: 14, right: 14 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;
    }

    // CUESTIONARIO OPCIONAL: SECUENCIAS DIDÁCTICAS
    const didQuestions = rubric?.didacticSequenceQuestions || [];
    if (didQuestions.length > 0) {
      if (currentY > 200) {
        doc.addPage();
        currentY = 16;
      }

      const didRows: any[] = [];
      didQuestions.forEach((q) => {
        didRows.push([
          {
            content: `${q.number}. ${q.question}\n\nReflexión / Evidencias:\n_____________________________________________________________________________________________________________________________________\n_____________________________________________________________________________________________________________________________________`,
            styles: { fontSize: 7.5 }
          }
        ]);
      });

      didRows.push([
        {
          content:
            'Observaciones Generales de la Secuencia Didáctica:\n_____________________________________________________________________________________________________________________________________\n_____________________________________________________________________________________________________________________________________',
          styles: { fontSize: 7.5, fontStyle: 'italic', fillColor: [240, 253, 250] }
        }
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [
          [
            {
              content:
                'ACOMPAÑAMIENTO: DIÁLOGO REFLEXIVO SOBRE LA IMPLEMENTACIÓN DE LAS SECUENCIAS DIDÁCTICAS (OPCIONAL)\nPropósito: Propiciar un espacio de diálogo horizontal que invite a la reflexión y a la apropiación de las secuencias didácticas.',
              styles: { fillColor: [13, 148, 136], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 }
            }
          ]
        ],
        body: didRows,
        theme: 'grid',
        bodyStyles: { cellPadding: 3 },
        margin: { left: 14, right: 14 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 5;
    }

    // ACUERDOS Y COMPROMISOS PEDAGÓGICOS EN BLANCO
    if (currentY > 215) {
      doc.addPage();
      currentY = 16;
    }

    autoTable(doc, {
      startY: currentY,
      head: [
        [
          {
            content: 'ACUERDOS, FORTALEZAS Y COMPROMISOS PEDAGÓGICOS',
            colSpan: 2,
            styles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 }
          }
        ]
      ],
      body: [
        [
          {
            content:
              'Fortalezas Observadas y Buenas Prácticas:\n\n_____________________________________________________________________________________________________\n_____________________________________________________________________________________________________',
            styles: { fontSize: 7.5 }
          },
          {
            content:
              'Aspectos y Criterios a Fortalecer:\n\n_____________________________________________________________________________________________________\n_____________________________________________________________________________________________________',
            styles: { fontSize: 7.5 }
          }
        ],
        [
          {
            content:
              'Acuerdos Pedagógicos y Compromisos de Acompañamiento:\n\n_____________________________________________________________________________________________________________________________________\n_____________________________________________________________________________________________________________________________________',
            colSpan: 2,
            styles: { fontSize: 7.5 }
          }
        ]
      ],
      theme: 'grid',
      bodyStyles: { cellPadding: 3 },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 16;

    // SECCIÓN DE REVISIÓN, VALIDACIÓN Y APROBACIÓN INSTITUCIONAL (FIRMAS)
    if (currentY > 240) {
      doc.addPage();
      currentY = 30;
    }

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);

    const sigColWidth = (pageWidth - 28) / 3;

    // Firma 1: Elaborado / Coordinador
    doc.text('_________________________________', 14 + sigColWidth * 0.5, currentY, { align: 'center' });
    doc.text('Elaborado / Presentado por:', 14 + sigColWidth * 0.5, currentY + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Coordinador(a) Pedagógico(a)', 14 + sigColWidth * 0.5, currentY + 8.5, { align: 'center' });
    doc.text('Fecha: _____/_____/202___', 14 + sigColWidth * 0.5, currentY + 12.5, { align: 'center' });

    // Firma 2: Revisado por / Equipo de Gestión
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('_________________________________', 14 + sigColWidth * 1.5, currentY, { align: 'center' });
    doc.text('Revisado / Validado por:', 14 + sigColWidth * 1.5, currentY + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Equipo de Gestión / Supervisión', 14 + sigColWidth * 1.5, currentY + 8.5, { align: 'center' });
    doc.text('Fecha: _____/_____/202___', 14 + sigColWidth * 1.5, currentY + 12.5, { align: 'center' });

    // Firma 3: Aprobado por / Dirección del Centro
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('_________________________________', 14 + sigColWidth * 2.5, currentY, { align: 'center' });
    doc.text('Aprobado por:', 14 + sigColWidth * 2.5, currentY + 4.5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Dirección del Centro Educativo', 14 + sigColWidth * 2.5, currentY + 8.5, { align: 'center' });
    doc.text('(Firma y Sello Institucional)', 14 + sigColWidth * 2.5, currentY + 12.5, { align: 'center' });

    // Pie de página oficial
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Modelo Oficial del Instrumento para Revisión y Aprobación • ${groupInfo.title} • ${center?.name || 'Centro Educativo'} • ${schoolYear}`,
      pageWidth / 2,
      currentY + 22,
      { align: 'center' }
    );

    const fileName = `Instrumento_En_Blanco_${groupInfo.short.replace(/\s+/g, '_')}_Para_Revision_${schoolYear}.pdf`;

    if (openPrintDialog) {
      doc.autoPrint();
      const blobUrl = doc.output('bloburl');
      const win = window.open(blobUrl, '_blank');
      if (!win) {
        doc.save(fileName);
      }
    } else {
      doc.save(fileName);
    }
  };

  // Exportar Reporte General de Salud del Centro en PDF
  const exportCenterHealthPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(17);
    doc.setTextColor(30, 41, 59);
    doc.text((center?.name || 'Centro Educativo').toUpperCase(), pageWidth / 2, 18, {
      align: 'center'
    });

    doc.setFontSize(12);
    doc.setTextColor(79, 70, 229);
    doc.text('INFORME EJECUTIVO DE SALUD INSTITUCIONAL Y DESEMPEÑO DE PERSONAL', pageWidth / 2, 26, {
      align: 'center'
    });

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Año Escolar: ${schoolYear} | Filtro de Período: ${
        periodFilter === 'ALL' ? 'Todos los Períodos' : periodFilter
      } | Promedio Global: ${centerHealthStats.globalAvgScore.toFixed(2)}/4.00 (${
        centerHealthStats.globalPercentage
      }%)`,
      pageWidth / 2,
      32,
      { align: 'center' }
    );

    autoTable(doc, {
      startY: 38,
      head: [
        [
          'Grupo de Personal',
          'Miembros',
          'Evaluados',
          'Cobertura',
          'Promedio (1-4)',
          'Porcentaje',
          'Nivel General'
        ]
      ],
      body: centerHealthStats.groupSummaries.map((g) => [
        g.label,
        g.totalMembers,
        g.evaluatedMembers,
        `${g.coveragePct}%`,
        `${g.avgScore.toFixed(2)} / 4.00`,
        `${g.avgPercentage}%`,
        g.avgScore > 0 ? g.levelInfo.label : 'Sin evaluar'
      ]),
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59], fontSize: 8.5 },
      bodyStyles: { fontSize: 8.5 },
      margin: { left: 14, right: 14 }
    });

    let currentY = (doc as any).lastAutoTable.finalY + 10;

    centerHealthStats.groupSummaries.forEach((g) => {
      if (g.evaluationsCount === 0) return;
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      autoTable(doc, {
        startY: currentY,
        head: [
          [
            {
              content: `SALUD POR CRITERIOS: ${g.label.toUpperCase()} (${g.avgPercentage}%)`,
              colSpan: 4,
              styles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] }
            }
          ],
          ['#', 'Criterio General Evaluado', 'Promedio (1-4)', 'Salud Porcentual']
        ],
        body: g.criteriaStats.map((c) => [
          c.number,
          c.title,
          `${c.average.toFixed(2)} / 4.00`,
          `${c.percentage}%`
        ]),
        theme: 'striped',
        headStyles: { fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;
    });

    doc.save(`Salud_Institucional_Personal_${schoolYear}.pdf`);
  };

  // Crear y enviar convocatoria de encuesta a Alumnos y Padres
  const handleCreateSurveyBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBroadcastTitle.trim()) {
      toast.error('Ingresa un título para la encuesta.');
      return;
    }
    if (newBroadcastAudience.length === 0) {
      toast.error('Selecciona al menos un público destino (Alumnos o Padres).');
      return;
    }

    setIsSendingSurvey(true);
    try {
      const newB: ActiveSurveyBroadcast = {
        id: `surv_b_${Date.now()}`,
        centerId,
        schoolYear,
        period: newBroadcastPeriod,
        title: newBroadcastTitle.trim(),
        description: newBroadcastDesc.trim(),
        targetAudience: newBroadcastAudience,
        targetCourseIds: newBroadcastCourses,
        targetTeacherIds: [],
        isActive: true,
        createdAt: new Date().toISOString()
      };

      const updated = [newB, ...broadcasts];
      await staffEvaluationService.saveSurveyBroadcasts(centerId, updated, user?.id);
      setBroadcasts(updated);
      toast.success(
        `¡Encuesta del período ${newBroadcastPeriod} activada y enviada al portal de ${newBroadcastAudience
          .map((a) => (a === 'student' ? 'Alumnos' : 'Padres'))
          .join(' y ')}!`
      );
    } catch (err) {
      console.error('Error creando convocatoria de encuesta:', err);
      toast.error('No se pudo publicar la encuesta.');
    } finally {
      setIsSendingSurvey(false);
    }
  };

  const handleToggleBroadcastStatus = async (bId: string) => {
    const updated = broadcasts.map((b) => (b.id === bId ? { ...b, isActive: !b.isActive } : b));
    setBroadcasts(updated);
    await staffEvaluationService.saveSurveyBroadcasts(centerId, updated, user?.id);
    toast.success('Estado de la encuesta actualizado.');
  };

  const handleDeleteBroadcast = async (bId: string) => {
    if (!window.confirm('¿Eliminar esta convocatoria de encuesta?')) return;
    const updated = broadcasts.filter((b) => b.id !== bId);
    setBroadcasts(updated);
    await staffEvaluationService.saveSurveyBroadcasts(centerId, updated, user?.id);
    toast.success('Convocatoria eliminada.');
  };

  // Reasignar / Mover convocatoria de encuesta y sus respuestas a otro período (ej. P2 -> P1)
  const handleMoveBroadcastPeriod = async (broadcastId: string, targetPeriod: EvaluationPeriod) => {
    if (
      !window.confirm(
        `¿Deseas cambiar esta convocatoria de encuesta al Período ${targetPeriod}? También se reasignarán automáticamente al Período ${targetPeriod} todas las respuestas que ya hayan completado los estudiantes y familias.`
      )
    ) {
      return;
    }
    try {
      const res = await staffEvaluationService.moveSurveyBroadcastPeriod(
        centerId,
        broadcastId,
        targetPeriod,
        true,
        user?.id
      );
      await loadAllModuleData();
      toast.success(
        `¡Convocatoria de encuesta movida con éxito al Período ${targetPeriod}! (${res.migratedSurveysCount} encuestas reasignadas a ${targetPeriod})`
      );
    } catch (e) {
      console.error(e);
      toast.error('Error al mover la convocatoria de encuesta.');
    }
  };

  // Mover una evaluación individual a otro período (ej. P2 -> P1)
  const handleMoveEvaluationPeriod = async (targetPeriod: EvaluationPeriod) => {
    if (!evaluatingStaff) return;
    const currentRec = evaluatingStaff.existingRecord;
    if (!currentRec) {
      setEvaluatingStaff({
        ...evaluatingStaff,
        period: targetPeriod
      });
      toast.success(`Período de la ficha cambiado a ${targetPeriod}.`);
      return;
    }

    if (
      !window.confirm(
        `¿Deseas mover esta evaluación registrada del Período ${evaluatingStaff.period} al Período ${targetPeriod}?`
      )
    ) {
      return;
    }

    try {
      const updated = await staffEvaluationService.moveEvaluationPeriod(
        centerId,
        currentRec.id,
        targetPeriod,
        user?.id
      );
      await loadAllModuleData();
      if (updated) {
        setEvaluatingStaff({
          ...evaluatingStaff,
          period: targetPeriod,
          existingRecord: updated
        });
      }
      toast.success(`¡Evaluación movida exitosamente al Período ${targetPeriod}!`);
    } catch (e) {
      console.error(e);
      toast.error('Error al mover la evaluación.');
    }
  };

  // Mover todas las evaluaciones y encuestas de P2 a P1 en 1 solo clic
  const handleMoveAllP2ToP1 = async () => {
    const p2Count = evaluations.filter((e) => e.period === 'P2').length;
    const p2BroadcastsCount = broadcasts.filter((b) => b.period === 'P2').length;
    if (p2Count === 0 && p2BroadcastsCount === 0) {
      toast.info('No hay registros en el Período P2 para mover.');
      return;
    }

    if (
      !window.confirm(
        `¿Confirmas mover todas las evaluaciones y encuestas registradas en el Período P2 (${p2Count} evaluaciones y ${p2BroadcastsCount} convocatorias) al Período P1? Esta acción consolidará todos los resultados en P1 para que se visualicen correctamente.`
      )
    ) {
      return;
    }

    try {
      const migrated = await staffEvaluationService.moveAllEvaluationsPeriod(
        centerId,
        'P2',
        'P1',
        user?.id
      );
      setPeriodFilter('P1');
      await loadAllModuleData();
      toast.success(`¡Listo! Se movieron ${migrated} evaluaciones/encuestas del Período P2 al Período P1.`);
    } catch (e) {
      console.error('Error moviendo registros:', e);
      toast.error('Ocurrió un error al transferir los registros al P1.');
    }
  };

  // Guardar cambios en el editor de rúbrica / formulario
  const handleSaveEditedRubric = async () => {
    if (!editingRubric) return;
    setIsSavingRubric(true);
    try {
      await staffEvaluationService.saveRubric(
        centerId,
        selectedRubricKey,
        editingRubric,
        user?.id
      );
      await loadAllModuleData();
      toast.success('¡Instrumento de evaluación actualizado y guardado para este centro!');
    } catch (err) {
      toast.error('Error al guardar los cambios del instrumento.');
    } finally {
      setIsSavingRubric(false);
    }
  };

  const handleResetRubricToDefault = async () => {
    if (
      !window.confirm(
        '¿Restaurar este instrumento a los criterios e indicadores originales por defecto?'
      )
    ) {
      return;
    }
    const defaults = getDefaultRubricTemplates(
      centerId,
      center?.name || 'Centro Educativo Cristiano Génesis'
    );
    const targetDefault = defaults[selectedRubricKey];
    if (targetDefault) {
      setEditingRubric(JSON.parse(JSON.stringify(targetDefault)));
      await staffEvaluationService.saveRubric(centerId, selectedRubricKey, targetDefault, user?.id);
      await loadAllModuleData();
      toast.success('Instrumento restaurado a sus valores originales.');
    }
  };

  // Renderizador de la vista de un grupo de personal (Docentes, Gestión, Administrativo, Apoyo)
  const renderStaffGroupView = (group: StaffEvaluationGroup) => {
    const members = (staffByGroup[group] || []).filter((m: any) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (m.full_name || m.name || '').toLowerCase().includes(q);
    });
    const rubric = rubrics[group];
    const groupInfo = GROUP_LABELS[group];
    const groupSummary = centerHealthStats.groupSummaries.find((g) => g.group === group);

    return (
      <div className="space-y-8 animate-in fade-in duration-300">
        {/* Cabecera del Grupo con Salud Porcentual */}
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span
                className={`px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${groupInfo.badgeClass}`}
              >
                {groupInfo.title}
              </span>
              <span className="text-xs font-bold text-slate-400">
                • {members.length} integrantes registrados
              </span>
            </div>
            <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">
              {rubric?.title}
            </h3>
            <p className="text-xs text-slate-500 max-w-2xl">{rubric?.subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="bg-slate-50 px-5 py-3.5 rounded-2xl border border-slate-200/80 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Promedio del Grupo
              </p>
              <p className="text-2xl font-black text-indigo-600 mt-0.5">
                {groupSummary?.avgScore ? `${groupSummary.avgScore.toFixed(2)} / 4.0` : '---'}
              </p>
              <span className="text-[10px] font-black text-slate-500">
                {groupSummary?.avgPercentage || 0}% de cumplimiento
              </span>
            </div>

            <div className="bg-slate-50 px-5 py-3.5 rounded-2xl border border-slate-200/80 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Evaluados ({periodFilter === 'ALL' ? 'Global' : periodFilter})
              </p>
              <p className="text-2xl font-black text-emerald-600 mt-0.5">
                {groupSummary?.evaluatedMembers || 0} / {members.length}
              </p>
              <span className="text-[10px] font-black text-slate-500">
                {groupSummary?.coveragePct || 0}% cobertura
              </span>
            </div>

            <button
              type="button"
              onClick={() => exportBlankEvaluationFormPDF(group, true)}
              className="px-4 py-3 rounded-2xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              title="Descargar e imprimir este formulario en blanco para revisión y aprobación institucional"
            >
              <FileText size={14} />
              <span>Formulario en Blanco</span>
            </button>

            <button
              type="button"
              onClick={() => exportGroupEvaluationsPDF(group, true)}
              className="px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              title="Imprimir los formularios con resultados de todos los evaluados de este grupo para firmar"
            >
              <Printer size={14} />
              <span>Imprimir Todos ({groupInfo.short})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedRubricKey(group);
                setActiveTab('rubrics');
              }}
              className="px-4 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer shadow-sm"
            >
              <Sliders size={14} />
              <span>Editar Formulario</span>
            </button>
          </div>
        </div>

        {/* Gráfico de Salud por Criterios de este Grupo */}
        {groupSummary && groupSummary.evaluationsCount > 0 && (
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  Rendimiento por Criterios Evaluados ({groupInfo.short})
                </h4>
                <p className="text-xs text-slate-500">
                  Porcentaje de logro alcanzado en cada dimensión del instrumento
                </p>
              </div>
              <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl">
                Base: {groupSummary.evaluationsCount} evaluaciones registradas
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
              {groupSummary.criteriaStats.map((cs) => {
                const lvl = calculateLevelFromAverage(cs.average);
                return (
                  <div
                    key={cs.id}
                    className="p-4 rounded-2xl border border-slate-100 bg-slate-50/60 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-black text-slate-800 leading-snug">
                        {cs.number}. {cs.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${lvl.bgClass} ${lvl.textClass}`}
                      >
                        {cs.percentage}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${cs.percentage}%`,
                          backgroundColor: lvl.color
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>Promedio: {cs.average.toFixed(2)} / 4.00</span>
                      <span>{lvl.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Listado Individual de Miembros con Resultados por Período o Comparativa */}
        <div className="bg-white rounded-[2.5rem] border border-slate-200/80 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Evaluación Individual • {groupInfo.title}
              </h4>
              <p className="text-xs text-slate-500">
                Aplica la ficha de evaluación por período o consulta el informe individual gráfico y porcentual
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {group === 'teacher' && (
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setLevelFilter('ALL')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      levelFilter === 'ALL'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todos (Combinado)
                  </button>
                  <button
                    type="button"
                    onClick={() => setLevelFilter('Primaria')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      levelFilter === 'Primaria'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-blue-700'
                    }`}
                  >
                    📘 Primaria
                  </button>
                  <button
                    type="button"
                    onClick={() => setLevelFilter('Secundaria')}
                    className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                      levelFilter === 'Secundaria'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-slate-600 hover:text-purple-700'
                    }`}
                  >
                    📙 Secundaria
                  </button>
                </div>
              )}

              <div className="relative">
                <Search
                  size={14}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar colaborador..."
                  className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 w-56"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                  <th className="py-4 px-5">Colaborador</th>
                  <th className="py-4 px-3 text-center">P1</th>
                  <th className="py-4 px-3 text-center">P2</th>
                  <th className="py-4 px-3 text-center">P3</th>
                  <th className="py-4 px-3 text-center">P4</th>
                  {periodFilter === 'COMPARE' && (
                    <th className="py-4 px-4 text-center bg-indigo-950">
                      Comparativa ({comparePeriodA} vs {comparePeriodB})
                    </th>
                  )}
                  {group === 'teacher' && (
                    <th className="py-4 px-4 text-center">Encuesta Alumnos/Padres</th>
                  )}
                  <th className="py-4 px-4 text-center">Resultado Consolidado</th>
                  <th className="py-4 px-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-xs font-bold text-slate-400">
                      No se encontraron miembros registrados en {groupInfo.title}.
                    </td>
                  </tr>
                ) : (
                  members.map((person: any) => {
                    const name = person.full_name || person.name || 'Sin Nombre';
                    const personInternalEvals = internalEvaluations.filter(
                      (e) => e.staffId === person.id && e.staffRole === group
                    );

                    const getPeriodEvalByLevel = (p: EvaluationPeriod, lvl?: 'Primaria' | 'Secundaria') => {
                      if (!lvl) return personInternalEvals.find((e) => e.period === p);
                      return personInternalEvals.find(
                        (e) =>
                          e.period === p &&
                          (e.academicLevel === lvl ||
                            (!e.academicLevel &&
                              (lvl === 'Secundaria'
                                ? e.courseName?.toLowerCase().includes('sec')
                                : !e.courseName?.toLowerCase().includes('sec'))))
                      );
                    };

                    const evalsPri = personInternalEvals.filter(
                      (e) => e.academicLevel === 'Primaria' || (!e.academicLevel && !e.courseName?.toLowerCase().includes('sec'))
                    );
                    const evalsSec = personInternalEvals.filter(
                      (e) => e.academicLevel === 'Secundaria' || (!e.academicLevel && e.courseName?.toLowerCase().includes('sec'))
                    );

                    const activeEvals =
                      levelFilter === 'Primaria'
                        ? (periodFilter === 'ALL' || periodFilter === 'COMPARE' ? evalsPri : evalsPri.filter((e) => e.period === periodFilter))
                        : levelFilter === 'Secundaria'
                        ? (periodFilter === 'ALL' || periodFilter === 'COMPARE' ? evalsSec : evalsSec.filter((e) => e.period === periodFilter))
                        : (periodFilter === 'ALL' || periodFilter === 'COMPARE' ? personInternalEvals : personInternalEvals.filter((e) => e.period === periodFilter));

                    const overallAvg =
                      activeEvals.length > 0
                        ? Number(
                            (
                              activeEvals.reduce((sum, x) => sum + x.averageScore, 0) /
                              activeEvals.length
                            ).toFixed(2)
                          )
                        : 0;
                    const overallPct =
                      activeEvals.length > 0
                        ? Math.round(
                            activeEvals.reduce((sum, x) => sum + x.percentage, 0) /
                              activeEvals.length
                          )
                        : 0;
                    const overallLevel = calculateLevelFromAverage(overallAvg);

                    const priAvgScore = evalsPri.length > 0 ? Math.round(evalsPri.reduce((a, b) => a + b.percentage, 0) / evalsPri.length) : null;
                    const secAvgScore = evalsSec.length > 0 ? Math.round(evalsSec.reduce((a, b) => a + b.percentage, 0) / evalsSec.length) : null;

                    // Encuestas estudiantiles/familiares para este docente
                    const teacherSurveys = surveyEvaluations.filter(
                      (s) =>
                        s.staffId === person.id &&
                        (periodFilter === 'ALL' ||
                          periodFilter === 'COMPARE' ||
                          s.period === periodFilter)
                    );
                    const surveyAvg =
                      teacherSurveys.length > 0
                        ? Number(
                            (
                              teacherSurveys.reduce((sum, x) => sum + x.averageScore, 0) /
                              teacherSurveys.length
                            ).toFixed(2)
                          )
                        : 0;
                    const surveyPct =
                      teacherSurveys.length > 0
                        ? Math.round(
                            teacherSurveys.reduce((sum, x) => sum + x.percentage, 0) /
                              teacherSurveys.length
                          )
                        : 0;

                    const evalA = getPeriodEvalByLevel(comparePeriodA, levelFilter === 'ALL' ? undefined : levelFilter);
                    const evalB = getPeriodEvalByLevel(comparePeriodB, levelFilter === 'ALL' ? undefined : levelFilter);
                    const diffPct =
                      evalA && evalB ? evalB.percentage - evalA.percentage : null;

                    return (
                      <tr key={person.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-4 px-5">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0">
                              {name.charAt(0)}
                            </div>
                            <div>
                              <p className="text-xs font-black text-slate-900 uppercase">{name}</p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">
                                {person.position || groupInfo.short}
                              </p>
                            </div>
                          </div>
                        </td>

                        {(['P1', 'P2', 'P3', 'P4'] as EvaluationPeriod[]).map((p) => {
                          if (group === 'teacher') {
                            const pPri = getPeriodEvalByLevel(p, 'Primaria');
                            const pSec = getPeriodEvalByLevel(p, 'Secundaria');

                            if (levelFilter === 'Primaria') {
                              return (
                                <td key={p} className="py-4 px-2 text-center">
                                  {pPri ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEvaluationModal(person, group, p, 'Primaria')}
                                      className="inline-flex flex-col items-center px-2 py-1 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer"
                                      title={`Primaria (${pPri.coordinatorName || 'Coord. Primaria'}): ${pPri.percentage}%`}
                                    >
                                      <span className="text-xs font-black text-blue-700">{pPri.percentage}%</span>
                                      <span className="text-[9px] font-bold text-blue-600">{pPri.averageScore.toFixed(1)}/4</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEvaluationModal(person, group, p, 'Primaria')}
                                      className="px-2 py-1 rounded-xl border border-dashed border-blue-200 text-[10px] font-bold text-blue-500 hover:bg-blue-50 transition-colors cursor-pointer"
                                    >
                                      + Primaria
                                    </button>
                                  )}
                                </td>
                              );
                            }

                            if (levelFilter === 'Secundaria') {
                              return (
                                <td key={p} className="py-4 px-2 text-center">
                                  {pSec ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEvaluationModal(person, group, p, 'Secundaria')}
                                      className="inline-flex flex-col items-center px-2 py-1 rounded-xl bg-purple-50 border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
                                      title={`Secundaria (${pSec.coordinatorName || 'Coord. Secundaria'}): ${pSec.percentage}%`}
                                    >
                                      <span className="text-xs font-black text-purple-700">{pSec.percentage}%</span>
                                      <span className="text-[9px] font-bold text-purple-600">{pSec.averageScore.toFixed(1)}/4</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEvaluationModal(person, group, p, 'Secundaria')}
                                      className="px-2 py-1 rounded-xl border border-dashed border-purple-200 text-[10px] font-bold text-purple-500 hover:bg-purple-50 transition-colors cursor-pointer"
                                    >
                                      + Secundaria
                                    </button>
                                  )}
                                </td>
                              );
                            }

                            // Modo Combinado (levelFilter === 'ALL')
                            return (
                              <td key={p} className="py-4 px-2 text-center">
                                <div className="flex flex-col items-center gap-1 min-w-[70px]">
                                  {pPri ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEvaluationModal(person, group, p, 'Primaria')}
                                      className="w-full px-1.5 py-0.5 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-[10px] font-black text-blue-700 flex items-center justify-between cursor-pointer"
                                      title={`Primaria: ${pPri.percentage}% (${pPri.coordinatorName || 'Coord. Primaria'})`}
                                    >
                                      <span className="text-[9px] font-bold text-blue-600">PRI</span>
                                      <span>{pPri.percentage}%</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEvaluationModal(person, group, p, 'Primaria')}
                                      className="text-[9px] font-bold text-slate-400 hover:text-blue-600 transition-colors"
                                      title="Evaluar en Primaria"
                                    >
                                      + Prim
                                    </button>
                                  )}

                                  {pSec ? (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEvaluationModal(person, group, p, 'Secundaria')}
                                      className="w-full px-1.5 py-0.5 rounded-lg bg-purple-50 border border-purple-200 hover:bg-purple-100 text-[10px] font-black text-purple-700 flex items-center justify-between cursor-pointer"
                                      title={`Secundaria: ${pSec.percentage}% (${pSec.coordinatorName || 'Coord. Secundaria'})`}
                                    >
                                      <span className="text-[9px] font-bold text-purple-600">SEC</span>
                                      <span>{pSec.percentage}%</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEvaluationModal(person, group, p, 'Secundaria')}
                                      className="text-[9px] font-bold text-slate-400 hover:text-purple-600 transition-colors"
                                      title="Evaluar en Secundaria"
                                    >
                                      + Sec
                                    </button>
                                  )}
                                </div>
                              </td>
                            );
                          }

                          // Non-teacher groups
                          const pEv = getPeriodEvalByLevel(p);
                          return (
                            <td key={p} className="py-4 px-3 text-center">
                              {pEv ? (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEvaluationModal(person, group, p)}
                                  className="inline-flex flex-col items-center px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
                                  title={`Clic para editar evaluación de ${p}`}
                                >
                                  <span className="text-xs font-black text-emerald-700">
                                    {pEv.percentage}%
                                  </span>
                                  <span className="text-[9px] font-bold text-emerald-600">
                                    {pEv.averageScore.toFixed(1)}/4
                                  </span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEvaluationModal(person, group, p)}
                                  className="px-2.5 py-1.5 rounded-xl border border-dashed border-slate-300 text-[10px] font-bold text-slate-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors cursor-pointer"
                                  title={`Aplicar ficha en ${p}`}
                                >
                                  + Evaluar
                                </button>
                              )}
                            </td>
                          );
                        })}

                        {periodFilter === 'COMPARE' && (
                          <td className="py-4 px-4 text-center bg-indigo-50/40">
                            {evalA || evalB ? (
                              <div className="inline-flex items-center gap-2 text-xs font-black">
                                <span className="text-slate-600">
                                  {evalA ? `${evalA.percentage}%` : '---'}
                                </span>
                                <span className="text-slate-400">→</span>
                                <span className="text-indigo-700">
                                  {evalB ? `${evalB.percentage}%` : '---'}
                                </span>
                                {diffPct !== null && (
                                  <span
                                    className={`px-2 py-0.5 rounded-lg text-[10px] ${
                                      diffPct >= 0
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : 'bg-rose-100 text-rose-700'
                                    }`}
                                  >
                                    {diffPct >= 0 ? `+${diffPct}%` : `${diffPct}%`}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400 italic">
                                Sin datos en {comparePeriodA}/{comparePeriodB}
                              </span>
                            )}
                          </td>
                        )}

                        {group === 'teacher' && (
                          <td className="py-4 px-4 text-center">
                            {teacherSurveys.length > 0 ? (
                              <div className="inline-flex flex-col items-center px-3 py-1 rounded-xl bg-teal-50 border border-teal-200">
                                <span className="text-xs font-black text-teal-800">
                                  {surveyPct}% ({surveyAvg.toFixed(1)}/4)
                                </span>
                                <span className="text-[9px] font-bold text-teal-600">
                                  {teacherSurveys.length} respuestas
                                </span>
                              </div>
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400 italic">
                                Sin encuestas
                              </span>
                            )}
                          </td>
                        )}

                        <td className="py-4 px-4 text-center">
                          {group === 'teacher' && priAvgScore !== null && secAvgScore !== null ? (
                            <div className="inline-flex flex-col items-center gap-1">
                              <span
                                className={`px-2.5 py-0.5 rounded-lg text-xs font-black border ${overallLevel.bgClass} ${overallLevel.textClass} ${overallLevel.borderClass}`}
                              >
                                {overallPct}% • {overallLevel.label}
                              </span>
                              <div className="flex items-center gap-1 text-[9px] font-bold">
                                <span className="text-blue-700 bg-blue-50 px-1 py-0.2 rounded border border-blue-200">Pri: {priAvgScore}%</span>
                                <span>•</span>
                                <span className="text-purple-700 bg-purple-50 px-1 py-0.2 rounded border border-purple-200">Sec: {secAvgScore}%</span>
                              </div>
                            </div>
                          ) : overallAvg > 0 ? (
                            <div className="inline-flex flex-col items-center">
                              <span
                                className={`px-3 py-1 rounded-xl text-xs font-black border ${overallLevel.bgClass} ${overallLevel.textClass} ${overallLevel.borderClass}`}
                              >
                                {overallPct}% • {overallLevel.label}
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                                Promedio: {overallAvg.toFixed(2)} / 4.0
                                {group === 'teacher' && priAvgScore !== null && !secAvgScore && ' (Primaria)'}
                                {group === 'teacher' && secAvgScore !== null && !priAvgScore && ' (Secundaria)'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-400 italic">
                              Sin evaluar
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleOpenEvaluationModal(person, group)}
                              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                            >
                              <ClipboardCheck size={13} />
                              <span>Evaluar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setViewingStaffDetail({ staff: person, group })}
                              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title="Ver análisis gráfico individual y comparativa por períodos"
                            >
                              <Eye size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={() => exportIndividualStaffPDF(person, group, undefined, true)}
                              className="p-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors cursor-pointer"
                              title="Imprimir Formulario con Resultados para Firmar (Coordinador y Docente)"
                            >
                              <Printer size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={() => exportIndividualStaffPDF(person, group, undefined, false)}
                              className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 transition-colors cursor-pointer"
                              title="Descargar Ficha Individual en PDF"
                            >
                              <Download size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-16 text-slate-900">
      {/* CABECERA PRINCIPAL Y FILTRO DE PERÍODOS */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 rounded-[2.5rem] shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
            <Sparkles size={12} />
            Sistema Integral de Evaluación y Salud Institucional • {schoolYear}
          </span>
          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tight">
            Seguimiento y Evaluación de Personal
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl">
            Evalúa individualmente a Docentes, Equipo de Gestión, Personal Administrativo y Apoyo con rúbricas editables de 1 a 4, encuestas estudiantiles/familiares y análisis por períodos.
          </p>
        </div>

        {/* Selector de Período o Comparativa entre 2 Períodos */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="bg-white/10 p-1.5 rounded-2xl border border-white/10 flex items-center gap-1">
            {(
              [
                { id: 'P1', label: 'P1' },
                { id: 'P2', label: 'P2' },
                { id: 'P3', label: 'P3' },
                { id: 'P4', label: 'P4' },
                { id: 'ALL', label: 'Consolidado' },
                { id: 'COMPARE', label: 'Comparar 2 Períodos' }
              ] as { id: PeriodFilter; label: string }[]
            ).map((p) => {
              const count =
                p.id === 'ALL' || p.id === 'COMPARE'
                  ? 0
                  : evaluations.filter((e) => e.period === p.id).length;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriodFilter(p.id)}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                    periodFilter === p.id
                      ? 'bg-white text-slate-900 shadow-md'
                      : 'text-slate-300 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span>{p.label}</span>
                  {count > 0 && (
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                        periodFilter === p.id
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'bg-white/20 text-white'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Banner de asistencia si hay evaluaciones en P2 */}
          {periodFilter === 'P2' && evaluations.some((e) => e.period === 'P2') && (
            <div className="w-full mt-2 p-3 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-200">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                <span className="text-xs">
                  ¿Se llenaron evaluaciones en el P2 por error? Hay {evaluations.filter((e) => e.period === 'P2').length} evaluaciones en P2.
                </span>
              </div>
              <button
                type="button"
                onClick={handleMoveAllP2ToP1}
                className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] uppercase tracking-wider shrink-0 shadow-sm flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} />
                <span>Bajar Todo al P1</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => exportBlankEvaluationFormPDF(activeGroupTab, true)}
            className="px-4 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            title="Descargar e imprimir el formulario en blanco para revisión y aprobación institucional"
          >
            <FileText size={15} />
            <span>Formulario en Blanco</span>
          </button>

          <button
            type="button"
            onClick={() => exportGroupEvaluationsPDF(undefined, true)}
            className="px-4 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
            title="Imprimir los formularios evaluados de todo el personal para firmar"
          >
            <Printer size={15} />
            <span>Imprimir Todos para Firmar</span>
          </button>

          <button
            type="button"
            onClick={exportCenterHealthPDF}
            className="px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer"
          >
            <Download size={15} />
            <span>Informe Salud PDF</span>
          </button>
        </div>
      </div>

      {/* BARRA DE COMPARATIVA SI ESTÁ ACTIVO EL MODO "COMPARE" */}
      {periodFilter === 'COMPARE' && (
        <div className="bg-indigo-50 border-2 border-indigo-200 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-black text-indigo-950 uppercase">
            <TrendingUp size={18} className="text-indigo-600" />
            <span>Modo Comparativo entre Dos Evaluaciones / Períodos:</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-indigo-700">
                1ra Evaluación:
              </span>
              <select
                value={comparePeriodA}
                onChange={(e) => setComparePeriodA(e.target.value as EvaluationPeriod)}
                className="px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-xs font-black text-slate-800"
              >
                {(['P1', 'P2', 'P3', 'P4'] as EvaluationPeriod[]).map((p) => (
                  <option key={p} value={p}>
                    Período {p}
                  </option>
                ))}
              </select>
            </div>
            <span className="font-black text-indigo-400">vs</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase text-indigo-700">
                2da Evaluación:
              </span>
              <select
                value={comparePeriodB}
                onChange={(e) => setComparePeriodB(e.target.value as EvaluationPeriod)}
                className="px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-xs font-black text-slate-800"
              >
                {(['P1', 'P2', 'P3', 'P4'] as EvaluationPeriod[]).map((p) => (
                  <option key={p} value={p}>
                    Período {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* NAVEGACIÓN DE VENTANAS DEL MÓDULO */}
      <div className="flex gap-2 p-2 bg-slate-100 rounded-[2rem] border border-slate-200 overflow-x-auto whitespace-nowrap">
        {[
          { id: 'dashboard', label: 'Salud del Centro (Dashboard)', icon: BarChart3 },
          { id: 'teacher', label: 'Docentes', icon: Briefcase },
          { id: 'management', label: 'Equipo de Gestión', icon: ShieldCheck },
          { id: 'administrative', label: 'Equipo Administrativo', icon: UserCheck },
          { id: 'support', label: 'Equipo de Apoyo', icon: HeartHandshake },
          { id: 'surveys', label: 'Encuestas Alumnos y Padres', icon: Send },
          { id: 'rubrics', label: 'Configurar Formularios', icon: Sliders },
          { id: 'attendance', label: 'Bitácora de Asistencia', icon: Calendar }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as MainTab)}
              className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer ${
                active
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 1. VENTANA: DASHBOARD DE SALUD DEL CENTRO */}
      {activeTab === 'dashboard' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Tarjetas de Salud por Departamento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {centerHealthStats.groupSummaries.map((g) => {
              const Icon = GROUP_LABELS[g.group].icon;
              return (
                <div
                  key={g.group}
                  onClick={() => setActiveTab(g.group)}
                  className="bg-white p-6 rounded-[2rem] border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md"
                      style={{ backgroundColor: g.color }}
                    >
                      <Icon size={22} />
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                        g.avgScore > 0
                          ? `${g.levelInfo.bgClass} ${g.levelInfo.textClass}`
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {g.avgScore > 0 ? `${g.avgPercentage}% • ${g.levelInfo.label}` : 'Sin evaluar'}
                    </span>
                  </div>

                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    {g.label}
                  </h3>
                  <div className="mt-3 flex items-baseline justify-between">
                    <p className="text-2xl font-black text-slate-900">
                      {g.avgScore > 0 ? g.avgScore.toFixed(2) : '0.00'}
                      <span className="text-xs font-bold text-slate-400"> / 4.00</span>
                    </p>
                    <p className="text-xs font-bold text-slate-500">
                      {g.evaluatedMembers}/{g.totalMembers} evaluados
                    </p>
                  </div>

                  <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${g.avgPercentage}%`,
                        backgroundColor: g.color
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Gráficos de Salud General por Departamento y Distribución de Niveles */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  Salud Comparativa por Equipo de Personal (%)
                </h3>
                <p className="text-xs text-slate-500">
                  Rendimiento porcentual promedio alcanzado por cada área del centro educativo
                </p>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={centerHealthStats.groupSummaries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis
                      dataKey="shortLabel"
                      tick={{ fontSize: 11, fontWeight: 800, fill: '#475569' }}
                    />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip
                      formatter={(val: any) => [`${val}%`, 'Salud Porcentual']}
                      contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0' }}
                    />
                    <Bar dataKey="avgPercentage" radius={[12, 12, 0, 0]}>
                      {centerHealthStats.groupSummaries.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-5 bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  Distribución por Escala de Logro
                </h3>
                <p className="text-xs text-slate-500">
                  Clasificación de las evaluaciones aplicadas según la escala 1 a 4
                </p>
              </div>

              {centerHealthStats.totalEvaluations === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                  <ClipboardCheck size={36} className="text-slate-400 mb-2" />
                  <p className="text-xs font-black text-slate-600 uppercase">
                    Aún no hay evaluaciones registradas en este período
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Selecciona cualquiera de las pestañas de personal para aplicar la primera ficha de evaluación.
                  </p>
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={centerHealthStats.scaleDistribution.filter((d) => d.value > 0)}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={4}
                      >
                        {centerHealthStats.scaleDistribution
                          .filter((d) => d.value > 0)
                          .map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '11px', fontWeight: 700 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Desglose Gráfico de Salud de los Criterios Generales por cada Grupo */}
          <div className="space-y-6">
            {centerHealthStats.groupSummaries.map((g) => (
              <div
                key={g.group}
                className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-full"
                      style={{ backgroundColor: g.color }}
                    />
                    <div>
                      <h4 className="text-base font-black text-slate-900 uppercase tracking-tight">
                        Salud por Criterios Generales • {g.label}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Diagnóstico institucional de cada competencia evaluada en {g.shortLabel}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab(g.group)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-black uppercase tracking-widest transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    Evaluar {g.shortLabel} →
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {g.criteriaStats.map((crit) => {
                    const lvl = calculateLevelFromAverage(crit.average);
                    return (
                      <div
                        key={crit.id}
                        className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/60 flex flex-col justify-between space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-xs font-black text-slate-800 leading-snug">
                            {crit.number}. {crit.title}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${
                              crit.average > 0
                                ? `${lvl.bgClass} ${lvl.textClass}`
                                : 'bg-slate-200 text-slate-500'
                            }`}
                          >
                            {crit.average > 0 ? `${crit.percentage}%` : 'S/E'}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${crit.percentage}%`,
                                backgroundColor: crit.average > 0 ? lvl.color : '#cbd5e1'
                              }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] font-bold text-slate-400">
                            <span>Media: {crit.average.toFixed(2)} / 4.00</span>
                            <span>{crit.average > 0 ? lvl.label : 'Sin evaluar'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. VENTANAS INDIVIDUALES POR CADA GRUPO DE PERSONAL */}
      {activeTab === 'teacher' && renderStaffGroupView('teacher')}
      {activeTab === 'management' && renderStaffGroupView('management')}
      {activeTab === 'administrative' && renderStaffGroupView('administrative')}
      {activeTab === 'support' && renderStaffGroupView('support')}

      {/* 3. VENTANA: ENCUESTAS A ALUMNOS Y PADRES */}
      {activeTab === 'surveys' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Formulario para enviar/activar encuesta */}
            <form
              onSubmit={handleCreateSurveyBroadcast}
              className="lg:col-span-5 bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-5 h-fit"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                  <Send size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                    Enviar Encuesta a Alumnos y Padres
                  </h3>
                  <p className="text-xs text-slate-500">
                    Publica la encuesta adaptada en el Aula Virtual de estudiantes y familias
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Título de la Convocatoria
                  </label>
                  <input
                    type="text"
                    value={newBroadcastTitle}
                    onChange={(e) => setNewBroadcastTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-800"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Mensaje / Instrucciones para Alumnos y Familias
                  </label>
                  <textarea
                    rows={3}
                    value={newBroadcastDesc}
                    onChange={(e) => setNewBroadcastDesc(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-medium text-slate-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Período a Evaluar
                    </label>
                    <select
                      value={newBroadcastPeriod}
                      onChange={(e) => setNewBroadcastPeriod(e.target.value as EvaluationPeriod)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-black text-slate-800 bg-white"
                    >
                      <option value="P1">Período 1 (P1)</option>
                      <option value="P2">Período 2 (P2)</option>
                      <option value="P3">Período 3 (P3)</option>
                      <option value="P4">Período 4 (P4)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                      Público Destino
                    </label>
                    <div className="flex gap-2">
                      {(
                        [
                          { id: 'student', label: 'Alumnos' },
                          { id: 'parent', label: 'Padres' }
                        ] as const
                      ).map((aud) => {
                        const checked = newBroadcastAudience.includes(aud.id);
                        return (
                          <button
                            key={aud.id}
                            type="button"
                            onClick={() =>
                              setNewBroadcastAudience((prev) =>
                                prev.includes(aud.id)
                                  ? prev.filter((x) => x !== aud.id)
                                  : [...prev, aud.id]
                              )
                            }
                            className={`flex-1 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                              checked
                                ? 'bg-emerald-600 text-white border-emerald-600'
                                : 'bg-slate-50 text-slate-500 border-slate-200'
                            }`}
                          >
                            {aud.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                    Cursos Destino ({newBroadcastCourses.length === 0 ? 'Todos los cursos' : `${newBroadcastCourses.length} seleccionados`})
                  </label>
                  <div className="max-h-36 overflow-y-auto p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setNewBroadcastCourses([])}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black cursor-pointer ${
                        newBroadcastCourses.length === 0
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-slate-600 border border-slate-200'
                      }`}
                    >
                      Todos los Cursos
                    </button>
                    {(state.courses || []).map((c: any) => {
                      const active = newBroadcastCourses.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            setNewBroadcastCourses((prev) =>
                              prev.includes(c.id)
                                ? prev.filter((id) => id !== c.id)
                                : [...prev, c.id]
                            )
                          }
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer ${
                            active
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white text-slate-600 border border-slate-200'
                          }`}
                        >
                          {c.grade} "{c.section}"
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSendingSurvey}
                  className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-widest shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Send size={15} />
                  <span>{isSendingSurvey ? 'Publicando...' : 'Activar y Enviar Encuesta'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRubricKey('student_survey');
                    setActiveTab('rubrics');
                  }}
                  className="w-full py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Ver / Editar Preguntas de la Encuesta de Alumnos y Padres
                </button>
              </div>
            </form>

            {/* Panel derecho: Convocatorias activas y Resultados consolidados de las encuestas */}
            <div className="lg:col-span-7 space-y-6">
              {/* Alerta inteligente para transferir de P2 a P1 en 1 clic */}
              {(evaluations.some((e) => e.period === 'P2') || broadcasts.some((b) => b.period === 'P2')) && (
                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-amber-900 shadow-sm animate-fade-in">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                      <AlertTriangle size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-tight">
                        ¿Encuestas o evaluaciones llenadas en P2 por error?
                      </p>
                      <p className="text-[11px] text-amber-700">
                        Se detectaron {evaluations.filter((e) => e.period === 'P2').length} registros en el Período P2. Puedes bajarlos todos al Período P1 de una vez.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleMoveAllP2ToP1}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider shrink-0 shadow-md flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                  >
                    <RefreshCw size={13} />
                    <span>Mover Todo a P1</span>
                  </button>
                </div>
              )}

              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-4">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                  Convocatorias de Encuesta Publicadas ({broadcasts.length})
                </h3>

                {broadcasts.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-4">
                    No se ha enviado ninguna encuesta aún. Usa el panel izquierdo para publicar una encuesta en el portal de alumnos y padres.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {broadcasts.map((b) => (
                      <div
                        key={b.id}
                        className="p-4 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/60"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                b.isActive
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-200 text-slate-600'
                              }`}
                            >
                              {b.isActive ? 'Activa en Portal' : 'Pausada / Cerrada'}
                            </span>

                            {/* Selector / Cambiador de Período de la encuesta */}
                            <div className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                              <span className="text-[10px] font-black text-indigo-700 uppercase">Período:</span>
                              <select
                                value={b.period}
                                onChange={(e) =>
                                  handleMoveBroadcastPeriod(b.id, e.target.value as EvaluationPeriod)
                                }
                                className="bg-transparent text-[10px] font-black text-indigo-900 outline-none cursor-pointer"
                                title="Cambiar el período de esta convocatoria y reasignar las encuestas respondidas"
                              >
                                <option value="P1">P1</option>
                                <option value="P2">P2</option>
                                <option value="P3">P3</option>
                                <option value="P4">P4</option>
                              </select>
                            </div>

                            {b.period === 'P2' && (
                              <button
                                type="button"
                                onClick={() => handleMoveBroadcastPeriod(b.id, 'P1')}
                                className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1 cursor-pointer transition-all"
                                title="Bajar esta encuesta y todas las respuestas al Período P1"
                              >
                                <ArrowDown size={11} />
                                <span>Bajar al P1</span>
                              </button>
                            )}

                            <span className="text-[10px] font-bold text-slate-400">
                              • Destino:{' '}
                              {b.targetAudience
                                .map((a) => (a === 'student' ? 'Alumnos' : 'Padres'))
                                .join(' + ')}
                            </span>
                          </div>
                          <p className="text-sm font-black text-slate-800 mt-1">{b.title}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleBroadcastStatus(b.id)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase cursor-pointer ${
                              b.isActive
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                                : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                            }`}
                          >
                            {b.isActive ? 'Cerrar' : 'Reactivar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBroadcast(b.id)}
                            className="p-2 rounded-xl text-rose-500 hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Resultados Consolidados de Encuestas de Alumnos y Padres por Docente */}
              <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                      Resultados de Encuestas de Alumnos y Padres por Docente
                    </h3>
                    <p className="text-xs text-slate-500">
                      Comparativa entre la valoración estudiantil/familiar y la evaluación interna del Equipo de Gestión
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-xl bg-teal-50 text-teal-700 font-black text-xs">
                    {surveyEvaluations.length} encuestas recibidas
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="py-3 px-3">Docente</th>
                        <th className="py-3 px-3 text-center">Respuestas</th>
                        <th className="py-3 px-3 text-center">Promedio Alumnos/Padres</th>
                        <th className="py-3 px-3 text-center">Evaluación Interna Gestión</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(staffByGroup.teacher || []).map((t: any) => {
                        const tSurveys = surveyEvaluations.filter(
                          (s) =>
                            s.staffId === t.id &&
                            (periodFilter === 'ALL' ||
                              periodFilter === 'COMPARE' ||
                              s.period === periodFilter)
                        );
                        const tInternal = filteredInternalEvals.filter(
                          (e) => e.staffId === t.id && e.staffRole === 'teacher'
                        );

                        const sAvg =
                          tSurveys.length > 0
                            ? Number(
                                (
                                  tSurveys.reduce((acc, c) => acc + c.averageScore, 0) /
                                  tSurveys.length
                                ).toFixed(2)
                              )
                            : 0;
                        const sPct =
                          tSurveys.length > 0
                            ? Math.round(
                                tSurveys.reduce((acc, c) => acc + c.percentage, 0) /
                                  tSurveys.length
                              )
                            : 0;

                        const iAvg =
                          tInternal.length > 0
                            ? Number(
                                (
                                  tInternal.reduce((acc, c) => acc + c.averageScore, 0) /
                                  tInternal.length
                                ).toFixed(2)
                              )
                            : 0;
                        const iPct =
                          tInternal.length > 0
                            ? Math.round(
                                tInternal.reduce((acc, c) => acc + c.percentage, 0) /
                                  tInternal.length
                              )
                            : 0;

                        return (
                          <tr key={t.id} className="hover:bg-slate-50">
                            <td className="py-3 px-3 text-xs font-black text-slate-800 uppercase">
                              {t.full_name || t.name}
                            </td>
                            <td className="py-3 px-3 text-center text-xs font-bold text-slate-600">
                              {tSurveys.length}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {sAvg > 0 ? (
                                <span className="px-2.5 py-1 rounded-lg bg-teal-50 text-teal-700 font-black text-xs">
                                  {sPct}% ({sAvg.toFixed(2)}/4)
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">Sin respuestas</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {iAvg > 0 ? (
                                <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-black text-xs">
                                  {iPct}% ({iAvg.toFixed(2)}/4)
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400">Pendiente</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. VENTANA: EDITOR DE INSTRUMENTOS / FORMULARIOS PERSONALIZABLES POR CENTRO */}
      {activeTab === 'rubrics' && editingRubric && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-200/80 shadow-sm space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-6">
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">
                  Personalizador de Instrumentos y Encuestas del Centro
                </h3>
                <p className="text-xs text-slate-500">
                  Ajusta libremente los títulos, criterios e indicadores específicos de cada ficha de evaluación según la identidad de tu centro educativo.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    exportBlankEvaluationFormPDF(
                      (selectedRubricKey === 'student_survey' ? 'teacher' : selectedRubricKey) as StaffEvaluationGroup,
                      true
                    )
                  }
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider shadow flex items-center gap-1.5 cursor-pointer"
                  title="Descargar e imprimir este instrumento en blanco para revisión y aprobación institucional"
                >
                  <Printer size={14} />
                  <span>Imprimir en Blanco</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetRubricToDefault}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>Restaurar Original</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditedRubric}
                  disabled={isSavingRubric}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 size={15} />
                  <span>{isSavingRubric ? 'Guardando...' : 'Guardar Instrumento'}</span>
                </button>
              </div>
            </div>

            {/* Selector del Instrumento que se desea editar */}
            <div className="flex flex-wrap gap-2">
              {[
                { key: 'teacher', label: 'Ficha Equipo Docente (9 Criterios)' },
                { key: 'management', label: 'Ficha Equipo de Gestión' },
                { key: 'administrative', label: 'Ficha Equipo Administrativo' },
                { key: 'support', label: 'Ficha Equipo de Apoyo' },
                { key: 'student_survey', label: 'Encuesta para Alumnos y Padres' }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedRubricKey(item.key)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all cursor-pointer ${
                    selectedRubricKey === item.key
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {/* Título y Subtítulo del Instrumento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Título del Instrumento
                </label>
                <input
                  type="text"
                  value={editingRubric.title}
                  onChange={(e) =>
                    setEditingRubric({ ...editingRubric, title: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-900"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                  Descripción / Propósito
                </label>
                <input
                  type="text"
                  value={editingRubric.subtitle}
                  onChange={(e) =>
                    setEditingRubric({ ...editingRubric, subtitle: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-700"
                />
              </div>
            </div>

            {/* Lista Editable de Criterios e Indicadores */}
            <div className="space-y-6">
              {editingRubric.criteria.map((crit, cIdx) => (
                <div
                  key={crit.id}
                  className="p-5 rounded-3xl border border-slate-200 bg-slate-50/50 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-1">
                      <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                        {cIdx + 1}
                      </span>
                      <input
                        type="text"
                        value={crit.title}
                        onChange={(e) => {
                          const updated = [...editingRubric.criteria];
                          updated[cIdx] = { ...crit, title: e.target.value };
                          setEditingRubric({ ...editingRubric, criteria: updated });
                        }}
                        className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-sm font-black text-slate-900"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = editingRubric.criteria
                          .filter((_, idx) => idx !== cIdx)
                          .map((c, i) => ({ ...c, number: i + 1 }));
                        setEditingRubric({ ...editingRubric, criteria: updated });
                      }}
                      className="text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 cursor-pointer self-end sm:self-auto"
                    >
                      <Trash2 size={13} /> Eliminar Criterio
                    </button>
                  </div>

                  <input
                    type="text"
                    value={crit.description}
                    onChange={(e) => {
                      const updated = [...editingRubric.criteria];
                      updated[cIdx] = { ...crit, description: e.target.value };
                      setEditingRubric({ ...editingRubric, criteria: updated });
                    }}
                    placeholder="Descripción de lo que evalúa este criterio..."
                    className="w-full px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-600"
                  />

                  <div className="space-y-2 pl-2 border-l-2 border-indigo-200">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Indicadores Específicos ({crit.indicators.length})
                    </p>
                    {crit.indicators.map((ind, iIdx) => (
                      <div key={ind.id} className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-indigo-600 w-8 shrink-0">
                          {cIdx + 1}.{iIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={ind.text}
                          onChange={(e) => {
                            const updatedCriteria = [...editingRubric.criteria];
                            const updatedInds = [...crit.indicators];
                            updatedInds[iIdx] = { ...ind, text: e.target.value };
                            updatedCriteria[cIdx] = { ...crit, indicators: updatedInds };
                            setEditingRubric({ ...editingRubric, criteria: updatedCriteria });
                          }}
                          className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updatedCriteria = [...editingRubric.criteria];
                            updatedCriteria[cIdx] = {
                              ...crit,
                              indicators: crit.indicators.filter((_, idx) => idx !== iIdx)
                            };
                            setEditingRubric({ ...editingRubric, criteria: updatedCriteria });
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        const updatedCriteria = [...editingRubric.criteria];
                        updatedCriteria[cIdx] = {
                          ...crit,
                          indicators: [
                            ...crit.indicators,
                            {
                              id: `ind_custom_${Date.now()}`,
                              text: 'Nuevo indicador específico a evaluar...'
                            }
                          ]
                        };
                        setEditingRubric({ ...editingRubric, criteria: updatedCriteria });
                      }}
                      className="mt-2 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} /> Añadir Indicador
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  const nextNum = editingRubric.criteria.length + 1;
                  setEditingRubric({
                    ...editingRubric,
                    criteria: [
                      ...editingRubric.criteria,
                      {
                        id: `crit_custom_${Date.now()}`,
                        number: nextNum,
                        title: 'Nuevo Criterio de Evaluación',
                        description: 'Descripción general del criterio...',
                        indicators: [
                          {
                            id: `ind_custom_${Date.now()}_1`,
                            text: 'Cumple satisfactoriamente con los lineamientos de este criterio.'
                          }
                        ]
                      }
                    ]
                  });
                }}
                className="w-full py-3.5 rounded-2xl border-2 border-dashed border-indigo-300 hover:border-indigo-500 text-indigo-600 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus size={16} /> Agregar Nuevo Criterio / Dimensión
              </button>

              {/* Editor de Preguntas Abiertas: Diálogo Reflexivo con el Docente */}
              {(editingRubric.group === 'teacher' ||
                (editingRubric.reflectiveQuestions && editingRubric.reflectiveQuestions.length > 0)) && (
                <div className="p-5 rounded-3xl bg-indigo-50/50 border border-indigo-200 space-y-4 mt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black uppercase text-indigo-950 flex items-center gap-2">
                        <MessageSquare size={16} className="text-indigo-600" />
                        <span>Diálogo Reflexivo con el Docente (Preguntas Abiertas)</span>
                      </h4>
                      <p className="text-xs text-slate-600">
                        Preguntas abiertas aplicadas después del último criterio y antes de los acuerdos finales.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {(editingRubric.reflectiveQuestions || []).map((rq, rqIdx) => (
                      <div key={rq.id} className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                          {rqIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={rq.question}
                          onChange={(e) => {
                            const updatedQ = [...(editingRubric.reflectiveQuestions || [])];
                            updatedQ[rqIdx] = { ...rq, question: e.target.value };
                            setEditingRubric({ ...editingRubric, reflectiveQuestions: updatedQ });
                          }}
                          className="flex-1 px-3 py-2 rounded-xl bg-white border border-indigo-200 text-xs font-bold text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updatedQ = (editingRubric.reflectiveQuestions || [])
                              .filter((_, idx) => idx !== rqIdx)
                              .map((item, i) => ({ ...item, number: i + 1 }));
                            setEditingRubric({ ...editingRubric, reflectiveQuestions: updatedQ });
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        const currentQ = editingRubric.reflectiveQuestions || [];
                        setEditingRubric({
                          ...editingRubric,
                          reflectiveQuestions: [
                            ...currentQ,
                            {
                              id: `refl_custom_${Date.now()}`,
                              number: currentQ.length + 1,
                              question: 'Nueva pregunta abierta para el diálogo reflexivo...'
                            }
                          ]
                        });
                      }}
                      className="mt-2 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} /> Añadir Pregunta Abierta
                    </button>
                  </div>
                </div>
              )}

              {/* Editor de Preguntas Abiertas: Secuencias Didácticas (Opcional) */}
              {(editingRubric.group === 'teacher' ||
                (editingRubric.didacticSequenceQuestions &&
                  editingRubric.didacticSequenceQuestions.length > 0)) && (
                <div className="p-5 rounded-3xl bg-teal-50/60 border border-teal-200 space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-black uppercase text-teal-950 flex items-center gap-2">
                        <BookOpen size={16} className="text-teal-600" />
                        <span>
                          Cuestionario Opcional: Implementación de Secuencias Didácticas
                        </span>
                      </h4>
                      <p className="text-xs text-slate-600">
                        Preguntas abiertas desplegables para los docentes que aplican secuencias didácticas.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {(editingRubric.didacticSequenceQuestions || []).map((dq, dqIdx) => (
                      <div key={dq.id} className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-lg bg-teal-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                          {dqIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={dq.question}
                          onChange={(e) => {
                            const updatedQ = [...(editingRubric.didacticSequenceQuestions || [])];
                            updatedQ[dqIdx] = { ...dq, question: e.target.value };
                            setEditingRubric({
                              ...editingRubric,
                              didacticSequenceQuestions: updatedQ
                            });
                          }}
                          className="flex-1 px-3 py-2 rounded-xl bg-white border border-teal-200 text-xs font-bold text-slate-800"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const updatedQ = (editingRubric.didacticSequenceQuestions || [])
                              .filter((_, idx) => idx !== dqIdx)
                              .map((item, i) => ({ ...item, number: i + 1 }));
                            setEditingRubric({
                              ...editingRubric,
                              didacticSequenceQuestions: updatedQ
                            });
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={() => {
                        const currentQ = editingRubric.didacticSequenceQuestions || [];
                        setEditingRubric({
                          ...editingRubric,
                          didacticSequenceQuestions: [
                            ...currentQ,
                            {
                              id: `did_seq_custom_${Date.now()}`,
                              number: currentQ.length + 1,
                              question: 'Nueva pregunta abierta sobre secuencias didácticas...'
                            }
                          ]
                        });
                      }}
                      className="mt-2 px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus size={12} /> Añadir Pregunta de Secuencia Didáctica
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. VENTANA: BITÁCORA DE ASISTENCIA E INCIDENCIAS RÁPIDAS */}
      {activeTab === 'attendance' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-300">
          <div className="lg:col-span-5 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <TeacherRecordForm />
          </div>
          <div className="lg:col-span-7 bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-base font-black text-slate-900 uppercase">
              Historial de Registros Puntuales
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-[10px] font-black uppercase text-slate-400">
                    <th className="py-3">Docente</th>
                    <th className="py-3">Fecha</th>
                    <th className="py-3">Estado / Tipo</th>
                    <th className="py-3">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {attendanceRecords.slice(0, 25).map((r: any, idx: number) => {
                    const t = (state.teachers || []).find(
                      (x: any) => x.id === (r.teacherId || r.teacher_id)
                    );
                    return (
                      <tr key={r.id || idx}>
                        <td className="py-2.5 font-bold">{t?.full_name || t?.name || 'Docente'}</td>
                        <td className="py-2.5">{r.date}</td>
                        <td className="py-2.5 uppercase font-black text-indigo-600">{r.status}</td>
                        <td className="py-2.5 text-slate-500">{r.notes}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: APLICAR FICHA DE EVALUACIÓN INDIVIDUAL (ESCALA 1 A 4) */}
      {evaluatingStaff && rubrics[evaluatingStaff.group] && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Cabecera del Modal */}
            <div className="p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                    {GROUP_LABELS[evaluatingStaff.group].title}
                  </span>
                  <div className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-xl border border-white/20">
                    <span className="text-[10px] text-white/70 font-bold uppercase">Período:</span>
                    <select
                      value={evaluatingStaff.period}
                      onChange={(e) =>
                        handleOpenEvaluationModal(
                          evaluatingStaff.staff,
                          evaluatingStaff.group,
                          e.target.value as EvaluationPeriod,
                          formAcademicLevel
                        )
                      }
                      className="bg-transparent text-white text-xs font-black outline-none cursor-pointer"
                    >
                      <option value="P1" className="text-slate-900">
                        Período 1 (P1)
                      </option>
                      <option value="P2" className="text-slate-900">
                        Período 2 (P2)
                      </option>
                      <option value="P3" className="text-slate-900">
                        Período 3 (P3)
                      </option>
                      <option value="P4" className="text-slate-900">
                        Período 4 (P4)
                      </option>
                    </select>
                  </div>

                  {evaluatingStaff.period === 'P2' && (
                    <button
                      type="button"
                      onClick={() => handleMoveEvaluationPeriod('P1')}
                      className="px-2.5 py-1 rounded-xl text-xs font-black bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
                      title="Mover esta evaluación con todas sus respuestas al Período P1"
                    >
                      <ArrowDown size={13} />
                      <span>Bajar al P1</span>
                    </button>
                  )}

                  {evaluatingStaff.group === 'teacher' && (
                    <div className="flex items-center bg-white/10 rounded-xl p-0.5 border border-white/20">
                      <button
                        type="button"
                        onClick={() =>
                          loadEvaluationForStaffLevel(
                            evaluatingStaff.staff,
                            evaluatingStaff.group,
                            evaluatingStaff.period,
                            'Primaria'
                          )
                        }
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          formAcademicLevel === 'Primaria'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-white/70 hover:text-white'
                        }`}
                      >
                        📘 Nivel Primario
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          loadEvaluationForStaffLevel(
                            evaluatingStaff.staff,
                            evaluatingStaff.group,
                            evaluatingStaff.period,
                            'Secundaria'
                          )
                        }
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          formAcademicLevel === 'Secundaria'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'text-white/70 hover:text-white'
                        }`}
                      >
                        📙 Nivel Secundario
                      </button>
                    </div>
                  )}
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight mt-2">
                  Evaluando a:{' '}
                  {evaluatingStaff.staff.full_name || evaluatingStaff.staff.name}
                </h3>
                <p className="text-xs text-slate-300">
                  {rubrics[evaluatingStaff.group].title}
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => exportBlankEvaluationFormPDF(evaluatingStaff.group, true)}
                  className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Descargar este formulario en blanco para imprimir o revisar físicamente"
                >
                  <Printer size={13} />
                  <span>Imprimir en Blanco</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEvaluatingStaff(null)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Cuerpo del Formulario */}
            <form
              onSubmit={(e) => handleSaveEvaluation(e, false)}
              className="flex-1 overflow-y-auto p-6 space-y-6"
            >
              {/* Datos Oficiales de Aplicación: Grado, Asignatura/Área, Fecha, Coordinador y Hora */}
              <div className="bg-indigo-50/70 p-5 rounded-3xl border border-indigo-200/80 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200/60 pb-2.5">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-indigo-950 flex items-center gap-2">
                      <FileText size={15} className="text-indigo-600" />
                      <span>
                        Datos Oficiales para el Formulario Impreso •{' '}
                        {center?.name || 'Centro Educativo'}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      Regional: <strong>{center?.regional || 'No especificada'}</strong> • Distrito:{' '}
                      <strong>{center?.district || 'No especificado'}</strong>
                    </p>
                  </div>

                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-[11px] font-black text-indigo-700">
                    <Clock size={13} className="text-indigo-600" />
                    <span>
                      {formAppliedTime
                        ? `Última hora registrada: ${formAppliedTime}`
                        : 'La hora exacta se registrará automáticamente al guardar'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                      Seleccionar Grado / Curso {formAcademicLevel !== 'General' ? `(${formAcademicLevel})` : ''}
                    </label>
                    <select
                      value={formCourseId}
                      onChange={(e) => {
                        const cid = e.target.value;
                        setFormCourseId(cid);
                        if (!cid) {
                          setFormCourseName('General / Todos los Grados');
                        } else {
                          const found = (state.courses || []).find((c: any) => c.id === cid);
                          if (found) {
                            setFormCourseName(`${found.grade} "${found.section || ''}"`.trim());
                          }
                        }
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    >
                      <option value="">-- General / No aplica grado específico --</option>
                      {(state.courses || [])
                        .filter((c: any) => {
                          if (evaluatingStaff.group !== 'teacher') return true;
                          if (!formAcademicLevel || formAcademicLevel === 'General') return true;
                          const cLevel = (c.level || '').toLowerCase();
                          const cGrade = (c.grade || '').toLowerCase();
                          const isSec = cLevel.includes('sec') || cLevel.includes('med') || cGrade.includes('sec');
                          const isPri = cLevel.includes('prim') || cGrade.includes('prim');
                          if (formAcademicLevel === 'Secundaria') return isSec;
                          if (formAcademicLevel === 'Primaria') return isPri || (!isSec && !cLevel);
                          return true;
                        })
                        .map((c: any) => (
                          <option key={c.id} value={c.id}>
                            {c.grade} "{c.section}" ({c.level || 'General'})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                      Asignatura / Área Evaluada
                    </label>
                    <input
                      type="text"
                      value={formSubjectName}
                      onChange={(e) => setFormSubjectName(e.target.value)}
                      placeholder="Ej: Lengua Española, Matemática, Gestión..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                      Fecha de Aplicación
                    </label>
                    <input
                      type="date"
                      value={formAppliedDate}
                      onChange={(e) => setFormAppliedDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                      Coordinador(a) / Evaluador(a) (Para Firma)
                    </label>
                    <input
                      type="text"
                      value={formCoordinatorName}
                      onChange={(e) => setFormCoordinatorName(e.target.value)}
                      placeholder="Nombre del coordinador o acompañante..."
                      className="w-full px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Escala Recomendada 1 a 4 */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                {rubrics[evaluatingStaff.group].scale.map((s) => (
                  <div
                    key={s.value}
                    className="bg-white p-3 rounded-xl border border-slate-200/70 shadow-2xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="w-7 h-7 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0"
                        style={{ backgroundColor: s.color }}
                      >
                        {s.value}
                      </span>
                      <span className="text-xs font-black text-slate-900 uppercase">
                        {s.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1.5 leading-snug">
                      {s.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Criterios e Indicadores */}
              <div className="space-y-6">
                {rubrics[evaluatingStaff.group].criteria.map((crit) => {
                  const critVals = crit.indicators.map((i) => formScores[i.id] || 0);
                  const critAvg =
                    critVals.length > 0
                      ? critVals.reduce((a, b) => a + b, 0) / critVals.length
                      : 0;
                  const critPct = Math.round((critAvg / 4) * 100);

                  return (
                    <div
                      key={crit.id}
                      className="bg-slate-50/70 rounded-3xl border border-slate-200/90 p-5 space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                        <div>
                          <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <span className="w-7 h-7 rounded-xl bg-indigo-600 text-white text-xs flex items-center justify-center font-black">
                              {crit.number}
                            </span>
                            <span>{crit.title}</span>
                          </h4>
                          <p className="text-xs text-slate-500 mt-1">{crit.description}</p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-3 py-1 rounded-xl bg-indigo-50 text-indigo-700 font-black text-xs">
                            {critAvg.toFixed(2)} / 4.00 ({critPct}%)
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2.5">
                        {crit.indicators.map((ind, idx) => {
                          const currentVal = formScores[ind.id] || 0;
                          return (
                            <div
                              key={ind.id}
                              className="bg-white p-3.5 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:border-indigo-200 transition-colors"
                            >
                              <p className="text-xs font-bold text-slate-700 leading-relaxed flex-1">
                                <span className="text-indigo-600 font-black mr-1.5">
                                  {crit.number}.{idx + 1}
                                </span>
                                {ind.text}
                              </p>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {[1, 2, 3, 4].map((val) => {
                                  const isSelected = currentVal === val;
                                  const btnStyle: Record<number, string> = {
                                    4: isSelected
                                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-emerald-50',
                                    3: isSelected
                                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50',
                                    2: isSelected
                                      ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50',
                                    1: isSelected
                                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-rose-50'
                                  };
                                  return (
                                    <button
                                      key={val}
                                      type="button"
                                      onClick={() =>
                                        setFormScores((prev) => ({ ...prev, [ind.id]: val }))
                                      }
                                      className={`w-10 h-9 rounded-xl font-black text-xs border transition-all cursor-pointer ${btnStyle[val]}`}
                                    >
                                      {val}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Opción de Observación Específica para el Criterio General */}
                      <div className="pt-3 border-t border-slate-200/80">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-indigo-700 mb-1.5 flex items-center gap-1.5">
                          <MessageSquare size={12} />
                          <span>
                            Observación del Criterio {crit.number}: {crit.title} (Opcional)
                          </span>
                        </label>
                        <textarea
                          rows={2}
                          value={formCriteriaObservations[crit.id] || ''}
                          onChange={(e) =>
                            setFormCriteriaObservations((prev) => ({
                              ...prev,
                              [crit.id]: e.target.value
                            }))
                          }
                          placeholder={`Escribe aquí observaciones puntuales o comentarios sobre el criterio "${crit.title}"...`}
                          className="w-full p-3 rounded-2xl bg-white border border-slate-200 focus:border-indigo-400 outline-none text-xs text-slate-700"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Diálogo Reflexivo con el Docente (5 Preguntas Abiertas antes de los Acuerdos Finales) */}
              {(rubrics[evaluatingStaff.group].reflectiveQuestions || []).length > 0 && (
                <div className="bg-indigo-50/60 p-6 rounded-3xl border border-indigo-200/90 space-y-4">
                  <div className="border-b border-indigo-200/70 pb-3">
                    <h4 className="text-sm font-black text-indigo-950 uppercase tracking-tight flex items-center gap-2">
                      <MessageSquare size={18} className="text-indigo-600" />
                      <span>Diálogo reflexivo con el docente</span>
                    </h4>
                    <p className="text-xs text-slate-600 mt-1">
                      Preguntas abiertas de reflexión pedagógica posteriores a la observación de la práctica docente.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {(rubrics[evaluatingStaff.group].reflectiveQuestions || []).map((rq, rqIdx) => (
                      <div
                        key={rq.id}
                        className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-2xs space-y-2"
                      >
                        <label className="block text-xs font-black text-slate-800 leading-snug">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-indigo-600 text-white text-[11px] font-black mr-2">
                            {rq.number || rqIdx + 1}
                          </span>
                          {rq.question}
                        </label>
                        <textarea
                          rows={2}
                          value={formReflectiveAnswers[rq.id] || ''}
                          onChange={(e) =>
                            setFormReflectiveAnswers((prev) => ({
                              ...prev,
                              [rq.id]: e.target.value
                            }))
                          }
                          placeholder="Escribe aquí la respuesta o reflexión expresada por el docente..."
                          className="w-full p-3 rounded-xl bg-slate-50/70 focus:bg-white border border-slate-200 focus:border-indigo-400 outline-none text-xs text-slate-700 transition-colors"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* CUESTIONARIO OPCIONAL DESPLEGABLE: IMPLEMENTACIÓN DE LAS SECUENCIAS DIDÁCTICAS */}
              {(rubrics[evaluatingStaff.group].didacticSequenceQuestions || []).length > 0 && (
                <div className="rounded-[2rem] border-2 border-teal-500/40 bg-gradient-to-br from-teal-950 via-slate-900 to-emerald-950 text-white shadow-xl overflow-hidden transition-all">
                  {/* Cabecera Desplegable */}
                  <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-0.5 rounded-full bg-teal-400/20 border border-teal-400/40 text-teal-300 text-[10px] font-black uppercase tracking-widest">
                          Cuestionario Opcional • Acompañamiento a los docentes
                        </span>
                      </div>
                      <h4 className="text-base sm:text-lg font-black uppercase tracking-tight text-white flex items-center gap-2 pt-1">
                        <BookOpen size={19} className="text-teal-400 shrink-0" />
                        <span>
                          Diálogo reflexivo sobre la implementación de las secuencias didácticas
                        </span>
                      </h4>
                      <p className="text-xs text-teal-200/80">
                        Despliega este instrumento únicamente si el docente evaluado aplica Secuencias Didácticas.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowDidacticSequence((prev) => !prev)}
                      className={`px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shrink-0 flex items-center gap-2 shadow-lg ${
                        showDidacticSequence
                          ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                          : 'bg-teal-500 text-slate-950 hover:bg-teal-400'
                      }`}
                    >
                      <Layers size={15} />
                      <span>
                        {showDidacticSequence
                          ? 'Ocultar Secuencia Didáctica'
                          : 'Desplegar Cuestionario'}
                      </span>
                    </button>
                  </div>

                  {/* Cuerpo Desplegable con Diseño Diferenciado */}
                  {showDidacticSequence && (
                    <div className="p-6 bg-white text-slate-900 border-t border-teal-500/30 space-y-6 animate-in fade-in duration-200">
                      {/* Recuadro de Propósito */}
                      <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-50 via-emerald-50/70 to-amber-50/50 border-l-4 border-teal-600 shadow-2xs">
                        <p className="text-[10px] font-black uppercase tracking-widest text-teal-800 mb-1">
                          Propósito del Acompañamiento
                        </p>
                        <p className="text-xs text-slate-700 leading-relaxed font-medium">
                          Propiciar un espacio de diálogo horizontal que invite a la reflexión y a la
                          apropiación de las secuencias didácticas, reconociendo las fortalezas y los
                          retos en su implementación, con miras a mejorar la práctica pedagógica.
                        </p>
                      </div>

                      <div className="flex items-center justify-between border-b border-teal-100 pb-2">
                        <span className="text-xs font-black uppercase tracking-wider text-teal-900 flex items-center gap-2">
                          <Sparkles size={15} className="text-teal-600" />
                          <span>Diálogo con el docente (Preguntas Abiertas)</span>
                        </span>
                        <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                          {(rubrics[evaluatingStaff.group].didacticSequenceQuestions || []).length}{' '}
                          preguntas de reflexión
                        </span>
                      </div>

                      {/* Lista de 9 Preguntas Abiertas con Estilo Distinto */}
                      <div className="grid grid-cols-1 gap-4">
                        {(rubrics[evaluatingStaff.group].didacticSequenceQuestions || []).map(
                          (dq, dqIdx) => (
                            <div
                              key={dq.id}
                              className="p-4 rounded-2xl bg-teal-50/30 border border-teal-200/80 border-l-4 border-l-teal-600 space-y-2 hover:bg-teal-50/50 transition-colors"
                            >
                              <label className="block text-xs font-black text-teal-950 leading-snug">
                                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-teal-700 text-white text-[10px] font-black mr-2 uppercase">
                                  Pregunta {dq.number || dqIdx + 1}
                                </span>
                                {dq.question}
                              </label>
                              <textarea
                                rows={2}
                                value={formDidacticAnswers[dq.id] || ''}
                                onChange={(e) =>
                                  setFormDidacticAnswers((prev) => ({
                                    ...prev,
                                    [dq.id]: e.target.value
                                  }))
                                }
                                placeholder="Escribe aquí la reflexión o respuesta abierta del docente..."
                                className="w-full p-3 rounded-xl bg-white border border-teal-200 focus:border-teal-600 outline-none text-xs text-slate-800"
                              />
                            </div>
                          )
                        )}
                      </div>

                      {/* Campo final de Observaciones de la Secuencia Didáctica */}
                      <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-2">
                        <label className="block text-xs font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                          <FileText size={14} className="text-amber-700" />
                          <span>
                            Observaciones Generales sobre la Implementación de las Secuencias Didácticas
                          </span>
                        </label>
                        <textarea
                          rows={3}
                          value={formDidacticObservations}
                          onChange={(e) => setFormDidacticObservations(e.target.value)}
                          placeholder="Registra aquí las observaciones generales del acompañante sobre la aplicación de la secuencia didáctica..."
                          className="w-full p-3 rounded-xl bg-white border border-amber-200 focus:border-amber-500 outline-none text-xs text-slate-800"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Observaciones Cualitativas y Acuerdos de Mejora */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-5 rounded-3xl border border-slate-200">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-emerald-700 mb-1">
                    Fortalezas Evidenciadas
                  </label>
                  <textarea
                    rows={3}
                    value={formStrengths}
                    onChange={(e) => setFormStrengths(e.target.value)}
                    placeholder="Aspectos destacados durante el acompañamiento..."
                    className="w-full p-3 rounded-xl bg-white border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-amber-700 mb-1">
                    Oportunidades de Mejora
                  </label>
                  <textarea
                    rows={3}
                    value={formImprovements}
                    onChange={(e) => setFormImprovements(e.target.value)}
                    placeholder="Aspectos puntuales por fortalecer..."
                    className="w-full p-3 rounded-xl bg-white border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-indigo-700 mb-1">
                    Acuerdos y Compromisos Asumidos
                  </label>
                  <textarea
                    rows={3}
                    value={formCommitments}
                    onChange={(e) => setFormCommitments(e.target.value)}
                    placeholder="Compromisos verificables para el próximo seguimiento..."
                    className="w-full p-3 rounded-xl bg-white border border-slate-200 text-xs"
                  />
                </div>
              </div>

              {/* Pie del Modal con Resumen en Vivo y Botón Guardar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-slate-200">
                {(() => {
                  const vals = Object.values(formScores);
                  const sum = vals.reduce((a, b) => a + Number(b || 0), 0);
                  const avg = vals.length > 0 ? sum / vals.length : 0;
                  const pct = vals.length > 0 ? Math.round((sum / (vals.length * 4)) * 100) : 0;
                  const lvl = calculateLevelFromAverage(avg);
                  return (
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-4 py-2 rounded-2xl font-black text-sm border ${lvl.bgClass} ${lvl.textClass} ${lvl.borderClass}`}
                      >
                        Resultado: {avg.toFixed(2)} / 4.00 ({pct}%) • {lvl.label}
                      </span>
                    </div>
                  );
                })()}

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEvaluatingStaff(null)}
                    className="px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-wider hover:bg-slate-100 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isSavingEval}
                    onClick={() => handleSaveEvaluation(undefined, true)}
                    className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 cursor-pointer"
                    title="Guarda la evaluación registrando la hora actual y abre el formulario listo para imprimir y firmar"
                  >
                    <Printer size={16} />
                    <span>
                      {isSavingEval ? 'Procesando...' : 'Guardar e Imprimir para Firmar'}
                    </span>
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingEval}
                    className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 cursor-pointer"
                  >
                    <CheckCircle2 size={16} />
                    <span>{isSavingEval ? 'Guardando...' : 'Solo Guardar'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REPORTE INDIVIDUAL GRÁFICO Y COMPARATIVO POR PERÍODOS */}
      {viewingStaffDetail && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {(() => {
              const { staff, group } = viewingStaffDetail;
              const staffName = staff.full_name || staff.name || 'Colaborador';
              const rubric = rubrics[group];
              const personEvals = internalEvaluations.filter(
                (e) => e.staffId === staff.id && e.staffRole === group
              );
              const teacherSurveys = surveyEvaluations.filter((s) => s.staffId === staff.id);

              const priEvals = personEvals.filter(
                (e) =>
                  (e.academicLevel ||
                    (e.courseName?.toLowerCase().includes('sec') ? 'Secundaria' : 'Primaria')) ===
                  'Primaria'
              );
              const secEvals = personEvals.filter(
                (e) =>
                  (e.academicLevel ||
                    (e.courseName?.toLowerCase().includes('sec') ? 'Secundaria' : 'Primaria')) ===
                  'Secundaria'
              );

              const priAvgPct =
                priEvals.length > 0
                  ? Math.round(priEvals.reduce((s, e) => s + e.percentage, 0) / priEvals.length)
                  : null;
              const secAvgPct =
                secEvals.length > 0
                  ? Math.round(secEvals.reduce((s, e) => s + e.percentage, 0) / secEvals.length)
                  : null;
              const surveyAvgPct =
                teacherSurveys.length > 0
                  ? Math.round(teacherSurveys.reduce((s, e) => s + e.percentage, 0) / teacherSurveys.length)
                  : null;

              const validParts = [priAvgPct, secAvgPct, surveyAvgPct].filter(
                (x): x is number => x !== null
              );
              const consolidatedIntegralPct =
                validParts.length > 0
                  ? Math.round(validParts.reduce((a, b) => a + b, 0) / validParts.length)
                  : null;

              const criteriaComparisonData = (rubric?.criteria || []).map((c) => {
                const row: any = {
                  name: `${c.number}. ${c.title.substring(0, 22)}`,
                  fullTitle: `${c.number}. ${c.title}`
                };
                (['P1', 'P2', 'P3', 'P4'] as EvaluationPeriod[]).forEach((p) => {
                  const evsForP = personEvals.filter((x) => x.period === p);
                  if (evsForP.length > 0) {
                    const sumAvg = evsForP.reduce(
                      (s, x) => s + (x.criteriaAverages?.[c.id] || 0),
                      0
                    );
                    const avg = sumAvg / evsForP.length;
                    row[p] = avg > 0 ? Math.round((avg / 4) * 100) : 0;
                  } else {
                    row[p] = 0;
                  }
                });
                return row;
              });

              return (
                <>
                  <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                        Informe Individual de Rendimiento • {GROUP_LABELS[group].title}
                      </span>
                      <h3 className="text-xl font-black uppercase tracking-tight mt-1">
                        {staffName}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => exportIndividualStaffPDF(staff, group, undefined, true)}
                        className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer size={14} /> Imprimir para Firmar
                      </button>
                      <button
                        type="button"
                        onClick={() => exportIndividualStaffPDF(staff, group, undefined, false)}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs uppercase flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download size={14} /> Descargar PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewingStaffDetail(null)}
                        className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                      >
                        <X size={20} />
                      </button>
                    </div>
                  </div>

                  <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {/* Consolidado Integral Génesis para Docentes (Primaria + Secundaria + Encuestas) */}
                    {group === 'teacher' && (
                      <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 text-white p-5 rounded-3xl shadow-lg border border-indigo-500/30 space-y-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-800/60 pb-3">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">
                              Consolidado Integral Génesis • Evaluación 360°
                            </span>
                            <h4 className="text-base font-black">
                              Desempeño Combinado: Primaria, Secundaria y Familias
                            </h4>
                          </div>
                          {consolidatedIntegralPct !== null && (
                            <span className="px-4 py-1.5 rounded-2xl bg-emerald-500 text-slate-950 text-sm font-black tracking-tight inline-flex items-center gap-1.5 shadow-md">
                              ⭐ {consolidatedIntegralPct}% Rendimiento Global
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          {/* Primaria */}
                          <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-blue-300 uppercase">📘 Nivel Primario</span>
                              <span className="text-xs font-black text-white">
                                {priAvgPct !== null ? `${priAvgPct}%` : 'Pendiente'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300">
                              {priEvals.length > 0
                                ? `${priEvals.length} eval. (${priEvals.map((e) => e.period).join(', ')}) • Coord: ${priEvals[priEvals.length - 1].coordinatorName || 'Primaria'}`
                                : 'Sin evaluación registrada en Primaria'}
                            </p>
                          </div>

                          {/* Secundaria */}
                          <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-amber-300 uppercase">📙 Nivel Secundario</span>
                              <span className="text-xs font-black text-white">
                                {secAvgPct !== null ? `${secAvgPct}%` : 'Pendiente'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300">
                              {secEvals.length > 0
                                ? `${secEvals.length} eval. (${secEvals.map((e) => e.period).join(', ')}) • Coord: ${secEvals[secEvals.length - 1].coordinatorName || 'Secundaria'}`
                                : 'Sin evaluación registrada en Secundaria'}
                            </p>
                          </div>

                          {/* Encuestas */}
                          <div className="bg-white/10 p-3.5 rounded-2xl border border-white/10 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-teal-300 uppercase">👥 Encuestas Alumnos/Padres</span>
                              <span className="text-xs font-black text-white">
                                {surveyAvgPct !== null ? `${surveyAvgPct}%` : 'Sin datos'}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-300">
                              {teacherSurveys.length > 0
                                ? `${teacherSurveys.length} respuestas de estudiantes y familias`
                                : 'Sin respuestas registradas'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Tarjetas por Período (P1, P2, P3, P4) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {(['P1', 'P2', 'P3', 'P4'] as EvaluationPeriod[]).map((p) => {
                        if (group === 'teacher') {
                          const evPri = priEvals.find((x) => x.period === p);
                          const evSec = secEvals.find((x) => x.period === p);

                          if (evPri && evSec) {
                            const avgPct = Math.round((evPri.percentage + evSec.percentage) / 2);
                            return (
                              <div
                                key={p}
                                className="p-4 rounded-2xl border border-indigo-200 bg-indigo-50/40 flex flex-col justify-between space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-slate-700 uppercase">
                                    Período {p}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-indigo-600 text-white">
                                    {avgPct}% Consolidado
                                  </span>
                                </div>
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                                    <span className="font-bold text-blue-900">📘 Primaria:</span>
                                    <span className="font-black text-blue-700">
                                      {evPri.percentage}% ({evPri.averageScore.toFixed(2)}/4)
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                                    <span className="font-bold text-amber-900">📙 Secundaria:</span>
                                    <span className="font-black text-amber-700">
                                      {evSec.percentage}% ({evSec.averageScore.toFixed(2)}/4)
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          if (evPri && !evSec) {
                            return (
                              <div
                                key={p}
                                className="p-4 rounded-2xl border border-blue-200 bg-blue-50/30 flex flex-col justify-between space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-slate-700 uppercase">
                                    Período {p}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-blue-100 text-blue-800">
                                    {evPri.percentage}% Prim
                                  </span>
                                </div>
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex items-center justify-between p-2 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                                    <span className="font-bold text-blue-900">📘 Primaria:</span>
                                    <span className="font-black text-blue-700">
                                      {evPri.percentage}% ({evPri.averageScore.toFixed(2)}/4)
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewingStaffDetail(null);
                                      handleOpenEvaluationModal(staff, group, p, 'Secundaria');
                                    }}
                                    className="w-full text-center py-1.5 rounded-xl border border-dashed border-amber-300 text-amber-700 hover:bg-amber-50 text-[11px] font-black uppercase cursor-pointer transition-colors"
                                  >
                                    + Evaluar Secundaria
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          if (!evPri && evSec) {
                            return (
                              <div
                                key={p}
                                className="p-4 rounded-2xl border border-amber-200 bg-amber-50/30 flex flex-col justify-between space-y-2"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-black text-slate-700 uppercase">
                                    Período {p}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-amber-100 text-amber-800">
                                    {evSec.percentage}% Sec
                                  </span>
                                </div>
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex items-center justify-between p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                                    <span className="font-bold text-amber-900">📙 Secundaria:</span>
                                    <span className="font-black text-amber-700">
                                      {evSec.percentage}% ({evSec.averageScore.toFixed(2)}/4)
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setViewingStaffDetail(null);
                                      handleOpenEvaluationModal(staff, group, p, 'Primaria');
                                    }}
                                    className="w-full text-center py-1.5 rounded-xl border border-dashed border-blue-300 text-blue-700 hover:bg-blue-50 text-[11px] font-black uppercase cursor-pointer transition-colors"
                                  >
                                    + Evaluar Primaria
                                  </button>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={p}
                              className="p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 flex flex-col justify-between space-y-2"
                            >
                              <span className="text-xs font-black text-slate-400 uppercase">
                                Período {p}
                              </span>
                              <div className="space-y-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingStaffDetail(null);
                                    handleOpenEvaluationModal(staff, group, p, 'Primaria');
                                  }}
                                  className="w-full text-center py-1.5 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 text-[11px] font-black uppercase cursor-pointer transition-colors"
                                >
                                  + Evaluar Primaria
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingStaffDetail(null);
                                    handleOpenEvaluationModal(staff, group, p, 'Secundaria');
                                  }}
                                  className="w-full text-center py-1.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 text-[11px] font-black uppercase cursor-pointer transition-colors"
                                >
                                  + Evaluar Secundaria
                                </button>
                              </div>
                            </div>
                          );
                        }

                        // Roles no docentes
                        const ev = personEvals.find((x) => x.period === p);
                        const lvl = ev ? calculateLevelFromAverage(ev.averageScore) : null;
                        return (
                          <div
                            key={p}
                            className="p-4 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-500 uppercase">
                                Período {p}
                              </span>
                              {ev && lvl && (
                                <span
                                  className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${lvl.bgClass} ${lvl.textClass}`}
                                >
                                  {lvl.label}
                                </span>
                              )}
                            </div>
                            {ev ? (
                              <div className="mt-2">
                                <p className="text-2xl font-black text-slate-900">
                                  {ev.percentage}%
                                </p>
                                <p className="text-xs font-bold text-slate-500">
                                  Promedio: {ev.averageScore.toFixed(2)} / 4.00
                                </p>
                              </div>
                            ) : (
                              <div className="mt-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setViewingStaffDetail(null);
                                    handleOpenEvaluationModal(staff, group, p);
                                  }}
                                  className="text-xs font-black text-indigo-600 hover:underline cursor-pointer"
                                >
                                  + Evaluar {p}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Gráfico Comparativo por Criterio y Período */}
                    {personEvals.length > 0 ? (
                      <>
                        <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-4">
                          <h4 className="text-sm font-black uppercase text-slate-800">
                            Evolución Porcentual por Criterios en cada Período (%)
                          </h4>
                          <div className="h-72">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={criteriaComparisonData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} />
                                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="P1" name="Período 1" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="P2" name="Período 2" fill="#10b981" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="P3" name="Período 3" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="P4" name="Período 4" fill="#ec4899" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Observaciones Registradas por Criterio General */}
                        {personEvals.some(
                          (ev) =>
                            ev.criteriaObservations &&
                            Object.values(ev.criteriaObservations).some((v) => v && v.trim())
                        ) && (
                          <div className="bg-slate-50 p-5 rounded-3xl border border-slate-200 space-y-3">
                            <h4 className="text-sm font-black uppercase text-slate-800">
                              Observaciones Registradas por Criterio General
                            </h4>
                            <div className="space-y-3">
                              {personEvals.map((ev) => {
                                const obsEntries = (rubric?.criteria || []).filter(
                                  (c) =>
                                    ev.criteriaObservations?.[c.id] &&
                                    ev.criteriaObservations[c.id].trim()
                                );
                                if (obsEntries.length === 0) return null;
                                return (
                                  <div
                                    key={ev.id}
                                    className="bg-white p-4 rounded-2xl border border-slate-200 space-y-2"
                                  >
                                    <span className="inline-block px-2.5 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-black uppercase">
                                      Período {ev.period}
                                    </span>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                      {obsEntries.map((c) => (
                                        <div
                                          key={c.id}
                                          className="p-3 rounded-xl bg-slate-50 border border-slate-200/70"
                                        >
                                          <p className="text-[11px] font-black text-slate-800">
                                            {c.number}. {c.title}
                                          </p>
                                          <p className="text-xs text-slate-600 mt-1 italic">
                                            "{ev.criteriaObservations?.[c.id]}"
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Respuestas del Diálogo Reflexivo con el Docente */}
                        {(rubric?.reflectiveQuestions || []).length > 0 &&
                          personEvals.some(
                            (ev) =>
                              ev.reflectiveAnswers &&
                              Object.values(ev.reflectiveAnswers).some((v) => v && v.trim())
                          ) && (
                            <div className="bg-indigo-50/50 p-5 rounded-3xl border border-indigo-200 space-y-3">
                              <h4 className="text-sm font-black uppercase text-indigo-950 flex items-center gap-2">
                                <MessageSquare size={15} className="text-indigo-600" />
                                <span>Diálogo Reflexivo con el Docente</span>
                              </h4>
                              <div className="space-y-3">
                                {personEvals.map((ev) => {
                                  const answeredQuestions = (rubric?.reflectiveQuestions || []).filter(
                                    (q) =>
                                      ev.reflectiveAnswers?.[q.id] &&
                                      ev.reflectiveAnswers[q.id].trim()
                                  );
                                  if (answeredQuestions.length === 0) return null;
                                  return (
                                    <div
                                      key={ev.id}
                                      className="bg-white p-4 rounded-2xl border border-indigo-100 space-y-2.5"
                                    >
                                      <span className="inline-block px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase">
                                        Período {ev.period}
                                      </span>
                                      <div className="space-y-2">
                                        {answeredQuestions.map((q) => (
                                          <div
                                            key={q.id}
                                            className="p-3 rounded-xl bg-slate-50 border border-slate-200/70"
                                          >
                                            <p className="text-[11px] font-black text-slate-800">
                                              {q.number}. {q.question}
                                            </p>
                                            <p className="text-xs text-slate-600 mt-1 italic">
                                              "{ev.reflectiveAnswers?.[q.id]}"
                                            </p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                        {/* Respuestas del Cuestionario Opcional de Secuencias Didácticas */}
                        {(rubric?.didacticSequenceQuestions || []).length > 0 &&
                          personEvals.some(
                            (ev) =>
                              ev.appliesDidacticSequence ||
                              (ev.didacticSequenceAnswers &&
                                Object.values(ev.didacticSequenceAnswers).some(
                                  (v) => v && v.trim()
                                )) ||
                              (ev.didacticSequenceObservations &&
                                ev.didacticSequenceObservations.trim())
                          ) && (
                            <div className="bg-teal-50/70 p-5 rounded-3xl border-2 border-teal-200 space-y-3">
                              <h4 className="text-sm font-black uppercase text-teal-950 flex items-center gap-2">
                                <BookOpen size={15} className="text-teal-600" />
                                <span>
                                  Diálogo Reflexivo sobre la Implementación de las Secuencias Didácticas
                                </span>
                              </h4>
                              <div className="space-y-3">
                                {personEvals.map((ev) => {
                                  const answeredDidactic = (
                                    rubric?.didacticSequenceQuestions || []
                                  ).filter(
                                    (q) =>
                                      ev.didacticSequenceAnswers?.[q.id] &&
                                      ev.didacticSequenceAnswers[q.id].trim()
                                  );
                                  const hasObs =
                                    ev.didacticSequenceObservations &&
                                    ev.didacticSequenceObservations.trim();
                                  if (answeredDidactic.length === 0 && !hasObs) return null;
                                  return (
                                    <div
                                      key={ev.id}
                                      className="bg-white p-4 rounded-2xl border border-teal-200 space-y-2.5"
                                    >
                                      <span className="inline-block px-2.5 py-0.5 rounded-lg bg-teal-100 text-teal-800 text-[10px] font-black uppercase">
                                        Período {ev.period} • Secuencia Didáctica
                                      </span>
                                      <div className="space-y-2">
                                        {answeredDidactic.map((q) => (
                                          <div
                                            key={q.id}
                                            className="p-3 rounded-xl bg-teal-50/40 border border-teal-100 border-l-4 border-l-teal-600"
                                          >
                                            <p className="text-[11px] font-black text-teal-950">
                                              {q.number}. {q.question}
                                            </p>
                                            <p className="text-xs text-slate-700 mt-1 italic">
                                              "{ev.didacticSequenceAnswers?.[q.id]}"
                                            </p>
                                          </div>
                                        ))}
                                        {hasObs && (
                                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                                            <p className="text-[11px] font-black uppercase text-amber-900">
                                              Observaciones (Secuencias Didácticas):
                                            </p>
                                            <p className="text-xs text-slate-700 mt-1">
                                              {ev.didacticSequenceObservations}
                                            </p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                      </>
                    ) : (
                      <div className="p-8 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                        <p className="text-sm font-bold text-slate-500">
                          Aún no se han registrado evaluaciones internas para {staffName}.
                        </p>
                      </div>
                    )}

                    {/* Resumen de Encuestas de Alumnos/Padres si es Docente */}
                    {group === 'teacher' && (
                      <div className="bg-teal-50/60 p-5 rounded-3xl border border-teal-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-black uppercase text-teal-950">
                            Valoración Recibida en Encuestas de Alumnos y Padres (
                            {teacherSurveys.length} respuestas)
                          </h4>
                          {teacherSurveys.length > 0 && (
                            <span className="px-3 py-1 rounded-xl bg-teal-600 text-white text-xs font-black">
                              Promedio:{' '}
                              {(
                                teacherSurveys.reduce((a, b) => a + b.averageScore, 0) /
                                teacherSurveys.length
                              ).toFixed(2)}{' '}
                              / 4.00 (
                              {Math.round(
                                teacherSurveys.reduce((a, b) => a + b.percentage, 0) /
                                  teacherSurveys.length
                              )}
                              %)
                            </span>
                          )}
                        </div>
                        {teacherSurveys.filter((s) => s.generalNotes).length > 0 && (
                          <div className="space-y-1.5 pt-2">
                            <p className="text-[10px] font-black uppercase text-teal-700">
                              Comentarios de estudiantes y familias:
                            </p>
                            {teacherSurveys
                              .filter((s) => s.generalNotes)
                              .slice(0, 6)
                              .map((s) => (
                                <div
                                  key={s.id}
                                  className="p-2.5 rounded-xl bg-white border border-teal-100 text-xs text-slate-700"
                                >
                                  "{s.generalNotes}"{' '}
                                  <span className="text-[10px] font-bold text-teal-600 ml-2">
                                    — {s.courseName || s.period}
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};
