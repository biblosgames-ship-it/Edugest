import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import * as XLSX from 'xlsx';
import {
  ArrowLeft,
  Download,
  CheckCircle,
  XCircle,
  Info,
  Filter,
  Search,
  RefreshCw,
  FileSpreadsheet,
  AlertTriangle,
  User,
  Users,
  BookOpen,
  Clock,
  CheckCircle2,
  TrendingUp,
  Award
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportProps {
  onClose: () => void;
  period: string; // 'P1', 'P2', 'P3', 'P4', or 'FINAL'
}

type StatusFilterType = 'ALL' | 'PENDING' | 'COMPLETED' | 'EMPTY';

export const MassDigitizingReport: React.FC<ReportProps> = ({ onClose, period: initialPeriod }) => {
  const { state, center, selectedYear } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod || 'P1');
  const [filterLevel, setFilterLevel] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [liveGrades, setLiveGrades] = useState<any[]>(state.grades || []);
  const [isLoading, setIsLoading] = useState(false);

  // Consulta en vivo de calificaciones desde Supabase para garantizar exactitud en tiempo real
  const fetchLiveGrades = async () => {
    setIsLoading(true);
    try {
      const centerId = center?.id || (state as any)?.center?.id;
      const year = selectedYear || '2026-2027';

      let query = supabase
        .from('student_grades')
        .select('id, course_id, subject_id, student_id, period, competency_id, grade, school_year')
        .eq('school_year', year);

      if (centerId && centerId !== 'default_center') {
        query = query.eq('center_id', centerId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        setLiveGrades(data);
      } else if (state.grades && state.grades.length > 0) {
        setLiveGrades(state.grades);
      }
    } catch (err) {
      console.warn('[MassDigitizingReport] Error cargando notas en vivo, usando memoria local:', err);
      if (state.grades) setLiveGrades(state.grades);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveGrades();
  }, [selectedYear, center?.id]);

  // Si state.grades se actualiza en el contexto y liveGrades está vacío, sincronizarlo
  useEffect(() => {
    if ((!liveGrades || liveGrades.length === 0) && state.grades && state.grades.length > 0) {
      setLiveGrades(state.grades);
    }
  }, [state.grades]);

  // Cálculo consolidado de digitado masivo por Curso y Materia con Porcentaje Real
  const digitizingData = useMemo(() => {
    const courses = state.courses || [];
    const subjects = state.subjects || [];
    const assignments = state.assignments || [];
    const teachers = state.teachers || [];
    const students = state.students || [];

    const levels: Record<string, any[]> = {};
    const pLower = selectedPeriod.toLowerCase();

    courses.forEach((course: any) => {
      const level = course.level || 'Otros';
      if (!levels[level]) levels[level] = [];

      // Estudiantes activos de este curso
      const courseStudents = students.filter(
        (s: any) =>
          s.course_id === course.id &&
          s.status !== 'inactive' &&
          s.status !== 'withdrawn'
      );
      const totalStudents = courseStudents.length;
      const studentIdsSet = new Set(courseStudents.map((s: any) => s.id));

      const isSecundario = (course.level || '').toLowerCase().includes('sec');
      const expectedCompetenciesCount = isSecundario ? 4 : 3;

      // Materias vinculadas al curso (vía assignments oficiales o por nivel)
      let courseSubjects = assignments
        .filter((a: any) => a.course_id === course.id)
        .map((a: any) => subjects.find((s: any) => s.id === a.subject_id))
        .filter(Boolean);

      // Si no hay asignaciones formales registradas, buscar por nivel
      if (courseSubjects.length === 0) {
        const cLvl = (course.level || '').toLowerCase();
        courseSubjects = subjects.filter((s: any) =>
          (s.level || '').toLowerCase().includes(cLvl.substring(0, 4))
        );
      }

      // Si aún no hay, buscar qué materias tienen notas en el curso
      if (courseSubjects.length === 0) {
        const cGrades = liveGrades.filter((g: any) => g.course_id === course.id);
        const subIdsWithGrades = Array.from(new Set(cGrades.map((g: any) => g.subject_id)));
        courseSubjects = subIdsWithGrades
          .map((subId) => subjects.find((s: any) => s.id === subId))
          .filter(Boolean);
      }

      // Deduplicar materias por id
      const uniqueSubjects = Array.from(
        new Map(courseSubjects.map((s: any) => [s.id, s])).values()
      ).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));

      // Analizar estado y avance de cada materia en este curso
      const subjectsStatus = uniqueSubjects.map((sub: any) => {
        // Encontrar docente a cargo
        const assignment = assignments.find(
          (a: any) => a.course_id === course.id && a.subject_id === sub.id
        );
        const teacher = teachers.find(
          (t: any) => t.id === assignment?.teacher_id || t.id === assignment?.teacherId
        );
        const teacherName = teacher?.name || 'Sin docente asignado';

        // Calificaciones del período seleccionado para esta materia y curso
        const gradesInSubject = liveGrades.filter((g: any) => {
          if (g.course_id !== course.id || g.subject_id !== sub.id) return false;
          const gPeriod = (g.period || '').toLowerCase();
          if (gPeriod !== pLower) return false;
          return g.grade !== null && g.grade !== undefined && g.grade !== '';
        });

        // Contar cuántos estudiantes del curso tienen notas registradas
        const gradedStudents = new Set<string>();
        gradesInSubject.forEach((g: any) => {
          if (studentIdsSet.has(g.student_id)) {
            gradedStudents.add(g.student_id);
          }
        });
        const gradedStudentsCount = gradedStudents.size;

        // Total de calificaciones esperadas (estudiantes * competencias requeridas)
        const totalExpectedGrades = totalStudents * expectedCompetenciesCount;
        const actualGradesCount = gradesInSubject.length;

        // Porcentaje exacto de digitado
        let percent = 0;
        if (totalExpectedGrades > 0) {
          percent = Math.min(100, Math.round((actualGradesCount / totalExpectedGrades) * 100));
        } else if (totalStudents > 0 && gradedStudentsCount > 0) {
          percent = Math.min(100, Math.round((gradedStudentsCount / totalStudents) * 100));
        }

        // Si todos los estudiantes tienen calificaciones en todas las competencias esperadas
        const isCompleted = percent === 100 || (totalStudents > 0 && gradedStudentsCount === totalStudents && actualGradesCount >= totalExpectedGrades * 0.95);
        const finalPercent = isCompleted ? 100 : percent;

        // Clasificación de estado
        let status: 'completed' | 'in_progress' | 'not_started' = 'not_started';
        let statusLabel = 'Sin Iniciar';

        if (finalPercent === 100) {
          status = 'completed';
          statusLabel = 'Completado';
        } else if (finalPercent > 0) {
          status = 'in_progress';
          statusLabel = `${finalPercent}% En Progreso`;
        }

        return {
          id: sub.id,
          name: sub.name || 'Materia Desconocida',
          teacherName,
          totalStudents,
          gradedStudentsCount,
          actualGradesCount,
          totalExpectedGrades,
          percent: finalPercent,
          status,
          statusLabel
        };
      });

      // Avance global del curso completo (promedio de sus asignaturas)
      const courseTotalSubjects = subjectsStatus.length;
      const courseCompletedSubjects = subjectsStatus.filter((s) => s.status === 'completed').length;
      const coursePercent =
        courseTotalSubjects > 0
          ? Math.round(
              subjectsStatus.reduce((acc, s) => acc + s.percent, 0) / courseTotalSubjects
            )
          : 0;

      const isCourseCompleted = courseTotalSubjects > 0 && courseCompletedSubjects === courseTotalSubjects;

      levels[level].push({
        id: course.id,
        name: `${course.grade} "${course.section}"`,
        rawGrade: course.grade,
        rawSection: course.section,
        level,
        tanda: course.tanda || 'Matutina',
        totalStudents,
        subjects: subjectsStatus,
        totalSubjects: courseTotalSubjects,
        completedSubjects: courseCompletedSubjects,
        coursePercent,
        isCompleted: isCourseCompleted
      });
    });

    return levels;
  }, [state.courses, state.subjects, state.assignments, state.teachers, state.students, liveGrades, selectedPeriod]);

  // Métricas globales del centro para los contadores superiores
  const overallMetrics = useMemo(() => {
    const allCoursesList = Object.values(digitizingData).flat();
    const totalCourses = allCoursesList.length;
    const completedCourses = allCoursesList.filter((c) => c.isCompleted).length;
    const pendingCourses = totalCourses - completedCourses;

    let totalSubjectsSum = 0;
    let completedSubjectsSum = 0;
    let percentAccumulator = 0;

    allCoursesList.forEach((c) => {
      totalSubjectsSum += c.totalSubjects;
      completedSubjectsSum += c.completedSubjects;
      percentAccumulator += c.coursePercent;
    });

    const averageCenterPercent =
      totalCourses > 0 ? Math.round(percentAccumulator / totalCourses) : 0;

    return {
      totalCourses,
      completedCourses,
      pendingCourses,
      totalSubjectsSum,
      completedSubjectsSum,
      averageCenterPercent
    };
  }, [digitizingData]);

  // Cursos filtrados por Nivel, Búsqueda y Estado de Digitado
  const filteredDigitizingData = useMemo(() => {
    const searchLower = searchTerm.toLowerCase().trim();
    const filteredLevels: Record<string, any[]> = {};

    Object.keys(digitizingData).forEach((level) => {
      if (filterLevel !== 'Todos' && level !== filterLevel) return;

      const coursesInLevel = digitizingData[level].filter((c: any) => {
        // Filtro por Estado de Digitado
        if (statusFilter === 'COMPLETED' && !c.isCompleted) return false;
        if (statusFilter === 'PENDING' && c.isCompleted) return false;
        if (statusFilter === 'EMPTY' && c.coursePercent > 0) return false;

        // Filtro por Texto de Búsqueda
        if (searchLower) {
          const matchCourseName = c.name.toLowerCase().includes(searchLower);
          const matchSubjectOrTeacher = c.subjects.some(
            (s: any) =>
              s.name.toLowerCase().includes(searchLower) ||
              s.teacherName.toLowerCase().includes(searchLower)
          );
          if (!matchCourseName && !matchSubjectOrTeacher) return false;
        }

        return true;
      });

      if (coursesInLevel.length > 0) {
        filteredLevels[level] = coursesInLevel;
      }
    });

    return filteredLevels;
  }, [digitizingData, filterLevel, statusFilter, searchTerm]);

  // Exportar Auditoría Completa a PDF
  const downloadPDF = () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Encabezado Institucional
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text((center?.name || 'CENTRO EDUCATIVO').toUpperCase(), pageWidth / 2, 14, { align: 'center' });

    doc.setFontSize(12);
    doc.setTextColor(79, 70, 229); // Indigo
    doc.text(`AUDITORÍA DE CONTROL DE DIGITADO - PERÍODO ${selectedPeriod}`, pageWidth / 2, 21, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(
      `Año Escolar: ${selectedYear || '2026-2027'}  |  Avance Global del Centro: ${overallMetrics.averageCenterPercent}%  |  Fecha: ${new Date().toLocaleDateString('es-DO')}`,
      pageWidth / 2,
      27,
      { align: 'center' }
    );

    let currentY = 33;

    Object.keys(filteredDigitizingData).forEach((level) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(30, 41, 59);
      doc.text(`NIVEL: ${level.toUpperCase()}`, 14, currentY);
      currentY += 4;

      filteredDigitizingData[level].forEach((course: any) => {
        const tableData: any[] = course.subjects.map((sub: any) => [
          sub.name,
          sub.teacherName,
          `${sub.gradedStudentsCount} / ${sub.totalStudents}`,
          `${sub.percent}%`,
          sub.percent === 100 ? 'COMPLETO' : sub.percent > 0 ? 'EN PROCESO' : 'SIN INICIAR'
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [[
            { content: `${course.name} (Avance: ${course.coursePercent}%)`, colSpan: 5, styles: { fillColor: [30, 41, 59], fontStyle: 'bold' } }
          ], [
            'Asignatura',
            'Docente Responsable',
            'Alumnos Evaluados',
            '% Avance',
            'Estado'
          ]],
          body: tableData,
          theme: 'grid',
          headStyles: { fillColor: [79, 70, 229], fontSize: 8, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8 },
          columnStyles: {
            0: { cellWidth: 50 },
            1: { cellWidth: 60 },
            2: { cellWidth: 30, halign: 'center' },
            3: { cellWidth: 20, halign: 'center', fontStyle: 'bold' },
            4: { cellWidth: 26, halign: 'center', fontStyle: 'bold' }
          },
          didParseCell: (data) => {
            if (data.section === 'body' && data.column.index === 4) {
              const text = data.cell.raw as string;
              if (text === 'COMPLETO') data.cell.styles.textColor = [16, 185, 129];
              else if (text === 'EN PROCESO') data.cell.styles.textColor = [217, 119, 6];
              else data.cell.styles.textColor = [225, 29, 72];
            }
          },
          didDrawPage: (data) => {
            currentY = data.cursor?.y || currentY;
          }
        });

        currentY += 8;
      });

      currentY += 5;
    });

    doc.save(`Auditoria_Digitado_${selectedPeriod}_${selectedYear || '2026-2027'}.pdf`);
  };

  // Exportar Auditoría Completa a Excel (.xlsx)
  const downloadExcel = () => {
    const rows: any[] = [];

    Object.keys(filteredDigitizingData).forEach((level) => {
      filteredDigitizingData[level].forEach((course: any) => {
        course.subjects.forEach((sub: any) => {
          rows.push({
            NIVEL: level,
            CURSO: course.name,
            ASIGNATURA: sub.name,
            DOCENTE: sub.teacherName,
            'TOTAL ALUMNOS': sub.totalStudents,
            'ALUMNOS DIGITADOS': sub.gradedStudentsCount,
            'NOTAS REGISTRADAS': sub.actualGradesCount,
            'NOTAS ESPERADAS': sub.totalExpectedGrades,
            '% AVANCE': `${sub.percent}%`,
            ESTADO: sub.percent === 100 ? 'COMPLETADO' : sub.percent > 0 ? 'EN PROCESO' : 'SIN INICIAR',
            PERIODO: selectedPeriod,
            AÑO_ESCOLAR: selectedYear || '2026-2027'
          });
        });
      });
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, `Digitado_${selectedPeriod}`);
    XLSX.writeFile(wb, `Control_Digitado_Masivo_${selectedPeriod}_${selectedYear || '2026-2027'}.xlsx`);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] bg-slate-100 block overflow-y-auto">
      {/* BARRA SUPERIOR FIJA */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2.5 hover:bg-slate-100 rounded-2xl transition-colors text-slate-500 hover:text-slate-900 cursor-pointer"
            title="Volver"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                Auditoría en Tiempo Real
              </span>
              <span className="text-[10px] font-bold text-slate-400">Año {selectedYear || '2026-2027'}</span>
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight mt-0.5">
              Control de Digitado Masivo
            </h1>
          </div>
        </div>

        {/* SELECTOR DE PERÍODO Y BOTONES DE EXPORTACIÓN */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* SELECTOR DE PERÍODO */}
          <div className="flex items-center gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
            {(['P1', 'P2', 'P3', 'P4', 'FINAL'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase transition-all cursor-pointer ${
                  selectedPeriod === p
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                {p === 'FINAL' ? 'Anual' : p}
              </button>
            ))}
          </div>

          {/* BOTÓN REFRESCAR */}
          <button
            onClick={fetchLiveGrades}
            disabled={isLoading}
            className="p-2.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
            title="Refrescar datos en vivo de la nube"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin text-indigo-600' : ''} />
          </button>

          {/* BOTÓN EXCEL */}
          <button
            onClick={downloadExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
            title="Exportar a Excel (.xlsx)"
          >
            <FileSpreadsheet size={15} />
            <span>Excel</span>
          </button>

          {/* BOTÓN PDF */}
          <button
            onClick={downloadPDF}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-600/20 transition-all cursor-pointer active:scale-95"
            title="Descargar Auditoría Oficial en PDF"
          >
            <Download size={15} />
            <span>Exportar PDF</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-8 space-y-6">
        {/* PANEL DE MÉTRICAS GENERALES DEL CENTRO */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Cursos</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black text-slate-900 font-mono">{overallMetrics.totalCourses}</span>
              <span className="text-xs font-bold text-slate-400">{overallMetrics.totalSubjectsSum} Asignaturas</span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Cursos al 100%</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black text-emerald-600 font-mono">{overallMetrics.completedCourses}</span>
              <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Al día
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-rose-500">Cursos Incompletos</span>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-3xl font-black text-rose-500 font-mono">{overallMetrics.pendingCourses}</span>
              <span className="text-xs font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                Con faltantes
              </span>
            </div>
          </div>

          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Avance General Centro</span>
            <div className="mt-2">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-3xl font-black text-slate-900 font-mono">
                  {overallMetrics.averageCenterPercent}%
                </span>
                <span className="text-[10px] font-bold text-slate-400">
                  {overallMetrics.completedSubjectsSum} de {overallMetrics.totalSubjectsSum} materias
                </span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full transition-all duration-700 bg-gradient-to-r from-indigo-500 to-emerald-500"
                  style={{ width: `${overallMetrics.averageCenterPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* BARRA DE FILTROS Y BÚSQUEDA */}
        <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          {/* BUSCADOR */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por curso, asignatura o nombre del docente..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-black p-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* FILTROS RÁPIDOS DE ESTADO Y NIVEL */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* FILTRO DE ESTADO DE DIGITADO */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                onClick={() => setStatusFilter('ALL')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-white text-slate-900 shadow-sm font-black'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Todos
              </button>
              <button
                onClick={() => setStatusFilter('PENDING')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === 'PENDING'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-amber-700 hover:bg-amber-50'
                }`}
                title="Mostrar solo cursos y materias con digitado incompleto"
              >
                <AlertTriangle size={11} />
                <span>Solo Faltantes (&lt;100%)</span>
              </button>
              <button
                onClick={() => setStatusFilter('COMPLETED')}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  statusFilter === 'COMPLETED'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-emerald-700 hover:bg-emerald-50'
                }`}
              >
                Al 100%
              </button>
            </div>

            {/* FILTRO DE NIVEL */}
            <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200">
              <Filter size={14} className="text-slate-400" />
              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="text-xs font-black text-slate-700 bg-transparent outline-none cursor-pointer uppercase tracking-wider"
              >
                <option value="Todos">Todos los Niveles</option>
                {Object.keys(digitizingData).map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* LISTADO DE CURSOS Y MATERIAS CON PORCENTAJES REALES */}
        <div className="space-y-8">
          {Object.keys(filteredDigitizingData).length === 0 ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 text-center space-y-3">
              <Info className="mx-auto text-slate-400" size={36} />
              <h3 className="text-base font-black text-slate-800 uppercase">No se encontraron cursos con los filtros seleccionados</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Prueba cambiando el período, limpiando el término de búsqueda o cambiando el filtro de estado.
              </p>
            </div>
          ) : (
            Object.keys(filteredDigitizingData).map((level) => {
              const coursesInLevel = filteredDigitizingData[level];
              if (!coursesInLevel || coursesInLevel.length === 0) return null;

              return (
                <div key={level} className="space-y-4">
                  {/* TÍTULO DEL NIVEL */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black uppercase tracking-[0.25em] text-slate-500 bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">
                      Nivel {level} ({coursesInLevel.length} Cursos)
                    </span>
                    <div className="h-px bg-slate-200 flex-1" />
                  </div>

                  {/* CUADRÍCULA DE CURSOS */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {coursesInLevel.map((course: any) => {
                      return (
                        <div
                          key={course.id}
                          className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-all flex flex-col justify-between"
                        >
                          {/* ENCABEZADO DEL CURSO */}
                          <div className="p-5 bg-gradient-to-r from-slate-50 to-indigo-50/20 border-b border-slate-200">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                                  {course.name}
                                </h3>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5 flex items-center gap-1.5">
                                  <Users size={12} className="text-slate-400" />
                                  <span>{course.totalStudents} Estudiantes matriculados</span>
                                </p>
                              </div>

                              <span
                                className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider shrink-0 border ${
                                  course.isCompleted
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : course.coursePercent > 0
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}
                              >
                                {course.coursePercent}% Digitado
                              </span>
                            </div>

                            {/* BARRA DE PROGRESO DEL CURSO */}
                            <div className="mt-3.5 space-y-1">
                              <div className="flex justify-between items-center text-[10px] font-bold text-slate-500">
                                <span>Progreso General del Curso:</span>
                                <span className="font-mono">{course.completedSubjects} de {course.totalSubjects} materias al 100%</span>
                              </div>
                              <div className="w-full h-2 bg-slate-200/70 rounded-full overflow-hidden p-0.5">
                                <div
                                  className={`h-full rounded-full transition-all duration-700 ${
                                    course.coursePercent === 100
                                      ? 'bg-emerald-500'
                                      : course.coursePercent >= 50
                                      ? 'bg-amber-500'
                                      : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${course.coursePercent}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* DESGLOSE DETALLADO POR ASIGNATURA */}
                          <div className="p-5 space-y-3.5 flex-1">
                            {course.subjects.length === 0 ? (
                              <div className="text-xs text-slate-400 font-bold italic text-center py-6">
                                No hay materias vinculadas a este curso.
                              </div>
                            ) : (
                              course.subjects.map((sub: any) => {
                                const is100 = sub.percent === 100;
                                const isZero = sub.percent === 0;

                                return (
                                  <div
                                    key={sub.id}
                                    className="p-3 rounded-2xl bg-slate-50 hover:bg-slate-100/70 border border-slate-200/80 transition-colors space-y-2"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0 flex-1">
                                        <div className="text-xs font-black text-slate-800 uppercase truncate">
                                          {sub.name}
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1.5 mt-0.5 truncate">
                                          <User size={11} className="text-slate-400 shrink-0" />
                                          <span className="truncate">{sub.teacherName}</span>
                                        </div>
                                      </div>

                                      {/* PORCENTAJE NUMÉRICO DESTACADO */}
                                      <div className="text-right shrink-0">
                                        <span
                                          className={`text-xs font-black font-mono px-2 py-0.5 rounded-lg inline-block ${
                                            is100
                                              ? 'bg-emerald-100 text-emerald-800'
                                              : !isZero
                                              ? 'bg-amber-100 text-amber-800'
                                              : 'bg-rose-100 text-rose-800'
                                          }`}
                                        >
                                          {sub.percent}%
                                        </span>
                                      </div>
                                    </div>

                                    {/* BARRA DE PROGRESO DE LA MATERIA */}
                                    <div className="space-y-1">
                                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all duration-500 ${
                                            is100
                                              ? 'bg-emerald-500'
                                              : sub.percent >= 50
                                              ? 'bg-amber-500'
                                              : 'bg-rose-500'
                                          }`}
                                          style={{ width: `${sub.percent}%` }}
                                        />
                                      </div>

                                      {/* CONTEO DE ESTUDIANTES EVALUADOS */}
                                      <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                                        <span>
                                          {sub.gradedStudentsCount} de {sub.totalStudents} alumnos evaluados
                                        </span>
                                        <span className={is100 ? 'text-emerald-600' : isZero ? 'text-rose-500' : 'text-amber-600'}>
                                          {is100 ? '✓ Completo' : isZero ? '✕ Pendiente' : 'En proceso'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
