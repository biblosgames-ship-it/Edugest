import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import {
  ArrowLeft,
  Download,
  Users,
  Briefcase,
  UserCheck,
  ShieldCheck,
  HeartHandshake,
  FileSpreadsheet
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { exportStaffToExcel } from '../utils/listPdfGenerator';

interface ReportProps {
  onClose: () => void;
}

export const StaffConsolidatedReport: React.FC<ReportProps> = ({ onClose }) => {
  const { state, center, selectedYear } = useApp();

  const staffData = useMemo(() => {
    const personnel = state.teachers || [];

    const groups = {
      'Equipo de Gestión / Directivo': personnel.filter(
        (p) => p.role === 'management' || p.role === 'management_teacher'
      ),
      'Cuerpo Docente': personnel.filter(
        (p) => p.role === 'teacher' || p.role === 'management_teacher'
      ),
      'Personal Administrativo': personnel.filter((p) => p.role === 'administrative'),
      'Personal de Apoyo / Otros': personnel.filter((p) => p.role === 'support')
    };

    const sexCount = {
      female: personnel.filter((p) => p.sex === 'F').length,
      male: personnel.filter((p) => p.sex === 'M').length,
      unspecified: personnel.filter((p) => p.sex !== 'F' && p.sex !== 'M').length
    };

    return { groups, total: personnel.length, sexCount };
  }, [state.teachers]);

  const exportExcel = () => {
    exportStaffToExcel({
      staff: state.teachers || [],
      centerName: center?.name || 'Centro Educativo',
      schoolYear: selectedYear
    });
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Encabezado
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text(center?.name || 'Centro Educativo', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(14);
    doc.setTextColor(13, 148, 136); // Teal 600
    doc.text('REPORTE CONSOLIDADO DE PERSONAL', pageWidth / 2, 30, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Año Escolar: ${selectedYear} | Total Colaboradores: ${staffData.total}`,
      pageWidth / 2,
      37,
      { align: 'center' }
    );

    let currentY = 45;

    // SECCIÓN DE RESUMEN (SUMAS GENERALES)
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('RESUMEN GENERAL POR ÁREAS', 14, currentY);
    currentY += 5;

    autoTable(doc, {
      startY: currentY,
      head: [['Área / Departamento', 'Cantidad de Colaboradores']],
      body: Object.entries(staffData.groups).map(([name, members]) => [name, members.length]),
      foot: [['TOTAL GENERAL', staffData.total]],
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] },
      footStyles: { fillColor: [248, 250, 252], textColor: [30, 41, 59], fontStyle: 'bold' },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // SECCIÓN DE RESUMEN POR SEXO
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('DISTRIBUCIÓN POR GÉNERO', 14, currentY);
    currentY += 5;

    const sexBody = [
      ['Femenino', staffData.sexCount.female],
      ['Masculino', staffData.sexCount.male]
    ];
    if (staffData.sexCount.unspecified > 0) {
      sexBody.push(['No Especificado', staffData.sexCount.unspecified]);
    }

    autoTable(doc, {
      startY: currentY,
      head: [['Género', 'Cantidad']],
      body: sexBody,
      theme: 'grid',
      headStyles: { fillColor: [30, 41, 59] },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 10;

    // DETALLE POR DEPARTAMENTOS
    Object.entries(staffData.groups).forEach(([groupName, members]) => {
      if (members.length === 0) return;

      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(12);
      doc.setTextColor(30, 41, 59);
      doc.text(groupName.toUpperCase(), 14, currentY);
      currentY += 4;

      autoTable(doc, {
        startY: currentY,
        head: [['Nº', 'Nombre Completo', 'Rol', 'Sexo', 'Teléfono']],
        body: members.map((m, idx) => [
          idx + 1,
          (m.full_name || m.name || '').toUpperCase(),
          m.role === 'management_teacher'
            ? 'Docente / Gestión'
            : m.role === 'management'
              ? 'Gestión'
              : m.role === 'administrative'
                ? 'Administrativo'
                : m.role === 'support'
                  ? 'Apoyo'
                  : 'Docente',
          m.sex || 'M',
          m.phone || '---'
        ]),
        theme: 'striped',
        headStyles: { fillColor: [13, 148, 136] },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14, right: 14 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    doc.save(`Consolidado_Personal_${selectedYear}.pdf`);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'management_teacher':
        return <ShieldCheck className="text-emerald-500" size={24} />;
      case 'management':
        return <ShieldCheck className="text-amber-500" size={24} />;
      case 'teacher':
        return <Briefcase className="text-indigo-500" size={24} />;
      case 'administrative':
        return <UserCheck className="text-blue-500" size={24} />;
      default:
        return <HeartHandshake className="text-teal-500" size={24} />;
    }
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
              Consolidado de Personal
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Nómina y Distribución por Departamentos
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <FileSpreadsheet size={18} />
            Exportar Excel
          </button>
          <button
            onClick={downloadPDF}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95"
          >
            <Download size={18} />
            Exportar PDF
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-8 space-y-12">
        {/* RESUMEN RÁPIDO */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {Object.entries(staffData.groups).map(([name, members]) => (
            <div key={name} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-slate-50 rounded-2xl">
                  {getRoleIcon(members[0]?.role || '')}
                </div>
                <span className="text-2xl font-black text-slate-800">{members.length}</span>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight">
                {name}
              </p>
            </div>
          ))}
        </div>

        {/* DISTRIBUCIÓN POR GÉNERO */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center justify-around gap-6">
          <div className="text-center md:text-left">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
              Distribución de Personal por Sexo
            </h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase">
              Resumen demográfico del cuerpo laboral
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-12">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center font-black text-lg">
                F
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800">{staffData.sexCount.female}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Femenino
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center font-black text-lg">
                M
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800">{staffData.sexCount.male}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Masculino
                </p>
              </div>
            </div>

            {staffData.sexCount.unspecified > 0 && (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-slate-50 text-slate-500 rounded-full flex items-center justify-center font-black text-lg">
                  ?
                </div>
                <div>
                  <p className="text-2xl font-black text-slate-800">
                    {staffData.sexCount.unspecified}
                  </p>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    No Especificado
                  </p>
                </div>
              </div>
            )}

            <div className="h-12 w-px bg-slate-200 hidden md:block"></div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center">
                <Users size={20} />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800">{staffData.total}</p>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                  Total General
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* LISTADO POR ÁREAS */}
        <div className="space-y-10">
          {Object.entries(staffData.groups).map(
            ([groupName, members]) =>
              members.length > 0 && (
                <div key={groupName} className="space-y-6">
                  <div className="flex items-center gap-4">
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-[0.2em]">
                      {groupName}
                    </h2>
                    <div className="h-px bg-slate-200 flex-1"></div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {members.map((person, i) => (
                      <div
                        key={i}
                        className="bg-white p-5 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                          {getRoleIcon(person.role)}
                        </div>

                        <div className="flex items-center gap-4">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-white ${person.sex === 'F' ? 'bg-rose-400' : 'bg-blue-400'}`}
                          >
                            {person.full_name?.charAt(0) || person.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800 uppercase tracking-tight">
                              {person.full_name || person.name}
                            </p>
                            <p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mt-0.5">
                              {person.position ||
                                person.cargo ||
                                (person.role === 'management_teacher'
                                  ? 'Docente y Gestión'
                                  : person.role === 'teacher'
                                    ? 'Docente'
                                    : person.role === 'management'
                                      ? 'Gestión'
                                      : person.role === 'administrative'
                                        ? 'Administrativo'
                                        : person.role === 'support'
                                          ? 'Apoyo'
                                          : person.role)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
