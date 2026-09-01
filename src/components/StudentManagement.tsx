/** VERSION 54.0 - FIX IMPRESIÓN (CID ANCLADO) **/
import React, { useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useApp, useSupabase } from '../context/AppContext';
import { useStudents } from '../hooks/useStudents';
import { supabase } from '../lib/supabase';
import { sortCourses } from '../utils/courseSorter';
import {
  GraduationCap,
  Trash2,
  Pencil,
  Filter,
  Sparkles,
  Calendar,
  Eye,
  Download,
  Printer,
  UserPlus,
  Search,
  FileSpreadsheet
} from 'lucide-react';
import { StudentForm } from './StudentForm';
import { BulkImport } from './BulkImport';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { dataService } from '../services/dataService';
import { generateStudentPDF } from '../utils/pdfGenerator';
import { exportStudentsToExcel } from '../utils/listPdfGenerator';
import { PromoteStudentModal } from './PromoteStudentModal';
import { BulkPromoteModal } from './BulkPromoteModal';

export const StudentManagement = () => {
  const queryClient = useQueryClient();
  const { state, selectedYear, refreshData } = useApp();
  const { profile } = useSupabase();
  const { students: allStudents, isLoading: loading, deleteStudent, updateStudent } = useStudents();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');

  // Resetear el curso seleccionado al cambiar el año escolar para evitar filtros fantasmas
  useEffect(() => {
    setSelectedCourseId('');
  }, [selectedYear]);
  const [showForm, setShowForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [showBulkPromote, setShowBulkPromote] = useState(false);
  const [editingStudent, setEditingStudent] = useState<any>(null);
  const [promotingStudent, setPromotingStudent] = useState<any>(null);
  const [localLoading, setLocalLoading] = useState(false);
  const showLoading = loading || localLoading;

  const normText = (str: string) =>
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  const rawList = allStudents && allStudents.length > 0 ? allStudents : (state.students || []);

  // El filtrado ahora es local y ultra-rápido
  const filteredStudents = useMemo(() => {
    let result = [...rawList];

    // Filtro por curso
    if (selectedCourseId) {
      result = result.filter((s) => String(s.course_id) === String(selectedCourseId));
    }

    // Filtro por búsqueda
    if (searchTerm) {
      const term = normText(searchTerm);
      const tokens = term.split(/\s+/).filter(Boolean);

      result = result.filter((s) => {
        const fullString = normText(
          `${s.names || s.first_name || s.firstName || ''} ${s.first_surname || s.last_name || s.lastName || ''} ${s.second_surname || s.secondSurname || ''} ${s.student_code || ''} ${s.sigerd_code || ''} ${s.id_card || ''}`
        );
        const altFullString = fullString.replace(/nn/g, 'n');
        const altTerm = term.replace(/nn/g, 'n');

        return (
          fullString.includes(term) ||
          altFullString.includes(altTerm) ||
          tokens.every((t) => fullString.includes(t) || altFullString.includes(t.replace(/nn/g, 'n')))
        );
      });
    }

    return result.sort((a, b) => (a.order_number || 999) - (b.order_number || 999));
  }, [rawList, selectedCourseId, searchTerm]);

  const handleDownloadPDF = async (s: any) => {
    try {
      const centerId = profile?.center_id;
      if (!centerId) {
        alert('Error: No se encontró el centro educativo asociado a su perfil.');
        return;
      }
      const fullData = await dataService.getFullStudent(s.id);
      const centerData = await dataService.getCenter(centerId);
      const getRole = (f: any) => (f.relation || f.role || '').toLowerCase().trim();
      const dbPadre = (fullData.family || []).find((f: any) => getRole(f) === 'padre');
      const dbMadre = (fullData.family || []).find((f: any) => getRole(f) === 'madre');
      const dbTutor = (fullData.family || []).find((f: any) => {
        const r = getRole(f);
        return r === 'tutor' || (!['padre', 'madre'].includes(r) && r !== '');
      });

      const familyInfo = {
        padre: {
          name: dbPadre?.name || '',
          id_card: dbPadre?.secondary_phone || dbPadre?.id_card || '',
          phone: dbPadre?.phone || '',
          occupation: dbPadre?.occupation || ''
        },
        madre: {
          name: dbMadre?.name || '',
          id_card: dbMadre?.secondary_phone || dbMadre?.id_card || '',
          phone: dbMadre?.phone || '',
          occupation: dbMadre?.occupation || ''
        },
        tutor: {
          name: dbTutor?.name || '',
          relation: dbTutor?.occupation || dbTutor?.relation || dbTutor?.role || '',
          id_card: dbTutor?.secondary_phone || dbTutor?.id_card || '',
          phone: dbTutor?.phone || ''
        }
      };
      const courseInfo = state.courses.find((c: any) => c.id === s.course_id);
      generateStudentPDF(
        fullData,
        familyInfo,
        fullData.medical || {},
        fullData.history || {},
        fullData.documents || {},
        centerData || {},
        courseInfo
      );
    } catch (e) {
      console.error(e);
      alert('Error al generar PDF. Verifique su conexión.');
    }
  };

  const handleOrderChange = async (studentId: string, newOrder: string) => {
    const numOrder = newOrder === '' ? null : parseInt(newOrder, 10);
    try {
      await updateStudent({ id: studentId, updates: { order_number: numOrder } });
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      refreshData();
    } catch (err) {
      console.error('Error al actualizar número de orden:', err);
    }
  };

  const autoAssignOrder = async () => {
    const courseStudents = (allStudents || []).filter((s) => s.course_id === selectedCourseId);
    if (!selectedCourseId || courseStudents.length === 0) return;
    if (!window.confirm('¿Desea asignar números de orden automáticamente por orden alfabético?'))
      return;

    setLocalLoading(true);
    try {
      const sorted = [...courseStudents].sort((a, b) => {
        const nameA =
          `${a.first_surname || ''} ${a.second_surname || ''} ${a.names || ''}`.trim().toLowerCase();
        const nameB =
          `${b.first_surname || ''} ${b.second_surname || ''} ${b.names || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });

      const updates = sorted.map((s, idx) => ({
        id: s.id,
        order_number: idx + 1
      }));

      await Promise.all(
        updates.map((u) =>
          supabase.from('students').update({ order_number: u.order_number }).eq('id', u.id)
        )
      );

      await queryClient.invalidateQueries({ queryKey: ['students'] });
      refreshData();
      alert('Números de orden asignados correctamente.');
    } catch (e) {
      console.error(e);
      alert('Error al asignar números.');
    } finally {
      setLocalLoading(false);
    }
  };

  const printCourseList = async () => {
    if (!selectedCourseId) return;
    const course = state.courses?.find((c: any) => c.id === selectedCourseId);
    if (!course) return;

    setLocalLoading(true);
    try {
      const centerId = profile?.center_id;
      if (!centerId) {
        alert('Error: No se encontró el centro educativo asociado a su perfil.');
        setLocalLoading(false);
        return;
      }
      const centerData = await dataService.getCenter(centerId);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      const pageWidth = doc.internal.pageSize.width;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(centerData?.name?.toUpperCase() || 'CENTRO EDUCATIVO', pageWidth / 2, 15, {
        align: 'center'
      });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const headerInfo = [];
      if (centerData?.code) headerInfo.push(`CÓDIGO: ${centerData.code}`);
      if (centerData?.rnc) headerInfo.push(`RNC: ${centerData.rnc}`);
      if (centerData?.phone) headerInfo.push(`TEL: ${centerData.phone}`);
      doc.text(headerInfo.join('  |  '), pageWidth / 2, 20, { align: 'center' });

      if (centerData?.address) {
        doc.setFontSize(8);
        doc.text(centerData.address.toUpperCase(), pageWidth / 2, 24, { align: 'center' });
      }

      doc.setLineWidth(0.5);
      doc.line(15, 27, pageWidth - 15, 27);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('LISTADO OFICIAL DE ESTUDIANTES', pageWidth / 2, 33, { align: 'center' });

      doc.setFontSize(9);
      doc.text(
        `AÑO ESCOLAR: ${selectedYear}   |   CURSO: ${course.level} ${course.grade} ${course.section}   |   TANDA: ${(course.tanda || 'Matutina').toUpperCase()}`,
        pageWidth / 2,
        38,
        { align: 'center' }
      );

      const calculateAge = (birthDate: string) => {
        if (!birthDate) return '-';
        const today = new Date();
        const birth = new Date(birthDate);
        if (isNaN(birth.getTime())) return '-';
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age.toString();
      };

      const formatDate = (dateStr: string) => {
        if (!dateStr) return '---';
        try {
          const [year, month, day] = dateStr.split('T')[0].split('-');
          return `${day}/${month}/${year}`;
        } catch {
          return dateStr;
        }
      };

      const head = [['Nº', 'NOMBRES Y APELLIDOS', 'SEXO', 'FECHA NACIMIENTO', 'EDAD']];
      const body = [...filteredStudents].map((s: any, idx) => [
        s.order_number || idx + 1,
        `${s.first_surname || ''} ${s.second_surname || ''}, ${s.names || ''}`.toUpperCase(),
        s.sex || '-',
        formatDate(s.birth_date || s.birthDate),
        calculateAge(s.birth_date || s.birthDate)
      ]);

      autoTable(doc, {
        startY: 43,
        head: head,
        body: body,
        theme: 'grid',
        styles: {
          fontSize: filteredStudents.length > 35 ? 7.5 : 9,
          cellPadding: filteredStudents.length > 35 ? 0.8 : 1.5,
          valign: 'middle',
          font: 'helvetica'
        },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10 },
          2: { halign: 'center', cellWidth: 15 },
          3: { halign: 'center', cellWidth: 35 },
          4: { halign: 'center', cellWidth: 15 }
        },
        margin: { left: 15, right: 15, bottom: 15 },
        didDrawPage: (data) => {
          doc.setFontSize(7);
          doc.text(
            `Generado por EduGest Cloud - Página ${data.pageNumber}`,
            pageWidth / 2,
            doc.internal.pageSize.height - 10,
            { align: 'center' }
          );
        }
      });

      doc.save(`Listado_${course.grade}_${course.section}_${course.tanda || 'Matutina'}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Error al generar el listado.');
    } finally {
      setLocalLoading(false);
    }
  };

  const exportCourseListExcel = () => {
    const targetStudents = filteredStudents || [];
    if (targetStudents.length === 0) {
      alert('No hay alumnos para exportar.');
      return;
    }
    const course = state.courses?.find((c: any) => c.id === selectedCourseId);
    exportStudentsToExcel({
      students: targetStudents,
      courseInfo: course || null,
      centerName: state.center?.name || profile?.school_name || 'Centro Educativo',
      schoolYear: selectedYear
    });
  };

  const handleDelete = async (id: string) => {
    const studentObj = allStudents?.find((s: any) => s.id === id);
    const studentName = studentObj ? `${studentObj.names} ${studentObj.first_surname || ''}`.trim().toUpperCase() : 'ESTE ALUMNO';

    if (!window.confirm(`⚠️ ¿Desea eliminar a ${studentName} permanentemente? Se borrarán todos sus datos académicos y financieros vinculados.`)) return;
    
    const confirmationText = window.prompt(`⚠️ ¡ATENCIÓN! Esta acción es totalmente irreversible.\n\nPara confirmar la eliminación definitiva de ${studentName}, escriba la palabra "ELIMINAR" en el campo de abajo:`);
    
    if (confirmationText !== 'ELIMINAR') {
      alert('Confirmación incorrecta. La eliminación ha sido cancelada.');
      return;
    }

    try {
      await deleteStudent(id);
    } catch (e) {
      alert('Error al eliminar.');
    }
  };

  return (
    <div className="space-y-4 pb-10 animate-fade-in text-left text-text-main">
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-3xl border border-border-main shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg">
            <GraduationCap size={20} />
          </div>
          <div>
            <h1 className="text-lg font-black text-text-main uppercase">Gestión de Alumnos</h1>
            <div className="flex items-center gap-2 mt-1">
              <Calendar size={12} className="text-indigo-500" />
              <span className="text-[9px] font-black text-text-muted uppercase tracking-widest">
                {selectedYear}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-1 max-w-2xl gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Buscar alumno por nombre o apellido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-brand-bg border border-border-main rounded-xl text-[10px] font-black uppercase outline-none focus:border-indigo-500 focus:bg-surface transition-all shadow-inner"
            />
          </div>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="w-48 px-4 py-2.5 bg-brand-bg border border-border-main rounded-xl text-[10px] font-black uppercase outline-none focus:border-indigo-500 focus:bg-surface transition-all shadow-inner cursor-pointer"
          >
            <option value="">TODOS LOS CURSOS</option>
            {sortCourses(state.courses || []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.level} {c.grade} "{c.section}" - {c.tanda || 'Matutina'}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          {selectedCourseId && (
            <button
              onClick={() => setShowBulkImport(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all shadow-xl"
            >
              <FileSpreadsheet size={16} /> Importar Excel
            </button>
          )}
          {selectedCourseId && (
            <button
              onClick={() => setShowBulkPromote(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl"
            >
              <Sparkles size={16} /> Promoción Masiva
            </button>
          )}
          {selectedCourseId && (
            <button
              onClick={autoAssignOrder}
              className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-700 transition-all shadow-xl"
            >
              <Sparkles size={16} /> Auto-Orden
            </button>
          )}
          {selectedCourseId && (
            <button
              onClick={printCourseList}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-indigo-700 transition-all shadow-xl"
            >
              <Printer size={16} /> Imprimir PDF
            </button>
          )}
          <button
            onClick={exportCourseListExcel}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all shadow-xl"
          >
            <Download size={16} /> {selectedCourseId ? 'Listado Excel' : 'Exportar Todos en Excel'}
          </button>

          <button
            onClick={() => {
              setEditingStudent(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-xl"
          >
            <UserPlus size={16} /> Inscribir
          </button>
        </div>
      </div>

      <div className="bg-surface rounded-3xl border border-border-main shadow-xl overflow-hidden mx-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="py-2 px-4 text-[9px] font-black uppercase w-12 text-center border-r border-slate-800">
                #
              </th>
              <th className="py-2 px-4 text-[9px] font-black uppercase">Apellidos y Nombres</th>
              {!selectedCourseId && (
                <th className="py-2 px-4 text-[9px] font-black uppercase w-48">Curso / Sección / Tanda</th>
              )}
              <th className="py-2 px-4 text-[9px] font-black uppercase text-center w-8">S</th>
              <th className="py-2 px-4 text-[9px] font-black uppercase text-center w-36">Vínculo Familiar</th>
              <th className="py-2 px-4 text-right text-[9px] font-black uppercase w-32">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {showLoading ? (
              <tr>
                <td
                  colSpan={selectedCourseId ? 5 : 6}
                  className="py-10 text-center animate-pulse font-black text-slate-300 uppercase text-[9px]"
                >
                  Cargando...
                </td>
              </tr>
            ) : filteredStudents.length === 0 ? (
              <tr>
                <td
                  colSpan={selectedCourseId ? 5 : 6}
                  className="py-10 text-center font-black text-slate-400 uppercase text-[10px]"
                >
                  Sin resultados
                </td>
              </tr>
            ) : (
              filteredStudents.map((s, idx) => (
                <tr key={s.id} className="hover:bg-brand-bg transition-colors">
                  <td className="py-1 px-4 text-center border-r border-border-main">
                    <input
                      type="number"
                      value={s.order_number ?? ''}
                      onChange={(e) => handleOrderChange(s.id, e.target.value)}
                      className="w-12 px-1.5 py-1 bg-white border border-slate-300 rounded-lg text-center font-black text-indigo-700 text-xs outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                      placeholder="#"
                    />
                  </td>
                  <td className="py-1 px-4">
                    <div className="text-[10px] font-black text-text-main uppercase leading-none">
                      {s.first_surname} {s.second_surname || ''}, {s.names}
                    </div>
                  </td>
                  {!selectedCourseId && (
                    <td className="py-1 px-4 text-[10px] font-black text-slate-500 uppercase">
                      {(() => {
                        const c = (state.courses || []).find((course: any) => course.id === s.course_id);
                        return c ? `${c.grade} "${c.section}" - ${c.tanda || 'Matutina'}` : 'Sin curso';
                      })()}
                    </td>
                  )}
                  <td className="py-1 px-4 text-center text-[9px] font-black text-slate-400">
                    {s.sex || '-'}
                  </td>
                  <td className="py-1 px-4 text-center">
                    {(() => {
                      if (!s.family_id) {
                        return <span className="text-[9px] font-black uppercase text-slate-300">Sin Vincular</span>;
                      }
                      const siblingsList = (state.students || []).filter((x) => x.family_id === s.family_id && x.id !== s.id);
                      if (siblingsList.length === 0) {
                        return <span className="text-[9px] font-black uppercase text-slate-400">Hijo Único</span>;
                      }
                      return (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border border-indigo-100 flex items-center gap-1">
                            {siblingsList.length + 1} Hermanos
                          </span>
                          <span className="text-[8px] text-indigo-700 font-bold max-w-[120px] truncate" title={siblingsList.map(x => `${x.names} ${x.first_surname || ''}`).join(', ')}>
                            ({siblingsList.map(x => x.names.split(' ')[0]).join(', ')})
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-1 px-4 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => setPromotingStudent(s)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                        title="Promover / Reinscribir"
                      >
                        <Sparkles size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingStudent(s);
                          setShowForm(true);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          document.querySelectorAll('.overflow-y-auto').forEach((c) => c.scrollTo({ top: 0, behavior: 'smooth' }));
                        }}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Ver Perfil"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        onClick={() => handleDownloadPDF(s)}
                        className="p-1.5 text-slate-600 hover:bg-brand-bg rounded"
                        title="Imprimir Formulario"
                      >
                        <Download size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingStudent(s);
                          setShowForm(true);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                          document.querySelectorAll('.overflow-y-auto').forEach((c) => c.scrollTo({ top: 0, behavior: 'smooth' }));
                        }}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                        title="Editar"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="p-1.5 text-rose-600 hover:bg-rose-50 rounded"
                        title="Eliminar"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:pl-[280px]">
          <div className="bg-surface rounded-2xl shadow-2xl w-[95%] max-w-4xl max-h-[95vh] overflow-y-auto relative">
            <button
              onClick={() => setShowForm(false)}
              className="absolute top-6 right-6 text-text-muted hover:text-text-main font-black uppercase text-[10px]"
            >
              Cerrar
            </button>
            <StudentForm
              initialData={editingStudent}
              onSave={() => {
                setShowForm(false);
              }}
            />
          </div>
        </div>
      )}

      {showBulkImport && selectedCourseId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8 relative">
            <button
              onClick={() => setShowBulkImport(false)}
              className="absolute top-8 right-8 text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] bg-slate-100 px-3 py-1.5 rounded-lg"
            >
              Cerrar
            </button>
            <BulkImport
              gradeId={selectedCourseId}
              selectedYear={selectedYear}
              onComplete={() => {
                setShowBulkImport(false);
              }}
            />
          </div>
        </div>
      )}

      {promotingStudent && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-surface rounded-2xl shadow-2xl w-[95%] max-w-lg p-8 relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setPromotingStudent(null)}
              className="absolute top-6 right-6 text-text-muted hover:text-text-main font-black uppercase text-[10px]"
            >
              Cerrar
            </button>
            <PromoteStudentModal
              student={promotingStudent}
              onClose={() => setPromotingStudent(null)}
              onSuccess={async () => {
                setPromotingStudent(null);
              }}
            />
          </div>
        </div>
      )}

      {showBulkPromote && selectedCourseId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:pl-[280px]">
          <div className="bg-surface rounded-2xl shadow-2xl w-[95%] max-w-2xl max-h-[95vh] overflow-y-auto p-8 relative">
            <button
              onClick={() => setShowBulkPromote(false)}
              className="absolute top-6 right-6 text-text-muted hover:text-text-main font-black uppercase text-[10px]"
            >
              Cerrar
            </button>
            <BulkPromoteModal
              sourceCourseId={selectedCourseId}
              onClose={() => setShowBulkPromote(false)}
              onSuccess={async () => {
                // El listado de alumnos se refresca automáticamente mediante reactividad
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
