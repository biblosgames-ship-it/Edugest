import React, { useState, useEffect } from 'react';
import { X, UserPlus, School, Check, AlertCircle, Trash2, Search, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { dataService } from '../services/dataService';
import { useApp } from '../context/AppContext';
import { toast } from 'react-hot-toast';

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
    }
  }, [isOpen, profile?.center_id, selectedYear]);

  if (!isOpen) return null;

  // Cursos actualmente vinculados
  const linkedCourses = allCourses.filter(
    (c) => parentCourseIds.includes(c.id) || parentCourseIds.includes(c.code)
  );

  const handleLinkCourseById = async (courseId: string) => {
    if (!profile?.id) {
      toast.error('No se encontró sesión de usuario activa.');
      return;
    }

    if (parentCourseIds.includes(courseId)) {
      toast.error('Este curso ya está vinculado a tu perfil.');
      return;
    }

    setIsLinking(true);
    const updatedIds = [...parentCourseIds, courseId];

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ parent_course_ids: updatedIds })
        .eq('id', profile.id);

      if (error) {
        console.warn('Error saving to Supabase, saving locally:', error);
      }

      localStorage.setItem('parent_course_ids', JSON.stringify(updatedIds));
      localStorage.setItem('selected_course_id', courseId);
      setParentCourseIds(updatedIds);
      profile.parent_course_ids = updatedIds;

      window.dispatchEvent(new CustomEvent('selectedCourseChanged', { detail: courseId }));
      toast.success('¡Grado de tu hijo vinculado con éxito!');
      setCourseCode('');
      setSelectedCenterCourseId('');
    } catch (err: any) {
      console.error('Error linking course:', err);
      toast.error(err?.message || 'Error al vincular el grado.');
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
        .select('id, grade, section')
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

      // 3. Fallback: buscar por ID directo
      if (!targetCourseId) {
        const byId = allCourses.find((c) => c.id === sanitized || c.code === sanitized);
        if (byId) targetCourseId = byId.id;
      }

      if (!targetCourseId) {
        toast.error('Código no válido o no encontrado. Revisa el código del grado.');
        setIsLinking(false);
        return;
      }

      await handleLinkCourseById(targetCourseId);
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
                placeholder="Ej: GEN-5A o código de 6 dígitos"
                className="flex-1 px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-mono font-bold uppercase tracking-wider text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-600 outline-none transition-all"
                disabled={isLinking}
              />
              <button
                type="submit"
                disabled={isLinking || !courseCode.trim()}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
              >
                {isLinking ? '...' : '+ Vincular'}
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
                  onClick={() => selectedCenterCourseId && handleLinkCourseById(selectedCenterCourseId)}
                  disabled={isLinking || !selectedCenterCourseId}
                  className="px-5 py-3 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95"
                >
                  Vincular
                </button>
              </div>
            </div>
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
