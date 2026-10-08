import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Compass,
  Calendar,
  Clock,
  DollarSign,
  Plus,
  Users,
  CheckCircle2,
  XCircle,
  HelpCircle,
  ShieldCheck,
  Search,
  Filter,
  Download,
  Printer,
  Edit,
  Trash2,
  Receipt,
  Phone,
  HeartPulse,
  Sparkles,
  ClipboardList,
  AlertCircle,
  RefreshCw,
  Eye,
  Check,
  ChevronRight
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { SchoolCampaign, SchoolCampaignResponse, CampaignType } from '../../types/campaigns';
import { toast } from 'react-hot-toast';
import { getLocalDateString } from '../../utils/dateUtils';

export const CampaignsManager: React.FC = () => {
  const { profile, center, state } = useApp();
  const centerId = profile?.center_id || center?.id;

  const [campaigns, setCampaigns] = useState<SchoolCampaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [responses, setResponses] = useState<SchoolCampaignResponse[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingResponses, setLoadingResponses] = useState<boolean>(false);

  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedPaymentFilter, setSelectedPaymentFilter] = useState<string>('ALL');

  // Modal de Crear / Editar Campaña
  const [showCampaignModal, setShowCampaignModal] = useState<boolean>(false);
  const [editingCampaign, setEditingCampaign] = useState<SchoolCampaign | null>(null);
  const [campaignForm, setCampaignForm] = useState<{
    title: string;
    description: string;
    type: CampaignType;
    location: string;
    event_date: string;
    deadline_date: string;
    price: number;
    requires_permission: boolean;
    permission_text: string;
    target_courses: string[];
    is_active: boolean;
  }>({
    title: '',
    description: '',
    type: 'trip',
    location: '',
    event_date: '',
    deadline_date: '',
    price: 0,
    requires_permission: true,
    permission_text: 'Autorizo formalmente la participación de mi hijo(a) en esta actividad y confirmo que cumple con las condiciones para asistir.',
    target_courses: [],
    is_active: true
  });
  const [isSavingCampaign, setIsSavingCampaign] = useState<boolean>(false);

  // Modal de Cobro / Pago de Alumno
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [selectedResponseForPayment, setSelectedResponseForPayment] = useState<any | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amount_paid: 0,
    payment_method: 'cash',
    receipt_number: '',
    notes: '',
    payment_date: getLocalDateString()
  });
  const [isSavingPayment, setIsSavingPayment] = useState<boolean>(false);

  // Modal de Ficha de Permiso Parental
  const [viewingPermission, setViewingPermission] = useState<any | null>(null);

  // Ref para impresión de lista de viaje
  const printSheetRef = useRef<HTMLDivElement>(null);

  // Cargar campañas, cursos y estudiantes del centro
  const fetchData = async () => {
    if (!centerId) return;
    try {
      setLoading(true);

      // Cursos
      const { data: cData } = await supabase
        .from('courses')
        .select('*')
        .eq('center_id', centerId)
        .order('grade', { ascending: true });
      if (cData) setCourses(cData);

      // Estudiantes
      const { data: sData } = await supabase
        .from('students')
        .select('*')
        .eq('center_id', centerId)
        .order('last_name', { ascending: true });
      if (sData) setStudents(sData);

      // Campañas
      const { data: campData, error: campErr } = await supabase
        .from('school_campaigns')
        .select('*')
        .eq('center_id', centerId)
        .order('created_at', { ascending: false });

      if (!campErr && campData) {
        setCampaigns(campData as SchoolCampaign[]);
        if (campData.length > 0 && !selectedCampaignId) {
          setSelectedCampaignId(campData[0].id);
        }
      }
    } catch (err) {
      console.error('Error al cargar datos de campañas:', err);
      toast.error('Error al cargar actividades y campañas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [centerId]);

  // Cargar respuestas de la campaña seleccionada
  const loadResponses = async () => {
    if (!selectedCampaignId) {
      setResponses([]);
      return;
    }
    try {
      setLoadingResponses(true);
      const { data, error } = await supabase
        .from('school_campaign_responses')
        .select('*')
        .eq('campaign_id', selectedCampaignId);

      if (!error && data) {
        setResponses(data as SchoolCampaignResponse[]);
      }
    } catch (err) {
      console.warn('Error al cargar respuestas:', err);
    } finally {
      setLoadingResponses(false);
    }
  };

  useEffect(() => {
    loadResponses();
  }, [selectedCampaignId]);

  // Campaña actualmente seleccionada
  const activeCampaign = useMemo(() => {
    return campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0] || null;
  }, [campaigns, selectedCampaignId]);

  // Estudiantes que aplican a la campaña seleccionada
  const eligibleStudents = useMemo(() => {
    if (!activeCampaign) return [];
    if (!activeCampaign.target_courses || activeCampaign.target_courses.length === 0) {
      return students;
    }
    return students.filter((s) => activeCampaign.target_courses?.includes(s.course_id));
  }, [students, activeCampaign]);

  // Mapa de respuestas por estudiante
  const responsesMap = useMemo(() => {
    const map: Record<string, SchoolCampaignResponse> = {};
    responses.forEach((r) => {
      map[r.student_id] = r;
    });
    return map;
  }, [responses]);

  // Mapa de cursos por ID
  const coursesMap = useMemo(() => {
    const map: Record<string, any> = {};
    courses.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [courses]);

  // Métricas y KPIs en vivo
  const stats = useMemo(() => {
    const totalEligible = eligibleStudents.length;
    let confirmedCount = 0;
    let declinedCount = 0;
    let undecidedCount = 0;
    let totalCollected = 0;
    let permissionsCount = 0;
    let paidCount = 0;

    eligibleStudents.forEach((st) => {
      const resp = responsesMap[st.id];
      if (resp) {
        if (resp.response === 'yes') {
          confirmedCount++;
          if (resp.permission_granted) permissionsCount++;
          if (resp.amount_paid) totalCollected += Number(resp.amount_paid);
          if (resp.payment_status === 'paid') paidCount++;
        } else if (resp.response === 'no') {
          declinedCount++;
        } else {
          undecidedCount++;
        }
      } else {
        undecidedCount++;
      }
    });

    const unitPrice = activeCampaign?.price || 0;
    const projectedTotal = confirmedCount * unitPrice;
    const collectionPercentage = projectedTotal > 0 ? Math.min(100, Math.round((totalCollected / projectedTotal) * 100)) : 100;
    const attendancePercentage = totalEligible > 0 ? Math.round((confirmedCount / totalEligible) * 100) : 0;

    return {
      totalEligible,
      confirmedCount,
      declinedCount,
      undecidedCount,
      totalCollected,
      projectedTotal,
      collectionPercentage,
      attendancePercentage,
      permissionsCount,
      paidCount
    };
  }, [eligibleStudents, responsesMap, activeCampaign]);

  // Lista filtrada de estudiantes para la tabla
  const filteredStudents = useMemo(() => {
    return eligibleStudents.filter((st) => {
      const resp = responsesMap[st.id];
      const status = resp?.response || 'undecided';
      const paymentStatus = resp?.payment_status || (activeCampaign?.price ? 'pending' : 'not_applicable');

      // Filtro de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const fullName = `${st.first_name || ''} ${st.last_name || ''}`.toLowerCase();
        const idNum = (st.id_number || '').toLowerCase();
        if (!fullName.includes(q) && !idNum.includes(q)) return false;
      }

      // Filtro de curso
      if (selectedCourseFilter !== 'ALL' && st.course_id !== selectedCourseFilter) {
        return false;
      }

      // Filtro de estado de respuesta
      if (selectedStatusFilter !== 'ALL' && status !== selectedStatusFilter) {
        return false;
      }

      // Filtro de estado de pago
      if (selectedPaymentFilter !== 'ALL') {
        if (selectedPaymentFilter === 'paid' && paymentStatus !== 'paid') return false;
        if (selectedPaymentFilter === 'pending' && (paymentStatus !== 'pending' || status !== 'yes')) return false;
        if (selectedPaymentFilter === 'partial' && paymentStatus !== 'partial') return false;
      }

      return true;
    });
  }, [eligibleStudents, responsesMap, searchQuery, selectedCourseFilter, selectedStatusFilter, selectedPaymentFilter, activeCampaign]);

  // Abrir modal de creación/edición de campaña
  const handleOpenCampaignModal = (camp?: SchoolCampaign) => {
    if (camp) {
      setEditingCampaign(camp);
      setCampaignForm({
        title: camp.title,
        description: camp.description || '',
        type: camp.type,
        location: camp.location || '',
        event_date: camp.event_date ? camp.event_date.split('T')[0] : '',
        deadline_date: camp.deadline_date ? camp.deadline_date.split('T')[0] : '',
        price: camp.price || 0,
        requires_permission: camp.requires_permission,
        permission_text: camp.permission_text || 'Autorizo formalmente la participación de mi hijo(a) en esta actividad.',
        target_courses: camp.target_courses || [],
        is_active: camp.is_active
      });
    } else {
      setEditingCampaign(null);
      setCampaignForm({
        title: '',
        description: '',
        type: 'trip',
        location: '',
        event_date: '',
        deadline_date: '',
        price: 0,
        requires_permission: true,
        permission_text: 'Autorizo formalmente la participación de mi hijo(a) en esta actividad y confirmo que cumple con las condiciones para asistir.',
        target_courses: [],
        is_active: true
      });
    }
    setShowCampaignModal(true);
  };

  // Guardar campaña
  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!centerId) return;
    if (!campaignForm.title.trim()) {
      toast.error('El título de la actividad es requerido.');
      return;
    }

    try {
      setIsSavingCampaign(true);
      const payload: any = {
        center_id: centerId,
        title: campaignForm.title.trim(),
        description: campaignForm.description.trim(),
        type: campaignForm.type,
        location: campaignForm.location.trim(),
        event_date: campaignForm.event_date ? new Date(campaignForm.event_date).toISOString() : null,
        deadline_date: campaignForm.deadline_date ? new Date(campaignForm.deadline_date).toISOString() : null,
        price: Number(campaignForm.price) || 0,
        requires_permission: campaignForm.requires_permission,
        permission_text: campaignForm.permission_text.trim(),
        target_courses: campaignForm.target_courses.length > 0 ? campaignForm.target_courses : null,
        is_active: campaignForm.is_active,
        created_by: profile?.id,
        updated_at: new Date().toISOString()
      };

      if (editingCampaign) {
        const { data, error } = await supabase
          .from('school_campaigns')
          .update(payload)
          .eq('id', editingCampaign.id)
          .select()
          .single();

        if (error) throw error;
        setCampaigns((prev) => prev.map((c) => (c.id === data.id ? data : c)));
        toast.success('Actividad actualizada exitosamente.');
      } else {
        const { data, error } = await supabase
          .from('school_campaigns')
          .insert([payload])
          .select()
          .single();

        if (error) throw error;
        setCampaigns((prev) => [data, ...prev]);
        setSelectedCampaignId(data.id);
        toast.success('¡Actividad creada exitosamente!');
      }

      setShowCampaignModal(false);
    } catch (err: any) {
      console.error('Error al guardar campaña:', err);
      toast.error('Error al guardar la actividad.');
    } finally {
      setIsSavingCampaign(false);
    }
  };

  // Abrir modal de cobro para un alumno
  const handleOpenPaymentModal = (student: any) => {
    const resp = responsesMap[student.id];
    const unitPrice = activeCampaign?.price || 0;
    const currentPaid = resp?.amount_paid || 0;
    const pendingAmount = Math.max(0, unitPrice - currentPaid);

    setSelectedResponseForPayment({
      student,
      response: resp,
      unitPrice,
      currentPaid,
      pendingAmount
    });

    setPaymentForm({
      amount_paid: pendingAmount > 0 ? pendingAmount : unitPrice,
      payment_method: 'cash',
      receipt_number: `REC-${Date.now().toString().slice(-6)}`,
      notes: '',
      payment_date: getLocalDateString()
    });

    setShowPaymentModal(true);
  };

  // Guardar pago
  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedResponseForPayment || !activeCampaign || !centerId) return;

    try {
      setIsSavingPayment(true);
      const student = selectedResponseForPayment.student;
      const resp = selectedResponseForPayment.response;
      const newPaid = Number(paymentForm.amount_paid) || 0;
      const totalAccumulated = (resp?.amount_paid || 0) + newPaid;
      const unitPrice = activeCampaign.price || 0;

      const newStatus = totalAccumulated >= unitPrice ? 'paid' : totalAccumulated > 0 ? 'partial' : 'pending';

      const payload: any = {
        campaign_id: activeCampaign.id,
        center_id: centerId,
        student_id: student.id,
        response: resp?.response || 'yes',
        permission_granted: resp?.permission_granted ?? true,
        payment_status: newStatus,
        amount_paid: totalAccumulated,
        payment_method: paymentForm.payment_method,
        receipt_number: paymentForm.receipt_number.trim(),
        payment_date: new Date(paymentForm.payment_date).toISOString(),
        notes: paymentForm.notes.trim(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('school_campaign_responses')
        .upsert(payload, { onConflict: 'campaign_id,student_id' })
        .select()
        .single();

      if (error) throw error;

      setResponses((prev) => {
        const filtered = prev.filter((r) => !(r.campaign_id === activeCampaign.id && r.student_id === student.id));
        return [...filtered, data];
      });

      toast.success(`Pago de RD$ ${newPaid.toLocaleString()} registrado con éxito.`);
      setShowPaymentModal(false);
    } catch (err: any) {
      console.error('Error al registrar pago:', err);
      toast.error('Error al guardar el pago.');
    } finally {
      setIsSavingPayment(false);
    }
  };

  // Imprimir lista para chofer / guías / profesores
  const handlePrintList = () => {
    const printContent = printSheetRef.current;
    if (!printContent) return;

    const win = window.open('', '', 'width=900,height=650');
    if (!win) return;

    win.document.write(`
      <html>
        <head>
          <title>Lista de Asistencia - ${activeCampaign?.title || 'Actividad Escolar'}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 20px; color: #1e293b; }
            h1 { font-size: 18px; margin-bottom: 4px; color: #0f172a; }
            h2 { font-size: 13px; font-weight: normal; margin-top: 0; color: #64748b; margin-bottom: 16px; }
            .meta { display: flex; gap: 20px; font-size: 11px; margin-bottom: 20px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th { background: #f1f5f9; text-align: left; padding: 8px; border: 1px solid #cbd5e1; font-weight: bold; }
            td { padding: 6px 8px; border: 1px solid #cbd5e1; }
            tr:nth-child(even) { background: #f8fafc; }
            .badge-yes { color: #166534; font-weight: bold; }
            .badge-paid { color: #047857; font-weight: bold; }
            .badge-pending { color: #b45309; }
            .notes { font-size: 10px; color: #b91c1c; }
            .footer { margin-top: 30px; font-size: 10px; text-align: right; color: #94a3b8; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
          <div class="footer">Impreso desde Edugens el ${new Date().toLocaleString()}</div>
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  // Exportar a CSV
  const handleExportCSV = () => {
    if (!filteredStudents.length) {
      toast.error('No hay estudiantes para exportar.');
      return;
    }

    const headers = [
      'ID / Matrícula',
      'Estudiante',
      'Curso',
      'Asistencia',
      'Permiso Autorizado',
      'Firma Tutor',
      'Teléfono Emergencia',
      'Notas Médicas / Alergias',
      'Estado Pago',
      'Monto Pagado',
      'No. Recibo'
    ];

    const rows = filteredStudents.map((st) => {
      const resp = responsesMap[st.id];
      const courseObj = coursesMap[st.course_id];
      const courseName = courseObj ? `${courseObj.grade} ${courseObj.section}` : '';
      return [
        st.id_number || '',
        `"${st.first_name || ''} ${st.last_name || ''}"`,
        `"${courseName}"`,
        resp?.response === 'yes' ? 'SÍ' : resp?.response === 'no' ? 'NO' : 'PENDIENTE',
        resp?.permission_granted ? 'AUTORIZADO' : 'NO',
        `"${resp?.permission_signed_by || ''}"`,
        `"${resp?.emergency_contact_phone || ''}"`,
        `"${(resp?.medical_notes || '').replace(/"/g, '""')}"`,
        resp?.payment_status === 'paid' ? 'PAGADO' : resp?.payment_status === 'partial' ? 'ABONO' : 'PENDIENTE',
        resp?.amount_paid || 0,
        `"${resp?.receipt_number || ''}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `asistencia_${activeCampaign?.title.replace(/\s+/g, '_')}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* BARRA SUPERIOR: SELECTOR DE CAMPAÑA + ACCIONES */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 rounded-2xl text-indigo-600 dark:text-indigo-400">
            <Compass size={24} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Gestión de Actividades y Paseos
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="text-base font-black text-slate-900 dark:text-white bg-transparent outline-none cursor-pointer border-b border-dashed border-indigo-400 pb-0.5"
              >
                {campaigns.length === 0 ? (
                  <option value="">No hay actividades creadas</option>
                ) : (
                  campaigns.map((c) => (
                    <option key={c.id} value={c.id} className="dark:bg-slate-900">
                      {c.title} ({c.type === 'trip' ? 'Paseo' : c.type === 'survey' ? 'Encuesta' : 'Evento'}) {c.is_active ? '• Activo' : '• Pausado'}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeCampaign && (
            <button
              type="button"
              onClick={() => handleOpenCampaignModal(activeCampaign)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Edit size={14} />
              <span>Editar Actividad</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenCampaignModal()}
            className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5 transition-all transform hover:scale-[1.02] cursor-pointer"
          >
            <Plus size={16} />
            <span>Nueva Actividad / Paseo</span>
          </button>
        </div>
      </div>

      {activeCampaign ? (
        <>
          {/* TARJETAS DE INDICADORES / KPIS EN VIVO */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Confirmados (Sí) */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl">
                <CheckCircle2 size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Confirmados (Sí)
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    {stats.confirmedCount}
                  </h3>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    ({stats.attendancePercentage}%)
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  de {stats.totalEligible} alumnos convocados
                </p>
              </div>
            </div>

            {/* Declinados y Pendientes */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 rounded-2xl">
                <Clock size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Pendientes / Declinados
                </p>
                <div className="flex items-baseline gap-2">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    {stats.undecidedCount}
                  </h3>
                  <span className="text-xs font-bold text-rose-500">
                    ({stats.declinedCount} no van)
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  esperando respuesta de tutores
                </p>
              </div>
            </div>

            {/* Recaudación Financiera */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                <DollarSign size={24} />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Recaudado en Caja
                </p>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">
                  RD$ {stats.totalCollected.toLocaleString()}
                </h3>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all"
                    style={{ width: `${stats.collectionPercentage}%` }}
                  ></div>
                </div>
                <p className="text-[9px] text-slate-400 mt-1">
                  Meta esperada: RD$ {stats.projectedTotal.toLocaleString()} ({stats.collectionPercentage}%)
                </p>
              </div>
            </div>

            {/* Permisos Firmados */}
            <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-800 shadow-sm flex items-center gap-4">
              <div className="p-4 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-2xl">
                <ShieldCheck size={24} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Permisos Autorizados
                </p>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  {stats.permissionsCount}
                </h3>
                <p className="text-[10px] text-purple-600 dark:text-purple-400 font-bold mt-0.5">
                  {stats.paidCount} alumnos saldados
                </p>
              </div>
            </div>
          </div>

          {/* CONTENEDOR DE LA TABLA Y HERRAMIENTAS */}
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm p-6 space-y-6">
            {/* Barra de Filtros y Búsqueda */}
            <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                {/* Buscador */}
                <div className="relative min-w-[220px] flex-1">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar alumno por nombre o matrícula..."
                    className="w-full pl-10 pr-4 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Filtro de Curso */}
                <select
                  value={selectedCourseFilter}
                  onChange={(e) => setSelectedCourseFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none"
                >
                  <option value="ALL">Todos los Cursos</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.level} - {c.grade} {c.section}
                    </option>
                  ))}
                </select>

                {/* Filtro de Respuesta */}
                <select
                  value={selectedStatusFilter}
                  onChange={(e) => setSelectedStatusFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none"
                >
                  <option value="ALL">Cualquier Respuesta</option>
                  <option value="yes">Confirmados (Sí van)</option>
                  <option value="no">Declinados (No van)</option>
                  <option value="undecided">Sin Responder (Pendientes)</option>
                </select>

                {/* Filtro de Pago si tiene precio */}
                {activeCampaign.price > 0 && (
                  <select
                    value={selectedPaymentFilter}
                    onChange={(e) => setSelectedPaymentFilter(e.target.value)}
                    className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 outline-none"
                  >
                    <option value="ALL">Cualquier Pago</option>
                    <option value="paid">Totalmente Pagado</option>
                    <option value="partial">Con Abono Parcial</option>
                    <option value="pending">Pendiente de Pago</option>
                  </select>
                )}
              </div>

              {/* Botones de Exportación / Impresión */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Descargar lista en formato Excel (CSV)"
                >
                  <Download size={14} />
                  <span>CSV</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrintList}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Imprimir hoja de ruta para profesores / choferes"
                >
                  <Printer size={14} />
                  <span>Imprimir para Guías / Autobús</span>
                </button>
              </div>
            </div>

            {/* TABLA DE ALUMNOS */}
            <div className="overflow-x-auto custom-scrollbar border border-slate-100 dark:border-slate-800 rounded-2xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/80 text-[10px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Estudiante</th>
                    <th className="py-3 px-3">Curso</th>
                    <th className="py-3 px-3 text-center">Respuesta</th>
                    <th className="py-3 px-3 text-center">Permiso Parental</th>
                    {activeCampaign.price > 0 && (
                      <th className="py-3 px-3 text-center">Cobro / Finanzas</th>
                    )}
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStudents.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                        No se encontraron estudiantes para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredStudents.map((st, idx) => {
                      const resp = responsesMap[st.id];
                      const status = resp?.response || 'undecided';
                      const courseObj = coursesMap[st.course_id];
                      const courseName = courseObj ? `${courseObj.grade} ${courseObj.section}` : '--';
                      const isPaid = resp?.payment_status === 'paid';
                      const isPartial = resp?.payment_status === 'partial';

                      return (
                        <tr key={st.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                          {/* Alumno */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <span className="w-6 text-[10px] font-black text-slate-400 font-mono">
                                #{idx + 1}
                              </span>
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white">
                                  {st.first_name} {st.last_name}
                                </p>
                                {st.id_number && (
                                  <p className="text-[10px] font-mono text-slate-400">
                                    Mat: {st.id_number}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Curso */}
                          <td className="py-3 px-3">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-black text-[10px] text-slate-700 dark:text-slate-300">
                              {courseName}
                            </span>
                          </td>

                          {/* Respuesta */}
                          <td className="py-3 px-3 text-center">
                            {status === 'yes' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                <Check size={11} /> Confirmó (Sí)
                              </span>
                            ) : status === 'no' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
                                ✕ No asistirá
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500">
                                • Pendiente
                              </span>
                            )}
                          </td>

                          {/* Permiso Parental */}
                          <td className="py-3 px-3 text-center">
                            {resp?.permission_granted ? (
                              <button
                                type="button"
                                onClick={() => setViewingPermission({ student: st, response: resp })}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 hover:scale-105 transition-transform cursor-pointer"
                                title="Ver ficha y detalles de autorización"
                              >
                                <ShieldCheck size={12} />
                                <span>Autorizado</span>
                              </button>
                            ) : status === 'yes' ? (
                              <span className="text-[10px] text-amber-500 font-bold">Sin firma</span>
                            ) : (
                              <span className="text-[10px] text-slate-400">--</span>
                            )}
                          </td>

                          {/* Finanzas / Cobro */}
                          {activeCampaign.price > 0 && (
                            <td className="py-3 px-3 text-center">
                              {isPaid ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                                  ✓ Saldado (RD$ {resp.amount_paid?.toLocaleString()})
                                </span>
                              ) : isPartial ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                                  Abono: RD$ {resp.amount_paid?.toLocaleString()}
                                </span>
                              ) : status === 'yes' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                                  Pendiente (RD$ {activeCampaign.price.toLocaleString()})
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400">--</span>
                              )}
                            </td>
                          )}

                          {/* Acciones */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {activeCampaign.price > 0 && status === 'yes' && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenPaymentModal(st)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                                  title="Registrar cobro en caja"
                                >
                                  <Receipt size={12} />
                                  <span>{isPaid ? 'Recibo' : 'Cobrar'}</span>
                                </button>
                              )}

                              {resp?.permission_granted && (
                                <button
                                  type="button"
                                  onClick={() => setViewingPermission({ student: st, response: resp })}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                  title="Ver permiso del padre"
                                >
                                  <Eye size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-3xl mx-auto flex items-center justify-center">
            <Compass size={32} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              No hay actividades escolares configuradas
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
              Crea tu primer paseo, excursión, reunión o consulta a padres para activar la publicidad prioritaria y llevar el conteo de asistencia y pagos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => handleOpenCampaignModal()}
            className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/20 inline-flex items-center gap-2 cursor-pointer transition-all"
          >
            <Plus size={16} />
            <span>Crear Primera Actividad</span>
          </button>
        </div>
      )}

      {/* MODAL CREAR / EDITAR CAMPAÑA */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl max-w-xl w-full p-6 md:p-8 space-y-6 text-slate-900 dark:text-white animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600">
                  {editingCampaign ? 'Modificar Actividad' : 'Nueva Actividad / Paseo'}
                </span>
                <h3 className="text-xl font-black mt-0.5">
                  {editingCampaign ? editingCampaign.title : 'Configurar Campaña Escolar'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCampaignModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCampaign} className="space-y-4">
              {/* Tipo y Título */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Tipo de Actividad
                  </label>
                  <select
                    value={campaignForm.type}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, type: e.target.value as any }))}
                    className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
                  >
                    <option value="trip">Paseo / Excursión</option>
                    <option value="event">Evento Especial</option>
                    <option value="survey">Encuesta / Consulta</option>
                    <option value="meeting">Reunión de Padres</option>
                    <option value="campaign">Campaña General</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Título de la Actividad *
                  </label>
                  <input
                    type="text"
                    required
                    value={campaignForm.title}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="Ej. Paseo Anual a la Ciudad Colonial"
                    className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Descripción o Itinerario para los Padres
                </label>
                <textarea
                  rows={3}
                  value={campaignForm.description}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Detalles sobre salida, regreso, vestimenta, merienda o propósitos..."
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Ubicación y Precio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Destino / Ubicación
                  </label>
                  <input
                    type="text"
                    value={campaignForm.location}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="Ej. Zoológico Nacional"
                    className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Precio por Alumno (RD$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={campaignForm.price}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, price: Number(e.target.value) }))}
                    placeholder="0 = Gratuito"
                    className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Fecha del Evento
                  </label>
                  <input
                    type="date"
                    value={campaignForm.event_date}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, event_date: e.target.value }))}
                    className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Fecha Límite para Confirmar
                  </label>
                  <input
                    type="date"
                    value={campaignForm.deadline_date}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, deadline_date: e.target.value }))}
                    className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
                  />
                </div>
              </div>

              {/* Permiso Parental */}
              <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-100 dark:border-indigo-900/40 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="req_perm"
                    checked={campaignForm.requires_permission}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, requires_permission: e.target.checked }))}
                    className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                  />
                  <label htmlFor="req_perm" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                    Exigir autorización formal de los padres (firma digital y teléfono de emergencia)
                  </label>
                </div>

                {campaignForm.requires_permission && (
                  <textarea
                    rows={2}
                    value={campaignForm.permission_text}
                    onChange={(e) => setCampaignForm((prev) => ({ ...prev, permission_text: e.target.value }))}
                    placeholder="Texto de la autorización legal..."
                    className="w-full text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none mt-1"
                  />
                )}
              </div>

              {/* Cursos Convocados */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Cursos Convocados (dejar vacío para Todos los cursos)
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                  {courses.map((c) => {
                    const isSelected = campaignForm.target_courses.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setCampaignForm((prev) => ({
                            ...prev,
                            target_courses: isSelected
                              ? prev.target_courses.filter((id) => id !== c.id)
                              : [...prev.target_courses, c.id]
                          }));
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        {c.grade} {c.section}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Estado Activo */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="camp_active"
                  checked={campaignForm.is_active}
                  onChange={(e) => setCampaignForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 text-indigo-600 rounded cursor-pointer"
                />
                <label htmlFor="camp_active" className="text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                  Activar campaña (mostrar en el banner de los padres)
                </label>
              </div>

              {/* Botones */}
              <div className="flex gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCampaignModal(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCampaign}
                  className="flex-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
                >
                  {isSavingCampaign ? 'Guardando...' : editingCampaign ? 'Guardar Cambios' : 'Publicar Actividad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRAR COBRO / PAGO DE ALUMNO */}
      {showPaymentModal && selectedResponseForPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-5 text-slate-900 dark:text-white animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  Caja / Recibo de Pago
                </span>
                <h3 className="text-lg font-black">
                  {selectedResponseForPayment.student.first_name} {selectedResponseForPayment.student.last_name}
                </h3>
                <p className="text-xs text-slate-400">
                  Actividad: {activeCampaign?.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePayment} className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-400 font-bold block">Costo Total:</span>
                  <span className="font-black text-slate-900 dark:text-white">RD$ {selectedResponseForPayment.unitPrice.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Abonado:</span>
                  <span className="font-black text-blue-600">RD$ {selectedResponseForPayment.currentPaid.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block">Restante:</span>
                  <span className="font-black text-amber-600">RD$ {selectedResponseForPayment.pendingAmount.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Monto a Cobrar (RD$) *
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={paymentForm.amount_paid}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount_paid: Number(e.target.value) }))}
                  className="w-full text-base font-black px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, payment_method: e.target.value }))}
                    className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                    <option value="check">Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    No. de Recibo
                  </label>
                  <input
                    type="text"
                    value={paymentForm.receipt_number}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, receipt_number: e.target.value }))}
                    className="w-full text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                  Notas o Referencia
                </label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ej. Pagado por la madre en caja"
                  className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold text-xs uppercase cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingPayment}
                  className="flex-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
                >
                  {isSavingPayment ? 'Procesando...' : 'Registrar Pago en Caja'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FICHA DE PERMISO PARENTAL */}
      {viewingPermission && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl max-w-md w-full p-6 space-y-4 text-slate-900 dark:text-white animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-600 rounded-xl">
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h4 className="font-black text-sm">Ficha de Autorización</h4>
                  <p className="text-[11px] text-slate-400">
                    {viewingPermission.student.first_name} {viewingPermission.student.last_name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingPermission(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-purple-50/50 dark:bg-purple-950/20 rounded-xl border border-purple-100 dark:border-purple-900/40">
                <span className="text-[10px] font-bold text-purple-500 block uppercase tracking-wider">
                  Autorizado por:
                </span>
                <p className="font-black text-slate-900 dark:text-white mt-0.5">
                  {viewingPermission.response.permission_signed_by || 'Tutor Registrado'}
                </p>
                {viewingPermission.response.permission_date && (
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Fecha: {new Date(viewingPermission.response.permission_date).toLocaleString()}
                  </p>
                )}
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider flex items-center gap-1">
                  <Phone size={10} /> Teléfono de Emergencia:
                </span>
                <p className="font-black text-slate-900 dark:text-white mt-0.5 font-mono">
                  {viewingPermission.response.emergency_contact_phone || 'No especificado'}
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider flex items-center gap-1">
                  <HeartPulse size={10} className="text-rose-500" /> Notas Médicas / Alergias:
                </span>
                <p className="text-slate-700 dark:text-slate-300 mt-1 font-medium leading-relaxed">
                  {viewingPermission.response.medical_notes || 'Ninguna observación médica registrada.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setViewingPermission(null)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs uppercase cursor-pointer"
            >
              Cerrar Ficha
            </button>
          </div>
        </div>
      )}

      {/* PLANTILLA OCULTA PARA IMPRESIÓN */}
      <div style={{ display: 'none' }}>
        <div ref={printSheetRef}>
          <h1>{center?.name || 'Centro Educativo'}</h1>
          <h2>Hoja de Ruta y Lista de Asistentes - {activeCampaign?.title}</h2>
          <div className="meta">
            <div><strong>Destino:</strong> {activeCampaign?.location || 'No especificado'}</div>
            <div><strong>Fecha:</strong> {activeCampaign?.event_date ? new Date(activeCampaign.event_date).toLocaleDateString() : 'Por definir'}</div>
            <div><strong>Total Asistentes:</strong> {filteredStudents.filter((s) => responsesMap[s.id]?.response === 'yes').length} alumnos</div>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: '30px' }}>#</th>
                <th>Alumno</th>
                <th>Curso</th>
                <th>Tutor que Autoriza</th>
                <th>Tel. Emergencia</th>
                <th>Observaciones Médicas / Alergias</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents
                .filter((st) => responsesMap[st.id]?.response === 'yes')
                .map((st, i) => {
                  const resp = responsesMap[st.id];
                  const cObj = coursesMap[st.course_id];
                  return (
                    <tr key={st.id}>
                      <td>{i + 1}</td>
                      <td><strong>{st.first_name} {st.last_name}</strong></td>
                      <td>{cObj ? `${cObj.grade} ${cObj.section}` : '--'}</td>
                      <td>{resp?.permission_signed_by || 'Autorizado'}</td>
                      <td><strong>{resp?.emergency_contact_phone || '--'}</strong></td>
                      <td className="notes">{resp?.medical_notes || 'Ninguna'}</td>
                      <td>
                        {resp?.payment_status === 'paid' ? (
                          <span className="badge-paid">PAGADO</span>
                        ) : resp?.payment_status === 'partial' ? (
                          <span>ABONO RD$ {resp.amount_paid}</span>
                        ) : (
                          <span className="badge-pending">PENDIENTE</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
