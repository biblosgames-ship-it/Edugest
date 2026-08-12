import React, { useState } from 'react';
import { Pencil, Trash2, Link } from 'lucide-react';
import { useAssignments } from '../hooks/useAssignments';
import { useCourses } from '../hooks/useCourses';
import { useSubjects } from '../hooks/useSubjects';
import { useTeachers } from '../hooks/useTeachers';

export const AssignmentForm = () => {
  const { assignments, addAssignment, updateAssignment, deleteAssignment } = useAssignments();
  const { courses: allCourses } = useCourses();
  const { subjects: allSubjects } = useSubjects();
  const { teachers: allTeachers } = useTeachers();
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    courseId: '',
    subjectId: '',
    teacherId: '',
    hoursPerWeek: 0
  });
  const [filterLevel, setFilterLevel] = useState('Todos');
  const levels = ['Todos', 'Inicial', 'Primario', 'Secundario'];
  const [loading, setLoading] = useState(false);

  const filteredCourses = (allCourses || []).filter(
    (c) => filterLevel === 'Todos' || (c.level && c.level.includes(filterLevel))
  );

  const selectedCourse = (allCourses || []).find((c) => c.id === formData.courseId);
  const filteredSubjects = selectedCourse
    ? (allSubjects || []).filter((s) => s.level === selectedCourse.level || s.level === 'General')
    : allSubjects || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      if (editingAssignmentId) {
        await updateAssignment({ id: editingAssignmentId, updates: formData });
        alert('¡Asignación actualizada exitosamente!');
        setEditingAssignmentId(null);
      } else {
        // Verificar duplicados
        const exists = (assignments || []).some(
          (a) =>
            (a.courseId || (a as any).course_id) === formData.courseId &&
            (a.subjectId || (a as any).subject_id) === formData.subjectId &&
            (a.teacherId || (a as any).teacher_id) === formData.teacherId
        );

        if (exists) {
          throw new Error('Esta asignación exacta ya existe para este docente en este curso.');
        }

        await addAssignment(formData);
        alert('¡Asignación guardada exitosamente!');
      }
      setFormData({ ...formData, subjectId: '', hoursPerWeek: 0 });
    } catch (error: any) {
      console.error('Error en asignación:', error);
      alert(`Error: ${error.message || 'No se pudo procesar la asignación.'}`);
    } finally {
      setLoading(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const scrollContainers = document.querySelectorAll('.overflow-y-auto');
    scrollContainers.forEach((c) => c.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  const handleEdit = (assignment: any) => {
    setEditingAssignmentId(assignment.id);
    setFormData({
      courseId: assignment.courseId || (assignment as any).course_id,
      subjectId: assignment.subjectId || (assignment as any).subject_id,
      teacherId: assignment.teacherId || (assignment as any).teacher_id,
      hoursPerWeek: assignment.hoursPerWeek || (assignment as any).hours_per_week || 0
    });
    scrollToTop();
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Eliminar esta asignación?')) {
      try {
        await deleteAssignment(id);
      } catch (e) {
        alert('Error al eliminar.');
      }
    }
  };

  const handleSubjectChange = (subjectId: string) => {
    const subject = (allSubjects || []).find((s) => s.id === subjectId);
    setFormData({
      ...formData,
      subjectId,
      hoursPerWeek: subject ? subject.hoursPerWeek || (subject as any).hours_per_week || 0 : 0
    });
  };

  const inputClass =
    'w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 transition-all bg-white shadow-sm text-slate-800';
  const labelClass = 'block text-xs font-black text-slate-400 uppercase tracking-widest mb-2';

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-3xl border border-slate-100 shadow-xl space-y-8"
      >
        <div className="flex items-center gap-4 border-b border-slate-100 pb-6">
          <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Link className="text-white" size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">
              {editingAssignmentId ? 'Modificar Asignación' : 'Crear Nueva Asignación'}
            </h3>
            <p className="text-sm text-slate-500">
              Vincula docentes con sus materias y cursos correspondientes.
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <label className={labelClass}>1. Filtrar por Nivel y Curso</label>
            <div className="flex gap-1 bg-slate-50 p-1 rounded-xl mb-3">
              {levels.map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setFilterLevel(lvl)}
                  className={`flex-1 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${filterLevel === lvl ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <select
              value={formData.courseId}
              onChange={(e) => setFormData({ ...formData, courseId: e.target.value })}
              className={inputClass}
              required
            >
              <option value="">Elegir curso...</option>
              {filteredCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.level} {c.grade}
                  {c.section} ({c.tanda || 'Sin Tanda'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>2. Seleccionar Materia</label>
            <select
              value={formData.subjectId}
              onChange={(e) => handleSubjectChange(e.target.value)}
              className={inputClass}
              required
              disabled={!formData.courseId}
            >
              <option value="">Elegir materia...</option>
              {filteredSubjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {!formData.courseId && (
              <p className="text-[10px] text-slate-400 mt-1 italic">
                Primero selecciona un curso para filtrar materias.
              </p>
            )}
          </div>

          <div>
            <label className={labelClass}>3. Asignar Docente</label>
            <select
              value={formData.teacherId}
              onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
              className={inputClass}
              required
            >
              <option value="">Elegir docente...</option>
              {(allTeachers || []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>4. Horas Semanales</label>
            <input
              type="number"
              value={formData.hoursPerWeek}
              onChange={(e) =>
                setFormData({ ...formData, hoursPerWeek: parseInt(e.target.value) || 0 })
              }
              className={inputClass}
              required
              min="1"
            />
          </div>
        </div>

        <div className="flex gap-4 pt-4">
          <button
            type="submit"
            disabled={loading}
            className={`flex-1 py-4 rounded-2xl font-black text-lg uppercase tracking-widest transition-all shadow-lg ${loading ? 'bg-slate-200 cursor-wait' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100'}`}
          >
            {loading
              ? 'Procesando...'
              : editingAssignmentId
                ? 'Actualizar Cambios'
                : 'Asignar Ahora'}
          </button>

          {editingAssignmentId && (
            <button
              type="button"
              onClick={() => {
                setEditingAssignmentId(null);
                setFormData({ courseId: '', subjectId: '', teacherId: '', hoursPerWeek: 0 });
              }}
              className="px-8 bg-slate-100 text-slate-500 rounded-2xl font-bold hover:bg-slate-200 transition-all uppercase text-xs"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>

      <div className="space-y-6">
        <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
          Asignaciones Registradas
          <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-1 rounded-full">
            {(assignments || []).length}
          </span>
        </h3>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Curso / Materia
                </th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Docente Asignado
                </th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Horas
                </th>
                <th className="p-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {(assignments || []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-20 text-center text-slate-300 italic">
                    No hay asignaciones registradas todavía.
                  </td>
                </tr>
              ) : (
                (assignments || []).map((a: any) => {
                  const course = (allCourses || []).find(
                    (c) => c.id === (a.courseId || (a as any).course_id)
                  );
                  const subject = (allSubjects || []).find(
                    (s) => s.id === (a.subjectId || (a as any).subject_id)
                  );
                  const teacher = (allTeachers || []).find(
                    (t) => t.id === (a.teacherId || (a as any).teacher_id)
                  );
                  return (
                    <tr key={a.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="p-5">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter mb-1">
                            {course
                              ? `${course.level} ${course.grade}${course.section} (${course.tanda || 'Sin Tanda'})`
                              : 'CURSO ?'}
                          </span>
                          <span className="font-bold text-slate-800">
                            {subject ? subject.name : 'MATERIA ?'}
                          </span>
                        </div>
                      </td>
                      <td className="p-5">
                        <span className="text-sm font-medium text-slate-600">
                          {teacher ? teacher.name : 'SIN DOCENTE'}
                        </span>
                      </td>
                      <td className="p-5">
                        <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-black text-slate-500">
                          {a.hoursPerWeek || (a as any).hours_per_week}h
                        </span>
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(a)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          >
                            <Pencil size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(a.id)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
