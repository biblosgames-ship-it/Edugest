import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Plus,
  Trash2,
  Send,
  X,
  Layers,
  Sparkles,
  Users,
  Award,
  ChevronRight,
  Filter,
  Check
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { recoveryPlanService, RecoveryPlan, RecoveryPlanStudent, RecoveryScheduleWeek } from '../services/recoveryPlanService';

interface RecoveryPlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  course: any;
  subjects: any[];
  students: any[];
  grades: any[];
  centerId: string;
  schoolYear: string;
  activePeriod?: string;
  userId?: string;
}

export const RecoveryPlanModal: React.FC<RecoveryPlanModalProps> = ({
  isOpen,
  onClose,
  course,
  subjects = [],
  students = [],
  grades = [],
  centerId,
  schoolYear = '2026-2027',
  activePeriod = 'P1',
  userId
}) => {
  const [plans, setPlans] = useState<RecoveryPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<RecoveryPlan | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Umbral según nivel dominicano: Primaria 65, Secundaria 70
  const isPrimary = useMemo(() => {
    const lvl = (course?.level || '').toLowerCase();
    const grd = (course?.grade || '').toLowerCase();
    return lvl.includes('prim') || grd.includes('prim');
  }, [course?.level, course?.grade]);

  const passingThreshold = isPrimary ? 65 : 70;

  // Estado del formulario del nuevo plan
  const [period, setPeriod] = useState<string>(activePeriod || 'P1');
  const [title, setTitle] = useState<string>(`Plan de Recuperación - ${activePeriod || 'P1'}`);
  const [planMode, setPlanMode] = useState<'single' | 'weekly'>('weekly');
  const [singleStartDate, setSingleStartDate] = useState<string>('');
  const [singleEndDate, setSingleEndDate] = useState<string>('');

  // Semanas configuradas
  const [weeks, setWeeks] = useState<RecoveryScheduleWeek[]>([
    {
      weekNumber: 1,
      startDate: '',
      endDate: '',
      subjectIds: [],
      title: 'Semana 1'
    }
  ]);

  // Selección manual / automática de alumnos por materia
  // Map: `${studentId}_${subjectId}` -> { student, subject, originalScore, selected, weekNumber }
  const [candidateEntries, setCandidateEntries] = useState<Array<{
    studentId: string;
    studentName: string;
    subjectId: string;
    subjectName: string;
    originalScore: number;
    weekNumber: number;
    selected: boolean;
  }>>([]);

  // Cargar planes existentes al abrir
  useEffect(() => {
    if (!isOpen || !course?.id) return;
    loadCoursePlans();
  }, [isOpen, course?.id]);

  const loadCoursePlans = async () => {
    setLoading(true);
    try {
      const data = await recoveryPlanService.getPlans(course.id, schoolYear);
      setPlans(data);
    } catch (e) {
      console.warn('Error loading plans:', e);
    } finally {
      setLoading(false);
    }
  };

  // Calcular automáticamente qué alumnos están por debajo del umbral en el período seleccionado
  const computeCandidates = () => {
    const results: Array<{
      studentId: string;
      studentName: string;
      subjectId: string;
      subjectName: string;
      originalScore: number;
      weekNumber: number;
      selected: boolean;
    }> = [];

    // Filtrar asignaturas válidas del curso
    const courseSubjects = subjects.filter((s) => !s.course_id || s.course_id === course?.id);

    students.forEach((st) => {
      const stName = `${st.first_surname || st.last_name || ''} ${st.names || st.first_name || ''}`.trim() || 'Estudiante';

      courseSubjects.forEach((sub) => {
        // Buscar la calificación del estudiante para esta materia y período
        const gRecord = grades.find((g) => {
          const matchStudent = g.student_id === st.id;
          const matchSub = g.subject_id === sub.id;
          return matchStudent && matchSub;
        });

        let score = 0;
        if (gRecord) {
          if (period === 'P1') score = Number(gRecord.p1_final || gRecord.p1) || 0;
          else if (period === 'P2') score = Number(gRecord.p2_final || gRecord.p2) || 0;
          else if (period === 'P3') score = Number(gRecord.p3_final || gRecord.p3) || 0;
          else if (period === 'P4') score = Number(gRecord.p4_final || gRecord.p4) || 0;
          else if (period === 'FINAL') score = Number(gRecord.final_score || gRecord.cf) || 0;
        }

        // Si la nota es mayor que 0 y menor que el umbral (o si no tiene nota pero está reprobado)
        if (score > 0 && score < passingThreshold) {
          results.push({
            studentId: st.id,
            studentName: stName,
            subjectId: sub.id,
            subjectName: sub.name,
            originalScore: score,
            weekNumber: 1,
            selected: true
          });
        }
      });
    });

    setCandidateEntries(results);
  };

  // Cada vez que cambia el período o al iniciar creación, recalcular candidatos
  useEffect(() => {
    if (isCreating) {
      setTitle(`Plan de Recuperación ${period === 'FINAL' ? 'Final' : `Período ${period}`} - ${course?.grade || ''} ${course?.section || ''}`);
      computeCandidates();
    }
  }, [isCreating, period]);

  // Manejo de semanas
  const handleAddWeek = () => {
    const nextNum = weeks.length + 1;
    setWeeks((prev) => [
      ...prev,
      {
        weekNumber: nextNum,
        startDate: '',
        endDate: '',
        subjectIds: [],
        title: `Semana ${nextNum}`
      }
    ]);
  };

  const handleRemoveWeek = (weekNum: number) => {
    if (weeks.length <= 1) return;
    setWeeks((prev) => prev.filter((w) => w.weekNumber !== weekNum));
    // Reasignar alumnos a semana 1 si su semana fue eliminada
    setCandidateEntries((prev) =>
      prev.map((c) => (c.weekNumber === weekNum ? { ...c, weekNumber: 1 } : c))
    );
  };

  const handleSavePlan = async (status: 'draft' | 'active') => {
    if (!title.trim()) {
      toast.error('Ingresa un título para el plan.');
      return;
    }

    const selectedCandidates = candidateEntries.filter((c) => c.selected);
    if (selectedCandidates.length === 0) {
      toast.error('Selecciona al menos un estudiante y asignatura para el plan.');
      return;
    }

    // Preparar semanas
    let finalWeeks: RecoveryScheduleWeek[] = [];
    if (planMode === 'single') {
      if (!singleStartDate || !singleEndDate) {
        toast.error('Por favor ingresa las fechas de inicio y fin del plan.');
        return;
      }
      finalWeeks = [
        {
          weekNumber: 1,
          startDate: singleStartDate,
          endDate: singleEndDate,
          subjectIds: Array.from(new Set(selectedCandidates.map((c) => c.subjectId))),
          title: 'Período Completo de Recuperación'
        }
      ];
    } else {
      // Validar fechas de cada semana
      for (const w of weeks) {
        if (!w.startDate || !w.endDate) {
          toast.error(`Ingresa la fecha de inicio y fin para la Semana ${w.weekNumber}.`);
          return;
        }
      }
      finalWeeks = weeks.map((w) => ({
        ...w,
        subjectIds: Array.from(
          new Set(selectedCandidates.filter((c) => c.weekNumber === w.weekNumber).map((c) => c.subjectId))
        )
      }));
    }

    setLoading(true);
    try {
      const planPayload: Partial<RecoveryPlan> = {
        center_id: centerId,
        course_id: course.id,
        school_year: schoolYear,
        period,
        title,
        description: `Plan de recuperación para ${selectedCandidates.length} registros reprobados (Umbral < ${passingThreshold} pts).`,
        start_date: finalWeeks[0]?.startDate,
        end_date: finalWeeks[finalWeeks.length - 1]?.endDate,
        schedule_weeks: finalWeeks,
        status,
        created_by: userId
      };

      const studentsPayload: Partial<RecoveryPlanStudent>[] = selectedCandidates.map((c) => {
        const assignedWeek = finalWeeks.find((w) => w.weekNumber === c.weekNumber) || finalWeeks[0];
        return {
          student_id: c.studentId,
          subject_id: c.subjectId,
          original_score: c.originalScore,
          status: 'pending',
          week_number: c.weekNumber,
          start_date: assignedWeek?.startDate,
          end_date: assignedWeek?.endDate
        };
      });

      await recoveryPlanService.savePlan(planPayload, studentsPayload);
      toast.success(
        status === 'active'
          ? '¡Plan activado con éxito! Se sincronizó con la Agenda y las alertas para padres.'
          : 'Plan guardado como borrador.'
      );
      setIsCreating(false);
      await loadCoursePlans();
    } catch (e: any) {
      console.error('Error guardando plan:', e);
      toast.error('No se pudo guardar el plan de recuperación.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-surface border border-border-main rounded-[2.5rem] w-full max-w-4xl shadow-2xl overflow-hidden my-8 animate-in zoom-in-95 duration-200">
        {/* ENCABEZADO */}
        <div className="p-6 sm:p-8 bg-gradient-to-r from-amber-500/10 via-brand-bg to-brand-blue/10 border-b border-border-main flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Award size={24} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-text-main flex items-center gap-2">
                Plan de Recuperación Pedagógica
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                  {isPrimary ? 'Primaria • Mínimo 65' : 'Secundaria • Mínimo 70'}
                </span>
              </h2>
              <p className="text-xs font-bold text-text-muted">
                {course?.grade} {course?.section} • Año Lectivo {schoolYear}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2.5 rounded-full hover:bg-brand-bg text-text-muted hover:text-text-main transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto custom-scrollbar">
          {!isCreating ? (
            /* VISTA DE PLANES EXISTENTES */
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-text-main uppercase tracking-wider">
                    Planes de Recuperación del Curso
                  </h3>
                  <p className="text-xs text-text-muted font-medium">
                    Consulta los planes activos, edítalos o crea uno nuevo para este período.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreating(true)}
                  className="px-5 py-3 bg-brand-blue hover:bg-blue-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-brand-blue/20 transition-all cursor-pointer active:scale-95"
                >
                  <Plus size={16} />
                  Crear Nuevo Plan
                </button>
              </div>

              {plans.length === 0 ? (
                <div className="p-12 text-center rounded-3xl border-2 border-dashed border-border-main space-y-3 bg-brand-bg/50">
                  <Award size={40} className="mx-auto text-amber-500/60 animate-bounce" />
                  <p className="text-sm font-bold text-text-main">No hay planes de recuperación activos</p>
                  <p className="text-xs text-text-muted max-w-md mx-auto">
                    Los planes permiten organizar a los estudiantes que no alcanzaron el puntaje mínimo ({passingThreshold} pts) en semanas de evaluación y tareas específicas.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {plans.map((p) => (
                    <div
                      key={p.id}
                      className="p-5 rounded-2xl bg-brand-bg border border-border-main space-y-3 relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600">
                          Período {p.period}
                        </span>
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                            p.status === 'active'
                              ? 'bg-emerald-500/15 text-emerald-600'
                              : 'bg-slate-500/15 text-slate-500'
                          }`}
                        >
                          {p.status === 'active' ? '● Activo en Calendario' : '○ Borrador'}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-text-main">{p.title}</h4>
                      <p className="text-xs text-text-muted line-clamp-2">{p.description}</p>
                      
                      <div className="pt-2 border-t border-border-main flex items-center justify-between text-[11px] font-bold text-text-muted">
                        <span>{p.schedule_weeks?.length || 1} Semana(s) programada(s)</span>
                        {p.start_date && (
                          <span className="text-indigo-600">
                            {p.start_date} al {p.end_date}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* FORMULARIO DE CREACIÓN DE PLAN */
            <div className="space-y-6">
              {/* PASO 1: METADATOS BÁSICOS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Período a Recuperar
                  </label>
                  <select
                    value={period}
                    onChange={(e) => setPeriod(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-brand-bg border border-border-main rounded-xl text-xs font-bold text-text-main outline-none focus:ring-2 focus:ring-brand-blue"
                  >
                    <option value="P1">Período 1 (P1)</option>
                    <option value="P2">Período 2 (P2)</option>
                    <option value="P3">Período 3 (P3)</option>
                    <option value="P4">Período 4 (P4)</option>
                    <option value="FINAL">Fin de Año (Calificación Final)</option>
                  </select>
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-text-muted">
                    Título del Plan
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej. Plan de Recuperación Pedagógica P1"
                    className="w-full px-3.5 py-2.5 bg-brand-bg border border-border-main rounded-xl text-xs font-bold text-text-main outline-none focus:ring-2 focus:ring-brand-blue"
                  />
                </div>
              </div>

              {/* PASO 2: ESTRUCTURA DEL CALENDARIO (ÚNICO O POR SEMANAS) */}
              <div className="p-5 rounded-2xl bg-brand-bg border border-border-main space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-text-main flex items-center gap-2">
                      <Calendar size={14} className="text-amber-500" />
                      Cronograma y Fechas en el Calendario
                    </h4>
                    <p className="text-[11px] text-text-muted font-medium">
                      Define si las materias se recuperan en un único rango de fechas o escalonadas por semanas.
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-border-main">
                    <button
                      type="button"
                      onClick={() => setPlanMode('single')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        planMode === 'single' ? 'bg-brand-blue text-white shadow-sm' : 'text-text-muted'
                      }`}
                    >
                      Rango Único
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanMode('weekly')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        planMode === 'weekly' ? 'bg-brand-blue text-white shadow-sm' : 'text-text-muted'
                      }`}
                    >
                      Por Semanas
                    </button>
                  </div>
                </div>

                {planMode === 'single' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-text-muted">Fecha de Inicio</label>
                      <input
                        type="date"
                        value={singleStartDate}
                        onChange={(e) => setSingleStartDate(e.target.value)}
                        className="w-full px-3 py-2 bg-surface border border-border-main rounded-xl text-xs font-bold text-text-main outline-none focus:ring-2 focus:ring-brand-blue"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-text-muted">Fecha de Fin</label>
                      <input
                        type="date"
                        value={singleEndDate}
                        onChange={(e) => setSingleEndDate(e.target.value)}
                        className="w-full px-3 py-2 bg-surface border border-border-main rounded-xl text-xs font-bold text-text-main outline-none focus:ring-2 focus:ring-brand-blue"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    {weeks.map((w) => (
                      <div
                        key={w.weekNumber}
                        className="p-3.5 bg-surface rounded-xl border border-border-main flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-600 font-black text-xs flex items-center justify-center shrink-0">
                            {w.weekNumber}
                          </span>
                          <span className="text-xs font-black uppercase text-text-main">
                            Semana {w.weekNumber}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 flex-1 sm:max-w-md">
                          <input
                            type="date"
                            value={w.startDate}
                            onChange={(e) =>
                              setWeeks((prev) =>
                                prev.map((item) =>
                                  item.weekNumber === w.weekNumber ? { ...item, startDate: e.target.value } : item
                                )
                              )
                            }
                            className="w-full px-2.5 py-1.5 bg-brand-bg border border-border-main rounded-lg text-xs font-bold text-text-main outline-none"
                          />
                          <span className="text-text-muted text-xs">al</span>
                          <input
                            type="date"
                            value={w.endDate}
                            onChange={(e) =>
                              setWeeks((prev) =>
                                prev.map((item) =>
                                  item.weekNumber === w.weekNumber ? { ...item, endDate: e.target.value } : item
                                )
                              )
                            }
                            className="w-full px-2.5 py-1.5 bg-brand-bg border border-border-main rounded-lg text-xs font-bold text-text-main outline-none"
                          />
                        </div>

                        {weeks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveWeek(w.weekNumber)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))}

                    <button
                      type="button"
                      onClick={handleAddWeek}
                      className="text-xs font-black uppercase text-brand-blue hover:text-blue-600 flex items-center gap-1.5 pt-1 cursor-pointer"
                    >
                      <Plus size={14} /> Agregar otra semana de evaluación
                    </button>
                  </div>
                )}
              </div>

              {/* PASO 3: ESTUDIANTES Y ASIGNATURAS DETECTADAS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-text-main flex items-center gap-2">
                      <Users size={14} className="text-indigo-500" />
                      Alumnos Detectados por Debajo del Umbral ({candidateEntries.length})
                    </h4>
                    <p className="text-[11px] text-text-muted font-medium">
                      Alumnos con calificación menor a {passingThreshold} en {period}. Asigna a qué semana le corresponde evaluarse.
                    </p>
                  </div>
                </div>

                {candidateEntries.length === 0 ? (
                  <div className="p-6 text-center rounded-2xl bg-brand-bg border border-border-main text-xs font-bold text-emerald-600 space-y-1">
                    <CheckCircle2 size={24} className="mx-auto text-emerald-500" />
                    <span>¡Excelente! No se detectaron estudiantes con promedio menor a {passingThreshold} en este período.</span>
                  </div>
                ) : (
                  <div className="border border-border-main rounded-2xl overflow-hidden">
                    <div className="max-h-60 overflow-y-auto custom-scrollbar divide-y divide-border-main">
                      {candidateEntries.map((c, idx) => (
                        <div
                          key={`${c.studentId}_${c.subjectId}`}
                          className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface hover:bg-brand-bg/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={c.selected}
                              onChange={(e) =>
                                setCandidateEntries((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, selected: e.target.checked } : item
                                  )
                                )
                              }
                              className="w-4 h-4 rounded text-brand-blue cursor-pointer"
                            />
                            <div>
                              <p className="text-xs font-bold text-text-main">{c.studentName}</p>
                              <p className="text-[11px] text-text-muted font-medium">
                                {c.subjectName} • Calificación:{' '}
                                <span className="text-rose-500 font-bold">{c.originalScore} pts</span>
                              </p>
                            </div>
                          </div>

                          {planMode === 'weekly' && (
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-text-muted uppercase">Semana:</span>
                              <select
                                value={c.weekNumber}
                                onChange={(e) =>
                                  setCandidateEntries((prev) =>
                                    prev.map((item, i) =>
                                      i === idx ? { ...item, weekNumber: Number(e.target.value) } : item
                                    )
                                  )
                                }
                                className="px-2 py-1 bg-brand-bg border border-border-main rounded-lg text-xs font-bold text-text-main outline-none"
                              >
                                {weeks.map((w) => (
                                  <option key={w.weekNumber} value={w.weekNumber}>
                                    Semana {w.weekNumber}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div className="pt-4 border-t border-border-main flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-4 py-2.5 rounded-xl border border-border-main text-xs font-bold text-text-muted hover:text-text-main transition-colors"
                >
                  Volver a Lista de Planes
                </button>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSavePlan('draft')}
                    className="px-4 py-2.5 rounded-xl border border-border-main bg-surface hover:bg-brand-bg text-xs font-black uppercase text-text-main transition-colors disabled:opacity-50"
                  >
                    Guardar Borrador
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => handleSavePlan('active')}
                    className="px-5 py-2.5 bg-brand-blue hover:bg-blue-600 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-brand-blue/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                  >
                    <Send size={15} />
                    Activar y Sincronizar Calendario
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
