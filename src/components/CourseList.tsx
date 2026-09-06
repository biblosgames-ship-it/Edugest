import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, BookOpen, Users, Pencil, Trash2, X, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';

export const CourseList = () => {
  const { state, addCourse, updateCourse, deleteCourse } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    grade: '',
    section: '',
    level: 'Primario',
    tanda: 'Matutina',
    student_count: 0
  });

  const courses = state.courses || [];

  const handleOpenCreate = () => {
    setEditingCourse(null);
    setFormData({
      grade: '',
      section: '',
      level: 'Primario',
      tanda: 'Matutina',
      student_count: 0
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (course: any) => {
    setEditingCourse(course);
    setFormData({
      grade: course.grade || '',
      section: course.section || '',
      level: course.level || 'Primario',
      tanda: course.tanda || 'Matutina',
      student_count: course.student_count || course.studentCount || 0
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.grade.trim() || !formData.section.trim()) {
      return toast.error('Grado y sección son obligatorios');
    }

    setSaving(true);
    try {
      if (editingCourse) {
        await updateCourse(editingCourse.id, {
          grade: formData.grade.trim(),
          section: formData.section.trim().toUpperCase(),
          level: formData.level,
          tanda: formData.tanda,
          student_count: Number(formData.student_count) || 0
        });
        toast.success('Curso actualizado correctamente');
      } else {
        await addCourse({
          grade: formData.grade.trim(),
          section: formData.section.trim().toUpperCase(),
          level: formData.level,
          tanda: formData.tanda,
          student_count: Number(formData.student_count) || 0
        });
        toast.success('Curso creado exitosamente');
      }
      setIsModalOpen(false);
      setEditingCourse(null);
    } catch (err: any) {
      console.error('Error guardando curso:', err);
      toast.error('Error al guardar el curso: ' + (err.message || 'Error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (course: any) => {
    const courseName = `${course.grade} "${course.section}"`;
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el curso ${courseName}? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      await deleteCourse(course.id);
      toast.success(`Curso ${courseName} eliminado`);
    } catch (err: any) {
      console.error('Error eliminando curso:', err);
      toast.error('Error al eliminar curso: ' + (err.message || 'Error desconocido'));
    }
  };

  return (
    <div className="space-y-4 animate-fade-in pb-10">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-slate-900 uppercase">Cursos y Secciones</h2>
        <button
          onClick={handleOpenCreate}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-black uppercase text-[10px] shadow-lg hover:bg-indigo-700 transition-colors cursor-pointer"
        >
          <Plus size={14} /> Nuevo Curso
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {courses.map((course) => (
          <div
            key={course.id}
            className="bg-white p-4 rounded-2xl border border-slate-100 shadow-lg hover:shadow-xl transition-all group relative"
          >
            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button
                onClick={() => handleOpenEdit(course)}
                title="Editar curso"
                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
              >
                <Pencil size={14} />
              </button>
              <button
                onClick={() => handleDelete(course)}
                title="Eliminar curso"
                className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <div className="bg-slate-50 w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 mb-3">
              <BookOpen size={18} />
            </div>

            <h3 className="text-sm font-black text-slate-900 uppercase leading-tight">
              {course.grade} "{course.section}"
            </h3>
            <p className="text-[8px] font-black uppercase tracking-widest text-indigo-500 mb-3">
              {course.level}
            </p>

            <div className="flex items-center justify-between pt-3 border-t border-slate-50">
              <div className="flex items-center gap-1.5">
                <Users size={12} className="text-slate-300" />
                <span className="text-[9px] font-bold text-slate-600 uppercase">
                  {course.student_count || course.studentCount || 0} Est.
                </span>
              </div>
              <div className="text-[8px] font-black text-slate-400 uppercase bg-slate-50 px-2 py-0.5 rounded-md">
                {course.tanda}
              </div>
            </div>
          </div>
        ))}
      </div>

      {courses.length === 0 && (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-10 text-center">
          <p className="text-slate-300 font-black uppercase text-[10px] tracking-widest">
            No hay cursos registrados
          </p>
        </div>
      )}

      {/* MODAL CREAR / EDITAR */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                  {editingCourse ? <Pencil size={18} /> : <Plus size={18} />}
                </div>
                <div>
                  <h3 className="text-base font-black uppercase text-slate-900">
                    {editingCourse ? 'Editar Curso' : 'Nuevo Curso'}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {editingCourse ? `${editingCourse.grade} "${editingCourse.section}"` : 'Completa los datos del grado'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Grado *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. 1ro, 2do..."
                    value={formData.grade}
                    onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Sección *
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={3}
                    placeholder="Ej. A, B, C"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Nivel Educativo
                </label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Inicial">Inicial</option>
                  <option value="Primario">Primario</option>
                  <option value="Secundario">Secundario</option>
                  <option value="Politécnico">Politécnico</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Tanda
                  </label>
                  <select
                    value={formData.tanda}
                    onChange={(e) => setFormData({ ...formData, tanda: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Matutina">Matutina</option>
                    <option value="Vespertina">Vespertina</option>
                    <option value="Jornada Extendida">Jornada Extendida</option>
                    <option value="Nocturna">Nocturna</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
                    Capacidad Estimada
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formData.student_count}
                    onChange={(e) => setFormData({ ...formData, student_count: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white text-xs font-black uppercase tracking-wider rounded-xl hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50 cursor-pointer"
                >
                  <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
