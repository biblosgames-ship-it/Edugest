import React, { useState, useEffect } from 'react';
import { Pencil, Trash2, Plus, X, BookOpen, UserPlus } from 'lucide-react';
import { useApp, useSupabase } from '../context/AppContext';
import { useTeachers } from '../hooks/useTeachers';
import { useCourses } from '../hooks/useCourses';
import { useSubjects } from '../hooks/useSubjects';
import { useAssignments } from '../hooks/useAssignments';
import { supabase } from '../lib/supabase';

export const TeacherForm = () => {
  const { state } = useApp();
  const {
    teachers: allPersonnel,
    isLoading: teachersLoading,
    addTeacher,
    updateTeacher,
    deleteTeacher
  } = useTeachers();
  const { courses } = useCourses();
  const { subjects } = useSubjects();
  const { assignments: allAssignments, saveAssignments } = useAssignments();
  const { profile } = useSupabase();
  const [loading, setLoading] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    hoursAvailable: 0,
    area: ''
  });

  const [pendingAssignments, setPendingAssignments] = useState<any[]>([]);
  const [currentBuilder, setCurrentBuilder] = useState({
    courseId: '',
    subjectId: '',
    hours: 0
  });
  const [courseFilterLevel, setCourseFilterLevel] = useState('Todos');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const levels = ['Todos', 'Inicial', 'Primario', 'Secundario'];

  // FILTRO CRÍTICO: Solo mostrar personal cuyo rol sea 'teacher', 'docente', 'Maestro' o 'management_teacher'
  const actualTeachers = (allPersonnel || []).filter(
    (t: any) =>
      t.role === 'teacher' ||
      t.role === 'docente' ||
      t.role === 'Maestro' ||
      t.role === 'management_teacher'
  );

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const scrollContainers = document.querySelectorAll('.overflow-y-auto');
    scrollContainers.forEach((c) => c.scrollTo({ top: 0, behavior: 'smooth' }));
  };

  const handleEdit = (teacher: any) => {
    setEditingTeacherId(teacher.id);
    setFormData({
      name: teacher.full_name || teacher.name || '',
      hoursAvailable: teacher.hoursAvailable || teacher.hours_available || 0,
      area: teacher.area || ''
    });
    const existing = (allAssignments || []).filter(
      (a) => (a.teacher_id || a.teacherId) === teacher.id
    );
    setPendingAssignments(
      existing.map((a) => ({
        courseId: a.course_id || a.courseId,
        subjectId: a.subject_id || a.subjectId,
        hoursPerWeek: a.hours_per_week || a.hoursPerWeek
      }))
    );
    scrollToTop();
  };

  const handleAddPending = () => {
    if (!currentBuilder.courseId || !currentBuilder.subjectId || !currentBuilder.hours) return;

    if (editingIdx !== null) {
      const updated = [...pendingAssignments];
      updated[editingIdx] = { ...currentBuilder, hoursPerWeek: currentBuilder.hours };
      setPendingAssignments(updated);
      setEditingIdx(null);
    } else {
      setPendingAssignments([
        ...pendingAssignments,
        { ...currentBuilder, hoursPerWeek: currentBuilder.hours }
      ]);
    }
    setCurrentBuilder({ courseId: '', subjectId: '', hours: 0 });
  };

  const handleEditPending = (idx: number) => {
    const a = pendingAssignments[idx];
    setCurrentBuilder({
      courseId: a.courseId,
      subjectId: a.subjectId,
      hours: a.hoursPerWeek
    });
    setEditingIdx(idx);
    scrollToTop();
  };

  // PERSISTENCIA DE BORRADOR
  useEffect(() => {
    const draft = localStorage.getItem('teacher_form_draft');
    if (draft) {
      try {
        const {
          formData: dForm,
          pendingAssignments: dPending,
          editingTeacherId: dId
        } = JSON.parse(draft);
        setFormData(dForm);
        setPendingAssignments(dPending);
        setEditingTeacherId(dId);
      } catch (e) {
        console.error('Error al recuperar borrador:', e);
      }
    }
  }, []);

  useEffect(() => {
    if (formData.name || pendingAssignments.length > 0) {
      localStorage.setItem(
        'teacher_form_draft',
        JSON.stringify({
          formData,
          pendingAssignments,
          editingTeacherId
        })
      );
    }
  }, [formData, pendingAssignments, editingTeacherId]);

  const clearDraft = () => localStorage.removeItem('teacher_form_draft');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let teacherId = editingTeacherId;

      // 1. Guardar en STAFF (Datos Generales)
      const existingUser = editingTeacherId
        ? (allPersonnel || []).find((p: any) => p.id === editingTeacherId)
        : null;

      const staffData = {
        full_name: formData.name,
        name: formData.name,
        role: existingUser?.role || 'teacher',
        team: existingUser?.team || 'teacher',
        sex: existingUser?.sex || 'M',
        phone: existingUser?.phone || '',
        center_id: profile?.center_id || '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1'
      };

      if (editingTeacherId) {
        await updateTeacher({ id: editingTeacherId, updates: staffData });
      } else {
        const result = await addTeacher(staffData);
        teacherId = result.id;
      }

      if (teacherId) {
        // 2. Guardar en TEACHERS (Datos Académicos y de Asignación)
        const { error: teacherTableError } = await supabase.from('teachers').upsert({
          id: teacherId,
          center_id: profile?.center_id || '29bd105f-af7f-48b1-a9e9-a76ddf1e9ab1',
          area: formData.area,
          hours_available: formData.hoursAvailable || 40,
          name: formData.name
        });

        if (teacherTableError) console.error('Error en tabla teachers:', teacherTableError);

        // 3. Gestionar Asignaciones
        const finalAssignments = pendingAssignments.map((a) => ({
          course_id: a.courseId,
          subject_id: a.subjectId,
          hours_per_week: a.hoursPerWeek
        }));

        await saveAssignments({ teacherId, assignments: finalAssignments });
      }

      alert('¡Datos guardados correctamente!');
      clearDraft();
      setEditingTeacherId(null);
      setFormData({ name: '', hoursAvailable: 0, area: '' });
      setPendingAssignments([]);
    } catch (error: any) {
      console.error('Error en handleSubmit:', error);
      alert('Error al guardar: ' + (error.message || 'Verifique los datos e intente de nuevo'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full p-2 animate-fade-in text-text-main">
      <form
        onSubmit={handleSubmit}
        className="bg-surface p-6 rounded-[2rem] border border-border-main shadow-xl space-y-6"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-black text-text-main uppercase tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-blue rounded-xl flex items-center justify-center text-white shadow-lg shadow-brand-blue/20">
              <UserPlus size={20} />
            </div>
            {editingTeacherId ? 'Editar Perfil' : 'Registro de Docente'}
          </h3>
          {editingTeacherId && (
            <button
              type="button"
              onClick={() => {
                setEditingTeacherId(null);
                setFormData({ name: '', area: '', hoursAvailable: 0 });
                setPendingAssignments([]);
                clearDraft();
              }}
              className="text-[10px] font-black text-rose-500 uppercase tracking-widest hover:underline"
            >
              Cancelar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <input
            placeholder="Nombre completo"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="px-4 py-2.5 rounded-xl border border-border-main bg-brand-bg focus:ring-2 focus:ring-brand-blue outline-none text-sm text-text-main"
            required
          />
          <input
            placeholder="Área académica"
            value={formData.area}
            onChange={(e) => setFormData({ ...formData, area: e.target.value })}
            className="px-4 py-2.5 rounded-xl border border-border-main bg-brand-bg focus:ring-2 focus:ring-brand-blue outline-none text-sm text-text-main"
          />
          <input
            type="number"
            placeholder="Horas disponibles"
            value={formData.hoursAvailable || ''}
            onChange={(e) => setFormData({ ...formData, hoursAvailable: parseInt(e.target.value) })}
            className="px-4 py-2.5 rounded-xl border border-border-main bg-brand-bg focus:ring-2 focus:ring-brand-blue outline-none text-sm text-text-main"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 bg-brand-blue text-white rounded-2xl font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-xl shadow-brand-blue/10"
        >
          {loading
            ? '...'
            : editingTeacherId
              ? 'Actualizar Perfil y Carga'
              : 'Guardar Docente y Carga'}
        </button>

        <div className="pt-6 border-t border-border-main">
          <h4 className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
            <BookOpen size={14} className="text-brand-blue" /> Constructor de Carga Académica
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-brand-bg/50 p-6 rounded-2xl border border-border-main/50">
            <div>
              <label className="block text-[9px] font-black text-text-muted uppercase mb-2 ml-1">
                Filtrar Nivel
              </label>
              <div className="flex gap-1 bg-surface p-1 rounded-xl mb-3 border border-border-main/50">
                {levels.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setCourseFilterLevel(lvl)}
                    className={`flex-1 py-1 rounded-lg text-[8px] font-black uppercase transition-all ${courseFilterLevel === lvl ? 'bg-brand-blue text-white shadow-sm' : 'text-slate-400'}`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <label className="block text-[9px] font-black text-text-muted uppercase mb-2 ml-1">
                Grado / Curso
              </label>
              <select
                value={currentBuilder.courseId}
                onChange={(e) => setCurrentBuilder({ ...currentBuilder, courseId: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-border-main bg-surface focus:ring-2 focus:ring-brand-blue outline-none text-[10px] font-bold"
              >
                <option value="">Seleccionar...</option>
                {courses
                  .filter(
                    (c) =>
                      courseFilterLevel === 'Todos' ||
                      (c.level && c.level.includes(courseFilterLevel))
                  )
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.grade} {c.section} ({c.level} - {c.tanda})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-black text-text-muted uppercase mb-2 ml-1">
                Materia
              </label>
              <select
                value={currentBuilder.subjectId}
                onChange={(e) =>
                  setCurrentBuilder({ ...currentBuilder, subjectId: e.target.value })
                }
                className="w-full px-4 py-2.5 rounded-xl border border-border-main bg-surface focus:ring-2 focus:ring-brand-blue outline-none text-[10px] font-bold"
              >
                <option value="">Seleccionar...</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.level})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-black text-text-muted uppercase mb-2 ml-1">
                Horas Semanales
              </label>
              <input
                type="number"
                value={currentBuilder.hours || ''}
                onChange={(e) =>
                  setCurrentBuilder({ ...currentBuilder, hours: parseInt(e.target.value) })
                }
                className="w-full px-4 py-2.5 rounded-xl border border-border-main bg-surface focus:ring-2 focus:ring-brand-blue outline-none text-[10px] font-bold"
                placeholder="0"
              />
            </div>
            <button
              type="button"
              onClick={handleAddPending}
              className={`py-2.5 rounded-xl font-black uppercase text-[9px] tracking-widest transition-all flex items-center justify-center gap-2 ${editingIdx !== null ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-slate-900 hover:bg-black text-white'}`}
            >
              {editingIdx !== null ? <Pencil size={16} /> : <Plus size={16} />}
              {editingIdx !== null ? 'Actualizar Materia' : 'Añadir a Carga'}
            </button>
            {editingIdx !== null && (
              <button
                type="button"
                onClick={() => {
                  setEditingIdx(null);
                  setCurrentBuilder({ courseId: '', subjectId: '', hours: 0 });
                }}
                className="py-2.5 bg-slate-100 text-slate-500 rounded-xl font-bold uppercase text-[9px] hover:bg-slate-200 transition-all"
              >
                Cancelar Edición
              </button>
            )}
          </div>

          {pendingAssignments.length > 0 && (
            <div className="mt-6 space-y-2">
              <p className="text-[9px] font-black text-text-muted uppercase ml-1">
                Previsualización de Carga:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pendingAssignments.map((a, idx) => {
                  const c = courses.find((x) => x.id === a.courseId);
                  const s = subjects.find((x) => x.id === a.subjectId);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-white border border-border-main p-3 rounded-xl shadow-sm group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 text-[10px] font-bold">
                          {a.hoursPerWeek}h
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-text-main uppercase">
                            {s?.name}
                          </p>
                          <p className="text-[8px] font-bold text-text-muted uppercase">
                            {c?.grade} {c?.section} • {c?.level} - {c?.tanda || 'Matutina'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <button
                          type="button"
                          onClick={() => handleEditPending(idx)}
                          className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setPendingAssignments(pendingAssignments.filter((_, i) => i !== idx))
                          }
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </form>

      <div className="bg-surface rounded-[2rem] border border-border-main shadow-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest w-1/4">
                Docente
              </th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest">
                Carga Académica
              </th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-center">
                M. Asig
              </th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-center">
                M. Disp
              </th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-center">
                V. Asig
              </th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-center">
                V. Disp
              </th>
              <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-right">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-main">
            {actualTeachers.map((t: any) => {
              const teacherAssignments = (allAssignments || []).filter((a) => {
                const belongsToTeacher = (a.teacher_id || a.teacherId) === t.id;
                const courseExists = (courses || []).some(
                  (c: any) => c.id === (a.courseId || a.course_id)
                );
                const subjectExists = (subjects || []).some(
                  (s: any) => s.id === (a.subjectId || a.subject_id)
                );
                return belongsToTeacher && courseExists && subjectExists;
              });

              // 1. Horas Asignadas por Tanda (Manejo flexible de nombres de propiedades)
              const getHours = (a: any) => Number(a.hours_per_week || a.hoursPerWeek || 0);
              const getShift = (a: any) => {
                const c = (courses || []).find((x: any) => x.id === (a.courseId || a.course_id));
                const s = String(
                  c?.tanda || a.shift || a.tanda || a.shift_name || ''
                ).toLowerCase();
                if (s.includes('mat') || s.includes('mañana')) return 'Matutina';
                if (s.includes('ves') || s.includes('tarde')) return 'Vespertina';
                return 'Matutina'; // Por defecto Matutina si no se especifica
              };

              const assignedM = teacherAssignments
                .filter((a) => getShift(a) === 'Matutina')
                .reduce((acc, a) => acc + getHours(a), 0);
              const assignedV = teacherAssignments
                .filter((a) => getShift(a) === 'Vespertina')
                .reduce((acc, a) => acc + getHours(a), 0);

              // 2. Límites por Tanda (Sincronizado con Preferencias)
              const pref = (state.teacherPreferences || []).find((p: any) => p.teacherId === t.id);

              const calculatePedagogicalHours = (shift: 'morning' | 'afternoon') => {
                if (!pref) return 25; // Si no hay preferencia, estándar de 25h

                let totalPeriods = 0;
                const days =
                  (pref.workingDays || []).length > 0
                    ? pref.workingDays
                    : ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
                const periodDuration = 45;

                days.forEach((day: string) => {
                  const config = pref.dailyConfig?.[day] || {};
                  const start =
                    shift === 'morning'
                      ? config.mStart || pref.morningStart || '08:00'
                      : config.aStart || pref.afternoonStart || '14:00';
                  const end =
                    shift === 'morning'
                      ? config.mEnd || pref.morningEnd || '12:00'
                      : config.aEnd || pref.afternoonEnd || '18:00';

                  if (start && end && start !== end) {
                    const [h1, m1] = start.split(':').map(Number);
                    const [h2, m2] = end.split(':').map(Number);
                    const diff = h2 * 60 + m2 - (h1 * 60 + m1);

                    if (diff > 0) {
                      // Calculamos periodos de ese día y limitamos a un máximo de 5 por día
                      const dailyPeriods = Math.floor(diff / periodDuration);
                      totalPeriods += Math.min(5, dailyPeriods);
                    }
                  }
                });

                return totalPeriods || (shift === 'morning' ? days.length * 5 : 0);
              };

              const limitM = calculatePedagogicalHours('morning');
              const limitV = calculatePedagogicalHours('afternoon');

              const balanceM = limitM - assignedM;
              const balanceV = limitV - assignedV;
              const workingDaysCount = pref?.workingDays?.length || 5;

              const name = t.full_name || t.name || 'Sin Nombre';

              return (
                <tr key={t.id} className="hover:bg-brand-bg transition-colors group">
                  <td className="px-6 py-3">
                    <div className="font-bold text-text-main text-sm uppercase">{name}</div>
                    <div className="text-[9px] font-black text-brand-blue uppercase tracking-widest">
                      {t.area || 'Docencia'}
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {teacherAssignments.length > 0 ? (
                        teacherAssignments.map((a, idx) => {
                          const c = (courses || []).find(
                            (x: any) => x.id === (a.courseId || a.course_id)
                          );
                          const s = (subjects || []).find(
                            (x: any) => x.id === (a.subjectId || a.subject_id)
                          );
                          const tanda =
                            c?.tanda || a.shift || a.tanda || a.shift_name || 'Matutina';
                          const isVespertina = String(tanda).toLowerCase() === 'vespertina';
                          return (
                            <span
                              key={idx}
                              className={`text-[9px] font-bold border px-2 py-0.5 rounded ${isVespertina ? 'bg-orange-50 border-orange-100 text-orange-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}
                            >
                              {c?.grade}
                              {c?.section} {isVespertina ? '(V)' : '(M)'} • {s?.name} (
                              {a.hours_per_week || a.hoursPerWeek || 0}h)
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-[9px] font-bold text-text-muted/30 uppercase italic">
                          Sin carga
                        </span>
                      )}
                    </div>
                  </td>
                  {/* M. ASIG */}
                  <td
                    className={`px-6 py-3 text-center font-black text-xs ${assignedM > limitM ? 'text-rose-600' : 'text-slate-700'}`}
                  >
                    {assignedM}h
                  </td>
                  {/* M. DISP */}
                  <td className="px-6 py-3 text-center font-bold text-xs text-indigo-600 bg-indigo-50/30">
                    {limitM}h
                  </td>
                  {/* V. ASIG */}
                  <td
                    className={`px-6 py-3 text-center font-black text-xs ${assignedV > limitV ? 'text-rose-600' : 'text-slate-700'}`}
                  >
                    {assignedV}h
                  </td>
                  {/* V. DISP */}
                  <td className="px-6 py-3 text-center font-bold text-xs text-orange-600 bg-orange-50/30">
                    {limitV}h
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => handleEdit(t)}
                        className="p-2 text-slate-400 hover:text-indigo-600 transition-all rounded-lg hover:bg-indigo-50"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('¿Eliminar?')) deleteTeacher(t.id);
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 transition-all rounded-lg hover:bg-rose-50"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
