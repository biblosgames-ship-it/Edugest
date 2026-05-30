import React, { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Download, AlertTriangle, Calendar as CalendarIcon, Clock } from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ReportProps {
  onClose: () => void;
}

export const IncidentsReport: React.FC<ReportProps> = ({ onClose }) => {
  const { state, center, selectedYear } = useApp();

  const incidents = useMemo(() => {
    return (state.activities || [])
      .filter(a => a.type === 'incident')
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.activities]);

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59);
    doc.text(center?.name || 'Centro Educativo', pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(14);
    doc.setTextColor(225, 29, 72); // Rose 600
    doc.text('REGISTRO DE INCIDENCIAS INSTITUCIONALES', pageWidth / 2, 30, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Año Escolar: ${selectedYear} | Total Incidencias: ${incidents.length}`, pageWidth / 2, 37, { align: 'center' });

    autoTable(doc, {
      startY: 45,
      head: [['Fecha', 'Hora', 'Título / Incidencia', 'Descripción']],
      body: incidents.map(i => [
        format(new Date(`${i.date}T12:00:00`), 'dd/MM/yyyy'),
        `${i.startTime} - ${i.endTime}`,
        i.title,
        i.description || '-'
      ]),
      theme: 'grid',
      headStyles: { fillColor: [225, 29, 72] },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 35 },
        2: { cellWidth: 40, fontStyle: 'bold' },
        3: { cellWidth: 'auto' }
      }
    });

    doc.save(`Registro_Incidencias_${selectedYear}.pdf`);
  };

  const modalContent = (
    <div className="fixed inset-0 z-[99999] bg-slate-50 block overflow-y-auto pb-20">
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-800 uppercase tracking-tight">Registro de Incidencias</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Seguimiento de Novedades Institucionales</p>
          </div>
        </div>

        <button onClick={downloadPDF} className="flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">
          <Download size={18} />
          Exportar Registro
        </button>
      </div>

      <div className="max-w-5xl mx-auto p-8 space-y-6">
        {incidents.length === 0 ? (
          <div className="bg-white rounded-[3rem] p-20 text-center border border-slate-100 shadow-xl">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300">
                <AlertTriangle size={40} />
             </div>
             <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight mb-2">No hay incidencias registradas</h3>
             <p className="text-slate-400 text-sm max-w-xs mx-auto">Las incidencias marcadas en el calendario aparecerán aquí de forma consolidada.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
             {incidents.map((incident, idx) => (
               <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex items-start gap-6 group">
                  <div className="flex flex-col items-center justify-center bg-rose-50 p-4 rounded-2xl min-w-[100px]">
                     <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">
                        {format(new Date(`${incident.date}T12:00:00`), 'MMM', { locale: es })}
                     </span>
                     <span className="text-3xl font-black text-rose-600 leading-none">
                        {format(new Date(`${incident.date}T12:00:00`), 'dd')}
                     </span>
                  </div>
                  
                  <div className="flex-1 space-y-2">
                     <div className="flex items-center justify-between">
                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight group-hover:text-rose-600 transition-colors">
                           {incident.title}
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                           <Clock size={12} /> {incident.startTime} - {incident.endTime}
                        </div>
                     </div>
                     <p className="text-sm text-slate-500 leading-relaxed">
                        {incident.description || 'Sin descripción detallada.'}
                     </p>
                  </div>
               </div>
             ))}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
