import React, { useMemo } from 'react';
import {
  PieChart,
  Download,
  FileText,
  Calendar,
  TrendingUp,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Printer,
  ArrowLeft,
  FileSpreadsheet,
  FileDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useFinance } from '../../hooks/useFinance';
import { useApp } from '../../context/AppContext';

export const FinanceReports = () => {
  const { state, center } = useApp();
  const { invoices, loading } = useFinance();
  const [selectedCourseId, setSelectedCourseId] = React.useState<string | null>(null);

  const reportData = useMemo(() => {
    const students = state.students || [];
    const courses = state.courses || [];

    // 1. Estadísticas Generales
    const totalDebt = invoices.reduce((acc, i) => acc + Number(i.amount_final), 0);
    const totalPaid = invoices
      .filter((i) => i.status === 'paid')
      .reduce((acc, i) => acc + Number(i.amount_final), 0);
    const pendingBalance = totalDebt - totalPaid;
    const collectionRate = totalDebt > 0 ? (totalPaid / totalDebt) * 100 : 0;

    // 2. Agrupar por Curso
    const courseStats = courses
      .map((course) => {
        const courseStudents = students.filter((s) => s.course_id === course.id);
        let courseDebt = 0;
        let coursePaid = 0;
        let moraCount = 0;
        let alDiaCount = 0;

        courseStudents.forEach((student) => {
          const studentInvoices = invoices.filter((i) => i.student_id === student.id);
          const sDebt = studentInvoices.reduce((acc, i) => acc + Number(i.amount_final), 0);
          const sPaid = studentInvoices
            .filter((i) => i.status === 'paid')
            .reduce((acc, i) => acc + Number(i.amount_final), 0);
          const sBalance = sDebt - sPaid;
          const hasMora = studentInvoices.some(
            (i) =>
              i.status === 'overdue' ||
              (i.status === 'pending' && new Date(i.due_date) < new Date())
          );

          courseDebt += sDebt;
          coursePaid += sPaid;
          if (hasMora) moraCount++;
          else if (sDebt > 0 && sBalance === 0) alDiaCount++;
        });

        return {
          id: course.id,
          name: `${course.level} ${course.grade} "${course.section}"`,
          totalStudents: courseStudents.length,
          debt: courseDebt - coursePaid,
          paid: coursePaid,
          moraCount,
          alDiaCount
        };
      })
      .sort((a, b) => b.debt - a.debt); // Ordenar por mayor deuda

    return {
      totalDebt,
      totalPaid,
      pendingBalance,
      collectionRate,
      courseStats
    };
  }, [state.students, state.courses, invoices]);

  if (loading)
    return (
      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex items-center justify-center">
        <div className="animate-spin text-indigo-600 font-black">CARGANDO...</div>
      </div>
    );

  // VISTA DE REPORTE POR GRADO (IMPRIMIBLE)
  if (selectedCourseId) {
    const course = reportData.courseStats.find((c) => c.id === selectedCourseId);
    const courseStudents = state.students
      .filter((s) => s.course_id === selectedCourseId)
      .map((student) => {
        const studentInvoices = invoices.filter((i) => i.student_id === student.id);
        const sDebt = studentInvoices.reduce((acc, i) => acc + Number(i.amount_final), 0);
        const sPaid = studentInvoices
          .filter((i) => i.status === 'paid')
          .reduce((acc, i) => acc + Number(i.amount_final), 0);
        const hasMora = studentInvoices.some(
          (i) =>
            i.status === 'overdue' || (i.status === 'pending' && new Date(i.due_date) < new Date())
        );
        return { ...student, balance: sDebt - sPaid, hasMora };
      })
      .sort((a, b) => a.first_surname.localeCompare(b.first_surname));

    const handleExportExcel = () => {
      const data = courseStudents.map((s, idx) => ({
        '#': idx + 1,
        APELLIDOS: s.first_surname,
        NOMBRES: s.names,
        ESTADO: s.hasMora ? 'MORA' : s.balance > 0 ? 'PENDIENTE' : 'AL DÍA',
        'PENDIENTE (RD$)': s.balance
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Cobros');
      XLSX.writeFile(wb, `Reporte_Cobros_${course?.name.replace(/ /g, '_')}.xlsx`);
    };

    const handleExportPDF = () => {
      const doc = new jsPDF();

      // 1. Título e Institución
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(center?.name || 'EDUGEST SCHOOL', 14, 22);

      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`REPORTE DE COBROS: ${course?.name}`, 14, 30);
      doc.text(`FECHA: ${new Date().toLocaleDateString()}`, 14, 35);

      // 2. Tabla de Datos
      const tableBody = courseStudents.map((s, idx) => [
        idx + 1,
        `${s.first_surname} ${s.names}`.toUpperCase(),
        s.hasMora ? 'MORA' : s.balance > 0 ? 'PENDIENTE' : 'AL DÍA',
        `RD$ ${s.balance.toLocaleString()}`
      ]);

      autoTable(doc, {
        startY: 45,
        head: [['#', 'APELLIDOS, NOMBRES', 'ESTADO', 'PENDIENTE']],
        body: tableBody,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 9, halign: 'left' },
        bodyStyles: { fontSize: 8, textColor: 50 },
        columnStyles: {
          0: { cellWidth: 10 },
          2: { halign: 'center' },
          3: { halign: 'right' }
        },
        foot: [['', '', 'TOTAL PENDIENTE DEL GRADO:', `RD$ ${course?.debt.toLocaleString()}`]],
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontSize: 9,
          fontStyle: 'bold',
          halign: 'right'
        }
      });

      // 3. Firmas
      const finalY = (doc as any).lastAutoTable.finalY + 30;
      doc.setDrawColor(200);
      doc.line(14, finalY, 74, finalY);
      doc.line(130, finalY, 190, finalY);

      doc.setFontSize(8);
      doc.text('FIRMA DEL DIRECTOR', 30, finalY + 5);
      doc.text('SELLO DEL CENTRO', 150, finalY + 5);

      doc.save(`Reporte_Cobros_${course?.name.replace(/ /g, '_')}.pdf`);
    };

    return (
      <div className="space-y-6">
        <button
          onClick={() => setSelectedCourseId(null)}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors print:hidden"
        >
          <ArrowLeft size={16} /> Volver al Resumen
        </button>

        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-8">
            <div className="flex items-center gap-4">
              {center?.logo_url && (
                <img src={center.logo_url} alt="Logo" className="w-16 h-16 object-contain" />
              )}
              <div>
                <h2 className="text-xl font-black uppercase tracking-tighter text-slate-900">
                  {center?.name || 'EDUGEST SCHOOL'}
                </h2>
                <h3 className="text-sm font-bold text-indigo-600 uppercase">
                  REPORTE DE COBROS: {course?.name}
                </h3>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Fecha: {new Date().toLocaleDateString()}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleExportExcel}
                  className="bg-emerald-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                  <FileSpreadsheet size={14} /> Descargar Excel
                </button>
                <button
                  onClick={handleExportPDF}
                  className="bg-rose-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:bg-rose-700 transition-all shadow-lg shadow-rose-100"
                >
                  <FileDown size={14} /> Descargar PDF
                </button>
              </div>
            </div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-900">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Apellidos, Nombres</th>
                <th className="px-4 py-3 text-center">Estado</th>
                <th className="px-4 py-3 text-right">Pendiente</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {courseStudents.map((s, idx) => (
                <tr key={s.id} className="text-[11px] font-bold text-slate-700">
                  <td className="px-4 py-2 text-slate-400">{idx + 1}</td>
                  <td className="px-4 py-2 uppercase">
                    {s.first_surname} {s.names}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`uppercase text-[9px] px-2 py-0.5 rounded ${s.hasMora ? 'bg-rose-100 text-rose-700' : s.balance > 0 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}
                    >
                      {s.hasMora ? 'Mora' : s.balance > 0 ? 'Pendiente' : 'Al Día'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">RD$ {s.balance.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-900 font-black text-slate-900 uppercase">
                <td colSpan={3} className="px-4 py-4 text-right text-[10px]">
                  Total Pendiente del Grado:
                </td>
                <td className="px-4 py-4 text-right text-sm">
                  RD$ {course?.debt.toLocaleString()}
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="mt-20 flex justify-between px-10 invisible print:visible">
            <div className="text-center border-t border-slate-400 pt-2 w-48">
              <p className="text-[9px] font-bold uppercase">Firma del Director</p>
            </div>
            <div className="text-center border-t border-slate-400 pt-2 w-48">
              <p className="text-[9px] font-bold uppercase">Sello del Centro</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ... rest of the main view ... */}
      {/* HEADER & SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-2 bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col justify-between shadow-2xl shadow-slate-900/20">
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Reporte Financiero</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Estado General de Cobros
            </p>
          </div>
          <div className="mt-8 flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                Por Cobrar (Pendiente)
              </p>
              <p className="text-3xl font-black">
                RD$ {reportData.pendingBalance.toLocaleString()}
              </p>
            </div>
            <div className="bg-emerald-500/20 text-emerald-400 px-4 py-2 rounded-xl text-xs font-black">
              {reportData.collectionRate.toFixed(1)}% Cobrado
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl w-fit mb-4">
            <TrendingUp size={24} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
            Total Recaudado
          </p>
          <p className="text-xl font-black text-slate-900">
            RD$ {reportData.totalPaid.toLocaleString()}
          </p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl w-fit mb-4">
            <AlertTriangle size={24} />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
            En Mora
          </p>
          <p className="text-xl font-black text-slate-900">
            {reportData.courseStats.reduce((acc, c) => acc + c.moraCount, 0)} Alumnos
          </p>
        </div>
      </div>

      {/* DETALLE POR CURSO */}
      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tighter">Morosidad por Grado</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Desglose detallado de deudas y estados
            </p>
          </div>
          <button className="bg-slate-50 text-slate-400 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all flex items-center gap-2">
            <Download size={16} /> Exportar Reporte
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-8 py-5">Grado / Curso</th>
                <th className="px-8 py-5 text-center">Alumnos</th>
                <th className="px-8 py-5 text-center">Al Día</th>
                <th className="px-8 py-5 text-center">En Mora</th>
                <th className="px-8 py-5 text-right">Pendiente</th>
                <th className="px-8 py-5 text-right">Cobrado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reportData.courseStats.map((course) => (
                <tr key={course.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-slate-700 uppercase tracking-tight">
                        {course.name}
                      </span>
                      <button
                        onClick={() => setSelectedCourseId(course.id)}
                        className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Ver Reporte Imprimible"
                      >
                        <Printer size={16} />
                      </button>
                    </div>
                  </td>
                  <td className="px-8 py-4 text-center">
                    <span className="text-xs font-bold text-slate-500">{course.totalStudents}</span>
                  </td>
                  <td className="px-8 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-emerald-600 font-black text-[10px]">
                      <CheckCircle2 size={12} /> {course.alDiaCount}
                    </div>
                  </td>
                  <td className="px-8 py-4 text-center">
                    <div
                      className={`flex items-center justify-center gap-1.5 font-black text-[10px] ${course.moraCount > 0 ? 'text-rose-600' : 'text-slate-300'}`}
                    >
                      <Clock size={12} /> {course.moraCount}
                    </div>
                  </td>
                  <td
                    className={`px-8 py-4 text-right font-black text-sm ${course.debt > 0 ? 'text-rose-600' : 'text-slate-900'}`}
                  >
                    RD$ {course.debt.toLocaleString()}
                  </td>
                  <td className="px-8 py-4 text-right font-bold text-slate-400 text-xs">
                    RD$ {course.paid.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
