import React, { useState, useEffect, useMemo } from 'react';
import {
  ClipboardCheck,
  User,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Send,
  Sparkles,
  Award,
  X
} from 'lucide-react';
import {
  staffEvaluationService,
  ActiveSurveyBroadcast,
  EvaluationRubricTemplate,
  StaffEvaluationRecord,
  calculateLevelFromAverage
} from '../services/staffEvaluationService';
import { useApp } from '../context/AppContext';
import { toast } from 'react-hot-toast';

interface StudentTeacherSurveyBannerProps {
  centerId?: string;
  centerName?: string;
  schoolYear?: string;
  courseId?: string;
  courseName?: string;
  userProfile?: any;
  studentName?: string;
}

export const StudentTeacherSurveyBanner: React.FC<StudentTeacherSurveyBannerProps> = ({
  centerId,
  centerName,
  schoolYear = '2026-2027',
  courseId,
  courseName,
  userProfile,
  studentName
}) => {
  const { state } = useApp();
  const [broadcasts, setBroadcasts] = useState<ActiveSurveyBroadcast[]>([]);
  const [rubric, setRubric] = useState<EvaluationRubricTemplate | null>(null);
  const [existingRecords, setExistingRecords] = useState<StaffEvaluationRecord[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);

  // Modal de evaluación activa
  const [activeTeacherForSurvey, setActiveTeacherForSurvey] = useState<{
    teacherId: string;
    teacherName: string;
    subjectId?: string;
    subjectName?: string;
    broadcast: ActiveSurveyBroadcast;
  } | null>(null);

  const [scores, setScores] = useState<Record<string, number>>({});
  const [generalNotes, setGeneralNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isParent = ['parent', 'padre', 'madre', 'tutor', 'familiar'].includes(
    (userProfile?.role || '').toLowerCase()
  );
  const audienceRole: 'student' | 'parent' = isParent ? 'parent' : 'student';
  const sourceType = isParent ? 'parent_survey' : 'student_survey';

  const loadSurveyData = async () => {
    if (!centerId) return;
    try {
      const [bList, rubricsMap, evals] = await Promise.all([
        staffEvaluationService.getSurveyBroadcasts(centerId),
        staffEvaluationService.getRubrics(centerId, centerName),
        staffEvaluationService.getEvaluations(centerId, schoolYear)
      ]);
      setBroadcasts(bList || []);
      setRubric(rubricsMap.student_survey || null);
      setExistingRecords(evals || []);
    } catch (e) {
      console.warn('Error cargando encuestas estudiantiles:', e);
    }
  };

  useEffect(() => {
    loadSurveyData();
    const handler = () => loadSurveyData();
    window.addEventListener('staffSurveyBroadcastsUpdated', handler);
    window.addEventListener('staffEvaluationsUpdated', handler);
    return () => {
      window.removeEventListener('staffSurveyBroadcastsUpdated', handler);
      window.removeEventListener('staffEvaluationsUpdated', handler);
    };
  }, [centerId, schoolYear]);

  // Filtrar convocatorias activas para este rol y curso
  const activeBroadcast = useMemo(() => {
    return broadcasts.find((b) => {
      if (!b.isActive) return false;
      if (b.schoolYear && b.schoolYear !== schoolYear) return false;
      if (!b.targetAudience.includes(audienceRole)) return false;
      if (b.targetCourseIds && b.targetCourseIds.length > 0 && courseId) {
        if (!b.targetCourseIds.includes(courseId)) return false;
      }
      return true;
    });
  }, [broadcasts, schoolYear, audienceRole, courseId]);

  // Obtener lista de docentes que imparten clase en este curso
  const courseTeachers = useMemo(() => {
    if (!courseId || !activeBroadcast) return [];
    const assignments = (state.assignments || []).filter(
      (a: any) => (a.course_id || a.courseId) === courseId
    );
    const teachers = state.teachers || [];
    const subjects = state.subjects || [];

    const map = new Map<
      string,
      { teacherId: string; teacherName: string; subjectId: string; subjectName: string }
    >();

    assignments.forEach((asg: any) => {
      const tId = asg.teacher_id || asg.teacherId;
      const sId = asg.subject_id || asg.subjectId;
      if (!tId) return;

      if (
        activeBroadcast.targetTeacherIds &&
        activeBroadcast.targetTeacherIds.length > 0 &&
        !activeBroadcast.targetTeacherIds.includes(tId)
      ) {
        return;
      }

      const teacherObj = teachers.find((t: any) => t.id === tId);
      const subjectObj = subjects.find((s: any) => s.id === sId);
      if (!teacherObj) return;

      const key = `${tId}_${sId || 'general'}`;
      if (!map.has(key)) {
        map.set(key, {
          teacherId: tId,
          teacherName: teacherObj.full_name || teacherObj.name || 'Docente',
          subjectId: sId || '',
          subjectName: subjectObj?.name || 'Docente del Curso'
        });
      }
    });

    // Fallback: si no hay asignaciones en el curso pero hay docentes específicos en el broadcast
    if (map.size === 0 && activeBroadcast.targetTeacherIds?.length > 0) {
      activeBroadcast.targetTeacherIds.forEach((tId) => {
        const teacherObj = teachers.find((t: any) => t.id === tId);
        if (teacherObj) {
          map.set(tId, {
            teacherId: tId,
            teacherName: teacherObj.full_name || teacherObj.name || 'Docente',
            subjectId: '',
            subjectName: teacherObj.area || 'Docencia General'
          });
        }
      });
    }

    return Array.from(map.values());
  }, [courseId, activeBroadcast, state.assignments, state.teachers, state.subjects]);

  if (!activeBroadcast || !rubric || courseTeachers.length === 0) {
    return null;
  }

  const evaluatorId = userProfile?.id || 'anon_user';

  const hasEvaluatedTeacher = (teacherId: string, subjectId?: string) => {
    return existingRecords.some(
      (r) =>
        r.period === activeBroadcast.period &&
        r.staffId === teacherId &&
        r.evaluatorId === evaluatorId &&
        r.source === sourceType &&
        (!subjectId || !r.subjectId || r.subjectId === subjectId)
    );
  };

  const completedCount = courseTeachers.filter((ct) =>
    hasEvaluatedTeacher(ct.teacherId, ct.subjectId)
  ).length;

  const openSurveyModal = (ct: {
    teacherId: string;
    teacherName: string;
    subjectId?: string;
    subjectName?: string;
  }) => {
    const existing = existingRecords.find(
      (r) =>
        r.period === activeBroadcast.period &&
        r.staffId === ct.teacherId &&
        r.evaluatorId === evaluatorId &&
        r.source === sourceType &&
        (!ct.subjectId || !r.subjectId || r.subjectId === ct.subjectId)
    );

    if (existing) {
      setScores(existing.scores || {});
      setGeneralNotes(existing.generalNotes || '');
    } else {
      const initial: Record<string, number> = {};
      rubric.criteria.forEach((c) => {
        c.indicators.forEach((ind) => {
          initial[ind.id] = 4;
        });
      });
      setScores(initial);
      setGeneralNotes('');
    }

    setActiveTeacherForSurvey({
      ...ct,
      broadcast: activeBroadcast
    });
  };

  const handleSubmitSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTeacherForSurvey || !rubric || !centerId) return;

    const allIndicators = rubric.criteria.flatMap((c) => c.indicators);
    const unanswered = allIndicators.filter((ind) => !scores[ind.id]);
    if (unanswered.length > 0) {
      toast.error(`Por favor responde todos los indicadores (${unanswered.length} pendientes).`);
      return;
    }

    setIsSubmitting(true);
    try {
      const criteriaAverages: Record<string, number> = {};
      let totalScore = 0;
      let totalIndicators = 0;

      rubric.criteria.forEach((crit) => {
        let critSum = 0;
        crit.indicators.forEach((ind) => {
          const val = Number(scores[ind.id] || 0);
          critSum += val;
          totalScore += val;
          totalIndicators++;
        });
        criteriaAverages[crit.id] =
          crit.indicators.length > 0
            ? Number((critSum / crit.indicators.length).toFixed(2))
            : 0;
      });

      const maxScore = totalIndicators * 4;
      const averageScore =
        totalIndicators > 0 ? Number((totalScore / totalIndicators).toFixed(2)) : 0;
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
      const levelInfo = calculateLevelFromAverage(averageScore);

      const recordId = `surv_${activeBroadcast.period}_${activeTeacherForSurvey.teacherId}_${activeTeacherForSurvey.subjectId || 'gen'}_${evaluatorId}`;

      const record: StaffEvaluationRecord = {
        id: recordId,
        centerId,
        schoolYear,
        period: activeBroadcast.period,
        staffId: activeTeacherForSurvey.teacherId,
        staffName: activeTeacherForSurvey.teacherName,
        staffRole: 'teacher',
        evaluatorId,
        evaluatorName:
          studentName ||
          userProfile?.full_name ||
          (isParent ? 'Padre / Madre de Familia' : 'Estudiante'),
        evaluatorRole: audienceRole,
        source: sourceType,
        courseId,
        courseName,
        subjectId: activeTeacherForSurvey.subjectId,
        subjectName: activeTeacherForSurvey.subjectName,
        scores,
        criteriaAverages,
        totalScore,
        maxScore,
        averageScore,
        percentage,
        levelLabel: levelInfo.label,
        generalNotes: generalNotes.trim(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await staffEvaluationService.saveEvaluation(record, userProfile?.id);
      toast.success(
        `¡Gracias! Tu evaluación para Prof. ${activeTeacherForSurvey.teacherName} ha sido enviada.`
      );
      setActiveTeacherForSurvey(null);
      await loadSurveyData();
    } catch (err) {
      console.error('Error guardando encuesta docente:', err);
      toast.error('No se pudo guardar la encuesta. Intenta nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isMinimized) {
    return (
      <div className="mb-6 bg-gradient-to-r from-teal-900 to-emerald-900 text-white px-5 py-3 rounded-2xl shadow-md flex items-center justify-between animate-fade-in border border-emerald-700/50">
        <div className="flex items-center gap-3">
          <span className="p-2 bg-white/10 rounded-xl text-emerald-300">
            <ClipboardCheck size={18} />
          </span>
          <div>
            <p className="text-xs font-black tracking-wide uppercase text-emerald-200">
              {activeBroadcast.title} ({activeBroadcast.period})
            </p>
            <p className="text-[11px] text-emerald-100">
              Has evaluado a {completedCount} de {courseTeachers.length} docentes de tu curso
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
        >
          <span>Abrir Encuesta</span>
          <ChevronDown size={14} />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 rounded-[2.5rem] bg-gradient-to-br from-emerald-950 via-teal-900 to-slate-900 text-white p-6 md:p-8 shadow-2xl border-2 border-emerald-500/30 relative overflow-hidden animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
              <Sparkles size={12} />
              Encuesta Institucional Activa • Período {activeBroadcast.period}
            </span>
            <span className="text-xs font-bold text-emerald-300">
              {completedCount}/{courseTeachers.length} completadas
            </span>
          </div>

          <button
            onClick={() => setIsMinimized(true)}
            className="text-emerald-200 hover:text-white text-xs flex items-center gap-1 transition-colors px-2.5 py-1 rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <span>Minimizar</span>
            <ChevronUp size={14} />
          </button>
        </div>

        <div className="space-y-2 mb-6">
          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
            {activeBroadcast.title}
          </h2>
          <p className="text-xs md:text-sm text-emerald-100/90 max-w-3xl leading-relaxed">
            {activeBroadcast.description ||
              'Tu opinión nos ayuda a fortalecer la calidad educativa de nuestro centro. Selecciona cada docente para valorar su desempeño en este período.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {courseTeachers.map((ct) => {
            const done = hasEvaluatedTeacher(ct.teacherId, ct.subjectId);
            return (
              <div
                key={`${ct.teacherId}_${ct.subjectId}`}
                className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  done
                    ? 'bg-emerald-500/20 border-emerald-400/40'
                    : 'bg-white/10 border-white/15 hover:bg-white/15'
                }`}
              >
                <div className="min-w-0">
                  <p className="text-xs font-black text-white uppercase truncate flex items-center gap-1.5">
                    <User size={13} className="text-emerald-300 shrink-0" />
                    <span className="truncate">{ct.teacherName}</span>
                  </p>
                  <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider truncate mt-0.5 flex items-center gap-1">
                    <BookOpen size={11} className="shrink-0" />
                    <span className="truncate">{ct.subjectName}</span>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => openSurveyModal(ct)}
                  className={`px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                    done
                      ? 'bg-emerald-400/25 text-emerald-100 hover:bg-emerald-400/35'
                      : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg'
                  }`}
                >
                  {done ? (
                    <>
                      <CheckCircle2 size={13} />
                      <span>Evaluado</span>
                    </>
                  ) : (
                    <>
                      <ClipboardCheck size={13} />
                      <span>Evaluar</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* MODAL PARA RESPONDER ENCUESTA DEL DOCENTE */}
      {activeTeacherForSurvey && rubric && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Cabecera fija */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-400/20">
                  Período {activeTeacherForSurvey.broadcast.period} • {courseName || 'Mi Curso'}
                </span>
                <h3 className="text-lg md:text-xl font-black uppercase tracking-tight mt-2">
                  Evaluando a: Prof. {activeTeacherForSurvey.teacherName}
                </h3>
                <p className="text-xs text-slate-300 font-bold uppercase tracking-wider">
                  Materia: {activeTeacherForSurvey.subjectName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTeacherForSurvey(null)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Cuerpo desplazable */}
            <form onSubmit={handleSubmitSurvey} className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Leyenda de escala 1 a 4 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                {rubric.scale.map((s) => (
                  <div
                    key={s.value}
                    className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-2xs"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-6 h-6 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0"
                        style={{ backgroundColor: s.color }}
                      >
                        {s.value}
                      </span>
                      <span className="text-[11px] font-black text-slate-800 leading-tight">
                        {s.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug">{s.description}</p>
                  </div>
                ))}
              </div>

              {/* Lista de criterios e indicadores */}
              <div className="space-y-6">
                {rubric.criteria.map((crit) => (
                  <div
                    key={crit.id}
                    className="bg-slate-50/70 rounded-3xl border border-slate-200/80 p-5 space-y-4"
                  >
                    <div>
                      <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white text-xs flex items-center justify-center font-black">
                          {crit.number}
                        </span>
                        <span>{crit.title}</span>
                      </h4>
                      {crit.description && (
                        <p className="text-xs text-slate-500 mt-1">{crit.description}</p>
                      )}
                    </div>

                    <div className="space-y-3">
                      {crit.indicators.map((ind, idx) => {
                        const selectedVal = scores[ind.id] || 0;
                        return (
                          <div
                            key={ind.id}
                            className="bg-white p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                          >
                            <p className="text-xs font-bold text-slate-700 leading-relaxed flex-1">
                              <span className="text-indigo-600 font-black mr-1.5">
                                {crit.number}.{idx + 1}
                              </span>
                              {ind.text}
                            </p>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {[1, 2, 3, 4].map((val) => {
                                const active = selectedVal === val;
                                const bgColors: Record<number, string> = {
                                  4: active
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-emerald-50',
                                  3: active
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50',
                                  2: active
                                    ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-amber-50',
                                  1: active
                                    ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-rose-50'
                                };
                                return (
                                  <button
                                    key={val}
                                    type="button"
                                    onClick={() =>
                                      setScores((prev) => ({ ...prev, [ind.id]: val }))
                                    }
                                    className={`w-9 h-9 rounded-xl font-black text-xs border transition-all cursor-pointer ${bgColors[val]}`}
                                  >
                                    {val}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Comentario opcional */}
              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                  Comentario o sugerencia respetuosa (Opcional):
                </label>
                <textarea
                  rows={2}
                  value={generalNotes}
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  placeholder="Escribe aquí cualquier aspecto positivo o sugerencia sobre la clase..."
                  className="w-full p-3.5 rounded-2xl border border-slate-200 text-xs font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Pie de formulario */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTeacherForSurvey(null)}
                  className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-black text-xs uppercase tracking-wider hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Send size={15} />
                  <span>{isSubmitting ? 'Enviando...' : 'Enviar Valoración'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
