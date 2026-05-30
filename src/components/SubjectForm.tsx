import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useSubjects } from '../hooks/useSubjects';
import { Level } from '../types';

export const SubjectForm = () => {
  const {
    subjects: allSubjects,
    isLoading: subjectsLoading,
    addSubject,
    updateSubject,
    deleteSubject
  } = useSubjects();
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    hoursPerWeek: 0,
    level: 'Inicial' as Level,
    isPedagogicalBlock: false,
    distributionType: 'together' as 'together' | 'separated' | 'divided' | 'mixed'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSubjectId) {
        await updateSubject({ id: editingSubjectId, updates: formData });
        alert('¡Materia actualizada exitosamente!');
        setEditingSubjectId(null);
      } else {
        await addSubject(formData);
        alert('¡Materia guardada exitosamente!');
      }
      setFormData({
        name: '',
        hoursPerWeek: 0,
        level: 'Inicial',
        isPedagogicalBlock: false,
        distributionType: 'together'
      });
    } catch (error) {
      alert(editingSubjectId ? 'Error al actualizar la materia.' : 'Error al guardar la materia.');
    }
  };

  const handleEdit = (subject: any) => {
    setEditingSubjectId(subject.id);
    setFormData({
      name: subject.name,
      hoursPerWeek: subject.hoursPerWeek || subject.hours_per_week || 0,
      level: subject.level,
      isPedagogicalBlock: subject.isPedagogicalBlock || subject.is_pedagogical_block || false,
      distributionType: subject.distributionType || subject.distribution_type || 'together'
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (subjectId: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar esta materia?')) {
      try {
        await deleteSubject(subjectId);
      } catch (error) {
        alert('Error al eliminar la materia. Asegúrate de que no tenga asignaciones vinculadas.');
      }
    }
  };

  const inputClass =
    'w-full px-4 py-2.5 rounded-xl border border-border-main bg-brand-bg focus:ring-2 focus:ring-brand-blue outline-none text-sm text-text-main transition-all';
  const labelClass =
    'block text-[10px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1';

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-lg">
      <div>
        <label className={labelClass}>Nombre de la Materia / Bloque</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className={inputClass}
          required
        />
      </div>
      <div>
        <label className={labelClass}>Nivel</label>
        <select
          value={formData.level}
          onChange={(e) => setFormData({ ...formData, level: e.target.value as Level })}
          className={inputClass}
        >
          <option value="Inicial">Inicial</option>
          <option value="Primario">Primario</option>
          <option value="Secundario">Secundario</option>
          <option value="General">General (Todos los niveles)</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Horas por Semana</label>
        <input
          type="number"
          value={formData.hoursPerWeek}
          onChange={(e) => setFormData({ ...formData, hoursPerWeek: parseInt(e.target.value) })}
          className={inputClass}
          required
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={formData.isPedagogicalBlock}
          onChange={(e) => setFormData({ ...formData, isPedagogicalBlock: e.target.checked })}
          className="w-4 h-4 text-brand-blue border-border-main rounded focus:ring-brand-blue"
        />
        <label className="text-[10px] font-black uppercase text-text-muted tracking-widest">
          ¿Es un Bloque Pedagógico (Nivel Inicial)?
        </label>
      </div>
      <div>
        <label className={labelClass}>Tipo de Distribución</label>
        <select
          value={formData.distributionType}
          onChange={(e) => setFormData({ ...formData, distributionType: e.target.value as any })}
          className={inputClass}
        >
          <option value="together">Juntas</option>
          <option value="separated">Separadas</option>
          <option value="divided">Divididas en varios días</option>
          <option value="mixed">Juntas y separadas</option>
        </select>
      </div>
      <div className="flex gap-4">
        <button
          type="submit"
          className="flex-1 bg-brand-blue text-white py-3 px-4 rounded-xl hover:opacity-90 transition-all font-black uppercase text-[10px] tracking-widest shadow-lg shadow-brand-blue/10"
        >
          {editingSubjectId ? 'Actualizar Materia' : 'Guardar Materia / Bloque'}
        </button>
        {editingSubjectId && (
          <button
            type="button"
            onClick={() => {
              setEditingSubjectId(null);
              setFormData({
                name: '',
                hoursPerWeek: 0,
                level: 'Inicial',
                isPedagogicalBlock: false,
                distributionType: 'together'
              });
            }}
            className="flex-1 bg-brand-bg text-text-muted py-3 px-4 rounded-xl border border-border-main hover:bg-surface transition-all font-black uppercase text-[10px] tracking-widest"
          >
            Cancelar
          </button>
        )}
      </div>

      <div className="mt-12 bg-surface rounded-[2.5rem] border border-border-main shadow-xl overflow-hidden">
        <h3 className="text-sm font-black text-text-main uppercase tracking-widest p-6 border-b border-border-main">
          Materias Registradas ({allSubjects.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="py-4 px-6 text-[9px] font-black uppercase tracking-widest">
                  Nombre
                </th>
                <th className="py-4 px-6 text-[9px] font-black uppercase tracking-widest">Nivel</th>
                <th className="py-4 px-6 text-[9px] font-black uppercase tracking-widest">
                  Horas/Sem
                </th>
                <th className="py-4 px-6 text-[9px] font-black uppercase tracking-widest text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {allSubjects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 text-sm">
                    No hay materias registradas aún.
                  </td>
                </tr>
              ) : (
                allSubjects.map((subject: any) => (
                  <tr
                    key={subject.id}
                    className="border-b border-border-main hover:bg-brand-bg transition-colors"
                  >
                    <td className="py-4 px-6 font-bold text-text-main uppercase">{subject.name}</td>
                    <td className="py-4 px-6 text-sm text-text-muted">{subject.level}</td>
                    <td className="py-4 px-6 text-sm font-black text-brand-blue">
                      {subject.hoursPerWeek || subject.hours_per_week} hrs
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-right flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(subject)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Editar materia"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(subject.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar materia"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </form>
  );
};
