import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { sortCourses } from '../utils/courseSorter';
import {
  ArrowRightLeft,
  AlertCircle,
  Loader2,
  X,
  Search,
  CheckSquare,
  Square,
  ArrowRight,
  GraduationCap,
  Layers,
  ArrowRightCircle
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

  // Estados para selectores jerárquicos de destino
  const [selectedTargetLevel, setSelectedTargetLevel] = useState<string>('ALL');
  const [selectedTargetGrade, setSelectedTargetGrade] = useState<string>('ALL');

  // Curso de origen
  const sourceCourse = useMemo(() => {
    return (state.courses || []).find((c: any) => c.id === sourceCourseId);
  }, [state.courses, sourceCourseId]);

  // Todos los cursos disponibles excepto el de origen, ordenados
  const allTargetCourses = useMemo(() => {
    return sortCourses((state.courses || []).filter((c: any) => c.id !== sourceCourseId));
  }, [state.courses, sourceCourseId]);

  // Lista única de niveles disponibles en el centro
  const availableLevels = useMemo(() => {
    const set = new Set<string>();
    allTargetCourses.forEach((c: any) => {
      if (c.level) set.add(c.level);
    });
    return Array.from(set);
  }, [allTargetCourses]);

  // Lista única de grados disponibles (filtrados por nivel si no es 'ALL')
  const availableGrades = useMemo(() => {
    const list = selectedTargetLevel === 'ALL'
      ? allTargetCourses
      : allTargetCourses.filter((c: any) => c.level === selectedTargetLevel);

    const set = new Set<string>();
    const grades: string[] = [];
    list.forEach((c: any) => {
      if (c.grade && !set.has(c.grade)) {
        set.add(c.grade);
        grades.push(c.grade);
      }
    });
    return grades;
  }, [allTargetCourses, selectedTargetLevel]);

  // Cursos filtrados para la selección según nivel y grado
  const filteredTargetCourses = useMemo(() => {
    return allTargetCourses.filter((c: any) => {
      if (selectedTargetLevel !== 'ALL' && c.level !== selectedTargetLevel) return false;
      if (selectedTargetGrade !== 'ALL' && c.grade !== selectedTargetGrade) return false;
      return true;
    });
  }, [allTargetCourses, selectedTargetLevel, selectedTargetGrade]);

  // Inicializar nivel y grado con los del curso origen si están disponibles
  useEffect(() => {
    if (sourceCourse) {
      if (sourceCourse.level && availableLevels.includes(sourceCourse.level)) {
        setSelectedTargetLevel(sourceCourse.level);
      }
      if (sourceCourse.grade) {
        setSelectedTargetGrade(sourceCourse.grade);
      }
    }
  }, [sourceCourse, availableLevels]);

  // Asegurar que si cambia el filtro y el targetCourseId actual ya no está en la lista, se elija uno válido
  useEffect(() => {
    if (filteredTargetCourses.length > 0) {
      const exists = filteredTargetCourses.some((c: any) => c.id === targetCourseId);
      if (!exists) {
        setTargetCourseId(filteredTargetCourses[0].id);
      }
    } else if (allTargetCourses.length > 0 && !targetCourseId) {
      setTargetCourseId(allTargetCourses[0].id);
    }
  }, [filteredTargetCourses, allTargetCourses, targetCourseId]);

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

  // Manejo directo de selección de curso (sincroniza nivel y grado)
  const handleDirectCourseSelect = (courseId: string) => {
    setTargetCourseId(courseId);
    const c = allTargetCourses.find((item: any) => item.id === courseId);
    if (c) {
      if (c.level) setSelectedTargetLevel(c.level);
      if (c.grade) setSelectedTargetGrade(c.grade);
    }
  };

  // Manejo de cambio de grado
  const handleGradeSelect = (grade: string) => {
    setSelectedTargetGrade(grade);
    const matches = allTargetCourses.filter((c: any) => {
      if (selectedTargetLevel !== 'ALL' && c.level !== selectedTargetLevel) return false;
      if (grade !== 'ALL' && c.grade !== grade) return false;
      return true;
    });
    if (matches.length > 0) {
      setTargetCourseId(matches[0].id);
    }
  };

  // Manejo de cambio de nivel
  const handleLevelSelect = (level: string) => {
    setSelectedTargetLevel(level);
    const matches = allTargetCourses.filter((c: any) => {
      if (level !== 'ALL' && c.level !== level) return false;
      return true;
    });
    if (matches.length > 0) {
      // Si el grado actual no existe en el nuevo nivel, tomar el primero
      const gradesInNewLevel = Array.from(new Set(matches.map((c: any) => c.grade).filter(Boolean)));
      if (!gradesInNewLevel.includes(selectedTargetGrade)) {
        setSelectedTargetGrade(gradesInNewLevel[0] || 'ALL');
      }
      setTargetCourseId(matches[0].id);
    }
  };

  const targetCourseObj = (state.courses || []).find((c: any) => c.id === targetCourseId);
  const isDifferentGrade = Boolean(
    sourceCourse && targetCourseObj && sourceCourse.grade !== targetCourseObj.grade
  );

  const handleBulkMove = async () => {
    if (selectedStudentIds.length === 0) {
      setError('Por favor selecciona al menos un alumno para mover.');
      return;
    }
    if (!targetCourseId || !targetCourseObj) {
      setError('Por favor selecciona el grado y sección de destino.');
      return;
    }

    const targetLabel = `${targetCourseObj.level || ''} ${targetCourseObj.grade} "${targetCourseObj.section}" (${targetCourseObj.tanda || 'Matutina'})`;
    const sourceLabel = `${sourceCourse?.level || ''} ${sourceCourse?.grade || ''} "${sourceCourse?.section || ''}"`;

    let confirmMsg = `¿Confirmas que deseas mover ${selectedStudentIds.length} estudiante(s) a ${targetLabel}?`;
    if (isDifferentGrade) {
      confirmMsg = `⚠️ ATENCIÓN: Estás cambiando a los alumnos de GRADO:\n\nDe: ${sourceLabel}\nHacia: ${targetLabel}\n\n¿Estás seguro de continuar con el traslado masivo de ${selectedStudentIds.length} alumno(s)?`;
    }

    if (!window.confirm(confirmMsg)) {
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

  return (
    <div
      className="fixed inset-0 z-[100] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92dvh] sm:max-h-[88vh] flex flex-col overflow-hidden border border-slate-200 dark:border-slate-800"
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
                Mover / Reubicar Alumnos de Grado y Sección
              </h3>
              <p className="text-[11px] sm:text-xs text-blue-100 font-medium truncate">
                Mueve estudiantes masivamente a cualquier grado o sección en el año {selectedYear}
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
          {/* Panel de Selección de Destino */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            {/* Resumen Origen */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Curso de Origen Actual
                </span>
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  {sourceCourse
                    ? `${sourceCourse.level} ${sourceCourse.grade} "${sourceCourse.section}"`
                    : 'Curso no seleccionado'}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-[10px] font-bold text-slate-500 block">
                  Tanda: {sourceCourse?.tanda || 'Matutina'}
                </span>
                <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">
                  {students.length} alumnos matriculados
                </span>
              </div>
            </div>

            {/* Selectores de Destino: Nivel, Grado y Sección */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase text-blue-600 dark:text-blue-400">
                <GraduationCap size={16} />
                <span>Configurar Curso y Grado de Destino</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Selector de Nivel */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                    1. Nivel de Destino
                  </label>
                  <select
                    value={selectedTargetLevel}
                    onChange={(e) => handleLevelSelect(e.target.value)}
                    disabled={isProcessing}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    <option value="ALL">TODOS LOS NIVELES</option>
                    {availableLevels.map((lvl) => (
                      <option key={lvl} value={lvl}>
                        {lvl.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Selector de Grado (¡Lo que el usuario necesita!) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 block flex items-center justify-between">
                    <span>2. Grado de Destino *</span>
                    {selectedTargetGrade !== 'ALL' && (
                      <span className="text-[9px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded">
                        {selectedTargetGrade}
                      </span>
                    )}
                  </label>
                  <select
                    value={selectedTargetGrade}
                    onChange={(e) => handleGradeSelect(e.target.value)}
                    disabled={isProcessing}
                    className="w-full p-2.5 bg-blue-50/50 dark:bg-blue-950/30 border-2 border-blue-400 dark:border-blue-600 rounded-xl text-xs font-black text-blue-900 dark:text-blue-200 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-sm"
                  >
                    <option value="ALL">TODOS LOS GRADOS</option>
                    {availableGrades.map((g) => {
                      const isCurrentGrade = sourceCourse && sourceCourse.grade === g;
                      return (
                        <option key={g} value={g}>
                          {g} {isCurrentGrade ? '(Mismo grado actual)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* 3. Selector de Sección / Tanda */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 block">
                    3. Sección y Tanda *
                  </label>
                  <select
                    value={targetCourseId}
                    onChange={(e) => setTargetCourseId(e.target.value)}
                    disabled={isProcessing}
                    className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  >
                    {filteredTargetCourses.length === 0 && (
                      <option value="">No hay secciones disponibles</option>
                    )}
                    {filteredTargetCourses.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.level ? `${c.level} ` : ''}{c.grade} "{c.section}" - {c.tanda || 'Matutina'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Selector global rápido / alternativo */}
              <div className="pt-1">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  O seleccionar directamente de la lista de todos los cursos del centro:
                </label>
                <select
                  value={targetCourseId}
                  onChange={(e) => handleDirectCourseSelect(e.target.value)}
                  disabled={isProcessing}
                  className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] font-medium text-slate-700 dark:text-slate-300 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">-- Elige directamente un curso de la lista completa --</option>
                  {allTargetCourses.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.level} • Grado: {c.grade} • Sección "{c.section}" ({c.tanda || 'Matutina'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Banner Informativo de Traslado */}
            {targetCourseObj && (
              <div
                className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs transition-all ${
                  isDifferentGrade
                    ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200'
                    : 'bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200'
                }`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">Resumen del traslado:</span>
                  <span className="font-black px-2 py-0.5 bg-slate-900 text-white rounded-md text-[10px] uppercase">
                    {sourceCourse?.level} {sourceCourse?.grade} "{sourceCourse?.section}"
                  </span>
                  <ArrowRight size={14} className="shrink-0" />
                  <span className="font-black px-2 py-0.5 bg-blue-600 text-white rounded-md text-[10px] uppercase">
                    {targetCourseObj.level} {targetCourseObj.grade} "{targetCourseObj.section}"
                  </span>
                </div>

                {isDifferentGrade ? (
                  <span className="font-black text-[10px] uppercase tracking-wider bg-amber-200 dark:bg-amber-900/80 px-2 py-1 rounded text-amber-800 dark:text-amber-200 shrink-0">
                    ⚠️ Cambio de Grado ({sourceCourse?.grade} ➔ {targetCourseObj.grade})
                  </span>
                ) : (
                  <span className="font-bold text-[10px] text-blue-600 dark:text-blue-400 shrink-0">
                    ✓ Mismo grado (Cambio de sección)
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Barra de Búsqueda y Selección Total de Alumnos */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filtrar por nombre o matrícula..."
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
                      onChange={() => {}}
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
