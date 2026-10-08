import React, { useState, useEffect, useMemo } from 'react';
import {
  Compass,
  Calendar,
  Clock,
  DollarSign,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  ShieldCheck,
  Phone,
  HeartPulse,
  Send,
  Sparkles,
  ClipboardList
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { SchoolCampaign, SchoolCampaignResponse } from '../../types/campaigns';
import { toast } from 'react-hot-toast';

interface ParentCampaignBannerProps {
  centerId?: string;
  familyStudents?: any[];
  currentStudentId?: string;
  currentCourseId?: string;
  userProfile?: any;
}

export const ParentCampaignBanner: React.FC<ParentCampaignBannerProps> = ({
  centerId,
  familyStudents = [],
  currentStudentId,
  currentCourseId,
  userProfile
}) => {
  const [campaigns, setCampaigns] = useState<SchoolCampaign[]>([]);
  const [responses, setResponses] = useState<Record<string, SchoolCampaignResponse>>({}); // key: `${campaignId}_${studentId}`
  const [loading, setLoading] = useState<boolean>(true);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(currentStudentId || '');
  
  // Modal de confirmación y autorización
  const [selectedCampaignForModal, setSelectedCampaignForModal] = useState<SchoolCampaign | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean>(true);
  const [permissionSignedBy, setPermissionSignedBy] = useState<string>(userProfile?.full_name || '');
  const [emergencyPhone, setEmergencyPhone] = useState<string>(userProfile?.phone || '');
  const [medicalNotes, setMedicalNotes] = useState<string>('');
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Helper para obtener el nombre completo del estudiante
  const getStudentName = (st: any) => {
    if (!st) return 'Estudiante';
    if (st.full_name) return st.full_name;
    if (st.first_name || st.last_name) return `${st.first_name || ''} ${st.last_name || ''}`.trim();
    return st.name || 'Estudiante';
  };

  // Lista de estudiantes a considerar (si hay varios hermanos, o el actual)
  const studentsList = useMemo(() => {
    if (familyStudents && familyStudents.length > 0) return familyStudents;
    if (currentStudentId) return [{ id: currentStudentId, full_name: userProfile?.full_name || 'Estudiante', course_id: currentCourseId }];
    return [];
  }, [familyStudents, currentStudentId, userProfile, currentCourseId]);

  useEffect(() => {
    if (!selectedStudentId && studentsList.length > 0) {
      setSelectedStudentId(studentsList[0].id);
    }
  }, [studentsList, selectedStudentId]);

  // Cargar campañas activas
  const loadCampaigns = async () => {
    if (!centerId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('school_campaigns')
        .select('*')
        .eq('center_id', centerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setCampaigns(data as SchoolCampaign[]);

        // Cargar respuestas para los estudiantes
        const studentIds = studentsList.map((s) => s.id).filter(Boolean);
        if (studentIds.length > 0 && data.length > 0) {
          const campaignIds = data.map((c) => c.id);
          const { data: resData, error: resErr } = await supabase
            .from('school_campaign_responses')
            .select('*')
            .in('campaign_id', campaignIds)
            .in('student_id', studentIds);

          if (!resErr && resData) {
            const map: Record<string, SchoolCampaignResponse> = {};
            resData.forEach((r: any) => {
              map[`${r.campaign_id}_${r.student_id}`] = r;
            });
            setResponses(map);
          }
        }
      }
    } catch (err) {
      console.warn('Error al cargar campañas escolares:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, [centerId, studentsList.length]);

  // Filtrar campañas que aplican al estudiante actual
  const activeStudentObj = useMemo(() => {
    return studentsList.find((s) => s.id === selectedStudentId) || studentsList[0];
  }, [studentsList, selectedStudentId]);

  const applicableCampaigns = useMemo(() => {
    const studentCourseId = activeStudentObj?.course_id || currentCourseId;
    return campaigns.filter((c) => {
      if (!c.target_courses || c.target_courses.length === 0) return true;
      if (!studentCourseId) return true;
      return c.target_courses.includes(studentCourseId);
    });
  }, [campaigns, activeStudentObj, currentCourseId]);

  // Campaña visible (la primera activa que aplique)
  const currentCampaign = applicableCampaigns[0];

  if (loading || !currentCampaign || !activeStudentObj) {
    return null;
  }

  const responseKey = `${currentCampaign.id}_${activeStudentObj.id}`;
  const currentResponse = responses[responseKey];

  // Abrir modal de confirmación
  const openConfirmModal = (campaign: SchoolCampaign) => {
    setSelectedCampaignForModal(campaign);
    setPermissionGranted(true);
    setPermissionSignedBy(userProfile?.full_name || '');
    setEmergencyPhone(userProfile?.phone || currentResponse?.emergency_contact_phone || '');
    setMedicalNotes(currentResponse?.medical_notes || '');
    setSurveyAnswers(currentResponse?.survey_answers || {});
  };

  // Guardar respuesta "Sí" con autorización
  const handleConfirmParticipation = async () => {
    if (!selectedCampaignForModal || !activeStudentObj) return;
    try {
      setIsSubmitting(true);
      const isTripOrPermission = selectedCampaignForModal.requires_permission || selectedCampaignForModal.type === 'trip';

      if (isTripOrPermission && !permissionGranted) {
        toast.error('Debes marcar la casilla de autorización parental para continuar.');
        return;
      }

      const payload: any = {
        campaign_id: selectedCampaignForModal.id,
        center_id: centerId,
        student_id: activeStudentObj.id,
        parent_id: userProfile?.id || null,
        response: 'yes',
        permission_granted: isTripOrPermission ? permissionGranted : true,
        permission_signed_by: permissionSignedBy.trim() || userProfile?.full_name || 'Tutor Legal',
        permission_date: new Date().toISOString(),
        emergency_contact_phone: emergencyPhone.trim(),
        medical_notes: medicalNotes.trim(),
        survey_answers: surveyAnswers,
        payment_status: selectedCampaignForModal.price > 0 ? (currentResponse?.payment_status || 'pending') : 'not_applicable',
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('school_campaign_responses')
        .upsert(payload, { onConflict: 'campaign_id,student_id' })
        .select()
        .single();

      if (error) throw error;

      setResponses((prev) => ({
        ...prev,
        [`${selectedCampaignForModal.id}_${activeStudentObj.id}`]: data
      }));

      toast.success('¡Asistencia y autorización registradas con éxito!');
      setSelectedCampaignForModal(null);
    } catch (err: any) {
      console.error('Error al registrar autorización:', err);
      toast.error('Ocurrió un error al guardar tu respuesta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Marcar como "No asistirá"
  const handleDecline = async (campaign: SchoolCampaign) => {
    if (!activeStudentObj) return;
    try {
      const payload: any = {
        campaign_id: campaign.id,
        center_id: centerId,
        student_id: activeStudentObj.id,
        parent_id: userProfile?.id || null,
        response: 'no',
        permission_granted: false,
        payment_status: 'not_applicable',
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('school_campaign_responses')
        .upsert(payload, { onConflict: 'campaign_id,student_id' })
        .select()
        .single();

      if (error) throw error;

      setResponses((prev) => ({
        ...prev,
        [`${campaign.id}_${activeStudentObj.id}`]: data
      }));

      toast('Has marcado que no asistirá.', { icon: 'ℹ️' });
    } catch (err: any) {
      console.error('Error al registrar declinación:', err);
      toast.error('Error al registrar tu respuesta.');
    }
  };

  // Banner minimizado
  if (isMinimized) {
    return (
      <div className="mb-6 bg-gradient-to-r from-indigo-900 to-indigo-800 text-white px-5 py-3 rounded-2xl shadow-md flex items-center justify-between animate-fade-in border border-indigo-700/50">
        <div className="flex items-center gap-3">
          <span className="p-2 bg-white/10 rounded-xl text-amber-300">
            <Compass size={18} className="animate-pulse" />
          </span>
          <div>
            <p className="text-xs font-black tracking-wide uppercase text-indigo-200">
              Actividad en curso: {currentCampaign.title}
            </p>
            <p className="text-[11px] text-indigo-300">
              {currentResponse?.response === 'yes' ? '✓ Asistencia confirmada' : 'Pendiente de tu confirmación o respuesta'}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
        >
          <span>Ver detalles</span>
          <ChevronDown size={14} />
        </button>
      </div>
    );
  }

  // Identificador visual por tipo de campaña
  const typeConfig = {
    trip: { label: 'Paseo / Excursión', color: 'from-blue-600 via-indigo-600 to-indigo-800', icon: Compass, badgeBg: 'bg-blue-400/20 text-blue-200' },
    event: { label: 'Evento Especial', color: 'from-amber-600 via-orange-600 to-amber-800', icon: Sparkles, badgeBg: 'bg-amber-400/20 text-amber-200' },
    survey: { label: 'Encuesta a Padres', color: 'from-emerald-600 via-teal-600 to-emerald-800', icon: ClipboardList, badgeBg: 'bg-emerald-400/20 text-emerald-200' },
    meeting: { label: 'Reunión Importante', color: 'from-purple-600 via-violet-600 to-purple-800', icon: Calendar, badgeBg: 'bg-purple-400/20 text-purple-200' },
    campaign: { label: 'Campaña Escolar', color: 'from-rose-600 via-red-600 to-rose-800', icon: AlertCircle, badgeBg: 'bg-rose-400/20 text-rose-200' }
  }[currentCampaign.type] || { label: 'Actividad', color: 'from-indigo-600 to-indigo-900', icon: Compass, badgeBg: 'bg-indigo-400/20 text-indigo-200' };

  const TypeIcon = typeConfig.icon;

  return (
    <>
      <div className="mb-6 rounded-[2.5rem] bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 md:p-8 shadow-2xl border-2 border-indigo-500/30 relative overflow-hidden animate-fade-in">
        {/* Adorno decorativo de fondo */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

        {/* Barra superior con tipo y botón de minimizar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10 ${typeConfig.badgeBg}`}>
              <TypeIcon size={12} />
              {typeConfig.label}
            </span>
            {currentCampaign.deadline_date && (
              <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                <Clock size={12} /> Confirma antes del {new Date(currentCampaign.deadline_date).toLocaleDateString()}
              </span>
            )}
          </div>

          <button
            onClick={() => setIsMinimized(true)}
            className="text-slate-400 hover:text-white text-xs flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-white/5 cursor-pointer"
            title="Minimizar por ahora"
          >
            <span>Minimizar</span>
            <ChevronUp size={14} />
          </button>
        </div>

        {/* Selector de estudiante si tiene más de uno */}
        {studentsList.length > 1 && (
          <div className="mb-5 bg-white/10 p-2 rounded-2xl flex flex-wrap items-center gap-2 border border-white/10">
            <span className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider ml-2">
              Respondiendo por:
            </span>
            {studentsList.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStudentId(st.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  activeStudentObj.id === st.id
                    ? 'bg-white text-slate-900 shadow-md scale-105'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {getStudentName(st)}
              </button>
            ))}
          </div>
        )}

        {/* Contenido principal */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-2">
            <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
              {currentCampaign.title}
            </h2>
            {currentCampaign.description && (
              <p className="text-xs md:text-sm text-indigo-100/90 leading-relaxed font-medium">
                {currentCampaign.description}
              </p>
            )}

            {/* Fila de metadatos: fecha, lugar, precio */}
            <div className="flex flex-wrap items-center gap-4 pt-2 text-xs">
              {currentCampaign.event_date && (
                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl font-bold text-indigo-100 border border-white/10">
                  <Calendar size={13} className="text-amber-300" />
                  <span>{new Date(currentCampaign.event_date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </div>
              )}
              {currentCampaign.location && (
                <div className="flex items-center gap-1.5 bg-white/10 px-3 py-1.5 rounded-xl font-bold text-indigo-100 border border-white/10">
                  <Compass size={13} className="text-emerald-300" />
                  <span>{currentCampaign.location}</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 bg-amber-400/20 px-3 py-1.5 rounded-xl font-black text-amber-300 border border-amber-400/30">
                <DollarSign size={13} />
                <span>
                  {currentCampaign.price > 0 ? `Costo: RD$ ${Number(currentCampaign.price).toLocaleString()}` : 'Actividad Gratuita'}
                </span>
              </div>
            </div>
          </div>

          {/* Opciones de respuesta para el padre */}
          <div className="lg:col-span-4 bg-white/10 p-5 rounded-3xl border border-white/10 backdrop-blur-xs flex flex-col justify-center space-y-3">
            <p className="text-[11px] font-black uppercase tracking-widest text-indigo-200 text-center">
              Tu respuesta para: <span className="text-white">{getStudentName(activeStudentObj)}</span>
            </p>

            {/* Si ya respondió que Sí */}
            {currentResponse?.response === 'yes' ? (
              <div className="space-y-2 text-center">
                <div className="inline-flex items-center gap-2 bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 px-4 py-2 rounded-2xl text-xs font-black w-full justify-center">
                  <CheckCircle2 size={16} />
                  <span>¡Participación Confirmada!</span>
                </div>
                {currentCampaign.requires_permission && (
                  <p className="text-[10px] text-emerald-200 font-semibold flex items-center justify-center gap-1">
                    <ShieldCheck size={12} /> Permiso parental otorgado
                  </p>
                )}
                {currentCampaign.price > 0 && (
                  <div className="text-[11px] font-bold py-1 px-2 rounded-lg bg-black/20 text-indigo-200">
                    Estado de pago:{' '}
                    <span className={currentResponse.payment_status === 'paid' ? 'text-emerald-400 font-black' : 'text-amber-300 font-black'}>
                      {currentResponse.payment_status === 'paid' ? 'Pagado en Caja ✓' : 'Pendiente de Pago en Caja'}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => openConfirmModal(currentCampaign)}
                  className="text-[11px] text-indigo-300 hover:text-white underline font-bold transition-colors cursor-pointer"
                >
                  Modificar datos de permiso / contacto
                </button>
              </div>
            ) : currentResponse?.response === 'no' ? (
              <div className="space-y-2 text-center">
                <div className="inline-flex items-center gap-2 bg-rose-500/20 border border-rose-400/40 text-rose-300 px-4 py-2 rounded-2xl text-xs font-black w-full justify-center">
                  <XCircle size={16} />
                  <span>Marcado como: No asistirá</span>
                </div>
                <button
                  type="button"
                  onClick={() => openConfirmModal(currentCampaign)}
                  className="text-[11px] text-amber-300 hover:text-amber-200 underline font-bold transition-colors cursor-pointer"
                >
                  Cambiar de opinión y autorizar
                </button>
              </div>
            ) : (
              /* Aún no ha respondido */
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => openConfirmModal(currentCampaign)}
                  className="w-full py-3 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                >
                  <CheckCircle2 size={16} />
                  <span>Sí, participará</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleDecline(currentCampaign)}
                    className="flex-1 py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-rose-500/20 hover:text-rose-300 text-slate-300 font-bold text-[11px] uppercase tracking-wider border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <XCircle size={14} />
                    <span>No asistirá</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsMinimized(true)}
                    className="flex-1 py-2.5 px-3 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 font-bold text-[11px] uppercase tracking-wider border border-white/10 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <HelpCircle size={14} />
                    <span>Decidir luego</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE CONFIRMACIÓN, AUTORIZACIÓN PARENTAL Y ENCUESTA */}
      {selectedCampaignForModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 md:p-8 space-y-6 text-slate-900 dark:text-white animate-scale-in">
            {/* Cabecera del Modal */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-full">
                  Confirmación de Asistencia y Permiso
                </span>
                <h3 className="text-xl font-black mt-1 text-slate-900 dark:text-white">
                  {selectedCampaignForModal.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-bold">
                  Alumno: <span className="text-indigo-600 dark:text-indigo-400">{getStudentName(activeStudentObj)}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCampaignForModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Aviso de costo si aplica */}
            {selectedCampaignForModal.price > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 p-4 rounded-2xl flex items-center gap-3">
                <div className="p-2 bg-amber-500 text-white rounded-xl font-black text-sm">
                  $
                </div>
                <div>
                  <p className="text-xs font-black text-amber-900 dark:text-amber-200">
                    Costo de participación: RD$ {Number(selectedCampaignForModal.price).toLocaleString()}
                  </p>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                    El monto se puede abonar o saldar en el módulo de caja/finanzas del colegio.
                  </p>
                </div>
              </div>
            )}

            {/* Encuesta de opinión si la campaña la tiene */}
            {selectedCampaignForModal.survey_questions && selectedCampaignForModal.survey_questions.length > 0 && (
              <div className="space-y-3 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ClipboardList size={14} className="text-indigo-500" />
                  Preguntas de Consulta
                </h4>
                {selectedCampaignForModal.survey_questions.map((q, idx) => (
                  <div key={q.id || idx} className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {idx + 1}. {q.question}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setSurveyAnswers((prev) => ({ ...prev, [q.id || idx]: opt }))}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            surveyAnswers[q.id || idx] === opt
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Autorización Parental formal (para viajes / paseos) */}
            {(selectedCampaignForModal.requires_permission || selectedCampaignForModal.type === 'trip') && (
              <div className="space-y-4 bg-indigo-50/50 dark:bg-indigo-950/20 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/50">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="consent_checkbox"
                    checked={permissionGranted}
                    onChange={(e) => setPermissionGranted(e.target.checked)}
                    className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="consent_checkbox" className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed font-semibold cursor-pointer">
                    {selectedCampaignForModal.permission_text ||
                      `Autorizo formalmente la participación de ${activeStudentObj.full_name} en esta actividad bajo la supervisión del equipo docente del centro educativo.`}
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                      Nombre de quien autoriza:
                    </label>
                    <input
                      type="text"
                      value={permissionSignedBy}
                      onChange={(e) => setPermissionSignedBy(e.target.value)}
                      placeholder="Nombre del Padre/Madre/Tutor"
                      className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                      <Phone size={10} /> Teléfono de emergencia:
                    </label>
                    <input
                      type="tel"
                      value={emergencyPhone}
                      onChange={(e) => setEmergencyPhone(e.target.value)}
                      placeholder="(809) 000-0000"
                      className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1">
                    <HeartPulse size={10} /> Notas médicas o alergias (Opcional):
                  </label>
                  <textarea
                    rows={2}
                    value={medicalNotes}
                    onChange={(e) => setMedicalNotes(e.target.value)}
                    placeholder="Ejemplo: Alérgico a nueces, mareo en autobús, medicamentos requeridos..."
                    className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Botones de acción del Modal */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedCampaignForModal(null)}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-black text-xs uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSubmitting || (selectedCampaignForModal.requires_permission && !permissionGranted)}
                onClick={handleConfirmParticipation}
                className="flex-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Guardando...</span>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Confirmar y Guardar Permiso</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
