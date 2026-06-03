import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import {
  ArrowLeft,
  Download,
  User,
  BookOpen,
  TrendingUp,
  TrendingDown,
  Award,
  AlertCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import autoTable from 'jspdf-autotable';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

interface ReportProps {
  onClose: () => void;
  period: string;
}

export const TeacherPerformanceReport: React.FC<ReportProps> = ({
  onClose,
  period: initialPeriod
}) => {
  const { state, center, selectedYear } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod || 'P1');

  const performanceData = useMemo(() => {
    const teachers = state.teachers || [];
    const assignments = state.assignments || [];
    const courses = state.courses || [];
    const subjects = state.subjects || [];
    const grades = state.grades || [];

    const courseMap: Record<string, any> = {};
    courses.forEach((c) => (courseMap[c.id] = c));

    const subjectMap: Record<string, any> = {};
    subjects.forEach((s) => (subjectMap[s.id] = s));

    // Mapear promedios por docente
    const teacherStats = teachers
      .map((teacher) => {
        const teacherAssignments = assignments.filter((a) => a.teacher_id === teacher.id);

        const subjectAverages = teacherAssignments
          .map((asg) => {
            const asgGrades = grades.filter(
              (g) =>
                g.course_id === asg.course_id &&
                g.subject_id === asg.subject_id &&
                g.period?.toLowerCase() === selectedPeriod.toLowerCase() &&
                g.grade !== null
            );

            const avg =
              asgGrades.length > 0
                ? Math.round(
                    asgGrades.reduce((sum, g) => sum + (g.grade || 0), 0) / asgGrades.length
                  )
                : 0;

            const course = courseMap[asg.course_id];
            return {
              subjectName: subjectMap[asg.subject_id]?.name || 'Materia',
              courseName: course ? `${course.grade} ${course.section}` : 'N/A',
              level: course?.level || 'Otros',
              avg
            };
          })
          .filter((s) => s.avg > 0);

        const totalAvg =
          subjectAverages.length > 0
            ? Math.round(
                subjectAverages.reduce((sum, s) => sum + s.avg, 0) / subjectAverages.length
              )
            : 0;

        return {
          id: teacher.id,
          name: teacher.full_name || teacher.name || 'Docente',
          subjectAverages,
          totalAvg
        };
      })
      .filter((t) => t.subjectAverages.length > 0);

    // Agrupar por Niveles
    const levels: Record<string, any[]> = {};
    teacherStats.forEach((t) => {
      // Un docente puede estar en varios niveles, lo ponemos en el nivel predominante o en todos
      const teacherLevels = Array.from(new Set(t.subjectAverages.map((s) => s.level)));
      teacherLevels.forEach((lvl) => {
        if (!levels[lvl]) levels[lvl] = [];
        levels[lvl].push({
          ...t,
          subjectAverages: t.subjectAverages.filter((s) => s.level === lvl)
        });
      });
    });

    // Ordenar por promedio para el ranking
    const ranking = [...teacherStats].sort((a, b) => b.totalAvg - a.totalAvg);

    return { levels, ranking, teacherStats };
  }, [
    state.teachers,
    state.assignments,
    state.courses,
    state.subjects,
    state.grades,
    selectedPeriod
  ]);

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Encabezado
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text(center?.name || 'Centro Educativo', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(14);
    doc.setTextColor(79, 70, 229);
    doc.text('REPORTE DE DESEMPEÑO ACADÉMICO DOCENTE', pageWidth / 2, 30, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Periodo: ${selectedPeriod} | Año Escolar: ${selectedYear}`, pageWidth / 2, 37, {
      align: 'center'
    });

    let currentY = 50;

    // SECCIÓN 1: RANKING DE EXCELENCIA
    doc.setFontSize(12);
    doc.setTextColor(16, 185, 129); // Emerald
    doc.text('TOP 3: MAYORES PROMEDIOS', 14, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [['Pos.', 'Docente', 'Índice Académico']],
      body: performanceData.ranking.slice(0, 3).map((t, i) => [i + 1, t.name, t.totalAvg]),
      theme: 'striped',
      headStyles: { fillColor: [16, 185, 129] },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // SECCIÓN 2: RANKING DE SEGUIMIENTO
    doc.setFontSize(12);
    doc.setTextColor(225, 29, 72); // Rose
    doc.text('TOP 3: MENORES PROMEDIOS', 14, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [['Pos.', 'Docente', 'Índice Académico']],
      body: [...performanceData.ranking]
        .reverse()
        .slice(0, 3)
        .map((t, i) => [i + 1, t.name, t.totalAvg]),
      theme: 'striped',
      headStyles: { fillColor: [225, 29, 72] },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 20;

    // SECCIÓN 3: DETALLE POR NIVELES Y MATERIAS
    Object.keys(performanceData.levels).forEach((level) => {
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59);
      doc.text(`NIVEL: ${level.toUpperCase()}`, 14, currentY);
      currentY += 8;

      performanceData.levels[level].forEach((teacher) => {
        const teacherRows = teacher.subjectAverages.map((s: any) => [
          s.subjectName,
          s.courseName,
          s.avg
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [
            [
              {
                content: `Docente: ${teacher.name} (Promedio: ${teacher.totalAvg})`,
                colSpan: 3,
                styles: { fillColor: [79, 70, 229] }
              }
            ],
            ['Materia', 'Curso', 'Índice']
          ],
          body: teacherRows,
          theme: 'grid',
          headStyles: { fillColor: [248, 250, 252], textColor: [71, 85, 105] },
          columnStyles: {
            2: { cellWidth: 30, halign: 'center' }
          },
          margin: { left: 14, right: 14 }
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
        if (currentY > 260) {
          doc.addPage();
          currentY = 20;
        }
      });

      currentY += 5;
    });

    doc.save(`Desempeño_Docente_${selectedPeriod}_${selectedYear}.pdf`);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] bg-slate-50 block overflow-y-auto pb-20">
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-800 uppercase tracking-tight">
              Desempeño por Docente
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Análisis de Índices Académicos por Cátedra
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
            {['P1', 'P2', 'P3', 'P4', 'FINAL'].map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${selectedPeriod === p ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={downloadPDF}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95"
          >
            <Download size={16} />
            Exportar Desempeño
          </button>
        </div>
      </div>

      <div
        id="teacher-performance-container"
        className="max-w-7xl mx-auto p-8 space-y-10 bg-slate-50"
      >
        {/* ENCABEZADO OFICIAL */}
        <div className="flex flex-col items-center justify-center text-center mb-10 pb-8 border-b-2 border-indigo-100">
          {center?.logo_url && (
            <img
              src={center.logo_url}
              alt="Logo del Centro"
              className="w-24 h-24 object-contain mb-4"
            />
          )}
          <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">
            {center?.name || 'Centro Educativo'}
          </h1>
          <div className="mt-4 flex gap-3">
            <div className="px-6 py-2 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-md">
              Desempeño Académico Docente
            </div>
            <div className="px-6 py-2 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-md">
              Periodo: {selectedPeriod}
            </div>
          </div>
        </div>

        {/* RANKING TOP & BOTTOM */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Top Performers */}
          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-[2rem] shadow-sm">
            <h3 className="text-xs font-black text-emerald-700 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Award size={16} /> Índices Más Altos (Excelencia)
            </h3>
            <div className="space-y-3">
              {performanceData.ranking.slice(0, 3).map((t, i) => (
                <div
                  key={i}
                  className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center font-black text-xs">
                      {i + 1}
                    </div>
                    <span className="text-sm font-bold text-slate-700">{t.name}</span>
                  </div>
                  <span className="text-lg font-black text-emerald-600">{t.totalAvg}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Needs Support */}
          <div className="bg-rose-50 border border-rose-100 p-6 rounded-[2rem] shadow-sm">
            <h3 className="text-xs font-black text-rose-700 uppercase tracking-widest mb-4 flex items-center gap-2">
              <AlertCircle size={16} /> Índices Más Bajos (Seguimiento)
            </h3>
            <div className="space-y-3">
              {[...performanceData.ranking]
                .reverse()
                .slice(0, 3)
                .map((t, i) => (
                  <div
                    key={i}
                    className="bg-white p-4 rounded-2xl flex justify-between items-center shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center font-black text-xs">
                        {i + 1}
                      </div>
                      <span className="text-sm font-bold text-slate-700">{t.name}</span>
                    </div>
                    <span className="text-lg font-black text-rose-600">{t.totalAvg}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {/* DETALLE POR NIVELES */}
        <div className="space-y-12">
          {Object.keys(performanceData.levels).map((level) => (
            <div key={level} className="space-y-6">
              <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                {level}
                <div className="h-px bg-slate-200 flex-1"></div>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {performanceData.levels[level].map((teacher, i) => (
                  <div
                    key={i}
                    className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
                  >
                    <div className="p-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-indigo-500 shadow-sm border border-slate-100">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase tracking-tight leading-none">
                            {teacher.name}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                            {teacher.subjectAverages.length} Materias
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-indigo-600 leading-none">
                          {teacher.totalAvg}
                        </p>
                        <p className="text-[8px] font-black text-slate-400 uppercase">Promedio</p>
                      </div>
                    </div>

                    <div className="p-5 flex-1 space-y-4">
                      {teacher.subjectAverages.map((sub: any, si: number) => (
                        <div key={si} className="space-y-1.5">
                          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tight">
                            <span className="text-slate-500 truncate max-w-[140px]">
                              {sub.subjectName}{' '}
                              <span className="text-slate-300">({sub.courseName})</span>
                            </span>
                            <span
                              className={
                                sub.avg >= 90
                                  ? 'text-emerald-500'
                                  : sub.avg >= 70
                                    ? 'text-amber-500'
                                    : 'text-rose-500'
                              }
                            >
                              {sub.avg} pts
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${sub.avg >= 90 ? 'bg-emerald-500' : sub.avg >= 70 ? 'bg-amber-500' : 'bg-rose-500'}`}
                              style={{ width: `${sub.avg}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
