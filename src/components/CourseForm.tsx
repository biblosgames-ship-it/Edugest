import React, { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useCourses } from '../hooks/useCourses';
import { Level, Tanda, Cycle, Modality, Output } from '../types';

export const CourseForm = () => {
  const { state } = useApp();
  const {
    courses: allCourses,
    isLoading: coursesLoading,
    addCourse,
    updateCourse,
    deleteCourse
  } = useCourses();
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [isCodeManuallyEdited, setIsCodeManuallyEdited] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    level: 'Inicial' as Level,
    grade: '',
    section: '',
    studentCount: 0,
    tanda: 'Matutina' as Tanda,
    cycle: 'Primer Ciclo' as Cycle,
    modality: 'Académica' as Modality,
    output: 'N/A' as Output
  });

  const handleGradeChange = (val: string) => {
    setFormData((prev) => {
      const newGrade = val;
      const cleanGrade = newGrade.trim().replace(/[^a-zA-Z0-9]/g, '');
      const suggestedCode = isCodeManuallyEdited
        ? prev.code
        : `${cleanGrade}-${prev.section.trim()}`.toUpperCase();
      return { ...prev, grade: newGrade, code: suggestedCode };
    });
  };

  const handleSectionChange = (val: string) => {
    setFormData((prev) => {
      const newSection = val;
      const cleanGrade = prev.grade.trim().replace(/[^a-zA-Z0-9]/g, '');
      const suggestedCode = isCodeManuallyEdited
        ? prev.code
        : `${cleanGrade}-${newSection.trim()}`.toUpperCase();
      return { ...prev, section: newSection, code: suggestedCode };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingCourseId) {
        await updateCourse({ id: editingCourseId, updates: formData });
        alert('¡Curso actualizado exitosamente!');
        setEditingCourseId(null);
      } else {
        await addCourse(formData);
        alert('¡Curso guardado exitosamente!');
      }
      setFormData({
        code: '',
        level: 'Inicial',
        grade: '',
        section: '',
        studentCount: 0,
        tanda: 'Matutina',
        cycle: 'Primer Ciclo',
        modality: 'Académica',
        output: 'N/A'
      });
      setIsCodeManuallyEdited(false);
    } catch (error) {
      alert(editingCourseId ? 'Error al actualizar el curso.' : 'Error al guardar el curso.');
    }
  };

  const handleEdit = (course: any) => {
    setEditingCourseId(course.id);
    setIsCodeManuallyEdited(!!course.code);
    setFormData({
      code: course.code || '',
      level: course.level,
      grade: course.grade,
      section: course.section,
      studentCount: course.studentCount || course.student_count || 0,
      tanda: course.tanda,
      cycle: course.cycle,
      modality: course.modality,
      output: course.output
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (courseId: string) => {
    if (
      window.confirm(
        '¿Estás seguro de que deseas eliminar este curso? Esta acción no se puede deshacer.'
      )
    ) {
      try {
        await deleteCourse(courseId);
      } catch (error) {
        alert('Error al eliminar el curso. Es posible que esté referenciado en otros registros.');
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
        <label className={labelClass}>Nivel</label>
        <select
          value={formData.level}
          onChange={(e) => setFormData({ ...formData, level: e.target.value as Level })}
          className={inputClass}
        >
          <option value="Inicial">Inicial</option>
          <option value="Primario">Primario</option>
          <option value="Secundario">Secundario</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Ciclo</label>
        <select
          value={formData.cycle}
          onChange={(e) => setFormData({ ...formData, cycle: e.target.value as Cycle })}
          className={inputClass}
        >
          <option value="Primer Ciclo">Primer Ciclo</option>
          <option value="Segundo Ciclo">Segundo Ciclo</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Modalidad</label>
        <select
          value={formData.modality}
          onChange={(e) => setFormData({ ...formData, modality: e.target.value as Modality })}
          className={inputClass}
        >
          <option value="Académica">Académica</option>
          <option value="Técnico-Profesional">Técnico-Profesional</option>
          <option value="Artes">Artes</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Salida</label>
        <select
          value={formData.output}
          onChange={(e) => setFormData({ ...formData, output: e.target.value as Output })}
          className={inputClass}
        >
          <option value="N/A">N/A (Inicial/Primario)</option>
          <option value="General">General (1ro-3ro Sec)</option>
          <option value="Ciencias y Tecnología">Ciencias y Tecnología</option>
          <option value="Humanidades y Lenguas Modernas">Humanidades y Lenguas Modernas</option>
          <option value="Ciencias Sociales y Humanidades">Ciencias Sociales y Humanidades</option>
          <option value="Ciencias Económicas y Financieras">
            Ciencias Económicas y Financieras
          </option>
          <option value="Artes">Artes</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Tanda</label>
        <select
          value={formData.tanda}
          onChange={(e) => setFormData({ ...formData, tanda: e.target.value as Tanda })}
          className={inputClass}
        >
          <option value="Matutina">Matutina</option>
          <option value="Vespertina">Vespertina</option>
          <option value="Nocturna">Nocturna</option>
        </select>
      </div>

      <div>
        <label className={labelClass}>Grado</label>
        <input
          type="text"
          value={formData.grade}
          onChange={(e) => handleGradeChange(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div>
        <label className={labelClass}>Sección</label>
        <input
          type="text"
          value={formData.section}
          onChange={(e) => handleSectionChange(e.target.value)}
          className={inputClass}
          required
        />
      </div>
      <div>
        <label className={labelClass}>Cantidad de Estudiantes</label>
        <input
          type="number"
          value={formData.studentCount}
          onChange={(e) =>
            setFormData({ ...formData, studentCount: parseInt(e.target.value) || 0 })
          }
          className={inputClass}
          required
        />
      </div>
      <div className="flex gap-4">
        <button
          type="submit"
          className="flex-1 bg-brand-blue text-white py-3 px-4 rounded-xl hover:opacity-90 transition-all font-black uppercase text-[10px] tracking-widest shadow-lg shadow-brand-blue/10"
        >
          {editingCourseId ? 'Actualizar Curso' : 'Guardar Curso'}
        </button>
        {editingCourseId && (
          <button
            type="button"
            onClick={() => {
              setEditingCourseId(null);
              setIsCodeManuallyEdited(false);
              setFormData({
                code: '',
                level: 'Inicial',
                grade: '',
                section: '',
                studentCount: 0,
                tanda: 'Matutina',
                cycle: 'Primer Ciclo',
                modality: 'Académica',
                output: 'N/A'
              });
            }}
            className="flex-1 bg-brand-bg text-text-muted py-3 px-4 rounded-xl border border-border-main hover:bg-surface transition-all font-black uppercase text-[10px] tracking-widest"
          >
            Cancelar
          </button>
        )}
      </div>

      <div className="mt-12 space-y-8">
        <h3 className="text-sm font-black text-text-main uppercase tracking-widest">
          Cursos Registrados ({allCourses.length})
        </h3>

        <div className="space-y-6">
          {allCourses.length === 0 ? (
            <div className="bg-surface border border-dashed border-border-main rounded-[2rem] p-10 text-center text-text-muted font-bold uppercase text-[10px] tracking-widest">
              No hay cursos registrados aún.
            </div>
          ) : (
            (['Inicial', 'Primario', 'Secundario'] as const).map((lvl) => {
              const levelCourses = allCourses.filter((c: any) => c.level === lvl);
              if (levelCourses.length === 0) return null;

              return (
                <div
                  key={lvl}
                  className="bg-surface rounded-[2rem] border border-border-main overflow-hidden shadow-md"
                >
                  {/* Cabecera del Nivel */}
                  <div className="bg-brand-bg px-6 py-4 border-b border-border-main flex items-center justify-between">
                    <h4 className="text-xs font-black text-text-main uppercase tracking-widest">
                      Nivel {lvl}
                    </h4>
                    <span className="text-[9px] bg-indigo-50 border border-indigo-100 text-indigo-700 font-black px-2.5 py-0.5 rounded-full uppercase">
                      {levelCourses.length} {levelCourses.length === 1 ? 'Curso' : 'Cursos'}
                    </span>
                  </div>

                  {/* Lista de Cursos del Nivel */}
                  <div className="divide-y divide-border-main">
                    {levelCourses.map((course: any) => {
                      const assignedHours = state.assignments
                        .filter((a: any) => a.course_id === course.id)
                        .reduce(
                          (acc: number, a: any) =>
                            acc + (Number(a.hours_per_week || a.hoursPerWeek) || 0),
                          0
                        );
                      const isFull = assignedHours === 25;

                      return (
                        <div
                          key={course.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-brand-bg transition-colors gap-4"
                        >
                          {/* Izquierda: Grado/Sección */}
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs uppercase">
                              {course.section}
                            </div>
                            <div>
                              <span className="text-xs font-black text-text-main uppercase leading-tight">
                                {course.grade}
                              </span>
                              <div className="text-[9px] text-text-muted font-bold uppercase tracking-wider">
                                Tanda: {course.tanda}
                              </div>
                            </div>
                          </div>

                          {/* Derecha: Info y Acciones */}
                          <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                            <div className="flex items-center gap-4 text-[10px] text-text-muted font-bold uppercase">
                              <span>
                                Estudiantes:{' '}
                                <strong className="text-brand-blue">
                                  {course.studentCount || course.student_count || 0}
                                </strong>
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider ${isFull ? 'bg-emerald-500/20 text-emerald-600' : 'bg-amber-500/20 text-amber-600'}`}
                              >
                                {assignedHours} / 25h
                              </span>
                            </div>

                            <div className="flex gap-1 border-l border-border-main pl-4">
                              <button
                                type="button"
                                onClick={() => handleEdit(course)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-brand-bg rounded-xl transition-all"
                                title="Editar curso"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(course.id)}
                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                title="Eliminar curso"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </form>
  );
};
