import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  Lock,
  Unlock,
  AlertTriangle,
  Search,
  Filter,
  CheckCheck,
  Save,
  Loader2,
  FileSpreadsheet,
  Users,
  ShieldCheck,
  Sparkles,
  Info
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { gradesReleaseService } from '../../services/gradesReleaseService';

interface GradesReleaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  centerId: string;
  schoolYear: string;
  studentsWithBalances: any[];
  courses: any[];
}

export const GradesReleaseModal: React.FC<GradesReleaseModalProps> = ({
  isOpen,
  onClose,
  centerId,
  schoolYear,
  studentsWithBalances,
  courses
}) => {
  const [releasedMap, setReleasedMap] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('ALL');
  const [financialFilter, setFinancialFilter] = useState<'ALL' | 'UP_TO_DATE' | 'WITH_DEBT'>('ALL');

  // Cargar estado actual de liberaciones al abrir
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    gradesReleaseService
      .getReleasedMap(centerId, schoolYear)
      .then((map) => {
        if (isMounted) {
          setReleasedMap(map);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Error cargando liberaciones:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, centerId, schoolYear]);

  // Lista filtrada de estudiantes
  const filteredStudents = useMemo(() => {
    return (studentsWithBalances || []).filter((s: any) => {
      // Filtro por curso
      if (selectedCourseId !== 'ALL' && s.course_id !== selectedCourseId) {
        return false;
      }

      // Filtro financiero
      const isUpToDate = !s.hasOverdue && (s.status === 'Al día' || s.status === 'Saldado' || s.balance <= 0);
      if (financialFilter === 'UP_TO_DATE' && !isUpToDate) {
        return false;
      }
      if (financialFilter === 'WITH_DEBT' && isUpToDate) {
        return false;
      }

      // Filtro de búsqueda por nombre
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const fullName = `${s.names || s.first_name || ''} ${s.first_surname || s.last_name || ''} ${s.second_surname || ''}`.toLowerCase();
        const code = (s.sigerd_code || s.student_code || s.rne || '').toLowerCase();
        return fullName.includes(q) || code.includes(q);
      }

      return true;
    });
  }, [studentsWithBalances, selectedCourseId, financialFilter, searchTerm]);

  // Métricas rápidas
  const totalStudents = studentsWithBalances.length;
  const totalReleased = useMemo(() => {
    return studentsWithBalances.filter((s) => !!releasedMap[s.id]).length;
  }, [studentsWithBalances, releasedMap]);
  const totalBlocked = totalStudents - totalReleased;

  // Alternar individualmente
  const toggleStudent = (studentId: string) => {
    setReleasedMap((prev) => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  // ACCIÓN MASIVA SOLICITADA: Habilitar a todos los que están al día y deshabilitar a los morosos/con deuda
  const handleBulkReleaseUpToDateOnly = () => {
    let releasedCount = 0;
    let blockedCount = 0;

    const newMap = { ...releasedMap };

    studentsWithBalances.forEach((s) => {
      const isUpToDate = !s.hasOverdue && (s.status === 'Al día' || s.status === 'Saldado' || s.balance <= 0);
      if (isUpToDate) {
        newMap[s.id] = true;
        releasedCount++;
      } else {
        newMap[s.id] = false;
        blockedCount++;
      }
    });

    setReleasedMap(newMap);
    toast.success(
      `Cotejados ${releasedCount} alumnos al día. ${blockedCount} alumnos con mora fueron bloqueados.`,
      { duration: 4000 }
    );
  };

  // Habilitar a todos los visibles o de la escuela
  const handleBulkEnableAll = () => {
    const newMap = { ...releasedMap };
    filteredStudents.forEach((s) => {
      newMap[s.id] = true;
    });
    setReleasedMap(newMap);
    toast.success(`Habilitados ${filteredStudents.length} alumnos.`);
  };

  // Bloquear a todos los visibles o de la escuela
  const handleBulkDisableAll = () => {
    const newMap = { ...releasedMap };
    filteredStudents.forEach((s) => {
      newMap[s.id] = false;
    });
    setReleasedMap(newMap);
    toast.success(`Bloqueados ${filteredStudents.length} alumnos.`);
  };

  // Guardar cambios
  const handleSave = async () => {
    setIsSaving(true);
    const saveToast = toast.loading('Guardando configuración de notas en el portal...');
    try {
      const res = await gradesReleaseService.saveReleasedMap(centerId, schoolYear, releasedMap);
      if (res.success) {
        toast.success(`¡Configuración aplicada con éxito!`, { id: saveToast });
        onClose();
      } else {
        toast.error('Ocurrió un error al guardar.', { id: saveToast });
      }
    } catch (error: any) {
      console.error('Error guardando liberaciones:', error);
      toast.error('Error al guardar: ' + error.message, { id: saveToast });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] w-full max-w-5xl shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* HEADER */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <FileSpreadsheet size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300 bg-indigo-950/60 px-2.5 py-0.5 rounded-full border border-indigo-800/50">
                  Control Financiero
                </span>
                <span className="text-[10px] font-bold text-slate-400">Ciclo {schoolYear}</span>
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-white mt-0.5">
                Liberación de Calificaciones a Familias
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X size={20} />
          </button>
        </div>

        {/* EXPLICACIÓN Y MÉTRICAS */}
        <div className="p-5 bg-indigo-50/50 dark:bg-slate-900/40 border-b border-indigo-100 dark:border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-2.5 max-w-xl">
            <Info size={18} className="text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed">
              <strong className="font-black text-slate-900 dark:text-white">Regla de Visualización:</strong> Por defecto ningún padre puede ver notas. Solo los alumnos que cotejes aquí tendrán habilitado el módulo de calificaciones (4 competencias y promedio) en su portal.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <div className="px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs flex items-center gap-2 shrink-0">
              <Users size={14} className="text-slate-500" />
              <div className="text-left">
                <div className="text-[9px] font-black uppercase text-slate-400">Total Alumnos</div>
                <div className="text-sm font-black text-slate-800 dark:text-white">{totalStudents}</div>
              </div>
            </div>

            <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 shadow-xs flex items-center gap-2 shrink-0">
              <CheckCircle2 size={14} className="text-emerald-600" />
              <div className="text-left">
                <div className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400">Habilitados</div>
                <div className="text-sm font-black text-emerald-700 dark:text-emerald-300">{totalReleased}</div>
              </div>
            </div>

            <div className="px-3.5 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 shadow-xs flex items-center gap-2 shrink-0">
              <Lock size={14} className="text-rose-600" />
              <div className="text-left">
                <div className="text-[9px] font-black uppercase text-rose-600 dark:text-rose-400">Bloqueados</div>
                <div className="text-sm font-black text-rose-700 dark:text-rose-300">{totalBlocked}</div>
              </div>
            </div>
          </div>
        </div>

        {/* BARRA DE ACCIONES MASIVAS Y FILTROS */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 space-y-4 bg-white dark:bg-slate-900">
          {/* Botones de Acción Masiva */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleBulkReleaseUpToDateOnly}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md shadow-emerald-500/20 transition-all cursor-pointer active:scale-95"
                title="Cotejar únicamente a los estudiantes sin deuda/mora y bloquear a los que tienen balance pendiente"
              >
                <Sparkles size={15} />
                <span>Cotejar Alumnos al Día (Sin Deuda)</span>
              </button>

              <button
                type="button"
                onClick={handleBulkEnableAll}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <CheckCheck size={14} />
                <span>Cotejar Visibles ({filteredStudents.length})</span>
              </button>

              <button
                type="button"
                onClick={handleBulkDisableAll}
                className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-rose-600 dark:text-rose-400 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Lock size={14} />
                <span>Bloquear Visibles</span>
              </button>
            </div>

            <div className="text-xs text-slate-500 font-bold">
              Mostrando <strong className="text-slate-900 dark:text-white">{filteredStudents.length}</strong> alumnos
            </div>
          </div>

          {/* Filtros de Búsqueda */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-2">
            <div className="sm:col-span-5 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Buscar por nombre de alumno o RNE..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white"
              />
            </div>

            <div className="sm:col-span-4">
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white cursor-pointer"
              >
                <option value="ALL">-- TODOS LOS CURSOS --</option>
                {courses.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.level ? `${c.level} ` : ''}{c.grade} "{c.section}" ({c.tanda || 'Matutina'})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-3">
              <select
                value={financialFilter}
                onChange={(e: any) => setFinancialFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-white cursor-pointer"
              >
                <option value="ALL">TODOS LOS ESTADOS</option>
                <option value="UP_TO_DATE">🟢 SOLO AL DÍA</option>
                <option value="WITH_DEBT">🔴 SOLO CON DEUDA/MORA</option>
              </select>
            </div>
          </div>
        </div>

        {/* TABLA DE ALUMNOS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-950/20">
          {isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 size={32} className="animate-spin text-indigo-600" />
              <span className="text-xs font-bold uppercase tracking-widest">Cargando datos de liberación...</span>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="py-16 text-center text-slate-400 font-bold text-xs space-y-2">
              <Users size={36} className="mx-auto opacity-30 mb-2" />
              <p>No se encontraron estudiantes con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-4 text-center w-12">
                      <span className="sr-only">Selección</span>
                    </th>
                    <th className="py-3 px-4">Estudiante</th>
                    <th className="py-3 px-4">Curso / Grado</th>
                    <th className="py-3 px-4 text-center">Estado Financiero</th>
                    <th className="py-3 px-4 text-center">Acceso a Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {filteredStudents.map((student: any) => {
                    const isReleased = !!releasedMap[student.id];
                    const isUpToDate = !student.hasOverdue && (student.status === 'Al día' || student.status === 'Saldado' || student.balance <= 0);
                    const courseObj = courses.find((c: any) => c.id === student.course_id);

                    const fullName = `${student.first_surname || student.last_name || ''} ${student.second_surname || ''}, ${student.names || student.first_name || ''}`.toUpperCase().trim();

                    return (
                      <tr
                        key={student.id}
                        onClick={() => toggleStudent(student.id)}
                        className={`transition-colors cursor-pointer select-none ${
                          isReleased
                            ? 'bg-emerald-50/30 dark:bg-emerald-950/20 hover:bg-emerald-50/60'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isReleased}
                            onChange={() => toggleStudent(student.id)}
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-black text-slate-800 dark:text-white flex items-center gap-2">
                            <span>{fullName || 'ESTUDIANTE'}</span>
                            {isReleased ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                <Unlock size={10} /> Habilitado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                                <Lock size={10} /> Bloqueado
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            RNE: {student.sigerd_code || student.student_code || student.rne || '---'}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            {courseObj
                              ? `${courseObj.grade} "${courseObj.section}" (${courseObj.level || ''})`
                              : 'Sin Curso'}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isUpToDate ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 size={12} /> Al Día (RD$ 0.00)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                              <AlertTriangle size={12} />
                              <span>Deuda: RD$ {Number(student.balance || 0).toLocaleString()}</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStudent(student.id);
                            }}
                            className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                              isReleased
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                            }`}
                          >
                            {isReleased ? '✓ Notas Visibles' : '✕ Oculto'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* FOOTER CON BOTÓN GUARDAR */}
        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4 bg-white dark:bg-slate-900">
          <div className="text-xs text-slate-500 font-medium hidden sm:block">
            {totalReleased} de {totalStudents} alumnos tienen acceso al boletín en este momento.
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-slate-900/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>Guardar y Aplicar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
