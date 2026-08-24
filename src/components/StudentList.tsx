import React, { useState, useEffect } from 'react';
import { dataService } from '../services/dataService';
import { Student } from '../types/student';
import { Pencil, Trash2, Printer, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useApp } from '../context/AppContext';
import { exportStudentsToExcel } from '../utils/listPdfGenerator';

export const StudentList = ({ gradeId, centerId, onEdit }: any) => {
  const { state, center, selectedYear } = useApp();
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchStudents = async () => {
    if (!gradeId) return;
    const targetCid = centerId || center?.id;
    if (!targetCid) return;
    setIsLoading(true);
    try {
      const year = selectedYear || '2026-2027';
      const data = await dataService.getStudents(
        gradeId,
        targetCid,
        year
      );
      setStudents(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [gradeId]);

  const exportExcel = () => {
    const course = state.courses?.find((c: any) => c.id === gradeId);
    exportStudentsToExcel({
      students,
      courseInfo: course || null,
      centerName: center?.name || 'Centro Educativo',
      schoolYear: selectedYear
    });
  };

  const printList = () => {
    const course = state.courses?.find((c: any) => c.id === gradeId);
    if (!course) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
    const pageWidth = doc.internal.pageSize.width;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('LISTADO OFICIAL DE ESTUDIANTES', pageWidth / 2, 15, { align: 'center' });

    doc.setFontSize(10);
    doc.text(
      `AÑO ESCOLAR: ${selectedYear || '2026-2027'}   |   CURSO: ${course.level} ${course.grade} ${course.section}   |   TANDA: ${(course.tanda || 'Matutina').toUpperCase()}`,
      pageWidth / 2,
      21,
      { align: 'center' }
    );

    const head = [['Nº', 'NOMBRES Y APELLIDOS', 'SEXO', 'CÉDULA']];
    const body = [...students]
      .sort((a: any, b: any) => (a.orderNumber || 99) - (b.orderNumber || 99))
      .map((s: any, idx) => [
        s.orderNumber || idx + 1,
        `${s.first_surname || s.lastName} ${s.second_surname || ''}, ${s.names || s.firstName}`.toUpperCase(),
        s.sex || '-',
        s.idCard || s.id_card || '---'
      ]);

    autoTable(doc, {
      startY: 28,
      head: head,
      body: body,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 1.5, valign: 'middle' },
      headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 15 },
        2: { halign: 'center', cellWidth: 15 },
        3: { cellWidth: 35 }
      }
    });

    doc.save(`Listado_${course.grade}_${course.section}_${course.tanda || 'Matutina'}.pdf`);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden mx-1">
      <div className="flex justify-between items-center p-2 bg-slate-50 border-b border-slate-100">
        <span className="text-[10px] font-black uppercase text-slate-500">
          Alumnos inscritos ({students.length})
        </span>
        {students.length > 0 && (
          <div className="flex items-center gap-1.5">
            <button
              onClick={exportExcel}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[9px] font-black uppercase transition-all shadow-sm"
              title="Descargar en formato Excel"
            >
              <FileSpreadsheet size={12} /> EXCEL
            </button>
            <button
              onClick={printList}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-black uppercase transition-all shadow-sm"
              title="Imprimir o guardar como PDF"
            >
              <Printer size={12} /> PDF
            </button>
          </div>
        )}
      </div>
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-slate-900 text-white">
            <th className="px-3 py-1 text-[9px] font-black uppercase w-8 text-center">#</th>
            <th className="px-3 py-1 text-[9px] font-black uppercase">Nombre</th>
            <th className="px-3 py-1 text-[9px] font-black uppercase text-center w-8">S</th>
            <th className="px-3 py-1 text-right text-[9px] font-black uppercase w-20">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading ? (
            <tr>
              <td
                colSpan={4}
                className="p-4 text-center text-[10px] font-black uppercase text-slate-400 animate-pulse"
              >
                Cargando...
              </td>
            </tr>
          ) : students.length === 0 ? (
            <tr>
              <td colSpan={4} className="p-4 text-center text-[10px] text-slate-300 italic">
                No hay alumnos.
              </td>
            </tr>
          ) : (
            students
              .sort((a, b) => (a.orderNumber || 99) - (b.orderNumber || 99))
              .map((s: any) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-3 py-0.5 text-center text-[10px] font-black text-indigo-600">
                    {s.orderNumber || '-'}
                  </td>
                  <td className="px-3 py-0.5 font-bold text-slate-800 uppercase text-[10px] tracking-tighter">
                    {s.first_surname || s.lastName} {s.second_surname || ''},{' '}
                    {s.names || s.firstName}
                  </td>
                  <td className="px-3 py-0.5 text-center text-[9px] font-black text-slate-400">
                    {s.sex || '-'}
                  </td>
                  <td className="px-3 py-0.5 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => onEdit(s)}
                        className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                      >
                        <Pencil size={12} />
                      </button>
                      <button className="p-1 text-rose-600 hover:bg-rose-50 rounded">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
          )}
        </tbody>
      </table>
    </div>
  );
};
