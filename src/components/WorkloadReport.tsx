import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Download, Clock, BookOpen, User, Layers } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface ReportProps {
  onClose: () => void;
}

export const WorkloadReport: React.FC<ReportProps> = ({ onClose }) => {
  const { state, center, selectedYear } = useApp();

  const workloadData = useMemo(() => {
    const teachers = state.teachers || [];
    const assignments = state.assignments || [];
    const courses = state.courses || [];
    const subjects = state.subjects || [];

    const courseMap: Record<string, any> = {};
    courses.forEach((c) => (courseMap[c.id] = c));

    const subjectMap: Record<string, any> = {};
    subjects.forEach((s) => (subjectMap[s.id] = s));

    const report = teachers
      .map((teacher) => {
        const teacherAssignments = assignments.filter((a) => a.teacher_id === teacher.id);

        const byLevel: Record<string, number> = {
          Inicial: 0,
          Primario: 0,
          Secundario: 0,
          Otros: 0
        };

        const teacherSubjects: string[] = [];

        teacherAssignments.forEach((asg) => {
          const course = courseMap[asg.course_id];
          const level = course?.level || 'Otros';
          const hours = Number(asg.hours_per_week || asg.hoursPerWeek || 0);

          if (byLevel[level] !== undefined) byLevel[level] += hours;
          else byLevel['Otros'] += hours;

          const sName = subjectMap[asg.subject_id]?.name || 'Materia';
          const cName = course ? `${course.grade} ${course.section}` : 'N/A';
          teacherSubjects.push(`${sName} (${cName}) - ${hours}h`);
        });

        const totalHours = Object.values(byLevel).reduce((a, b) => a + b, 0);

        // Mapear a nombres de visualización solicitados y aplicar ratios
        const formattedLevels = {
          Inicial: `${byLevel['Inicial']}/25`,
          Primaria: `${byLevel['Primario']}/25`,
          Secundaria: `${byLevel['Secundario']}/30`,
          Otros: byLevel['Otros'] > 0 ? `${byLevel['Otros']}h` : '-'
        };

        return {
          id: teacher.id,
          name: teacher.full_name || teacher.name || 'Docente',
          formattedLevels,
          totalHours,
          subjects: Array.from(new Set(teacherSubjects))
        };
      })
      .filter((t) => t.totalHours > 0);

    return report;
  }, [state.teachers, state.assignments, state.courses, state.subjects]);

  const downloadPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4'); // Horizontal para mejor visualización de columnas
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(20);
    doc.text(center?.name || 'Centro Educativo', pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.setTextColor(234, 88, 12); // Orange 600
    doc.text('REPORTE DE CARGA HORARIA Y FUNCIONES DOCENTES', pageWidth / 2, 25, {
      align: 'center'
    });

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Año Escolar: ${selectedYear}`, pageWidth / 2, 32, { align: 'center' });

    autoTable(doc, {
      startY: 40,
      head: [
        [
          'Docente',
          'Inicial (25h)',
          'Primaria (25h)',
          'Secundaria (30h)',
          'Otros',
          'Total h/s',
          'Materias / Cursos'
        ]
      ],
      body: workloadData.map((t) => [
        t.name,
        t.formattedLevels['Inicial'],
        t.formattedLevels['Primaria'],
        t.formattedLevels['Secundaria'],
        t.formattedLevels['Otros'],
        { content: `${t.totalHours}h`, styles: { fontStyle: 'bold' } },
        t.subjects.join(', ')
      ]),
      theme: 'grid',
      headStyles: { fillColor: [234, 88, 12] },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'center', cellWidth: 20 },
        3: { halign: 'center', cellWidth: 20 },
        4: { halign: 'center', cellWidth: 20 },
        5: { halign: 'center', cellWidth: 20 },
        6: { cellWidth: 'auto', fontSize: 8 }
      }
    });

    doc.save(`Carga_Horaria_${selectedYear}.pdf`);
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
              Carga Horaria y Funciones
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Distribución de Horas Semanales por Nivel
            </p>
          </div>
        </div>

        <button
          onClick={downloadPDF}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95"
        >
          <Download size={18} />
          Exportar Carga
        </button>
      </div>

      <div className="max-w-7xl mx-auto p-8">
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Docente
                </th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                  Inicial (25h)
                </th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                  Primaria (25h)
                </th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                  Secundaria (30h)
                </th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                  Total h/s
                </th>
                <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Materias Asignadas
                </th>
              </tr>
            </thead>
            <tbody>
              {workloadData.map((t, i) => (
                <tr
                  key={i}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors group"
                >
                  <td className="p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center font-black">
                        {t.name.charAt(0)}
                      </div>
                      <span className="text-sm font-black text-slate-800 uppercase tracking-tight">
                        {t.name}
                      </span>
                    </div>
                  </td>
                  <td className="p-6 text-center text-sm font-bold text-slate-500">
                    {t.formattedLevels['Inicial']}
                  </td>
                  <td className="p-6 text-center text-sm font-bold text-slate-500">
                    {t.formattedLevels['Primaria']}
                  </td>
                  <td className="p-6 text-center text-sm font-bold text-slate-500">
                    {t.formattedLevels['Secundaria']}
                  </td>
                  <td className="p-6 text-center">
                    <span className="bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full text-sm font-black">
                      {t.totalHours}h
                    </span>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-wrap gap-2">
                      {t.subjects.map((s, si) => (
                        <span
                          key={si}
                          className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[9px] font-bold uppercase whitespace-nowrap"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
