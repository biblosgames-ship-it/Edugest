import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useSupabase } from '../context/AppContext';
import { dataService } from '../services/dataService';
import { supabase } from '../lib/supabase';
import {
  CalendarRange,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  CheckSquare,
  Square
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CloneYearWizardProps {
  onClose: () => void;
}

export const CloneYearWizard = ({ onClose }: CloneYearWizardProps) => {
  const { state, refreshData } = useApp();
  const { profile } = useSupabase();

  const [sourceYear, setSourceYear] = useState('');
  const [targetYear, setTargetYear] = useState('');
  const [cloneAssignments, setCloneAssignments] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingCourses, setIsLoadingCourses] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [courses, setCourses] = useState<any[]>([]);
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);

  // Filtrar años disponibles
  const schoolYears = useMemo(() => {
    return state.schoolYears || [];
  }, [state.schoolYears]);

  // Cargar cursos al cambiar el año de origen
  useEffect(() => {
    const fetchSourceCourses = async () => {
      if (!sourceYear || !profile?.center_id) {
        setCourses([]);
        setSelectedCourseIds([]);
        return;
      }

      setIsLoadingCourses(true);
      setError(null);
      try {
        const { data, error: cErr } = await supabase
          .from('courses')
          .select('*')
          .eq('center_id', profile.center_id)
          .eq('school_year', sourceYear);

        if (cErr) throw cErr;
        const sorted = (data || []).sort((a: any, b: any) => {
          return `${a.level} ${a.grade} ${a.section}`.localeCompare(
            `${b.level} ${b.grade} ${b.section}`
          );
        });
        setCourses(sorted);
        setSelectedCourseIds(sorted.map((c: any) => c.id)); // Seleccionar todos por defecto
      } catch (err: any) {
        console.error(err);
        setError('Error al cargar cursos del año seleccionado.');
      } finally {
        setIsLoadingCourses(false);
      }
    };

    fetchSourceCourses();
  }, [sourceYear, profile?.center_id]);

  const handleSelectAll = () => {
    if (selectedCourseIds.length === courses.length) {
      setSelectedCourseIds([]);
    } else {
      setSelectedCourseIds(courses.map((c: any) => c.id));
    }
  };

  const handleToggleCourse = (id: string) => {
    setSelectedCourseIds((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    );
  };

  const handleClone = async () => {
    if (!profile?.center_id || !sourceYear || !targetYear) return;
    if (selectedCourseIds.length === 0) {
      setError('Debes seleccionar al menos un curso para clonar.');
      return;
    }
    if (sourceYear === targetYear) {
      setError('El año de origen y el año de destino no pueden ser iguales.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      await dataService.cloneSchoolYear(
        profile.center_id,
        sourceYear,
        targetYear,
        selectedCourseIds,
        cloneAssignments
      );

      await refreshData(profile.center_id, true);
      setSuccess(true);
      toast.success('Clonación de ciclo completada');
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error durante la clonación de ciclo.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="text-left space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100">
            <CalendarRange size={20} />
          </div>
          <div>
            <h3 className="text-lg font-black uppercase text-slate-900">
              Clonar Estructura de Ciclo
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Duplicar cursos y asignaciones de materias de un ciclo anterior
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
          disabled={isProcessing}
        >
          <X size={20} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl flex items-center gap-3 text-xs font-bold">
          <AlertCircle size={18} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!success ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Ciclo Escolar de Origen
              </label>
              <select
                value={sourceYear}
                onChange={(e) => setSourceYear(e.target.value)}
                disabled={isProcessing}
                className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="">-- Seleccionar origen --</option>
                {schoolYears.map((y: any) => (
                  <option key={y.id} value={y.name}>
                    {y.name} ({y.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Ciclo Escolar de Destino (Nuevo)
              </label>
              <select
                value={targetYear}
                onChange={(e) => setTargetYear(e.target.value)}
                disabled={isProcessing}
                className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all cursor-pointer"
              >
                <option value="">-- Seleccionar destino --</option>
                {schoolYears.map((y: any) => (
                  <option key={y.id} value={y.name}>
                    {y.name} ({y.status})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Selector de Cursos */}
          {sourceYear && (
            <div className="space-y-3 bg-slate-50/50 p-6 rounded-[2rem] border border-slate-100">
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
                  Cursos a clonar ({selectedCourseIds.length} de {courses.length})
                </span>
                {courses.length > 0 && (
                  <button
                    onClick={handleSelectAll}
                    disabled={isProcessing}
                    className="text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase tracking-widest"
                  >
                    {selectedCourseIds.length === courses.length
                      ? 'Desmarcar Todos'
                      : 'Marcar Todos'}
                  </button>
                )}
              </div>

              {isLoadingCourses ? (
                <div className="flex items-center justify-center py-6 gap-2 text-slate-400">
                  <Loader2 className="animate-spin" size={16} />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Cargando cursos del año origen...
                  </span>
                </div>
              ) : courses.length === 0 ? (
                <p className="text-[10px] text-slate-400 font-semibold italic text-center py-4">
                  No se encontraron cursos registrados en el ciclo {sourceYear}.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 max-h-[200px] overflow-y-auto pr-1">
                  {courses.map((c: any) => {
                    const isSelected = selectedCourseIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => handleToggleCourse(c.id)}
                        disabled={isProcessing}
                        className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-white border-indigo-500 text-indigo-950 shadow-sm'
                            : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {isSelected ? (
                          <CheckSquare className="text-indigo-600 shrink-0" size={16} />
                        ) : (
                          <Square className="text-slate-300 shrink-0" size={16} />
                        )}
                        <span className="text-[10px] font-black uppercase truncate">
                          {c.level} {c.grade} "{c.section}" - {c.tanda || 'Matutina'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Checkbox de Asignaciones */}
          <button
            onClick={() => setCloneAssignments(!cloneAssignments)}
            disabled={isProcessing}
            className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200/50 rounded-2xl w-full text-left"
          >
            {cloneAssignments ? (
              <CheckSquare className="text-indigo-600 shrink-0" size={20} />
            ) : (
              <Square className="text-slate-300 shrink-0" size={20} />
            )}
            <div>
              <p className="text-[10px] font-black text-slate-800 uppercase tracking-wider">
                Clonar asignaciones de profesores a materias
              </p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-0.5">
                Si un docente impartía una materia en un curso, se creará esa misma asignación para
                el nuevo año escolar.
              </p>
            </div>
          </button>

          <div className="flex gap-4 pt-4 border-t border-slate-100">
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="flex-1 px-6 py-4 bg-slate-150 hover:bg-slate-200 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleClone}
              disabled={
                isProcessing || !sourceYear || !targetYear || selectedCourseIds.length === 0
              }
              className="flex-2 px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="animate-spin" size={14} /> Procesando Clonación...
                </>
              ) : (
                <>
                  <Copy size={14} /> Iniciar Clonación de Ciclo
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-12 flex flex-col items-center justify-center text-center gap-6 min-h-[300px] animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-50">
            <CheckCircle2 size={44} />
          </div>
          <div className="space-y-2">
            <h4 className="text-lg font-black uppercase text-slate-900">¡Clonación Completada!</h4>
            <p className="text-xs text-slate-500 font-medium max-w-sm">
              La estructura de cursos seleccionada y las asignaciones del ciclo {sourceYear} han
              sido clonadas correctamente hacia el ciclo {targetYear}.
            </p>
          </div>
          <button
            onClick={onClose}
            className="px-10 py-4 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all hover:scale-105 active:scale-95"
          >
            Cerrar Asistente
          </button>
        </div>
      )}
    </div>
  );
};
