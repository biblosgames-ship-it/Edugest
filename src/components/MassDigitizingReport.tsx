import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Download, CheckCircle, XCircle, Info, Filter } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportProps {
  onClose: () => void;
  period: string; // 'P1', 'P2', 'P3', 'P4', or 'FINAL'
}

export const MassDigitizingReport: React.FC<ReportProps> = ({ onClose, period: initialPeriod }) => {
  const { state, center, selectedYear } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod || 'P1');
  const [filterLevel, setFilterLevel] = useState('Todos');

  const digitizingData = useMemo(() => {
    const courses = state.courses || [];
    const subjects = state.subjects || [];
    const grades = state.grades || [];
    
    // Agrupar por nivel
    const levels: Record<string, any[]> = {};
    
    courses.forEach((course: any) => {
      const level = course.level || 'Otros';
      if (!levels[level]) levels[level] = [];
      
      // Obtener materias para este curso
      // Normalmente las materias están vinculadas al curso. 
      // Si no hay una tabla de unión, asumimos que todas las materias del sistema podrían aplicar,
      // o buscamos qué materias tienen calificaciones en este curso.
      // Pero lo correcto es ver qué materias están asignadas al curso.
      // En Edugens, parece que las materias son globales pero se filtran por curso en el registro.
      
      // Vamos a obtener las materias que TIENEN alumnos y notas en este curso.
      const courseGrades = grades.filter((g: any) => g.course_id === course.id && g.period?.toLowerCase() === selectedPeriod.toLowerCase());
      const courseSubjectsIds = Array.from(new Set(courseGrades.map((g: any) => g.subject_id)));
      
      // Si el sistema tiene una asignación formal, deberíamos usarla. 
      // Pero si no, usaremos las materias que tienen al menos una nota o que están en el sistema.
      // Vamos a usar todas las materias y marcar como "No Digitado" las que no tengan notas.
      // Sin embargo, un curso no tiene todas las materias.
      
      // Mejor: Buscamos qué materias tienen notas en CUALQUIER periodo para este curso para saber cuáles le pertenecen.
      const allCourseGrades = grades.filter((g: any) => g.course_id === course.id);
      const subjectsInCourseIds = Array.from(new Set(allCourseGrades.map((g: any) => g.subject_id)));
      
      const subjectsStatus = subjectsInCourseIds.map(subId => {
        const sub = subjects.find((s: any) => s.id === subId);
        const hasGrades = courseGrades.some((g: any) => g.subject_id === subId && g.grade !== null);
        
        return {
          id: subId,
          name: sub?.name || 'Materia Desconocida',
          status: hasGrades ? 'Digitado' : 'Pendiente'
        };
      });

      levels[level].push({
        id: course.id,
        name: `${course.grade} ${course.section}`,
        subjects: subjectsStatus,
        total: subjectsStatus.length,
        completed: subjectsStatus.filter(s => s.status === 'Digitado').length
      });
    });

    return levels;
  }, [state.courses, state.subjects, state.grades, selectedPeriod]);

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(18);
    doc.text(center?.name || 'Centro Educativo', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Auditoría de Control de Digitado Masivo', pageWidth / 2, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Periodo: ${selectedPeriod} | Año Escolar: ${selectedYear} | Fecha: ${new Date().toLocaleDateString()}`, pageWidth / 2, 32, { align: 'center' });
    
    let currentY = 40;

    Object.keys(digitizingData).forEach((level) => {
      if (filterLevel !== 'Todos' && level !== filterLevel) return;

      doc.setFontSize(12);
      doc.setTextColor(79, 70, 229); // Indigo
      doc.text(`Nivel: ${level}`, 14, currentY);
      currentY += 5;
      
      const tableData: any[] = [];
      digitizingData[level].forEach((course: any) => {
        course.subjects.forEach((sub: any, idx: number) => {
          tableData.push([
            idx === 0 ? course.name : '',
            sub.name,
            sub.status
          ]);
        });
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Curso', 'Asignatura', 'Estatus']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [79, 70, 229] },
        didDrawPage: (data) => {
          currentY = data.cursor?.y || currentY;
        }
      });
      
      currentY += 15;
    });

    doc.save(`Control_Digitado_${selectedPeriod}_${selectedYear}.pdf`);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] bg-slate-100 block overflow-y-auto">
      {/* Barra superior */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-800 uppercase tracking-tight">Control de Digitado Masivo</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Auditoría General de Carga de Notas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            {['P1', 'P2', 'P3', 'P4', 'FINAL'].map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${selectedPeriod === p ? 'bg-rose-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-100'}`}
              >
                {p}
              </button>
            ))}
          </div>

          <button onClick={downloadPDF} className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-rose-200 transition-all active:scale-95">
            <Download size={16} />
            Exportar Auditoría
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8">
        <div className="flex items-center justify-between mb-8">
           <div className="flex gap-4">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center min-w-[120px]">
                <span className="text-[10px] font-black text-slate-400 uppercase">Total Cursos</span>
                <span className="text-2xl font-black text-slate-800">{Object.values(digitizingData).flat().length}</span>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center min-w-[120px]">
                <span className="text-[10px] font-black text-slate-400 uppercase">Completados</span>
                <span className="text-2xl font-black text-emerald-600">
                  {Object.values(digitizingData).flat().filter(c => c.completed === c.total && c.total > 0).length}
                </span>
              </div>
           </div>
           
           <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200">
             <Filter size={16} className="text-slate-400" />
             <select 
               value={filterLevel} 
               onChange={(e) => setFilterLevel(e.target.value)}
               className="text-xs font-bold text-slate-600 bg-transparent outline-none cursor-pointer"
             >
               <option value="Todos">Todos los Niveles</option>
               {Object.keys(digitizingData).map(lvl => (
                 <option key={lvl} value={lvl}>{lvl}</option>
               ))}
             </select>
           </div>
        </div>

        <div className="space-y-8">
          {Object.keys(digitizingData).map(level => {
            if (filterLevel !== 'Todos' && level !== filterLevel) return null;
            
            return (
              <div key={level} className="space-y-4">
                <h2 className="text-sm font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                  {level}
                  <div className="h-px bg-slate-200 flex-1"></div>
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {digitizingData[level].map((course: any) => (
                    <div key={course.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
                      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                        <span className="text-xs font-black text-slate-800 uppercase">{course.name}</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${course.completed === course.total ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                          {course.completed}/{course.total}
                        </span>
                      </div>
                      <div className="p-4 space-y-2">
                        {course.subjects.length === 0 ? (
                          <div className="text-[10px] text-slate-400 font-bold italic text-center py-2">
                            No hay materias asignadas o con notas
                          </div>
                        ) : (
                          course.subjects.map((sub: any) => (
                            <div key={sub.id} className="flex justify-between items-center group">
                              <span className="text-[11px] font-bold text-slate-600 truncate max-w-[150px]">{sub.name}</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-black uppercase ${sub.status === 'Digitado' ? 'text-emerald-500' : 'text-rose-400'}`}>
                                  {sub.status}
                                </span>
                                {sub.status === 'Digitado' ? (
                                  <CheckCircle size={14} className="text-emerald-500" />
                                ) : (
                                  <XCircle size={14} className="text-rose-400" />
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
