import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Download, Trophy, Medal, Star, User, GraduationCap } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { toPng } from 'html-to-image';
import autoTable from 'jspdf-autotable';

interface ReportProps {
  onClose: () => void;
  period: string; // 'P1', 'P2', 'P3', 'P4', or 'FINAL'
}

export const HonorRollReport: React.FC<ReportProps> = ({ onClose, period: initialPeriod }) => {
  const { state, center, selectedYear } = useApp();
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod || 'P1');

  const honorData = useMemo(() => {
    const students = state.students || [];
    const courses = state.courses || [];
    const subjects = state.subjects || [];
    const grades = state.grades || [];
    
    // Mapear cursos para acceso rápido
    const courseMap: Record<string, any> = {};
    courses.forEach((c: any) => { courseMap[c.id] = c; });

    // Calcular promedios de todos los estudiantes para el periodo seleccionado
    const studentAverages = students.map((s: any) => {
      const sGrades = grades.filter(g => 
        g.student_id === s.id && 
        g.period?.toLowerCase() === selectedPeriod.toLowerCase() && 
        g.grade !== null
      );
      
      const subjectGrades: Record<string, number> = {};
      sGrades.forEach(g => {
        // En Edugens, si hay varias competencias para el mismo periodo y materia, promediamos
        if (!subjectGrades[g.subject_id]) subjectGrades[g.subject_id] = 0;
        // Tomamos el mejor entre nota y recuperación si aplica (aquí simplificamos a la nota del periodo)
        subjectGrades[g.subject_id] = g.grade || 0;
      });

      const values = Object.values(subjectGrades);
      const avg = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;
      
      const course = courseMap[s.course_id];
      return {
        id: s.id,
        name: `${s.last_name || ''} ${s.first_name || ''}`.trim(),
        avg,
        courseName: course ? `${course.grade} ${course.section}` : 'N/A',
        level: course?.level || 'Otros'
      };
    }).filter(s => s.avg >= 90); // Solo alumnos de honor (>= 90)

    studentAverages.sort((a, b) => b.avg - a.avg);

    // Agrupar por nivel
    const levels: Record<string, any[]> = {};
    studentAverages.forEach(s => {
      if (!levels[s.level]) levels[s.level] = [];
      levels[s.level].push(s);
    });

    // Agrupar por curso
    const coursesGroup: Record<string, any[]> = {};
    studentAverages.forEach(s => {
      const key = `${s.level} - ${s.courseName}`;
      if (!coursesGroup[key]) coursesGroup[key] = [];
      coursesGroup[key].push(s);
    });

    return { 
      topGlobal: studentAverages.slice(0, 5),
      levels,
      coursesGroup,
      totalHonor: studentAverages.length
    };
  }, [state.students, state.courses, state.subjects, state.grades, selectedPeriod]);

  const downloadPDF = async () => {
    const input = document.getElementById('honor-roll-container');
    if (!input) return;

    try {
      const targetWidth = 1000;
      const originalWidth = input.style.width;
      const originalMaxWidth = input.style.maxWidth;
      const originalMargin = input.style.margin;

      input.style.width = `${targetWidth}px`;
      input.style.maxWidth = `${targetWidth}px`;
      input.style.margin = '0';

      const imgData = await toPng(input, { 
        quality: 1.0, 
        backgroundColor: '#f8fafc',
        pixelRatio: 2,
        cacheBust: true,
      });
      
      input.style.width = originalWidth;
      input.style.maxWidth = originalMaxWidth;
      input.style.margin = originalMargin;

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (input.offsetHeight * pdfWidth) / targetWidth;
      
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pdf.internal.pageSize.getHeight();

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pdf.internal.pageSize.getHeight();
      }

      pdf.save(`Cuadro_Honor_${selectedPeriod}_${selectedYear}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] bg-slate-50 block overflow-y-auto">
      {/* Header Premium */}
      <div className="bg-white px-6 py-6 border-b border-amber-100 flex items-center justify-between sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-3 hover:bg-amber-50 rounded-full transition-colors text-amber-600">
            <ArrowLeft size={24} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="text-amber-500" size={24} />
              <h1 className="text-2xl font-black text-slate-800 uppercase tracking-tighter">Cuadro de Honor Institucional</h1>
            </div>
            <p className="text-xs font-bold text-amber-600 uppercase tracking-[0.2em] mt-1">
              Máximo Mérito Académico • {selectedYear}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-amber-50 p-1.5 rounded-2xl border border-amber-100">
            {['P1', 'P2', 'P3', 'P4', 'FINAL'].map((p) => (
              <button
                key={p}
                onClick={() => setSelectedPeriod(p)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${selectedPeriod === p ? 'bg-amber-500 text-white shadow-lg' : 'bg-white text-amber-600 hover:bg-amber-100'}`}
              >
                {p}
              </button>
            ))}
          </div>

          <button onClick={downloadPDF} className="flex items-center gap-2 bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl transition-all active:scale-95">
            <Download size={18} />
            Publicar Cuadro
          </button>
        </div>
      </div>

      <div id="honor-roll-container" className="max-w-6xl mx-auto p-10 space-y-12 pb-20 bg-slate-50">
        
        {/* ENCABEZADO OFICIAL EN LA UI */}
        <div className="flex flex-col items-center justify-center text-center mb-12 pb-8 border-b-2 border-amber-200">
          {center?.logo_url && (
            <img src={center.logo_url} alt="Logo del Centro" className="w-32 h-32 object-contain mb-4" />
          )}
          <h1 className="text-4xl font-black text-slate-900 uppercase tracking-tighter drop-shadow-sm">{center?.name || 'Centro Educativo'}</h1>
          <div className="mt-4 flex gap-3">
            <div className="px-6 py-2 bg-amber-500 text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-md">
              Cuadro de Honor Oficial
            </div>
            <div className="px-6 py-2 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-md">
              Periodo: {selectedPeriod}
            </div>
          </div>
        </div>
        
        {/* PODIO GLOBAL */}
        <div className="relative pt-8 pb-16 px-10 bg-gradient-to-b from-amber-500 to-amber-600 rounded-[2.5rem] shadow-lg overflow-hidden">
          <div className="absolute top-0 right-0 p-10 opacity-10">
            <Trophy size={160} className="text-white" />
          </div>
          
          <div className="text-center mb-12 relative z-10">
             <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Excelencia Académica Global</h2>
             <p className="text-amber-100 font-bold uppercase tracking-widest text-[10px]">Los promedios más altos de toda la institución</p>
          </div>

          <div className="flex justify-center items-end gap-4 md:gap-6 relative z-10">
            {/* 2do Lugar */}
            {honorData.topGlobal[1] && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 md:w-24 md:h-24 bg-slate-200 rounded-full border-4 border-slate-300 flex items-center justify-center shadow-lg relative">
                   <Medal className="text-slate-400" size={40} />
                   <div className="absolute -bottom-2 bg-slate-400 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase">2do</div>
                </div>
                <div className="text-center">
                  <p className="text-white font-black text-lg truncate max-w-[150px]">{honorData.topGlobal[1].name}</p>
                  <p className="text-amber-100 text-[10px] font-bold uppercase">{honorData.topGlobal[1].courseName}</p>
                  <div className="mt-2 text-2xl font-black text-white">{honorData.topGlobal[1].avg}</div>
                </div>
              </div>
            )}

            {/* 1er Lugar */}
            {honorData.topGlobal[0] && (
              <div className="flex flex-col items-center gap-4 mb-8">
                <div className="w-24 h-24 md:w-32 md:h-32 bg-amber-100 rounded-full border-8 border-amber-300 flex items-center justify-center ring-[12px] ring-white/20 relative">
                   <Trophy className="text-amber-500" size={50} />
                   <div className="absolute -bottom-3 bg-amber-500 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase shadow-xl ring-4 ring-amber-300">Ganador</div>
                </div>
                <div className="text-center">
                  <p className="text-white font-black text-xl drop-shadow-md">{honorData.topGlobal[0].name}</p>
                  <p className="text-amber-100 text-[10px] font-bold uppercase tracking-widest">{honorData.topGlobal[0].courseName}</p>
                  <div className="mt-3 bg-white text-amber-600 px-5 py-1.5 rounded-xl text-3xl font-black shadow-2xl ring-4 ring-amber-400/50">
                    {honorData.topGlobal[0].avg}
                  </div>
                </div>
              </div>
            )}

            {/* 3er Lugar */}
            {honorData.topGlobal[2] && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 md:w-24 md:h-24 bg-orange-100 rounded-full border-4 border-orange-300 flex items-center justify-center shadow-lg relative">
                   <Medal className="text-orange-400" size={40} />
                   <div className="absolute -bottom-2 bg-orange-400 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase">3ro</div>
                </div>
                <div className="text-center">
                  <p className="text-white font-black text-lg truncate max-w-[150px]">{honorData.topGlobal[2].name}</p>
                  <p className="text-amber-100 text-[10px] font-bold uppercase">{honorData.topGlobal[2].courseName}</p>
                  <div className="mt-2 text-2xl font-black text-white">{honorData.topGlobal[2].avg}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* DISTRIBUCIÓN POR NIVELES */}
        <div className="space-y-12">
          {Object.keys(honorData.levels).map(level => (
            <div key={level} className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-amber-200 flex items-center justify-center">
                   <GraduationCap className="text-amber-500" size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Mérito por Nivel: {level}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Listado de excelencia académica</p>
                </div>
                <div className="flex-1 h-px bg-slate-200 ml-4"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {honorData.levels[level].map((student, i) => (
                  <div key={i} className="bg-white p-4 rounded-[1.5rem] border border-slate-200 shadow-sm hover:translate-y-[-2px] transition-all duration-300 group">
                    <div className="flex justify-between items-start mb-4">
                       <div className="w-10 h-10 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-amber-50 group-hover:text-amber-500 transition-colors">
                         <User size={20} />
                       </div>
                       <div className="flex flex-col items-end">
                         <span className="text-2xl font-black text-slate-800 group-hover:text-amber-500 transition-colors">{student.avg}</span>
                         <span className="text-[8px] font-black uppercase text-slate-400">Promedio</span>
                       </div>
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800 uppercase tracking-tight leading-tight mb-1">{student.name}</p>
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">{student.courseName}</p>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-1.5">
                       {[1,2,3,4,5].map(s => (
                         <Star key={s} size={10} fill={student.avg >= 95 ? "#f59e0b" : "#d1d5db"} className={student.avg >= 95 ? "text-amber-500" : "text-slate-300"} />
                       ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* RESUMEN POR CURSOS */}
        <div className="bg-slate-900 rounded-[3rem] p-10 text-white overflow-hidden relative">
          <div className="absolute -bottom-10 -left-10 opacity-10">
            <Medal size={200} />
          </div>
          
          <h3 className="text-2xl font-black uppercase tracking-tight mb-8 relative z-10">Consolidado por Cursos</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 relative z-10">
            {Object.keys(honorData.coursesGroup).map(courseKey => (
              <div key={courseKey} className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/10">
                  <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500">{courseKey}</h4>
                </div>
                <div className="space-y-3">
                  {honorData.coursesGroup[courseKey].map((s, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/5 p-3 rounded-2xl hover:bg-white/10 transition-colors">
                      <span className="text-xs font-bold text-slate-300 truncate max-w-[180px]">{s.name}</span>
                      <span className="text-sm font-black text-white">{s.avg}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
