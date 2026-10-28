import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  GraduationCap,
  Lock,
  Unlock,
  CheckCircle2,
  AlertCircle,
  Printer,
  ChevronDown,
  User,
  Users,
  Award,
  BookOpen,
  Calendar,
  Sparkles,
  TrendingUp,
  Download,
  Loader2,
  ShieldCheck,
  PhoneCall,
  Building2
} from 'lucide-react';
import { useApp, useSupabase } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { dataService } from '../services/dataService';
import { gradesReleaseService } from '../services/gradesReleaseService';
import { resolveStudentForUser } from '../utils/studentResolver';
import { getReportTanda } from '../utils/courseSorter';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ParentGradesModuleProps {
  userData: any;
  onViewChange?: (view: string) => void;
}

export const ParentGradesModule: React.FC<ParentGradesModuleProps> = ({
  userData: profile,
  onViewChange
}) => {
  const { state, center, selectedYear } = useApp();
  const schoolYear = selectedYear || '2026-2027';
  const centerId = profile?.center_id || center?.id || '';

  const isParent = ['parent', 'padre', 'tutor', 'madre', 'familiar'].includes(profile?.role || '');

  const [loading, setLoading] = useState(true);
  const [familyStudents, setFamilyStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [isGradesReleased, setIsGradesReleased] = useState<boolean>(false);
  const [gradesMap, setGradesMap] = useState<Record<string, Record<string, any>>>({});
  const [selectedPeriod, setSelectedPeriod] = useState<'P1' | 'P2' | 'P3' | 'P4' | 'FINAL'>('P1');

  // 1. Resolver el estudiante activo (o lista de hijos para padres)
  useEffect(() => {
    let isCancelled = false;
    const initStudents = async () => {
      setLoading(true);
      try {
        const resolved = await resolveStudentForUser({
          profile,
          centerId,
          stateStudents: state.students
        });

        if (isCancelled) return;

        let studentsList: any[] = [];
        if (resolved.familyStudents && resolved.familyStudents.length > 0) {
          studentsList = resolved.familyStudents;
        } else if (resolved.student) {
          studentsList = [resolved.student];
        }

        // Si es padre y aún no tiene en familyStudents, intentar buscar en parents table
        if (isParent && studentsList.length === 0 && profile?.id) {
          const { data: pLinks } = await supabase
            .from('parents')
            .select('student_id, students(*)')
            .eq('profile_id', profile.id);

          if (pLinks && pLinks.length > 0) {
            pLinks.forEach((l: any) => {
              if (l.students) studentsList.push(l.students);
            });
          }
        }

        setFamilyStudents(studentsList);

        const initialId =
          selectedStudentId ||
          resolved.studentId ||
          studentsList[0]?.id ||
          profile?.student_id ||
          '';

        setSelectedStudentId(initialId);
      } catch (err) {
        console.error('[ParentGradesModule] Error resolviendo estudiante:', err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    initStudents();

    return () => {
      isCancelled = true;
    };
  }, [profile, centerId, isParent, state.students]);

  // Alumno actualmente seleccionado
  const currentStudent = useMemo(() => {
    return familyStudents.find((s) => s.id === selectedStudentId) || familyStudents[0] || null;
  }, [familyStudents, selectedStudentId]);

  // Curso del alumno
  const studentCourse = useMemo(() => {
    if (!currentStudent?.course_id) return null;
    return (state.courses || []).find((c: any) => c.id === currentStudent.course_id) || null;
  }, [currentStudent, state.courses]);

  const isSecundario = useMemo(() => {
    return (studentCourse?.level || '').toLowerCase().includes('secund');
  }, [studentCourse]);

  // Competencias oficiales
  const competencies = useMemo(() => {
    if (isSecundario) {
      return [
        { id: 'c2', short: 'C1', name: 'Comunicativa', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
        { id: 'c3', short: 'C2', name: 'Pensamiento Lógico, Creativo y Crítico', color: 'text-amber-700 bg-amber-50 border-amber-200' },
        { id: 'c1', short: 'C3', name: 'Ética y Ciudadana', color: 'text-sky-700 bg-sky-50 border-sky-200' },
        { id: 'c4', short: 'C4', name: 'Científica y Tecnológica', color: 'text-purple-700 bg-purple-50 border-purple-200' }
      ];
    }
    return [
      { id: 'c1', short: 'C1', name: 'Comunicativa', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
      { id: 'c2', short: 'C2', name: 'Pensamiento Lógico', color: 'text-amber-700 bg-amber-50 border-amber-200' },
      { id: 'c3', short: 'C3', name: 'Ética y Ciudadana', color: 'text-sky-700 bg-sky-50 border-sky-200' }
    ];
  }, [isSecundario]);

  // 2. Verificar permiso de visualización (Finanzas)
  useEffect(() => {
    if (!currentStudent?.id) {
      setIsGradesReleased(false);
      return;
    }

    let isMounted = true;
    gradesReleaseService
      .isStudentGradesReleased(currentStudent.id, centerId, schoolYear)
      .then((released) => {
        if (isMounted) setIsGradesReleased(released);
      })
      .catch(() => {
        if (isMounted) setIsGradesReleased(false);
      });

    // Escuchar cambios reactivos en vivo
    const handleReleaseChange = (e: any) => {
      const map = e.detail?.releasedMap;
      if (map && map[currentStudent.id] !== undefined) {
        setIsGradesReleased(!!map[currentStudent.id]);
      }
    };
    window.addEventListener('gradesReleaseChanged', handleReleaseChange);

    return () => {
      isMounted = false;
      window.removeEventListener('gradesReleaseChanged', handleReleaseChange);
    };
  }, [currentStudent?.id, centerId, schoolYear]);

  // 3. Cargar calificaciones del alumno desde student_grades
  useEffect(() => {
    if (!currentStudent?.id || !isGradesReleased) {
      setGradesMap({});
      return;
    }

    let isCancelled = false;
    const fetchGrades = async () => {
      try {
        const { data, error } = await supabase
          .from('student_grades')
          .select('*')
          .eq('student_id', currentStudent.id)
          .eq('school_year', schoolYear);

        if (error) throw error;
        if (isCancelled) return;

        const map: Record<string, Record<string, any>> = {};
        if (data) {
          data.forEach((g: any) => {
            if (!map[g.subject_id]) map[g.subject_id] = {};
            const sGrades = map[g.subject_id];
            const pL = (g.period || '').toLowerCase();

            if (g.grade !== null) sGrades[`${g.competency_id}_${pL}`] = g.grade;
            if (g.rp1 !== null) sGrades[`${g.competency_id}_rp1`] = g.rp1;
            if (g.rp2 !== null) sGrades[`${g.competency_id}_rp2`] = g.rp2;
            if (g.rp3 !== null) sGrades[`${g.competency_id}_rp3`] = g.rp3;
            if (g.rp4 !== null) sGrades[`${g.competency_id}_rp4`] = g.rp4;
            if (g.recovery_grade !== null) sGrades['final_rec'] = g.recovery_grade;
            if (g.period === 'COMP') sGrades['comp'] = g.grade;
            if (g.period === 'EXTRA') sGrades['extra'] = g.grade;
            if (g.period === 'ESP1') sGrades['esp1'] = g.grade;
            if (g.period === 'ESP2') sGrades['esp2'] = g.grade;
          });
        }

        setGradesMap(map);
      } catch (err) {
        console.error('[ParentGradesModule] Error cargando notas:', err);
      }
    };

    fetchGrades();

    return () => {
      isCancelled = true;
    };
  }, [currentStudent?.id, isGradesReleased, schoolYear]);

  // Asignaturas del curso
  const courseSubjects = useMemo(() => {
    if (!studentCourse?.id) return [];
    let subs = (state.assignments || [])
      .filter((a: any) => a.course_id === studentCourse.id)
      .map((a: any) => (state.subjects || []).find((s: any) => s.id === a.subject_id))
      .filter(Boolean);

    if (subs.length === 0 && studentCourse) {
      const cLvl = (studentCourse.level || '').toLowerCase();
      subs = (state.subjects || []).filter((s: any) =>
        (s.level || '').toLowerCase().includes(cLvl.substring(0, 5))
      );
    }
    if (subs.length === 0) subs = state.subjects || [];

    // Deduplicar por id
    const unique = Array.from(new Map(subs.map((s: any) => [s.id, s])).values());
    return unique.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
  }, [studentCourse, state.assignments, state.subjects]);

  // Cálculos por materia y periodo
  const getBestGrade = (sGrades: any, cId: string, p: string) => {
    if (!sGrades) return 0;
    const pL = p.toLowerCase();
    const g = parseInt(sGrades[`${cId}_${pL}`], 10) || 0;
    const r = parseInt(sGrades[`${cId}_r${pL}`], 10) || 0;
    return Math.max(g, r);
  };

  const calculatedSubjects = useMemo(() => {
    return courseSubjects.map((subject: any) => {
      const sGrades = gradesMap[subject.id] || {};

      // Notas por competencia en el período seleccionado
      const periodScores: Record<string, number> = {};
      let periodSum = 0;
      let periodCount = 0;

      competencies.forEach((comp) => {
        if (selectedPeriod === 'FINAL') {
          // Promedio de los 4 periodos para esta competencia
          const pSum = ['p1', 'p2', 'p3', 'p4'].reduce((acc, p) => acc + getBestGrade(sGrades, comp.id, p), 0);
          const pAvg = Math.round(pSum / 4);
          periodScores[comp.id] = pAvg;
          if (pAvg > 0) {
            periodSum += pAvg;
            periodCount++;
          }
        } else {
          const val = getBestGrade(sGrades, comp.id, selectedPeriod);
          periodScores[comp.id] = val;
          if (val > 0) {
            periodSum += val;
            periodCount++;
          }
        }
      });

      // Calificación final del periodo (media de competencias)
      let subjectFinal = periodCount > 0 ? Math.round(periodSum / competencies.length) : 0;

      // Si es final y tiene recuperación final
      if (selectedPeriod === 'FINAL' && !isSecundario) {
        const recFinal = parseInt(sGrades['final_rec'], 10) || 0;
        subjectFinal = Math.max(subjectFinal, recFinal);
      }

      const passingGrade = isSecundario ? 70 : 65;
      const isApproved = subjectFinal >= passingGrade;

      return {
        ...subject,
        periodScores,
        subjectFinal,
        isApproved,
        hasGrades: periodCount > 0
      };
    });
  }, [courseSubjects, gradesMap, competencies, selectedPeriod, isSecundario]);

  // Métricas generales (GPA)
  const evaluatedSubjects = calculatedSubjects.filter((s) => s.hasGrades);
  const totalScore = evaluatedSubjects.reduce((acc, s) => acc + s.subjectFinal, 0);
  const overallAverage = evaluatedSubjects.length > 0 ? Math.round(totalScore / evaluatedSubjects.length) : 0;
  const approvedCount = evaluatedSubjects.filter((s) => s.isApproved).length;
  const pendingCount = evaluatedSubjects.length - approvedCount;

  // Clasificación cualitativa
  const performanceLabel = useMemo(() => {
    if (overallAverage >= 90) return { text: 'Excelente', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    if (overallAverage >= 80) return { text: 'Muy Bueno', color: 'text-blue-600 bg-blue-50 border-blue-200' };
    if (overallAverage >= 70) return { text: 'Bueno', color: 'text-indigo-600 bg-indigo-50 border-indigo-200' };
    if (overallAverage >= 65) return { text: 'En Proceso', color: 'text-amber-600 bg-amber-50 border-amber-200' };
    return { text: 'Insuficiente', color: 'text-rose-600 bg-rose-50 border-rose-200' };
  }, [overallAverage]);

  // Descarga en PDF del Boletín
  const handleDownloadPDF = () => {
    if (!currentStudent || !studentCourse) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.width;

    // Header del Centro
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text((center?.name || 'CENTRO EDUCATIVO').toUpperCase(), pageWidth / 2, 16, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`BOLETÍN DE CALIFICACIONES - ${selectedPeriod === 'FINAL' ? 'CONSOLIDADO ANUAL' : `PERÍODO ${selectedPeriod}`}`, pageWidth / 2, 22, { align: 'center' });

    doc.setFontSize(8);
    doc.text(`AÑO ESCOLAR: ${schoolYear}   |   FECHA: ${new Date().toLocaleDateString('es-DO')}`, pageWidth / 2, 27, { align: 'center' });

    doc.setDrawColor(200);
    doc.line(14, 30, pageWidth - 14, 30);

    // Datos del Estudiante
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    const studentFullName = `${currentStudent.first_surname || ''} ${currentStudent.second_surname || ''}, ${currentStudent.names || ''}`.toUpperCase().trim();
    doc.text(`ESTUDIANTE: ${studentFullName}`, 14, 36);
    doc.text(`CURSO: ${studentCourse.level} ${studentCourse.grade} "${studentCourse.section}" (${getReportTanda(studentCourse.tanda, 'full')})`, 14, 41);
    doc.setFont('helvetica', 'normal');
    doc.text(`RNE: ${currentStudent.sigerd_code || currentStudent.student_code || currentStudent.rne || '---'}`, pageWidth - 60, 36);
    doc.text(`PROMEDIO GENERAL: ${overallAverage > 0 ? overallAverage : '---'}`, pageWidth - 60, 41);

    // Tabla de Calificaciones
    const head = [
      ['Nº', 'ASIGNATURA', ...competencies.map((c) => c.short), 'NOTA FINAL', 'ESTADO']
    ];

    const body = calculatedSubjects.map((s, idx) => {
      return [
        (idx + 1).toString().padStart(2, '0'),
        s.name.toUpperCase(),
        ...competencies.map((c) => s.periodScores[c.id] > 0 ? s.periodScores[c.id].toString() : '-'),
        s.subjectFinal > 0 ? s.subjectFinal.toString() : '-',
        s.hasGrades ? (s.isApproved ? 'Aprobada' : 'En proceso') : 'Sin nota'
      ];
    });

    autoTable(doc, {
      startY: 46,
      head: head,
      body: body,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2, halign: 'center', valign: 'middle' },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { halign: 'left', cellWidth: 70 }
      },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] }
    });

    doc.save(`Boletin_${currentStudent.names}_${selectedPeriod}_${schoolYear}.pdf`);
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 size={36} className="animate-spin text-indigo-600" />
        <span className="text-xs font-bold uppercase tracking-widest">Cargando expediente académico...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* SELECTOR DE HIJOS PARA PADRES CON VARIOS ESTUDIANTES */}
      {isParent && familyStudents.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 ml-2 mr-1 flex items-center gap-1.5">
            <Users size={14} /> Seleccionar Hijo:
          </span>
          {familyStudents.map((child) => (
            <button
              key={child.id}
              type="button"
              onClick={() => setSelectedStudentId(child.id)}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                selectedStudentId === child.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              {child.names ? child.names.split(' ')[0] : 'Estudiante'} {child.first_surname || ''}
            </button>
          ))}
        </div>
      )}

      {/* ENCABEZADO DEL ESTUDIANTE */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-[1.8rem] bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
            <GraduationCap size={32} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800">
                Boletín Académico
              </span>
              <span className="text-[10px] font-bold text-slate-400">Ciclo {schoolYear}</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-1">
              {currentStudent
                ? `${currentStudent.names || ''} ${currentStudent.first_surname || ''} ${currentStudent.second_surname || ''}`.trim()
                : 'Expediente de Calificaciones'}
            </h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-2 mt-1">
              <span>{studentCourse ? `${studentCourse.level} ${studentCourse.grade} "${studentCourse.section}"` : 'Sin Curso'}</span>
              <span>•</span>
              <span>Tanda {getReportTanda(studentCourse?.tanda, 'full')}</span>
            </p>
          </div>
        </div>

        {isGradesReleased && (
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              type="button"
              onClick={handleDownloadPDF}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
            >
              <Printer size={16} />
              <span>Descargar Boletín (PDF)</span>
            </button>
          </div>
        )}
      </div>

      {/* CASO 1: CALIFICACIONES BLOQUEADAS POR FINANZAS */}
      {!isGradesReleased ? (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl p-8 sm:p-14 text-center max-w-2xl mx-auto space-y-6 animate-in zoom-in-95 duration-200 my-6">
          <div className="w-20 h-20 mx-auto rounded-[2rem] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center shadow-inner animate-pulse">
            <Lock size={36} />
          </div>

          <div className="space-y-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/80 px-4 py-1 rounded-full border border-amber-300 dark:border-amber-700">
              Consulta Digital Temporalmente Restringida
            </span>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Calificaciones no disponibles
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-lg mx-auto font-medium">
              Las calificaciones oficiales de este ciclo aún no han sido liberadas para consulta en línea para este estudiante.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 text-left space-y-2">
            <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-700 dark:text-slate-200">
              <Building2 size={16} className="text-indigo-600 dark:text-indigo-400" />
              <span>¿Cómo acceder a las calificaciones?</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Para validar la entrega de calificaciones o verificar el balance de cuenta y pagos administrativos, favor comunicarse directamente con el departamento de administración o caja del centro educativo.
            </p>
            {center?.phone && (
              <div className="pt-2 flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                <PhoneCall size={14} />
                <span>Teléfono del Centro: {center.phone}</span>
              </div>
            )}
          </div>

          {onViewChange && (
            <button
              type="button"
              onClick={() => onViewChange('dashboard')}
              className="px-6 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest transition-all cursor-pointer"
            >
              Volver al Aula Virtual
            </button>
          )}
        </div>
      ) : (
        /* CASO 2: CALIFICACIONES HABILITADAS POR FINANZAS */
        <div className="space-y-6">
          {/* SELECTOR DE PERÍODO Y MÉTRICAS GLOBALES */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* SELECTOR DE PERÍODO */}
            <div className="lg:col-span-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col justify-between space-y-4">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Período de Evaluación
                </span>
                <h3 className="text-base font-black text-slate-800 dark:text-white uppercase tracking-tight mt-0.5">
                  Selecciona el Ciclo de Notas
                </h3>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {(['P1', 'P2', 'P3', 'P4', 'FINAL'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPeriod(p)}
                    className={`py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border ${
                      selectedPeriod === p
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/30 scale-105'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {p === 'FINAL' ? 'Anual' : p}
                  </button>
                ))}
              </div>
            </div>

            {/* MÉTRICAS DE PROMEDIO GENERAL (GPA) */}
            <div className="lg:col-span-6 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-around gap-4">
              <div className="text-center">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                  Promedio {selectedPeriod === 'FINAL' ? 'Anual' : selectedPeriod}
                </div>
                <div className="text-4xl font-black text-slate-900 dark:text-white font-mono mt-1">
                  {overallAverage > 0 ? overallAverage : '---'}
                </div>
                <span className={`inline-block mt-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase border ${performanceLabel.color}`}>
                  {performanceLabel.text}
                </span>
              </div>

              <div className="h-14 w-px bg-slate-100 dark:bg-slate-800" />

              <div className="text-center">
                <div className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-widest">
                  Aprobadas
                </div>
                <div className="text-3xl font-black text-emerald-600 font-mono mt-1">
                  {approvedCount}
                </div>
                <span className="text-[10px] font-bold text-slate-400">Materias</span>
              </div>

              <div className="h-14 w-px bg-slate-100 dark:bg-slate-800" />

              <div className="text-center">
                <div className="text-[10px] font-black uppercase text-rose-500 tracking-widest">
                  En Proceso
                </div>
                <div className="text-3xl font-black text-rose-500 font-mono mt-1">
                  {pendingCount}
                </div>
                <span className="text-[10px] font-bold text-slate-400">Por nivelar</span>
              </div>
            </div>
          </div>

          {/* TABLA DE CALIFICACIONES POR MATERIA Y 4 COMPETENCIAS */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-2">
                  <Award className="text-indigo-600" size={20} />
                  Desglose de Calificaciones por Materia
                </h3>
                <p className="text-xs text-slate-400 font-medium mt-0.5">
                  Mostrando las 4 competencias MINERD y el promedio final para el período {selectedPeriod}.
                </p>
              </div>
              <span className="text-xs font-black uppercase px-3 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
                {evaluatedSubjects.length} Asignaturas
              </span>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                    <th className="py-4 px-6 w-12 text-center">Nº</th>
                    <th className="py-4 px-6 min-w-[200px]">Asignatura / Área</th>
                    {competencies.map((comp) => (
                      <th key={comp.id} className="py-4 px-4 text-center min-w-[100px]" title={comp.name}>
                        <div>{comp.short}</div>
                        <div className="text-[8px] font-normal text-slate-300 normal-case truncate max-w-[110px] mx-auto">
                          {comp.name}
                        </div>
                      </th>
                    ))}
                    <th className="py-4 px-6 text-center bg-indigo-950 text-indigo-200 min-w-[90px]">
                      Nota Final
                    </th>
                    <th className="py-4 px-6 text-center w-28">Estatus</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {calculatedSubjects.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400 font-bold">
                        No hay asignaturas registradas para este curso.
                      </td>
                    </tr>
                  ) : (
                    calculatedSubjects.map((sub, idx) => {
                      const passingGrade = isSecundario ? 70 : 65;
                      const hasNote = sub.hasGrades;

                      return (
                        <tr
                          key={sub.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3.5 px-6 text-center font-mono font-bold text-slate-400">
                            {(idx + 1).toString().padStart(2, '0')}
                          </td>

                          <td className="py-3.5 px-6">
                            <div className="font-black text-slate-900 dark:text-white uppercase">
                              {sub.name}
                            </div>
                            <span className="text-[10px] text-slate-400 font-medium">
                              Materia Regular
                            </span>
                          </td>

                          {competencies.map((comp) => {
                            const val = sub.periodScores[comp.id];
                            return (
                              <td key={comp.id} className="py-3.5 px-4 text-center">
                                {val > 0 ? (
                                  <span className={`inline-block min-w-[36px] py-1 px-2 rounded-lg font-mono font-black text-xs ${
                                    val >= passingGrade
                                      ? 'text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800'
                                      : 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800'
                                  }`}>
                                    {val}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-600 font-mono">--</span>
                                )}
                              </td>
                            );
                          })}

                          <td className="py-3.5 px-6 text-center bg-indigo-50/30 dark:bg-indigo-950/20">
                            {hasNote ? (
                              <span className={`inline-block min-w-[42px] py-1.5 px-2.5 rounded-xl font-mono font-black text-sm shadow-xs ${
                                sub.isApproved
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-rose-600 text-white'
                              }`}>
                                {sub.subjectFinal}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono font-bold">---</span>
                            )}
                          </td>

                          <td className="py-3.5 px-6 text-center">
                            {hasNote ? (
                              sub.isApproved ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                                  <CheckCircle2 size={12} /> Aprobada
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-full border border-rose-200 dark:border-rose-800">
                                  <AlertCircle size={12} /> En Proceso
                                </span>
                              )
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">Pendiente</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* LEYENDA INFERIOR */}
            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 text-[10px] text-slate-400 font-medium flex flex-wrap items-center justify-between gap-4">
              <div>
                * Las calificaciones siguen la normativa oficial del MINERD. Nota mínima de aprobación:{' '}
                <strong className="text-slate-700 dark:text-slate-200">{isSecundario ? '70 puntos (Secundaria)' : '65 puntos (Primaria)'}</strong>.
              </div>
              <div className="font-mono text-slate-400">Edugest Digital Report</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
