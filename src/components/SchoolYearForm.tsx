import React, { useState } from 'react';
import { Pencil, Trash2, CheckCircle2, Calendar } from 'lucide-react';
import { useApp, useSupabase } from '../context/AppContext';
import { supabase } from '../lib/supabase';

export const SchoolYearForm = () => {
  const {
    state,
    addSchoolYear,
    updateSchoolYear,
    deleteSchoolYear,
    setSelectedYear,
    refreshData,
    selectedYear
  } = useApp();
  const { profile } = useSupabase();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    start_date: '',
    end_date: '',
    status: 'planificacion' as 'planificacion' | 'activo' | 'cerrado'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateSchoolYear(editingId, formData);
        alert('¡Año escolar actualizado!');
        setEditingId(null);
      } else {
        await addSchoolYear(formData);
        alert('¡Año escolar creado exitosamente!');
      }
      setFormData({ name: '', start_date: '', end_date: '', status: 'planificacion' });
    } catch (error: any) {
      console.error('Error en SchoolYearForm:', error);
      alert(
        'Error al procesar el año escolar: ' +
          (error.message || error.details || 'Error desconocido')
      );
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const scrollContainers = document.querySelectorAll('.overflow-y-auto');
    scrollContainers.forEach((c) => c.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  const handleEdit = (year: any) => {
    setEditingId(year.id);
    setFormData({
      name: year.name,
      start_date: year.start_date || '',
      end_date: year.end_date || '',
      status: year.status || 'planificacion'
    });
    scrollToTop();
  };

  const handleDelete = async (id: string, name: string) => {
    if (name === selectedYear) {
      alert(
        'No se puede eliminar el año escolar que se encuentra seleccionado actualmente como activo.'
      );
      return;
    }

    try {
      // 1. Consultar si existen cursos vinculados a este año escolar
      const { count: courseCount, error: cErr } = await supabase
        .from('courses')
        .select('*', { count: 'exact', head: true })
        .eq('center_id', profile?.center_id)
        .eq('school_year', name);

      if (cErr) throw cErr;
      if (courseCount && courseCount > 0) {
        alert(
          `No se puede eliminar el ciclo ${name} porque tiene ${courseCount} curso(s) registrado(s) en la base de datos. Debe eliminarlos primero.`
        );
        return;
      }

      // 2. Consultar si existen alumnos vinculados a este año escolar
      const { count: studentCount, error: sErr } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('center_id', profile?.center_id)
        .eq('school_year', name);

      if (sErr) throw sErr;
      if (studentCount && studentCount > 0) {
        alert(
          `No se puede eliminar el ciclo ${name} porque tiene ${studentCount} alumno(s) matriculado(s) en él. Debe desvincularlos o eliminarlos primero.`
        );
        return;
      }

      // 3. Confirmación extra escribiendo el nombre del ciclo
      const confirmationText = prompt(
        `⚠️ ¡ATENCIÓN! Esta acción es irreversible.\n\nPara confirmar la eliminación del ciclo "${name}", por favor escribe su nombre exactamente igual abajo:`
      );

      if (confirmationText !== name) {
        if (confirmationText !== null) {
          alert('Confirmación incorrecta. La eliminación ha sido cancelada.');
        }
        return;
      }

      await deleteSchoolYear(id);
      alert('¡Año escolar eliminado con éxito!');
    } catch (error: any) {
      console.error('Error al eliminar año escolar:', error);
      alert('Error al eliminar el año escolar.');
    }
  };

  const handleActivate = async (year: any) => {
    try {
      const centerId = profile?.center_id;
      if (centerId) {
        await supabase
          .from('school_years')
          .update({ status: 'inactivo' })
          .eq('center_id', centerId);
      }
      await updateSchoolYear(year.id, { status: 'activo' });
      setSelectedYear(year.name);
      alert(`Año ${year.name} activado globalmente.`);
    } catch (error) {
      alert('Error al activar año.');
    }
  };

  const handleMigrateData = async (yearName: string) => {
    if (
      !window.confirm(
        `¿Vincular todos los datos del centro (cursos, materias, horarios y candados) al ciclo ${yearName}?`
      )
    )
      return;
    try {
      const centerId = profile?.center_id;

      let qStudents = supabase.from('students').update({ school_year: yearName });
      if (centerId) qStudents = qStudents.eq('center_id', centerId);
      await qStudents.or('school_year.is.null,school_year.eq.""');

      let qCourses = supabase.from('courses').update({ school_year: yearName });
      if (centerId) qCourses = qCourses.eq('center_id', centerId);
      await qCourses.or('school_year.is.null,school_year.eq.""');

      let qSchedule = supabase.from('schedule_entries').update({ school_year: yearName });
      if (centerId) qSchedule = qSchedule.eq('center_id', centerId);
      await qSchedule.or('school_year.is.null,school_year.eq.""');

      alert(`✅ ¡Todos los datos y horarios quedaron vinculados con éxito al ciclo ${yearName}!`);
      await refreshData(undefined, true);
    } catch (error: any) {
      alert('Error al vincular datos: ' + error.message);
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 rounded-xl border border-border-main bg-brand-bg focus:ring-2 focus:ring-brand-blue outline-none text-sm text-text-main transition-all';
  const labelClass =
    'block text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1';

  return (
    <div className="space-y-10">
      <form
        onSubmit={handleSubmit}
        className="space-y-6 max-w-lg bg-white p-8 rounded-[2rem] border border-border-main shadow-xl"
      >
        <div className="flex items-center gap-3 mb-4 text-brand-blue">
          <Calendar size={24} />
          <h2 className="text-lg font-black uppercase tracking-tight">Gestionar Ciclo Escolar</h2>
        </div>

        <div>
          <label className={labelClass}>Nombre del Ciclo (ej: 2025-2026)</label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className={inputClass}
            placeholder="2025-2026"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Fecha Inicio</label>
            <input
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Fecha Fin</label>
            <input
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Estado Inicial</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
            className={inputClass}
          >
            <option value="planificacion">En Planificación</option>
            <option value="activo">Activo</option>
            <option value="cerrado">Cerrado / Histórico</option>
          </select>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            className="flex-1 bg-brand-blue text-white py-4 rounded-2xl hover:opacity-90 transition-all font-black uppercase text-xs tracking-widest shadow-lg shadow-brand-blue/20"
          >
            {editingId ? 'Actualizar Ciclo' : 'Crear Nuevo Ciclo'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setFormData({ name: '', start_date: '', end_date: '', status: 'planificacion' });
              }}
              className="px-6 bg-slate-100 text-slate-500 rounded-2xl font-black uppercase text-xs tracking-widest"
            >
              X
            </button>
          )}
        </div>
      </form>

      <div className="bg-surface rounded-[2.5rem] border border-border-main shadow-2xl overflow-hidden">
        <div className="p-8 border-b border-border-main flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-sm font-black text-text-main uppercase tracking-widest">
              Ciclos Registrados
            </h3>
            <p className="text-[10px] text-text-muted uppercase font-bold mt-1">
              Configuración base del centro
            </p>
          </div>
          <div className="px-4 py-1 bg-brand-blue/10 text-brand-blue rounded-full text-[10px] font-black uppercase tracking-widest">
            {state.schoolYears.length} Años
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="py-5 px-8 text-[9px] font-black uppercase tracking-widest">
                  Nombre del Ciclo
                </th>
                <th className="py-5 px-8 text-[9px] font-black uppercase tracking-widest">
                  Periodo
                </th>
                <th className="py-5 px-8 text-[9px] font-black uppercase tracking-widest text-center">
                  Estado
                </th>
                <th className="py-5 px-8 text-[9px] font-black uppercase tracking-widest text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {state.schoolYears.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-12 text-center text-slate-400 text-sm font-medium italic"
                  >
                    No hay ciclos escolares registrados. Comience creando uno arriba.
                  </td>
                </tr>
              ) : (
                state.schoolYears.map((year: any) => (
                  <tr
                    key={year.id}
                    className={`border-b border-border-main hover:bg-brand-blue/5 transition-colors ${selectedYear === year.name ? 'bg-brand-blue/5' : ''}`}
                  >
                    <td className="py-6 px-8">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-slate-900 tracking-tight text-lg">
                          {year.name}
                        </span>
                        {selectedYear === year.name && (
                          <span className="flex items-center gap-1 bg-emerald-500 text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter">
                            <CheckCircle2 size={10} /> Seleccionado
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-6 px-8">
                      <div className="text-xs font-bold text-slate-500 flex flex-col">
                        <span>Desde: {year.start_date || 'N/A'}</span>
                        <span>Hasta: {year.end_date || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-6 px-8 text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          year.status === 'activo'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : year.status === 'cerrado'
                              ? 'bg-slate-100 text-slate-500 border-slate-200'
                              : 'bg-amber-50 text-amber-600 border-amber-100'
                        }`}
                      >
                        {year.status}
                      </span>
                    </td>
                    <td className="py-6 px-8 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleMigrateData(year.name)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm"
                          title="Vincular cursos, materias, horarios y candados a este ciclo escolar"
                        >
                          <Calendar size={14} className="text-amber-600" />
                          <span>Vincular Datos</span>
                        </button>
                        {selectedYear !== year.name && (
                          <button
                            onClick={() => handleActivate(year)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-xl text-[10px] font-black uppercase transition-all shadow-sm"
                            title="Activar este año"
                          >
                            <CheckCircle2 size={14} />
                            <span>Activar</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleEdit(year)}
                          className="p-2 text-slate-400 hover:text-brand-blue hover:bg-brand-blue/10 rounded-xl transition-all"
                          title="Editar ciclo"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(year.id, year.name)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Eliminar ciclo"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
