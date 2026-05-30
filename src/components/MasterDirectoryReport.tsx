import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Download, 
  FileText, 
  Search,
  X
} from 'lucide-react';
import { useApp, useSupabase } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MasterDirectoryReportProps {
  onClose?: () => void;
}

export const MasterDirectoryReport: React.FC<MasterDirectoryReportProps> = ({ onClose }) => {
  const { state, center, selectedYear } = useApp();
  const { profile } = useSupabase();
  const [parents, setParents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchParents = async () => {
      const centerId = profile?.center_id;
      if (!centerId) return;
      try {
        const { data, error } = await supabase
          .from('parents')
          .select('*')
          .eq('center_id', centerId);
        if (error) throw error;
        setParents(data || []);
      } catch (err) {
        console.error('Error fetching parents:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchParents();
  }, [profile]);

  const students = state.students || [];
  const courses = state.courses || [];

  const studentDirectory = students.map(student => {
    const course = courses.find(c => c.id === student.course_id);
    const tutorRecord = parents.find(p => p.student_id === student.id);
    return {
      id: student.id,
      name: `${student.first_surname || student.lastName || ''} ${student.second_surname || ''}, ${student.names || student.firstName || ''}`.trim(),
      courseName: course ? `${course.level} - ${course.grade} ${course.section}` : 'N/A',
      courseLevel: course?.level || 'N/A',
      address: [student.address_street, student.address_number, student.address_sector].filter(Boolean).join(', ') || 'No especificada',
      tutorName: tutorRecord?.name || 'No asignado',
      tutorRelation: tutorRecord?.relation || 'N/A',
      tutorPhone: tutorRecord?.phone || 'N/A',
      tutorSecondaryPhone: tutorRecord?.secondary_phone || 'N/A'
    };
  });

  const filteredDirectory = studentDirectory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    item.tutorName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', format: 'letter' });
    const now = new Date().toLocaleDateString();

    doc.setFontSize(16);
    doc.text('DIRECTORIO MAESTRO DE ESTUDIANTES Y TUTORES', 14, 18);
    doc.setFontSize(10);
    doc.text(`Centro Educativo: ${center?.name || 'Sistema Edugest'}   |   Fecha: ${now}`, 14, 25);

    const body = filteredDirectory.map((item, idx) => [
      idx + 1,
      item.name.toUpperCase(),
      item.courseName.toUpperCase(),
      item.tutorName.toUpperCase(),
      item.tutorRelation.toUpperCase(),
      item.tutorPhone,
      item.address.toUpperCase()
    ]);

    autoTable(doc, {
      startY: 32,
      head: [['Nº', 'ESTUDIANTE', 'CURSO/GRADO', 'TUTOR / ENCARGADO', 'PARENTESCO', 'TELÉFONO', 'DIRECCIÓN']],
      body: body,
      theme: 'striped',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 55 },
        2: { cellWidth: 35 },
        3: { cellWidth: 45 },
        4: { cellWidth: 25 },
        5: { cellWidth: 25 },
        6: { cellWidth: 60 }
      }
    });

    doc.save(`Directorio_Maestro_${now}.pdf`);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-3">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-100">
              <Users size={24} />
            </div>
            Directorio Maestro
          </h2>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Base de datos completa con información de contacto y tutores legales de los alumnos.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={exportPDF}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 disabled:opacity-50"
          >
            <Download size={18} /> Exportar PDF
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-600 transition-all"
            >
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Buscar por estudiante o tutor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
          <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <FileText size={18} className="text-indigo-600" /> Directorio de Alumnos y Contactos
          </h4>
          <span className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-[10px] font-black uppercase">
            {filteredDirectory.length} Registros
          </span>
        </div>

        {loading ? (
          <div className="p-20 text-center text-slate-400 text-sm font-bold animate-pulse uppercase tracking-widest">
            Cargando contactos...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50">
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estudiante</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Curso</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tutor / Encargado</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Parentesco</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Teléfono</th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dirección</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredDirectory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-8 py-6">
                      <span className="text-xs font-black text-slate-700 uppercase">{item.name}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">{item.courseName}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-black text-slate-700 uppercase">{item.tutorName}</span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-[10px] font-black uppercase bg-slate-100 px-3 py-1 rounded-full text-slate-500">
                        {item.tutorRelation}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <span className="text-xs font-black text-slate-800">{item.tutorPhone}</span>
                    </td>
                    <td className="px-8 py-6 max-w-[200px] truncate">
                      <span className="text-xs text-slate-500" title={item.address}>{item.address}</span>
                    </td>
                  </tr>
                ))}
                {filteredDirectory.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-slate-400 text-sm font-bold uppercase tracking-widest">
                      No se encontraron alumnos registrados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MasterDirectoryReport;
