import React, { useState, useEffect } from 'react';
import { X, UserPlus, School, Check, AlertCircle, Trash2, Search, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { dataService } from '../services/dataService';
import { useApp } from '../context/AppContext';
import { toast } from 'react-hot-toast';

import { getStudentsForInvitation } from '../services/userService';

interface LinkChildModalProps {
  userData: any;
  isOpen: boolean;
  onClose: () => void;
}

export const LinkChildModal: React.FC<LinkChildModalProps> = ({
  userData: profile,
  isOpen,
  onClose
}) => {
  const { selectedYear } = useApp();
  const [courseCode, setCourseCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [parentCourseIds, setParentCourseIds] = useState<string[]>(() => {
    try {
      const local = localStorage.getItem('parent_course_ids');
      const localList = local ? JSON.parse(local) : null;
      return profile?.parent_course_ids || localList || [];
    } catch {
      return profile?.parent_course_ids || [];
    }
  });
  const [selectedCenterCourseId, setSelectedCenterCourseId] = useState('');

  // Estados para el paso 2: Selección del alumno
  const [targetCourse, setTargetCourse] = useState<any | null>(null);
  const [courseStudents, setCourseStudents] = useState<any[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [manualStudentName, setManualStudentName] = useState('');

  // Cargar cursos del centro educativo para vinculación rápida con un clic
  useEffect(() => {
    const fetchCourses = async () => {
      if (!profile?.center_id) return;
      try {
        const data = await dataService.getCourses(
          profile.center_id,
          selectedYear || '2026-2027'
        );
        setAllCourses(data || []);
      } catch (err) {
        console.error('Error loading courses for link modal:', err);
      }
    };

    if (isOpen) {
      fetchCourses();
    } else {
      // Limpiar estados al cerrar
      setTargetCourse(null);
      setCourseStudents([]);
      setSelectedStudentId('');
      setManualStudentName('');
      setCourseCode('');
      setSelectedCenterCourseId('');
    }
  }, [isOpen, profile?.center_id, selectedYear]);

  if (!isOpen) return null;

  // Cargar los alumnos del curso seleccionado
  const loadStudentsForCourse = async (courseObj: any, codeUsed?: string) => {
    setIsLoadingStudents(true);
    setCourseStudents([]);
    setSelectedStudentId('');
    setManualStudentName('');

    try {
      let list = await getStudentsForInvitation(
        codeUsed || courseObj.code || '',
        courseObj.id,
        courseObj.center_id || profile?.center_id
      );

      // Fallback directo si RPC no trajo resultados
      if (!list || list.length === 0) {
        const { data: directStudents } = await supabase
          .from('students')
          .select('*')
          .eq('course_id', courseObj.id);
        if (directStudents && directStudents.length > 0) {
          list = directStudents;
        }
      }

      const activeStudents = (list || []).filter((s: any) => {
        const status = (s.status || '').toLowerCase().trim();
        return status !== 'retirado' && status !== 'inactivo' && status !== 'expulsado';
      });

      activeStudents.sort((a: any, b: any) => {
        const orderA = a.order_number ?? 999;
        const orderB = b.order_number ?? 999;
        if (orderA !== orderB) return orderA - orderB;

        const nameA = `${a.first_surname || a.last_name || ''} ${a.second_surname || ''} ${a.names || a.first_name || a.name || ''}`.trim().toLowerCase();
        const nameB = `${b.first_surname || b.last_name || ''} ${b.second_surname || ''} ${b.names || b.first_name || b.name || ''}`.trim().toLowerCase();
        return nameA.localeCompare(nameB);
      });

      setCourseStudents(activeStudents);
    } catch (err) {
      console.error('Error loading students in LinkChildModal:', err);
      setCourseStudents([]);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  const handleSelectCourseToLink = async (courseId: string, codeUsed?: string) => {
    if (parentCourseIds.includes(courseId)) {
      toast.error('Este curso ya está vinculado a tu perfil.');
      return;
    }

    let courseObj = allCourses.find((c) => c.id === courseId || c.code === courseId);
    if (!courseObj) {
      // Buscar información directa en BD
      const { data } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .maybeSingle();
      courseObj = data;
    }

    if (!courseObj) {
      toast.error('No se encontró la información del curso.');
      return;
    }

    setTargetCourse(courseObj);
    await loadStudentsForCourse(courseObj, codeUsed);
  };

  const handleConfirmLinkWithStudent = async () => {
    if (!profile?.id || !targetCourse) {
      toast.error('No se encontró la sesión o el curso a vincular.');
      return;
    }

    // Validar selección de alumno si hay alumnos en lista
    if (courseStudents.length > 0 && !selectedStudentId) {
      toast.error('Por favor selecciona el nombre de tu hijo(a) de la lista.');
      return;
    }

    let studentName = '';
    let studentIdToLink = null;

    if (selectedStudentId === 'manual' || courseStudents.length === 0) {
      studentName = manualStudentName.trim();
      if (!studentName) {
        toast.error('Por favor escribe el nombre completo de tu hijo(a).');
        return;
      }
    } else {
      const selectedStudent = courseStudents.find((s) => s.id === selectedStudentId);
      if (selectedStudent) {
        studentIdToLink = selectedStudent.id;
        const firstName = (selectedStudent.names || selectedStudent.first_name || '').trim();
        const lastName = (selectedStudent.first_surname || selectedStudent.last_name || '').trim();
        studentName = `${firstName} ${lastName}`.trim();
      }
    }

    setIsLinking(true);
    const updatedIds = Array.from(new Set([...parentCourseIds, targetCourse.id]));

    try {
      // 1. Actualizar perfil con el nuevo curso
      const { error: profErr } = await supabase
        .from('profiles')
        .update({ parent_course_ids: updatedIds })
        .eq('id', profile.id);

      if (profErr) {
        console.warn('Error updating profile parent_course_ids:', profErr);
      }

      // 2. Asociar en la tabla 'parents' para vincular directamente al hijo
      if (studentIdToLink || studentName) {
        try {
          await supabase.from('parents').insert([
            {
              center_id: targetCourse.center_id || profile.center_id,
              student_id: studentIdToLink || null,
              profile_id: profile.id,
              name: studentName ? `${studentName} (Hijo/a)` : (profile.full_name || 'Padre/Tutor'),
              email: profile.email || null,
              relation: 'Tutor'
            }
          ]);
        } catch (parentInsertErr) {
          console.warn('Could not insert parent child relationship:', parentInsertErr);
        }
      }

      // 3. Persistir en localStorage y sincronizar estado
      localStorage.setItem('parent_course_ids', JSON.stringify(updatedIds));
      localStorage.setItem('selected_course_id', targetCourse.id);
      setParentCourseIds(updatedIds);
      profile.parent_course_ids = updatedIds;

      window.dispatchEvent(new CustomEvent('selectedCourseChanged', { detail: targetCourse.id }));
      toast.success(`¡${studentName ? studentName.split(' ')[0] : 'Grado'} vinculado con éxito!`);

      // Resetear formulario
      setTargetCourse(null);
      setCourseStudents([]);
      setSelectedStudentId('');
      setManualStudentName('');
      setCourseCode('');
      setSelectedCenterCourseId('');
    } catch (err: any) {
      console.error('Error linking child course:', err);
      toast.error(err?.message || 'Error al vincular al estudiante.');
    } finally {
      setIsLinking(false);
    }
  };

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = courseCode.trim().toUpperCase().replace(/\s+/g, '');
    if (!sanitized) return;

    setIsLinking(true);
    try {
      // 1. Buscar en courses por código directo
      const { data: courseMatch } = await supabase
        .from('courses')
        .select('*')
        .ilike('code', sanitized)
        .maybeSingle();

      let targetCourseId = courseMatch?.id;

      // 2. Si no, buscar en invitation_codes
      if (!targetCourseId) {
        const { data: invMatch } = await supabase
          .from('invitation_codes')
          .select('course_id')
          .ilike('code', sanitized)
          .maybeSingle();
        if (invMatch?.course_id) {
          targetCourseId = invMatch.course_id;
        }
      }

      // 3. Fallback: buscar por ID directo en lista local
      if (!targetCourseId) {
        const byId = allCourses.find((c) => c.id === sanitized || c.code === sanitized);
        if (byId) targetCourseId = byId.id;
      }

      if (!targetCourseId) {
        toast.error('Código no válido o no encontrado. Revisa el código del grado.');
        setIsLinking(false);
        return;
      }

      await handleSelectCourseToLink(targetCourseId, sanitized);
    } catch (err: any) {
      console.error('Error searching course code:', err);
      toast.error('Error al procesar el código.');
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlinkCourse = async (courseId: string) => {
    if (!window.confirm('¿Seguro que deseas desvincular este curso de tu cuenta?')) return;

    const updatedIds = parentCourseIds.filter((id) => id !== courseId);
    try {
      await supabase
        .from('profiles')
        .update({ parent_course_ids: updatedIds })
        .eq('id', profile.id);

      localStorage.setItem('parent_course_ids', JSON.stringify(updatedIds));
      setParentCourseIds(updatedIds);
      profile.parent_course_ids = updatedIds;

      const active = localStorage.getItem('selected_course_id');
      if (active === courseId && updatedIds.length > 0) {
        localStorage.setItem('selected_course_id', updatedIds[0]);
        window.dispatchEvent(new CustomEvent('selectedCourseChanged', { detail: updatedIds[0] }));
      }

      toast.success('Curso desvinculado.');
    } catch (err) {
      console.error('Error unlinking course:', err);
      toast.error('Error al desvincular.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 to-indigo-950 text-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-300 border border-indigo-400/20 flex items-center justify-center">
              <UserPlus size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black tracking-tight">Vincular Otro Hijo</h3>
              <p className="text-xs text-indigo-200/80 font-medium">
                Accede a las tareas y avisos de todos tus hijos
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {/* PASO 2: SELECCIONAR ALUMNO DEL CURSO DETECTADO */}
          {targetCourse ? (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="bg-indigo-50/70 border border-indigo-150 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black bg-indigo-600 text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider inline-block mb-1">
                    Grado Seleccionado
                  </span>
                  <h4 className="text-base font-black text-indigo-950 uppercase">
                    {targetCourse.grade} "{targetCourse.section}"
                  </h4>
                  <p className="text-[11px] text-indigo-700 font-semibold">
                    {targetCourse.level || 'Secundaria'} {targetCourse.tanda ? `• Tanda ${targetCourse.tanda}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTargetCourse(null);
                    setCourseStudents([]);
                    setSelectedStudentId('');
                    setManualStudentName('');
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline px-2 py-1"
                >
                  Cambiar
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    Selecciona el Nombre de tu Hijo(a) *
                  </label>
                  {isLoadingStudents ? (
                    <span className="text-[10px] font-bold text-indigo-500 animate-pulse">
                      Cargando alumnos...
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      {courseStudents.length} alumnos en lista
                    </span>
                  )}
                </div>

                <select
                  required={selectedStudentId !== 'manual' && courseStudents.length > 0}
                  disabled={isLoadingStudents}
                  className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none transition-all disabled:opacity-60 cursor-pointer"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                >
                  <option value="">
                    {isLoadingStudents
                      ? '-- Cargando lista de alumnos del curso... --'
                      : courseStudents.length > 0
                      ? '-- Seleccionar a tu hijo(a) de la lista oficial --'
                      : '-- No se encontraron alumnos en este curso --'}
                  </option>
                  {courseStudents.map((st: any) => {
                    const firstName = (st.names || st.first_name || '').trim();
                    const lastName = (st.first_surname || st.last_name || '').trim();
                    const secondSurname = (st.second_surname || '').trim();
                    const fullSurnames = `${lastName} ${secondSurname}`.trim();

                    let displayName = '';
                    if (fullSurnames && firstName) {
                      displayName = `${fullSurnames}, ${firstName}`;
                    } else {
                      displayName = fullSurnames || firstName || st.name || st.full_name || 'Estudiante';
                    }

                    const orderStr = st.order_number ? `#${st.order_number} - ` : '';
                    return (
                      <option key={st.id} value={st.id}>
                        {orderStr}{displayName}
                      </option>
                    );
                  })}
                  <option value="manual">
                    ✍️ El nombre de mi hijo(a) no aparece en la lista (Escribir manualmente)
                  </option>
                </select>
              </div>

              {(selectedStudentId === 'manual' || (!isLoadingStudents && courseStudents.length === 0)) && (
                <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                    Escribe el Nombre Completo de tu Hijo(a) *
                  </label>
                  <input
                    type="text"
                    value={manualStudentName}
                    onChange={(e) => setManualStudentName(e.target.value)}
                    placeholder="Ej: Nombre y apellidos del estudiante"
                    className="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none transition-all"
                    required
                  />
                  {courseStudents.length === 0 && !isLoadingStudents && (
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-3 rounded-xl font-medium leading-relaxed">
                      💡 <strong>Información:</strong> Este curso aún no tiene alumnos pre-cargados por el centro. Escribe el nombre de tu hijo(a) para vincularte directamente y acceder a sus horarios, tareas y agenda.
                    </p>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setTargetCourse(null);
                    setCourseStudents([]);
                    setSelectedStudentId('');
                    setManualStudentName('');
                  }}
                  className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all"
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLinkWithStudent}
                  disabled={isLinking || (courseStudents.length > 0 && !selectedStudentId && !manualStudentName)}
                  className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-emerald-200 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isLinking ? 'Vinculando...' : 'Confirmar y Vincular'}
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Opción 1: Por Código */}
              <div className="space-y-3">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                  1. Ingresar código del curso o invitación
                </label>
                <form onSubmit={handleSubmitCode} className="flex gap-2">
                  <input
                    type="text"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value)}
                    placeholder="Ej: GEN-5A o código de curso"
                    className="flex-1 px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-mono font-bold uppercase tracking-wider text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 outline-none transition-all"
                    disabled={isLinking}
                  />
                  <button
                    type="submit"
                    disabled={isLinking || !courseCode.trim()}
                    className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                  >
                    {isLinking ? '...' : 'Buscar Alumnos'}
                  </button>
                </form>
              </div>

              {/* Separador */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  O selecciona del listado del centro
                </span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              {/* Opción 2: Selector Rápido de Cursos del Centro */}
              {allCourses.length > 0 && (
                <div className="space-y-3">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                    2. Seleccionar directamente el grado y sección
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedCenterCourseId}
                      onChange={(e) => setSelectedCenterCourseId(e.target.value)}
                      className="flex-1 px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:bg-white focus:border-indigo-600 outline-none transition-all cursor-pointer"
                    >
                      <option value="">Selecciona el grado de tu hijo...</option>
                      {allCourses.map((c) => {
                        const alreadyLinked = parentCourseIds.includes(c.id);
                        return (
                          <option key={c.id} value={c.id} disabled={alreadyLinked}>
                            {c.grade} "{c.section}" ({c.level || 'Secundaria'}) {alreadyLinked ? '✓ (Ya vinculado)' : ''}
                          </option>
                        );
                      })}
                    </select>

                    <button
                      type="button"
                      onClick={() => selectedCenterCourseId && handleSelectCourseToLink(selectedCenterCourseId)}
                      disabled={isLinking || !selectedCenterCourseId}
                      className="px-5 py-3 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                    >
                      Buscar Alumnos
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Lista de Hijos / Grados Vinculados Actualmente */}
          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Hijos / Cursos Vinculados ({parentCourseIds.length})
            </h4>

            {parentCourseIds.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-4 bg-slate-50 rounded-2xl text-center">
                Aún no tienes ningún curso vinculado.
              </p>
            ) : (
              <div className="space-y-2">
                {parentCourseIds.map((courseId) => {
                  const courseObj = allCourses.find(
                    (c) => c.id === courseId || c.code === courseId
                  );
                  return (
                    <div
                      key={courseId}
                      className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                          <School size={15} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-900">
                            {courseObj
                              ? `${courseObj.grade} "${courseObj.section}"`
                              : `Curso ID: ${courseId}`}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            {courseObj?.level || 'Nivel Escolar'} {courseObj?.tanda ? `• Tanda ${courseObj.tanda}` : ''}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleUnlinkCourse(courseId)}
                        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                        title="Desvincular este curso"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md active:scale-95"
          >
            Listo / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
