import React, { useState, useEffect } from 'react';
import {
  Key,
  Shield,
  DollarSign,
  Users,
  CheckCircle2,
  Clock,
  Mail,
  Search,
  Activity,
  RefreshCw,
  CreditCard,
  List,
  Tag,
  Phone,
  Trash2,
  Eye,
  Download,
  Upload,
  Database,
  Edit2,
  Plus
} from 'lucide-react';
import {
  generateLicenses,
  getLicenses,
  getDashboardStats,
  sendPasswordReset,
  getPlans,
  getPayments,
  registerPayment,
  assignPlanToLicense,
  deleteCenter,
  switchActiveCenter,
  updateSubscriptionEndDate,
  exportCenterData,
  importCenterData,
  createPlan,
  updatePlan,
  deletePayment,
  updatePayment,
  SaaSProductKey,
  SaaSStats,
  SaaSPlan,
  SaaSPayment
} from '../services/saasAdminService';

export const SaaSAdminPanel: React.FC = () => {
  const [stats, setStats] = useState<SaaSStats | null>(null);
  const [licenses, setLicenses] = useState<SaaSProductKey[]>([]);
  const [plans, setPlans] = useState<SaaSPlan[]>([]);
  const [payments, setPayments] = useState<SaaSPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Forms state
  const [generateCount, setGenerateCount] = useState(1);
  const [generatePrice, setGeneratePrice] = useState(100);
  const [isGenerating, setIsGenerating] = useState(false);

  const [resetEmail, setResetEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  // Payment State
  const [payLicenseId, setPayLicenseId] = useState('');
  const [payAmount, setPayAmount] = useState(100);
  const [payMethod, setPayMethod] = useState('Transferencia');
  const [payRef, setPayRef] = useState('');
  const [payMonths, setPayMonths] = useState(1);
  const [isPaying, setIsPaying] = useState(false);

  const [activeTab, setActiveTab] = useState<
    'licenses' | 'centers' | 'security' | 'plans' | 'payments' | 'support' | 'backups'
  >('licenses');

  // Backup / Import State
  const [importTargetId, setImportTargetId] = useState('');
  const [backupData, setBackupData] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Subscription Plan Form State
  const [editingPlan, setEditingPlan] = useState<SaaSPlan | null>(null);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [planName, setPlanName] = useState('');
  const [planPriceMonthly, setPlanPriceMonthly] = useState(0);
  const [planPriceYearly, setPlanPriceYearly] = useState(0);
  const [planMaxStudents, setPlanMaxStudents] = useState(500);
  const [planMaxTeachers, setPlanMaxTeachers] = useState(50);
  const [planMaxManagers, setPlanMaxManagers] = useState(5);
  const [planMaxSupport, setPlanMaxSupport] = useState(5);
  const [planMaxUsers, setPlanMaxUsers] = useState(500);
  const [isSavingPlan, setIsSavingPlan] = useState(false);

  // Edit Payment State
  const [editingPayment, setEditingPayment] = useState<SaaSPayment | null>(null);
  const [editPayAmount, setEditPayAmount] = useState(0);
  const [editPayMethod, setEditPayMethod] = useState('Transferencia');
  const [editPayRef, setEditPayRef] = useState('');
  const [editPayDate, setEditPayDate] = useState('');
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [selectedLicenseForBilling, setSelectedLicenseForBilling] = useState<SaaSProductKey | null>(null);
  const [billingType, setBillingType] = useState<'reminder' | 'invoice'>('reminder');
  const [billingSubject, setBillingSubject] = useState('');
  const [billingBody, setBillingBody] = useState('');
  const [bankInfo, setBankInfo] = useState(
    'Banco BHD\nCuenta Corriente: #1234567890\nTitular: EduGest SRL\nRNC: 1-32-45678-9'
  );

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [newStats, newLicenses, newPlans, newPayments] = await Promise.all([
        getDashboardStats(),
        getLicenses(),
        getPlans(),
        getPayments()
      ]);
      setStats(newStats);
      setLicenses(newLicenses);
      setPlans(newPlans);
      setPayments(newPayments);
    } catch (error: any) {
      console.error('Error fetching SaaS data:', error);
      if (error.name === 'AbortError' || error.message?.includes('Lock was stolen')) {
        // Ignorar silenciosamente ya que otra consulta paralela resolverá y cargará la información
        return;
      }
      alert('Error cargando datos del panel: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedLicenseForBilling) return;

    const license = selectedLicenseForBilling;
    const planDetails = plans.find((p) => p.id === license.plan_id);
    const monthlyPrice = planDetails?.price_monthly || license.price || 0;
    const yearlyPrice = planDetails?.price_yearly || (license.price ? license.price * 10 : 0);
    const planName = license.plan_name || 'Básico';

    if (billingType === 'reminder') {
      const subject = `Recordatorio de Pago Suscripción EduGest - ${license.center_name || 'Mi Centro'}`;
      const endDateStr = license.subscription_end_date
        ? new Date(license.subscription_end_date).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'S/N';

      const body = `Estimado Equipo de ${license.center_name || 'Centro Educativo'}:

Le saludamos cordialmente desde el equipo administrativo de EduGest.

Este correo electrónico es un recordatorio amigable del pago correspondiente a la suscripción del software de gestión escolar EduGest.

Detalle de su suscripción:
• Centro Educativo: ${license.center_name || 'No especificado'}
• Plan Asignado: ${planName}
• Costo del Plan: $${monthlyPrice.toLocaleString()} DOP mensual / $${yearlyPrice.toLocaleString()} DOP anual
• Fecha de Vencimiento: ${endDateStr}

Para mantener el servicio activo y sin interrupciones para el personal, docentes y padres, por favor realice su pago correspondiente por transferencia bancaria utilizando los datos detallados a continuación:

Datos de Cuenta para Transferencia:
${bankInfo}

Una vez realizado el depósito o transferencia, por favor responda a este correo adjuntando el comprobante de pago con el número de referencia para proceder con la extensión inmediata de su vigencia.

Agradecemos su puntualidad y confianza en nuestra plataforma.

Atentamente,
El equipo de EduGest
soporte@edugest.net`;

      setBillingSubject(subject);
      setBillingBody(body);
    } else {
      const licensePayments = payments.filter((p) => p.license_id === license.id);
      const lastPayment = licensePayments.length > 0 ? licensePayments[0] : null;

      const subject = `Factura y Confirmación de Pago - Suscripción EduGest - ${license.center_name || 'Mi Centro'}`;
      const amountPaid = lastPayment ? lastPayment.amount : monthlyPrice;
      const payMethodStr = lastPayment ? lastPayment.method : 'Transferencia';
      const payRefStr = lastPayment?.reference_note || 'N/A';
      const payDateStr = lastPayment?.payment_date
        ? new Date(lastPayment.payment_date).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : new Date().toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          });

      const nextExpirationStr = license.subscription_end_date
        ? new Date(license.subscription_end_date).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'N/A';

      const body = `Estimado Equipo de ${license.center_name || 'Centro Educativo'}:

Le saludamos cordialmente.

Por medio de la presente, confirmamos que hemos recibido y registrado con éxito su pago de suscripción de la plataforma EduGest. A continuación, le detallamos su recibo/factura de pago correspondiente:

DETALLE DE LA FACTURA
===================================
• Centro Educativo: ${license.center_name || 'No especificado'}
• Plan Asignado: ${planName}
• Monto Recibido: $${amountPaid.toLocaleString()} DOP
• Fecha de Pago: ${payDateStr}
• Método de Pago: ${payMethodStr}
• Referencia: ${payRefStr}
• Nueva Fecha de Vencimiento: ${nextExpirationStr}
===================================

Este correo sirve como constancia y recibo formal de pago por el periodo de servicio correspondiente. Su acceso al sistema ha sido extendido y se encuentra completamente activo.

Le agradecemos su confianza en nuestros servicios de gestión educativa. Si tiene alguna duda o requiere asistencia, no dude en contactarnos.

Atentamente,
El equipo de EduGest
soporte@edugest.net`;

      setBillingSubject(subject);
      setBillingBody(body);
    }
  }, [selectedLicenseForBilling, billingType, bankInfo, payments, plans]);

  const handleSendBillingEmail = () => {
    if (!selectedLicenseForBilling?.linked_email) {
      alert('Este centro no tiene un correo electrónico vinculado.');
      return;
    }
    const to = selectedLicenseForBilling.linked_email;
    const subject = encodeURIComponent(billingSubject);
    const body = encodeURIComponent(billingBody);
    window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
    setIsBillingModalOpen(false);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (generateCount < 1) return;

    setIsGenerating(true);
    try {
      await generateLicenses(generateCount, generatePrice);
      await fetchData();
      setGenerateCount(1);
    } catch (error: any) {
      alert('Error Crítico Generando: ' + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;

    setIsResetting(true);
    setResetMessage('');
    try {
      await sendPasswordReset(resetEmail);
      setResetMessage(`Se ha enviado un enlace de recuperación a ${resetEmail}.`);
      setResetEmail('');
    } catch (error: any) {
      setResetMessage('Error: ' + error.message);
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteCenter = async (centerId: string, centerName: string) => {
    if (
      !window.confirm(
        `¿ESTÁS SEGURO? Esto borrará el centro "${centerName}", todos sus datos (estudiantes, profesores, etc.) y desvinculará la licencia. Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    try {
      await deleteCenter(centerId);
      alert('Centro borrado exitosamente.');
      await fetchData();
    } catch (error: any) {
      alert('Error al borrar centro: ' + error.message);
    }
  };

  const handleSwitchCenter = async (centerId: string, centerName: string) => {
    try {
      await switchActiveCenter(centerId);
      alert(`Accediendo al centro "${centerName}"...`);
      window.location.reload();
    } catch (err: any) {
      alert('Error al acceder al centro: ' + err.message);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payLicenseId) return alert('Seleccione un centro.');
    setIsPaying(true);
    try {
      await registerPayment(payLicenseId, payAmount, payMethod, payRef, payMonths);
      alert('Pago registrado y suscripción extendida exitosamente.');
      setPayAmount(100);
      setPayRef('');
      setPayMonths(1);
      await fetchData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsPaying(false);
    }
  };

  const handleChangePlan = async (licenseId: string, planId: string) => {
    try {
      await assignPlanToLicense(licenseId, planId);
      await fetchData();
    } catch (err: any) {
      alert('Error cambiando plan: ' + err.message);
    }
  };

  const handleExportBackup = async (centerId: string, centerName: string) => {
    try {
      const data = await exportCenterData(centerId);
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(data, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      const dateStr = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute(
        'download',
        `respaldo_${centerName.replace(/\s+/g, '_').toLowerCase()}_${dateStr}.json`
      );
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (err: any) {
      alert('Error al exportar respaldo: ' + err.message);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.center_id || !parsed.version) {
          alert('El archivo no parece ser un respaldo de Edugest válido.');
          return;
        }
        setBackupData(parsed);
      } catch (err) {
        alert('Error al leer el archivo JSON: formato inválido.');
      }
    };
    reader.readAsText(file);
  };

  const handleImportBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importTargetId) return alert('Por favor, seleccione la escuela destino.');
    if (!backupData) return alert('Por favor, suba un archivo de respaldo (.json).');

    const targetLicense = licenses.find((l) => l.used_by_center === importTargetId);
    const targetName = targetLicense?.center_name || 'este centro';

    if (
      !window.confirm(
        `¿ESTÁS TOTALMENTE SEGURO? Se eliminarán todos los datos operacionales actuales de "${targetName}" y se instalarán los del respaldo. Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }

    setIsImporting(true);
    try {
      await importCenterData(importTargetId, backupData);
      alert('Respaldo restaurado e importado con éxito.');
      setBackupData(null);
      setImportTargetId('');
      const fileInput = document.getElementById('backup-file-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      await fetchData();
    } catch (err: any) {
      alert('Error crítico durante la importación: ' + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const startEditPlan = (plan: SaaSPlan) => {
    setEditingPlan(plan);
    setIsCreatingPlan(false);
    setPlanName(plan.name);
    setPlanPriceMonthly(plan.price_monthly);
    setPlanPriceYearly(plan.price_yearly || 0);
    setPlanMaxStudents(plan.max_students);
    setPlanMaxTeachers(plan.max_teachers);
    setPlanMaxManagers(plan.max_managers || 5);
    setPlanMaxSupport(plan.max_support || 5);
    setPlanMaxUsers(plan.max_users || 500);
  };

  const startCreatePlan = () => {
    setEditingPlan(null);
    setIsCreatingPlan(true);
    setPlanName('');
    setPlanPriceMonthly(29);
    setPlanPriceYearly(290);
    setPlanMaxStudents(300);
    setPlanMaxTeachers(30);
    setPlanMaxManagers(5);
    setPlanMaxSupport(5);
    setPlanMaxUsers(500);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName) return alert('Por favor ingrese el nombre del plan.');
    setIsSavingPlan(true);
    try {
      const planPayload = {
        name: planName,
        price_monthly: Number(planPriceMonthly),
        price_yearly: Number(planPriceYearly),
        max_students: Number(planMaxStudents),
        max_teachers: Number(planMaxTeachers),
        max_managers: Number(planMaxManagers),
        max_support: Number(planMaxSupport),
        max_users: Number(planMaxUsers)
      };

      if (editingPlan) {
        await updatePlan(editingPlan.id, planPayload);
        alert('Plan actualizado exitosamente.');
      } else if (isCreatingPlan) {
        await createPlan(planPayload);
        alert('Plan creado exitosamente.');
      }

      setEditingPlan(null);
      setIsCreatingPlan(false);
      await fetchData();
    } catch (err: any) {
      alert('Error al guardar el plan: ' + err.message);
    } finally {
      setIsSavingPlan(false);
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este registro de pago?')) return;
    try {
      await deletePayment(paymentId);
      alert('Pago eliminado exitosamente.');
      await fetchData();
    } catch (err: any) {
      alert('Error al eliminar pago: ' + err.message);
    }
  };

  const startEditPayment = (payment: SaaSPayment) => {
    setEditingPayment(payment);
    setEditPayAmount(payment.amount);
    setEditPayMethod(payment.method);
    setEditPayRef(payment.reference_note || '');
    setEditPayDate(payment.payment_date ? payment.payment_date.split('T')[0] : '');
  };

  const handleSaveEditPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment) return;
    setIsSavingPayment(true);
    try {
      await updatePayment(editingPayment.id, {
        amount: Number(editPayAmount),
        method: editPayMethod,
        reference_note: editPayRef || null,
        payment_date: editPayDate
          ? new Date(editPayDate + 'T12:00:00').toISOString()
          : new Date().toISOString()
      });
      alert('Pago actualizado exitosamente.');
      setEditingPayment(null);
      await fetchData();
    } catch (err: any) {
      alert('Error al guardar el pago: ' + err.message);
    } finally {
      setIsSavingPayment(false);
    }
  };

  const activeLicenses = licenses.filter((l) => l.is_used);
  const pendingLicenses = licenses.filter((l) => !l.is_used);

  const filteredActiveLicenses = activeLicenses.filter((l) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (l.center_name || '').toLowerCase().includes(query) ||
      (l.linked_email || '').toLowerCase().includes(query) ||
      (l.product_key || '').toLowerCase().includes(query)
    );
  });

  if (isLoading && !stats) {
    return (
      <div className="flex justify-center items-center h-64">
        <RefreshCw className="animate-spin text-brand-blue" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Shield className="text-brand-accent" size={28} />
            SaaS Super Admin
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Gestión global de licencias, planes, pagos y centros EduGest.
          </p>
        </div>
        <button
          onClick={fetchData}
          className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-50 text-slate-500 hover:text-brand-blue transition-colors"
          title="Actualizar datos"
        >
          <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Ingresos Totales (Pagos)</p>
            <h3 className="text-2xl font-bold text-slate-800">
              ${stats?.totalEarnings?.toLocaleString()}
            </h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Centros Activos</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats?.activeLicenses}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Licencias Pendientes</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats?.pendingLicenses}</h3>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="p-3 bg-purple-100 text-purple-600 rounded-xl">
            <Key size={24} />
          </div>
          <div>
            <p className="text-slate-500 text-sm font-medium">Total Códigos Generados</p>
            <h3 className="text-2xl font-bold text-slate-800">{stats?.totalLicenses}</h3>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-100 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab('centers')}
            className={`flex-none px-6 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'centers' ? 'text-brand-blue border-b-2 border-brand-blue bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Users size={18} /> Escuelas Vinculadas
          </button>
          <button
            onClick={() => setActiveTab('licenses')}
            className={`flex-none px-6 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'licenses' ? 'text-brand-blue border-b-2 border-brand-blue bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Key size={18} /> Inventario Códigos
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`flex-none px-6 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'plans' ? 'text-brand-blue border-b-2 border-brand-blue bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <List size={18} /> Manejo de Planes
          </button>
          <button
            onClick={() => setActiveTab('payments')}
            className={`flex-none px-6 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'payments' ? 'text-brand-blue border-b-2 border-brand-blue bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <CreditCard size={18} /> Asignar Pagos
          </button>
          <button
            onClick={() => setActiveTab('support')}
            className={`flex-none px-6 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'support' ? 'text-brand-blue border-b-2 border-brand-blue bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Phone size={18} /> Soporte (Directores)
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex-none px-6 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'security' ? 'text-brand-blue border-b-2 border-brand-blue bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Shield size={18} /> Seguridad
          </button>
          <button
            onClick={() => setActiveTab('backups')}
            className={`flex-none px-6 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${activeTab === 'backups' ? 'text-brand-blue border-b-2 border-brand-blue bg-blue-50/30' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Database size={18} /> Copias y Migración
          </button>
        </div>

        <div className="p-8">
          {/* TAB: CENTROS VINCULADOS */}
          {activeTab === 'centers' && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">
                  Centros Activos ({activeLicenses.length})
                </h3>
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
                    size={16}
                  />
                  <input
                    type="text"
                    placeholder="Buscar centro..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 pr-4 py-2 border border-slate-200 rounded-full text-sm focus:outline-none focus:border-brand-blue"
                  />
                </div>
              </div>

              {activeLicenses.length === 0 ? (
                <p className="text-slate-500 text-sm py-4">
                  Aún no hay centros registrados con licencia.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Centro Educativo
                        </th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Plan Asignado
                        </th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Product Key
                        </th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Suscripción (Fin)
                        </th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActiveLicenses.map((license) => {
                        const endDate = license.subscription_end_date
                          ? new Date(license.subscription_end_date)
                          : null;
                        const isExpired = endDate && endDate < new Date();
                        const centerId = license.used_by_center;

                        return (
                          <tr
                            key={license.id}
                            className="border-b border-slate-100 hover:bg-slate-50"
                          >
                            <td className="py-4 px-4 font-bold text-slate-800">
                              {license.center_name || 'Desconocido'}
                              <div className="text-xs text-slate-500 font-normal mt-1">
                                {license.linked_email}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <select
                                value={license.plan_id || ''}
                                onChange={(e) => handleChangePlan(license.id, e.target.value)}
                                className="bg-white border border-slate-200 text-sm rounded-md py-1 px-2 focus:outline-none focus:border-brand-blue"
                              >
                                <option value="">Sin Plan</option>
                                {plans.map((p) => (
                                  <option key={p.id} value={p.id}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="py-4 px-4 font-mono text-xs text-slate-500">
                              {license.product_key}
                            </td>
                            <td className="py-4 px-4 text-sm text-slate-600">
                              <input
                                type="date"
                                value={
                                  license.subscription_end_date
                                    ? license.subscription_end_date.split('T')[0]
                                    : ''
                                }
                                onChange={async (e) => {
                                  const val = e.target.value;
                                  const newDate = val
                                    ? new Date(val + 'T23:59:59').toISOString()
                                    : null;
                                  try {
                                    await updateSubscriptionEndDate(license.id, newDate);
                                    await fetchData();
                                  } catch (err: any) {
                                    alert('Error al actualizar fecha: ' + err.message);
                                  }
                                }}
                                className="bg-white border border-slate-200 text-xs rounded-lg p-1.5 focus:outline-none focus:border-brand-blue"
                              />
                            </td>
                            <td className="py-4 px-4">
                              {isExpired ? (
                                <span className="px-2 py-1 bg-red-100 text-red-700 rounded-md text-xs font-bold">
                                  Limitada / Vencida
                                </span>
                              ) : (
                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-md text-xs font-bold flex items-center gap-1 w-max">
                                  <CheckCircle2 size={12} /> Activa
                                </span>
                              )}
                            </td>
                            <td className="py-4 px-4 text-right">
                              {centerId && (
                                <div className="flex justify-end gap-1.5">
                                  {license.linked_email && (
                                    <button
                                      onClick={() => {
                                        setSelectedLicenseForBilling(license);
                                        setBillingType('reminder');
                                        setIsBillingModalOpen(true);
                                      }}
                                      className="p-2 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                                      title="Emitir Recordatorio o Factura por Correo"
                                    >
                                      <Mail size={18} />
                                    </button>
                                  )}
                                  <button
                                    onClick={() =>
                                      handleSwitchCenter(
                                        centerId,
                                        license.center_name || 'este centro'
                                      )
                                    }
                                    className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Acceder a la Escuela (Impersonar)"
                                  >
                                    <Eye size={18} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleExportBackup(
                                        centerId,
                                        license.center_name || 'este centro'
                                      )
                                    }
                                    className="p-2 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                                    title="Exportar Respaldo (Descargar JSON)"
                                  >
                                    <Download size={18} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteCenter(
                                        centerId,
                                        license.center_name || 'este centro'
                                      )
                                    }
                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Borrar Centro y Liberar Licencia"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB: INVENTARIO DE LICENCIAS (Pendientes) */}
          {activeTab === 'licenses' && (
            <div className="space-y-8 animate-fade-in">
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                  <Key size={20} className="text-brand-accent" />
                  Generador de Códigos de Invitación (SaaS)
                </h3>
                <form
                  onSubmit={handleGenerate}
                  className="flex flex-col md:flex-row gap-4 items-end"
                >
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Cantidad a generar
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={generateCount}
                      onChange={(e) => setGenerateCount(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:border-brand-blue transition-all"
                    />
                  </div>
                  <div className="flex-1 w-full hidden">
                    <input
                      type="number"
                      value={generatePrice}
                      onChange={(e) => setGeneratePrice(Number(e.target.value))}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="w-full md:w-auto bg-brand-blue text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-brand-blue/30"
                  >
                    {isGenerating ? (
                      <RefreshCw className="animate-spin" size={18} />
                    ) : (
                      <Key size={18} />
                    )}
                    Generar Códigos
                  </button>
                </form>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-4">
                  Códigos Pendientes (Sin Usar)
                </h3>
                {pendingLicenses.length === 0 ? (
                  <p className="text-slate-500 text-sm py-4">
                    No hay licencias pendientes. Genera nuevas arriba.
                  </p>
                ) : (
                  <div className="overflow-x-auto max-h-96 custom-scrollbar border border-slate-200 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-white shadow-sm">
                        <tr className="border-b border-slate-200">
                          <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Product Key (Enviar a Escuela)
                          </th>
                          <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Fecha de Creación
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingLicenses.map((license) => (
                          <tr
                            key={license.id}
                            className="border-b border-slate-100 hover:bg-slate-50"
                          >
                            <td className="py-3 px-4 font-mono font-medium text-slate-800">
                              {license.product_key}
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-sm">
                              {new Date(license.created_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: PLANES */}
          {activeTab === 'plans' && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Planes de Suscripción</h3>
                  <p className="text-slate-500 text-xs">
                    Crea o edita los planes comerciales, precios y límites de estudiantes/docentes.
                  </p>
                </div>
                {!editingPlan && !isCreatingPlan && (
                  <button
                    onClick={startCreatePlan}
                    className="bg-brand-blue hover:bg-blue-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Crear Nuevo Plan
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Lista de Planes (Toma todo si no hay form activo, toma 2/3 si lo hay) */}
                <div className={editingPlan || isCreatingPlan ? 'lg:col-span-2' : 'lg:col-span-3'}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {plans.map((plan) => (
                      <div
                        key={plan.id}
                        className={`border rounded-2xl p-6 bg-white hover:border-brand-blue transition-all relative shadow-sm flex flex-col justify-between ${editingPlan?.id === plan.id ? 'ring-2 ring-brand-blue/30 border-brand-blue' : 'border-slate-200'}`}
                      >
                        <div>
                          {plan.name === 'Pro' && (
                            <div className="absolute top-0 right-0 transform translate-x-2 -translate-y-2 bg-brand-accent text-white text-[10px] font-black uppercase px-2 py-1 rounded-full">
                              Popular
                            </div>
                          )}
                          <h4 className="text-xl font-black text-slate-800 mb-1">{plan.name}</h4>
                          <div className="flex items-end gap-1 mb-4">
                            <span className="text-3xl font-extrabold text-slate-800">
                              ${plan.price_monthly}
                            </span>
                            <span className="text-sm font-medium text-slate-500 mb-1">/mes</span>
                            <span className="text-xs text-slate-400 ml-2 mb-1">
                              (${plan.price_yearly || 0}/año)
                            </span>
                          </div>
                          <div className="space-y-3 mb-6 pt-3 border-t border-slate-200">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Max. Estudiantes:</span>
                              <span className="font-bold text-slate-700">
                                {plan.max_students > 10000 ? 'Ilimitado' : plan.max_students}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Max. Docentes:</span>
                              <span className="font-bold text-slate-700">
                                {plan.max_teachers > 1000 ? 'Ilimitado' : plan.max_teachers}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Max. Gestores:</span>
                              <span className="font-bold text-slate-700">
                                {plan.max_managers > 1000
                                  ? 'Ilimitado'
                                  : plan.max_managers || 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-500">Max. Apoyo:</span>
                              <span className="font-bold text-slate-700">
                                {plan.max_support > 1000 ? 'Ilimitado' : plan.max_support || 'N/A'}
                              </span>
                            </div>
                            <div className="flex justify-between text-sm text-indigo-600 font-semibold">
                              <span className="text-slate-500">Max. Usuarios:</span>
                              <span className="font-bold">
                                {plan.max_users > 10000 ? 'Ilimitado' : plan.max_users || 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-slate-50">
                          <button
                            onClick={() => startEditPlan(plan)}
                            className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          >
                            <Edit2 size={12} /> Editar Plan
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Formulario lateral de Creación/Edición */}
                {(editingPlan || isCreatingPlan) && (
                  <div className="lg:col-span-1 bg-slate-50 border border-slate-200 rounded-3xl p-6 space-y-6 h-max animate-fade-in">
                    <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                      <h4 className="text-md font-bold text-slate-800">
                        {editingPlan ? `Editar Plan: ${editingPlan.name}` : 'Crear Nuevo Plan'}
                      </h4>
                      <button
                        onClick={() => {
                          setEditingPlan(null);
                          setIsCreatingPlan(false);
                        }}
                        className="text-slate-400 hover:text-slate-600 text-xs font-bold"
                      >
                        Cancelar
                      </button>
                    </div>

                    <form onSubmit={handleSavePlan} className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                          Nombre del Plan
                        </label>
                        <input
                          type="text"
                          required
                          value={planName}
                          onChange={(e) => setPlanName(e.target.value)}
                          placeholder="e.g. Standard, Premium"
                          className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Precio Mensual ($)
                          </label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={planPriceMonthly}
                            onChange={(e) => setPlanPriceMonthly(Number(e.target.value))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Precio Anual ($)
                          </label>
                          <input
                            type="number"
                            required
                            min="0"
                            value={planPriceYearly}
                            onChange={(e) => setPlanPriceYearly(Number(e.target.value))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Estudiantes Máx.
                          </label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={planMaxStudents}
                            onChange={(e) => setPlanMaxStudents(Number(e.target.value))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Docentes Máx.
                          </label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={planMaxTeachers}
                            onChange={(e) => setPlanMaxTeachers(Number(e.target.value))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Gestores Máx.
                          </label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={planMaxManagers}
                            onChange={(e) => setPlanMaxManagers(Number(e.target.value))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Personal Apoyo Máx.
                          </label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={planMaxSupport}
                            onChange={(e) => setPlanMaxSupport(Number(e.target.value))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                            Usuarios Creados Máx. (Límite General)
                          </label>
                          <input
                            type="number"
                            required
                            min="1"
                            value={planMaxUsers}
                            onChange={(e) => setPlanMaxUsers(Number(e.target.value))}
                            className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue transition-all"
                          />
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={isSavingPlan}
                        className="w-full bg-brand-blue text-white font-bold py-3 px-8 rounded-xl hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer text-sm shadow-md"
                      >
                        {isSavingPlan ? (
                          <>
                            <RefreshCw className="animate-spin" size={16} /> Guardando...
                          </>
                        ) : (
                          'Guardar Plan'
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: PAGOS Y FACTURACIÓN */}
          {activeTab === 'payments' && (
            <div className="animate-fade-in grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Formulario de Pago */}
              <div className="col-span-1 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <CreditCard size={20} className="text-emerald-500" />
                  Registrar Pago (Extender)
                </h3>
                <form onSubmit={handlePayment} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Escuela / Centro
                    </label>
                    <select
                      required
                      value={payLicenseId}
                      onChange={(e) => setPayLicenseId(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-blue"
                    >
                      <option value="">-- Seleccionar Escuela --</option>
                      {activeLicenses.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.center_name || l.linked_email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Monto Pagado ($)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={payAmount}
                      onChange={(e) => setPayAmount(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Meses a extender
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="60"
                      value={payMonths}
                      onChange={(e) => setPayMonths(Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-blue"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Método de Pago
                    </label>
                    <select
                      value={payMethod}
                      onChange={(e) => setPayMethod(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-blue"
                    >
                      <option value="Transferencia">Transferencia Bancaria</option>
                      <option value="Tarjeta">Tarjeta de Crédito/Débito</option>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Referencia / Nota
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Transferencia BHD #1234"
                      value={payRef}
                      onChange={(e) => setPayRef(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-brand-blue"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isPaying}
                    className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 mt-4"
                  >
                    {isPaying ? 'Procesando...' : 'Registrar y Extender'}
                  </button>
                </form>
              </div>

              {/* Historial de Pagos */}
              <div className="col-span-2">
                <h3 className="text-lg font-bold text-slate-800 mb-6">
                  Historial de Pagos Recientes
                </h3>
                {payments.length === 0 ? (
                  <p className="text-slate-500 text-sm">No hay pagos registrados todavía.</p>
                ) : (
                  <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[500px] custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-white shadow-sm">
                        <tr className="border-b border-slate-200">
                          <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Fecha
                          </th>
                          <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Centro
                          </th>
                          <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Monto
                          </th>
                          <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Método/Ref
                          </th>
                          <th className="py-3 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                            Acciones
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((payment) => {
                          const license = activeLicenses.find((l) => l.id === payment.license_id);
                          return (
                            <tr
                              key={payment.id}
                              className="border-b border-slate-100 hover:bg-slate-50"
                            >
                              <td className="py-3 px-4 text-sm text-slate-600">
                                {new Date(payment.payment_date).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4 text-sm font-bold text-slate-800">
                                {license?.center_name || 'Desconocido'}
                              </td>
                              <td className="py-3 px-4 text-sm font-bold text-emerald-600">
                                ${payment.amount}
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-500">
                                <span className="font-medium text-slate-700">{payment.method}</span>
                                {payment.reference_note && (
                                  <span className="block italic">"{payment.reference_note}"</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex justify-end gap-1">
                                  <button
                                    onClick={() => startEditPayment(payment)}
                                    className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                    title="Editar Pago"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleDeletePayment(payment.id)}
                                    className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                    title="Eliminar Pago"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: SOPORTE Y CONTACTO */}
          {activeTab === 'support' && (
            <div className="animate-fade-in space-y-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-slate-800">
                  Directorio de Escuelas para Soporte
                </h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeLicenses.map((license) => (
                  <div
                    key={license.id}
                    className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <h4 className="font-bold text-slate-800 text-lg leading-tight mb-2">
                        {license.center_name || 'Escuela Desconocida'}
                      </h4>
                      <div className="flex items-center gap-2 text-sm text-slate-600 mb-1">
                        <Mail size={14} className="text-slate-400" />
                        <a
                          href={`mailto:${license.linked_email}`}
                          className="hover:text-brand-blue hover:underline"
                        >
                          {license.linked_email}
                        </a>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                        Plan: {license.plan_name}
                      </span>
                      <a
                        href={`mailto:${license.linked_email}?subject=Soporte EduGest SaaS`}
                        className="text-brand-blue text-sm font-bold hover:underline"
                      >
                        Contactar
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: SEGURIDAD */}
          {activeTab === 'security' && (
            <div className="animate-fade-in max-w-xl">
              <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm">
                <div className="w-12 h-12 bg-red-50 text-red-500 rounded-xl flex items-center justify-center mb-6">
                  <Shield size={24} />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Restablecer Contraseña</h3>
                <p className="text-slate-500 text-sm mb-6">
                  Ingresa el correo electrónico del administrador o usuario que perdió acceso. Se
                  enviará un enlace de recuperación seguro directamente a su bandeja de entrada.
                </p>

                <form onSubmit={handlePasswordReset} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Correo Electrónico
                    </label>
                    <div className="relative">
                      <Mail
                        className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400"
                        size={18}
                      />
                      <input
                        type="email"
                        required
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="ejemplo@escuela.edu"
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-12 pr-4 py-3 text-slate-700 focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isResetting}
                    className="w-full bg-slate-800 text-white font-bold py-3 px-8 rounded-xl hover:bg-slate-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isResetting ? (
                      <RefreshCw className="animate-spin" size={18} />
                    ) : (
                      'Enviar Enlace de Recuperación'
                    )}
                  </button>

                  {resetMessage && (
                    <div
                      className={`p-4 rounded-xl text-sm font-medium mt-4 ${resetMessage.startsWith('Error') ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}
                    >
                      {resetMessage}
                    </div>
                  )}
                </form>
              </div>
            </div>
          )}

          {/* TAB: BACKUPS & MIGRACIÓN */}
          {activeTab === 'backups' && (
            <div className="animate-fade-in space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Export Card */}
                <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm space-y-6">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-500 rounded-xl flex items-center justify-center">
                    <Download size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">Exportar Respaldo</h3>
                    <p className="text-slate-500 text-sm">
                      Descarga una copia completa en formato JSON con toda la información operativa
                      del colegio seleccionado: alumnos, personal, cursos, materias, horarios y
                      calificaciones.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Seleccionar Colegio
                      </label>
                      <select
                        onChange={(e) => {
                          const cid = e.target.value;
                          if (!cid) return;
                          const lic = licenses.find((l) => l.used_by_center === cid);
                          handleExportBackup(cid, lic?.center_name || 'centro');
                          e.target.value = ''; // Reset option
                        }}
                        defaultValue=""
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:border-brand-blue transition-all cursor-pointer"
                      >
                        <option value="" disabled>
                          Seleccione un colegio para descargar...
                        </option>
                        {activeLicenses.map((l) => (
                          <option key={l.id} value={l.used_by_center || ''}>
                            {l.center_name} ({l.linked_email})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Import Card */}
                <div className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm space-y-6">
                  <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-xl flex items-center justify-center">
                    <Upload size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">
                      Importar / Restaurar Respaldo
                    </h3>
                    <p className="text-slate-500 text-sm">
                      Sube un archivo de respaldo `.json` generado previamente para restaurar o
                      clonar todos los datos sobre una escuela destino seleccionada.
                    </p>
                    <p className="text-red-500 text-xs font-bold mt-2">
                      ⚠️ ¡ATENCIÓN! Esta acción borrará de forma permanente los datos actuales de la
                      escuela destino antes de inyectar el respaldo.
                    </p>
                  </div>

                  <form onSubmit={handleImportBackup} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Colegio Destino (Inquilino)
                      </label>
                      <select
                        required
                        value={importTargetId}
                        onChange={(e) => setImportTargetId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-3 text-slate-700 focus:outline-none focus:border-brand-blue transition-all cursor-pointer"
                      >
                        <option value="" disabled hidden>
                          Seleccione el colegio destino...
                        </option>
                        {activeLicenses.map((l) => (
                          <option key={l.id} value={l.used_by_center || ''}>
                            {l.center_name} ({l.linked_email})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Archivo de Respaldo (.json)
                      </label>
                      <input
                        id="backup-file-input"
                        type="file"
                        accept=".json"
                        required
                        onChange={handleFileChange}
                        className="w-full text-sm text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 file:cursor-pointer"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isImporting || !backupData || !importTargetId}
                      className="w-full bg-indigo-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isImporting ? (
                        <>
                          <RefreshCw className="animate-spin" size={18} /> Procesando
                          Restauración...
                        </>
                      ) : (
                        'Restaurar e Importar Datos'
                      )}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL: EDITAR PAGO */}
        {editingPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-8 space-y-6 animate-scale-up">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <h3 className="text-lg font-bold text-slate-800">Editar Registro de Pago</h3>
                <button
                  onClick={() => setEditingPayment(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>

              <form onSubmit={handleSaveEditPayment} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Monto ($)
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={editPayAmount}
                    onChange={(e) => setEditPayAmount(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Fecha de Pago
                  </label>
                  <input
                    type="date"
                    required
                    value={editPayDate}
                    onChange={(e) => setEditPayDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={editPayMethod}
                    onChange={(e) => setEditPayMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue cursor-pointer"
                  >
                    <option value="Transferencia">Transferencia Bancaria</option>
                    <option value="Tarjeta">Tarjeta de Crédito/Débito</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Otro">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                    Referencia / Nota
                  </label>
                  <input
                    type="text"
                    value={editPayRef}
                    onChange={(e) => setEditPayRef(e.target.value)}
                    placeholder="Ej. Transferencia BHD #1234"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-blue"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingPayment}
                  className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 mt-4 cursor-pointer text-sm shadow-md flex items-center justify-center gap-2"
                >
                  {isSavingPayment ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} /> Guardando...
                    </>
                  ) : (
                    'Guardar Cambios'
                  )}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* MODAL: FACTURACIÓN Y RECORDATORIOS */}
        {isBillingModalOpen && selectedLicenseForBilling && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full p-8 space-y-6 animate-scale-up">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">
                    Facturación y Recordatorios SaaS
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Centro: <span className="font-bold text-indigo-600">{selectedLicenseForBilling.center_name || 'Desconocido'}</span> ({selectedLicenseForBilling.linked_email})
                  </p>
                </div>
                <button
                  onClick={() => setIsBillingModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
                >
                  Cerrar
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  {/* TIPO DE CORREO */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Tipo de Correo
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setBillingType('reminder')}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          billingType === 'reminder'
                            ? 'bg-blue-50 text-blue-600 border-blue-200'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Recordatorio de Pago
                      </button>
                      <button
                        type="button"
                        onClick={() => setBillingType('invoice')}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          billingType === 'invoice'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Factura de Pago
                      </button>
                    </div>
                  </div>

                  {/* CUENTAS DE TRANSFERENCIA */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Cuentas Bancarias de Transferencia
                    </label>
                    <textarea
                      rows={4}
                      value={bankInfo}
                      onChange={(e) => setBankInfo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-medium focus:outline-none focus:border-brand-blue"
                      placeholder="Indique las cuentas bancarias..."
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  {/* ASUNTO PREVIO */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Asunto del Correo
                    </label>
                    <input
                      type="text"
                      value={billingSubject}
                      onChange={(e) => setBillingSubject(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-bold focus:outline-none focus:border-brand-blue"
                    />
                  </div>

                  {/* CUERPO PREVIO */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
                      Cuerpo del Correo (Editable)
                    </label>
                    <textarea
                      rows={10}
                      value={billingBody}
                      onChange={(e) => setBillingBody(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-[10px] font-mono leading-relaxed focus:outline-none focus:border-brand-blue"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsBillingModalOpen(false)}
                  className="flex-1 py-3 border border-slate-200 text-slate-500 rounded-xl font-bold hover:bg-slate-50 transition-colors text-sm cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSendBillingEmail}
                  className={`flex-1 py-3 text-white rounded-xl font-bold transition-all text-sm flex items-center justify-center gap-2 cursor-pointer ${
                    billingType === 'reminder'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <Mail size={16} />
                  Abrir Cliente de Correo
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
