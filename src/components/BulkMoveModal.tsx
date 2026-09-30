import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  ArrowRightLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Users,
  Search,
  CheckSquare,
  Square,
  ArrowRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface BulkMoveModalProps {
  sourceCourseId: string;
  onClose: () => void;
  onSuccess?: (newCourseId?: string) => void;
}

export const BulkMoveModal = ({ sourceCourseId, onClose, onSuccess }: BulkMoveModalProps) => {
  const { state, selectedYear, refreshData } = useApp();
  const queryClient = useQueryClient();

  const [students, setStudents] = useState<any[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [targetCourseId, setTargetCourseId] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Curso de origen
  const sourceCourse = useMemo(() => {
    return (state.courses || []).find((c: any) => c.id === sourceCourseId);
  }, [state.courses, sourceCourseId]);

  // Cursos disponibles para destino (del mismo año escolar, excluyendo el origen)
  const availableTargetCourses = useMemo(() => {
    return (state.courses || [])
      .filter((c: any) => c.id !== sourceCourseId)
      .sort((a: any, b: any) => {
        // Ordenar primero los que coincidan en nivel y grado con el curso origen
        const isSameGradeA = sourceCourse && a.level === sourceCourse.level && a.grade === sourceCourse.grade;
        const isSameGradeB = sourceCourse && b.level === sourceCourse.level && b.grade === sourceCourse.grade;
        if (isSameGradeA && !isSameGradeB) return -1;
        if (!isSameGradeA && isSameGradeB) return 1;
        return `${a.level} ${a.grade} ${a.section}`.localeCompare(`${b.level} ${b.grade} ${b.section}`);
      });
  }, [state.courses, sourceCourseId, sourceCourse]);

  // Pre-seleccionar sugerencia de curso destino
  useEffect(() => {
    if (availableTargetCourses.length > 0 && !targetCourseId) {
      // Buscar misma sección o misma clase en otra sección
      const sameGradeDiffSection = availableTargetCourses.find(
        (c: any) => sourceCourse && c.level === sourceCourse.level && c.grade === sourceCourse.grade
      );
      setTargetCourseId(sameGradeDiffSection ? sameGradeDiffSection.id : availableTargetCourses[0]?.id || '');
    }
  }, [availableTargetCourses, sourceCourse, targetCourseId]);

  // Cargar estudiantes del curso de origen
  useEffect(() => {
    const fetchStudents = async () => {
      if (!sourceCourseId) return;
      setIsLoadingStudents(true);
      try {
        const { data, error: sErr } = await supabase
          .from('students')
          .select('*')
          .eq('course_id', sourceCourseId)
          .eq('school_year', selectedYear);

        if (sErr) throw sErr;
        const sorted = (data || []).sort((a: any, b: any) => {
          const ordA = a.order_number || 999;
          const ordB = b.order_number || 999;
          if (ordA !== ordB) return ordA - ordB;
          const nameA = `${a.first_surname || ''} ${a.second_surname || ''} ${a.names || ''}`.toLowerCase();
          const nameB = `${b.first_surname || ''} ${b.second_surname || ''} ${b.names || ''}`.toLowerCase();
          return nameA.localeCompare(nameB);
        });
        setStudents(sorted);
        // Pre-seleccionar todos los alumnos por defecto
        setSelectedStudentIds(sorted.map((s: any) => s.id));
      } catch (err: any) {
        console.error('Error al cargar alumnos para mover:', err);
        setError('No se pudo cargar la lista de estudiantes de este curso.');
      } finally {
        setIsLoadingStudents(false);
      }
    };
    fetchStudents();
  }, [sourceCourseId, selectedYear]);

  // Filtrado de alumnos por nombre en la búsqueda interna
  const filteredStudents = useMemo(() => {
    if (!searchFilter.trim()) return students;
    const term = searchFilter.toLowerCase().trim();
    return students.filter((s: any) => {
      const fullName = `${s.first_surname || ''} ${s.second_surname || ''} ${s.names || ''}`.toLowerCase();
      const code = (s.student_code || s.sigerd_code || '').toLowerCase();
      return fullName.includes(term) || code.includes(term);
    });
  }, [students, searchFilter]);

  const handleToggleSelectAll = () => {
    if (selectedStudentIds.length === filteredStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(filteredStudents.map((s) => s.id));
    }
  };

  const handleToggleSelect = (id: string) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter((sid) => sid !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  const handleBulkMove = async () => {
    if (selectedStudentIds.length === 0) {
      setError('Por favor selecciona al menos un alumno para mover.');
      return;
    }
    if (!targetCourseId) {
      setError('Por favor selecciona la sección o curso de destino.');
      return;
    }

    const targetCourse = state.courses.find((c: any) => c.id === targetCourseId);
    const targetLabel = targetCourse
      ? `${targetCourse.grade} "${targetCourse.section}" (${targetCourse.level})`
      : 'el curso seleccionado';

    if (
      !window.confirm(
        `¿Confirmas que deseas mover ${selectedStudentIds.length} estudiante(s) a ${targetLabel}?`
      )
    ) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // 1. Mover los alumnos en la tabla students
      const { error: moveErr } = await supabase
        .from('students')
        .update({ course_id: targetCourseId })
        .in('id', selectedStudentIds);

      if (moveErr) throw moveErr;

      // 2. Si existen notas registradas en el curso de origen para estos alumnos, actualizarlas al nuevo curso
      try {
        await supabase
          .from('student_grades')
          .update({ course_id: targetCourseId })
          .eq('course_id', sourceCourseId)
          .in('student_id', selectedStudentIds);
      } catch (gErr) {
        console.warn('Nota sobre student_grades en reubicación:', gErr);
      }

      // 3. Si existen actividades parciales registradas en el curso de origen, actualizarlas al nuevo curso
      try {
        await supabase
          .from('student_partial_activities')
          .update({ course_id: targetCourseId })
          .eq('course_id', sourceCourseId)
          .in('student_id', selectedStudentIds);
      } catch (pErr) {
        console.warn('Nota sobre student_partial_activities en reubicación:', pErr);
      }

      // 4. Invalidar caché y actualizar estado
      await queryClient.invalidateQueries({ queryKey: ['students'] });
      await refreshData();

      toast.success(`¡${selectedStudentIds.length} alumno(s) movidos exitosamente a ${targetLabel}!`);
      if (onSuccess) onSuccess(targetCourseId);
      onClose();
    } catch (err: any) {
      console.error('Error al mover alumnos masivamente:', err);
      setError(`Error al mover los estudiantes: ${err?.message || 'Error desconocido'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const targetCourseObj = state.courses.find((c: any) => c.id === targetCourseId);

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Encabezado Fijo */}
        <div className="shrink-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900 px-5 sm:px-6 py-4 text-white flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center shrink-0">
              <ArrowRightLeft size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-sm sm:text-base uppercase tracking-tight text-white truncate">
                Mover Alumnos de Sección / Curso
              </h3>
              <p className="text-[11px] sm:text-xs text-blue-100 font-medium truncate">
                Reubica masivamente estudiantes dentro del año {selectedYear}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="text-white/80 hover:text-white p-1.5 rounded-xl hover:bg-white/10 cursor-pointer shrink-0 transition-colors ml-2 disabled:opacity-50"
            title="Cerrar ventana"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mensaje de Error */}
        {error && (
          <div className="shrink-0 mx-4 sm:mx-6 mt-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2.5 text-xs font-bold animate-fade-in">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Cuerpo Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          {/* Tarjeta de Origen y Destino */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
            {/* Origen */}
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Curso / Sección Origen
              </span>
              <p className="text-sm font-black text-slate-900 dark:text-white">
                {sourceCourse
                  ? `${sourceCourse.level} ${sourceCourse.grade} "${sourceCourse.section}"`
                  : 'Curso no seleccionado'}
              </p>
              <p className="text-[11px] font-bold text-slate-500">
                Tanda {sourceCourse?.tanda || 'Matutina'} • {students.length} estudiantes
              </p>
            </div>

            {/* Destino */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block">
                Mover Hacia (Curso / Sección Destino) *
              </label>
              <select
                value={targetCourseId}
                onChange={(e) => setTargetCourseId(e.target.value)}
                disabled={isProcessing}
                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              >
                {availableTargetCourses.length === 0 && (
                  <option value="">No hay otros cursos disponibles</option>
                )}
                {availableTargetCourses.map((c: any) => {
                  const isSuggested =
                    sourceCourse && c.level === sourceCourse.level && c.grade === sourceCourse.grade;
                  return (
                    <option key={c.id} value={c.id}>
                      {isSuggested ? '★ ' : ''}
                      {c.level} {c.grade} "{c.section}" - {c.tanda || 'Matutina'}
                      {isSuggested ? ' (Mismo grado)' : ''}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Barra de Búsqueda y Selección Total */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por nombre o código..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors cursor-pointer shrink-0"
            >
              {selectedStudentIds.length === filteredStudents.length && filteredStudents.length > 0 ? (
                <>
                  <CheckSquare size={15} className="text-blue-600" />
                  <span>Deseleccionar Todos</span>
                </>
              ) : (
                <>
                  <Square size={15} className="text-slate-400" />
                  <span>Seleccionar Todos ({selectedStudentIds.length}/{students.length})</span>
                </>
              )}
            </button>
          </div>

          {/* Listado de Estudiantes con Checkbox */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-72 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900">
            {isLoadingStudents ? (
              <div className="p-8 text-center text-slate-400 text-xs font-bold flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-blue-600" />
                Cargando estudiantes del curso...
              </div>
            ) : filteredStudents.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs font-medium">
                No se encontraron estudiantes para mostrar.
              </div>
            ) : (
              filteredStudents.map((s: any, idx: number) => {
                const isSelected = selectedStudentIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => handleToggleSelect(s.id)}
                    className={`flex items-center gap-3 p-3 transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-blue-50/60 dark:bg-blue-950/30'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Manejado por el onClick del div
                      className="w-4 h-4 text-blue-600 rounded cursor-pointer accent-blue-600 shrink-0"
                    />
                    <div className="w-6 text-center text-[10px] font-black text-slate-400 shrink-0">
                      {s.order_number || idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase truncate">
                        {s.first_surname || ''} {s.second_surname || ''}, {s.names || ''}
                      </p>
                      <p className="text-[10px] text-slate-400 font-medium truncate">
                        SIGERD: {s.sigerd_code || '---'} {s.sex ? `• Sexo: ${s.sex}` : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Pie Fijo con Botones de Acción */}
        <div className="shrink-0 px-5 sm:px-6 py-3.5 bg-slate-50 dark:bg-slate-900/90 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-slate-500">
            <span className="text-blue-600 font-black">{selectedStudentIds.length}</span> de {students.length} seleccionados
          </p>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold uppercase tracking-wider text-xs cursor-pointer transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleBulkMove}
              disabled={isProcessing || selectedStudentIds.length === 0 || !targetCourseId}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-wider text-xs flex items-center gap-2 shadow-lg shadow-blue-600/30 disabled:opacity-50 cursor-pointer transition-all active:scale-95"
            >
              {isProcessing ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Moviendo...</span>
                </>
              ) : (
                <>
                  <ArrowRight size={15} />
                  <span>
                    Mover a {targetCourseObj ? `${targetCourseObj.grade} "${targetCourseObj.section}"` : 'Destino'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
