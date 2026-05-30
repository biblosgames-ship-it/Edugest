import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Download, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportProps {
  onClose: () => void;
}

export const PerformanceComparisonReport: React.FC<ReportProps> = ({ onClose }) => {
  const { state, center, selectedYear } = useApp();
  
  const comparisonData = useMemo(() => {
    const students = state.students || [];
    const courses = state.courses || [];
    const subjects = state.subjects || [];
    const grades = state.grades || [];
    const periods = ['P1', 'P2', 'P3', 'P4'];
    
    // 1. Evolución Global por Periodo
    const globalEvolution = periods.map(p => {
      const periodGrades = grades.filter(g => g.period?.toLowerCase() === p.toLowerCase() && g.grade !== null);
      const avg = periodGrades.length > 0 
        ? Math.round(periodGrades.reduce((sum, g) => sum + (g.grade || 0), 0) / periodGrades.length)
        : 0;
      return { period: p, promedio: avg };
    });

    // 2. Comparativa por Nivel
    const levels = Array.from(new Set(courses.map(c => c.level || 'Otros')));
    const levelComparison = levels.map(level => {
      const levelCourses = courses.filter(c => c.level === level);
      const levelCourseIds = levelCourses.map(c => c.id);
      
      const res: any = { level };
      periods.forEach(p => {
        const pGrades = grades.filter(g => 
          levelCourseIds.includes(g.course_id) && 
          g.period?.toLowerCase() === p.toLowerCase() && 
          g.grade !== null
        );
        res[p] = pGrades.length > 0 
          ? Math.round(pGrades.reduce((sum, g) => sum + (g.grade || 0), 0) / pGrades.length)
          : 0;
      });
      return res;
    });

    // 3. Comparativa por Materia (Top 10)
    const subjectComparison = subjects.slice(0, 10).map(sub => {
      const res: any = { subject: sub.name };
      periods.forEach(p => {
        const pGrades = grades.filter(g => 
          g.subject_id === sub.id && 
          g.period?.toLowerCase() === p.toLowerCase() && 
          g.grade !== null
        );
        res[p] = pGrades.length > 0 
          ? Math.round(pGrades.reduce((sum, g) => sum + (g.grade || 0), 0) / pGrades.length)
          : 0;
      });
      return res;
    });

    // 4. Detalle por Curso (Tabla)
    const courseDetail = courses.map(course => {
      const res: any = { 
        name: `${course.grade} ${course.section}`, 
        level: course.level,
        averages: {} 
      };
      periods.forEach(p => {
        const pGrades = grades.filter(g => 
          g.course_id === course.id && 
          g.period?.toLowerCase() === p.toLowerCase() && 
          g.grade !== null
        );
        res.averages[p] = pGrades.length > 0 
          ? Math.round(pGrades.reduce((sum, g) => sum + (g.grade || 0), 0) / pGrades.length)
          : 0;
      });
      
      // Tendencia (P2 vs P1, P3 vs P2, etc.)
      const lastP = periods.filter(p => res.averages[p] > 0).pop();
      const prevP = periods[periods.indexOf(lastP || '') - 1];
      if (lastP && prevP && res.averages[lastP] > 0 && res.averages[prevP] > 0) {
        res.trend = res.averages[lastP] - res.averages[prevP];
      } else {
        res.trend = 0;
      }

      return res;
    });

    return { globalEvolution, levelComparison, subjectComparison, courseDetail };
  }, [state.students, state.courses, state.subjects, state.grades]);

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(18);
    doc.text(center?.name || 'Centro Educativo', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Reporte de Comparativa de Rendimiento', pageWidth / 2, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Año Escolar: ${selectedYear} | Fecha: ${new Date().toLocaleDateString()}`, pageWidth / 2, 32, { align: 'center' });
    
    autoTable(doc, {
      startY: 40,
      head: [['Curso', 'Nivel', 'P1', 'P2', 'P3', 'P4', 'Tendencia']],
      body: comparisonData.courseDetail.map(c => [
        c.name,
        c.level,
        c.averages.P1 || '-',
        c.averages.P2 || '-',
        c.averages.P3 || '-',
        c.averages.P4 || '-',
        c.trend > 0 ? `+${c.trend}` : c.trend
      ]),
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129] } // Emerald
    });

    doc.save(`Comparativa_Rendimiento_${selectedYear}.pdf`);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] bg-slate-100 block overflow-y-auto">
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-800 uppercase tracking-tight">Comparativa de Rendimiento</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Análisis Evolutivo por Periodos
            </p>
          </div>
        </div>

        <button onClick={downloadPDF} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-200 transition-all active:scale-95">
          <Download size={16} />
          Descargar Reporte
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-8 space-y-8">
        {/* FILA 1: EVOLUCIÓN GLOBAL Y POR NIVEL */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <Activity size={14} className="text-indigo-500" />
              Evolución Global (Promedio del Centro)
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={comparisonData.globalEvolution}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="period" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                  <Line 
                    type="monotone" 
                    dataKey="promedio" 
                    stroke="#4f46e5" 
                    strokeWidth={4} 
                    dot={{ r: 6, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} 
                    activeDot={{ r: 8, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald-500" />
              Comparativa por Niveles
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonData.levelComparison}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="level" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px' }} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 'bold', paddingTop: '10px' }} />
                  <Bar dataKey="P1" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="P2" fill="#64748b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="P3" fill="#334155" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="P4" fill="#1e293b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* FILA 2: COMPARATIVA POR MATERIAS */}
        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Promedios por Materia (Periodos 1-4)</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData.subjectComparison} margin={{ bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="subject" angle={-45} textAnchor="end" interval={0} tick={{ fontSize: 9 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Legend verticalAlign="top" align="right" wrapperStyle={{ paddingBottom: '20px' }} />
                <Bar dataKey="P1" fill="#c7d2fe" radius={[2, 2, 0, 0]} />
                <Bar dataKey="P2" fill="#818cf8" radius={[2, 2, 0, 0]} />
                <Bar dataKey="P3" fill="#4f46e5" radius={[2, 2, 0, 0]} />
                <Bar dataKey="P4" fill="#3730a3" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* FILA 3: DETALLE POR CURSO */}
        <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-xs font-black text-slate-600 uppercase tracking-widest">Desglose Detallado por Curso</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Curso</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nivel</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">P1</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">P2</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">P3</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">P4</th>
                  <th className="py-4 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tendencia</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {comparisonData.courseDetail.map((course: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6 text-sm font-bold text-slate-800">{course.name}</td>
                    <td className="py-4 px-6">
                      <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                        {course.level}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center font-bold text-slate-600">{course.averages.P1 || '-'}</td>
                    <td className="py-4 px-6 text-center font-bold text-slate-600">{course.averages.P2 || '-'}</td>
                    <td className="py-4 px-6 text-center font-bold text-slate-600">{course.averages.P3 || '-'}</td>
                    <td className="py-4 px-6 text-center font-bold text-slate-600">{course.averages.P4 || '-'}</td>
                    <td className="py-4 px-6">
                      {course.trend !== 0 ? (
                        <div className={`flex items-center gap-1 text-[11px] font-black ${course.trend > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {course.trend > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                          {course.trend > 0 ? `+${course.trend}` : course.trend}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-[11px] font-black text-slate-400">
                          <Minus size={14} /> Sin cambio
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
