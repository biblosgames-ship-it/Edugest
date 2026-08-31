import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Filter,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  User,
  CreditCard,
  FileSpreadsheet,
  Zap,
  RefreshCw,
  Trash2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useFinance } from '../../hooks/useFinance';
import { useStudents } from '../../hooks/useStudents';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { StudentAccountDetails } from './StudentAccountDetails';

const normalizeInvoiceKey = (inv: any) => {
  if (!inv) return 'UNKNOWN';

  if (inv.product_id) {
    return `PRODUCT_${inv.product_id}`;
  }

  const c = (inv.concept || '').trim().toLowerCase();

  if (c.includes('inscrip') || c.includes('inscrib')) {
    return 'INSCRIPCION';
  }

  if (typeof inv.month_number === 'number' && inv.month_number > 0) {
    return `CUOTA_${String(inv.month_number).padStart(2, '0')}`;
  }

  const cuotaMatch = c.match(/cuota\s*#?\s*-?\s*0*(\d+)/i);
  if (cuotaMatch) {
    return `CUOTA_${cuotaMatch[1].padStart(2, '0')}`;
  }

  const desc = (inv.description || '').trim().toLowerCase();

  if (c.includes('colegiatura') || c.includes('mensualidad') || c.includes('cuota')) {
    const monthMap: Record<string, string> = {
      septiembre: 'CUOTA_01', sept: 'CUOTA_01',
      octubre: 'CUOTA_02', oct: 'CUOTA_02',
      noviembre: 'CUOTA_03', nov: 'CUOTA_03',
      diciembre: 'CUOTA_04', dic: 'CUOTA_04',
      enero: 'CUOTA_05', ene: 'CUOTA_05',
      febrero: 'CUOTA_06', feb: 'CUOTA_06',
      marzo: 'CUOTA_07', mar: 'CUOTA_07',
      abril: 'CUOTA_08', abr: 'CUOTA_08',
      mayo: 'CUOTA_09',
      junio: 'CUOTA_10', jun: 'CUOTA_10',
      julio: 'CUOTA_11', jul: 'CUOTA_11',
      agosto: 'CUOTA_12', ago: 'CUOTA_12'
    };

    for (const [mName, key] of Object.entries(monthMap)) {
      const regex = new RegExp(`\\b${mName}\\b`, 'i');
      if (regex.test(c) || regex.test(desc)) {
        return key;
      }
    }
  }

  return (inv.concept || '').trim().toUpperCase();
};

export const StudentAccounts = ({ onTabChange }: { onTabChange?: (tab: string) => void }) => {
  const { state, profile, selectedYear } = useApp();
  const { students: allStudents } = useStudents();
  const { invoices, paymentPlans, refresh, loading, scholarships } = useFinance({
    invoices: true,
    paymentPlans: true,
    scholarships: true
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const isBatchProcessingRef = useRef(false);

  const handleBatchBilling = async () => {
    if (isBatchProcessing || isBatchProcessingRef.current) return;
    isBatchProcessingRef.current = true;
    // Buscar alumnos con facturación incompleta
    const studentsToProcess = students.filter((s) => {
      const course = state.courses?.find((c) => c.id === s.course_id);
      const cleanLevel = course?.level?.split(' ')?.[0]?.trim();

      let plan = paymentPlans.find((p) => p.course_id === s.course_id);
      if (!plan && cleanLevel) {
        plan = paymentPlans.find((p) => {
          const c = state.courses?.find((x) => x.id === p.course_id);
          return c?.level?.trim() === cleanLevel;
        });
      }
      if (!plan) return false;

      const currentYear = selectedYear || '2025-2026';
      const studentInvoices = invoices.filter((i) => i.student_id === s.id && !i.product_id && i.period === currentYear);
      const targetCount = Number(plan.months_count) + 1; // 1 inscripción + cuotas
      return studentInvoices.length < targetCount;
    });

    if (studentsToProcess.length === 0) {
      toast.success('Todos los alumnos ya tienen sus facturas generadas y al día.');
      return;
    }

    if (
      !window.confirm(
        `¿Deseas generar/completar AUTOMÁTICAMENTE la facturación anual para ${studentsToProcess.length} alumnos con cuotas pendientes o incompletas?`
      )
    )
      return;

    setIsBatchProcessing(true);
    const loadingToast = toast.loading(
      `Procesando facturación para ${studentsToProcess.length} alumnos...`
    );

    try {
      let createdCount = 0;
      const currentYear = selectedYear || '2025-2026';
      const periodYearMatch = currentYear.match(/^(\d{4})/);
      const baseYear = periodYearMatch ? Number(periodYearMatch[1]) : new Date().getFullYear();
      const errorList: string[] = [];

      for (const student of studentsToProcess) {
        // 1. Buscar Plan
        const course = state.courses?.find((c) => c.id === student.course_id);
        const cleanLevel = course?.level?.split(' ')?.[0]?.trim();

        let plan = paymentPlans.find((p) => p.course_id === student.course_id);
        if (!plan && cleanLevel) {
          plan = paymentPlans.find((p) => {
            const c = state.courses?.find((x) => x.id === p.course_id);
            return c?.level?.trim() === cleanLevel;
          });
        }

        if (!plan) continue;

        const studentExistingInvoices = invoices.filter(
          (i) => i.student_id === student.id && !i.product_id
        );

        // 2. Generar Pack de Facturas
        const newInvoices = [];
        const currentCenterId = profile?.center_id || student.center_id;

        // Buscar si el alumno tiene beca
        const studentScholarship = scholarships.find((s) => s.student_id === student.id);

        // Calcular Inscripción con beca si corresponde
        let enrollmentOriginal = Number(plan.enrollment_fee);
        let enrollmentFinal = enrollmentOriginal;
        let enrollmentDiscount = 0;

        if (
          studentScholarship &&
          (studentScholarship.applies_to === 'both' ||
            studentScholarship.applies_to === 'enrollment')
        ) {
          if (studentScholarship.type === 'percentage') {
            enrollmentDiscount = enrollmentOriginal * (Number(studentScholarship.value) / 100);
          } else {
            enrollmentDiscount = Number(studentScholarship.value);
          }
          enrollmentFinal = Math.max(0, enrollmentOriginal - enrollmentDiscount);
        }

        // Inscripción (solo si no existe ya)
        const hasEnrollment = studentExistingInvoices.some(
          (inv) => normalizeInvoiceKey(inv) === 'INSCRIPCION'
        );
        if (!hasEnrollment) {
          newInvoices.push({
            center_id: currentCenterId,
            student_id: student.id,
            course_id: student.course_id,
            period: currentYear,
            concept: 'Inscripción',
            amount_original: enrollmentOriginal,
            amount_final: enrollmentFinal,
            discount_applied: enrollmentDiscount,
            due_date: new Date().toISOString().split('T')[0],
            status: 'pending'
          });
        }

        // Mensualidades
        const monthNames = [
          'Enero',
          'Febrero',
          'Marzo',
          'Abril',
          'Mayo',
          'Junio',
          'Julio',
          'Agosto',
          'Septiembre',
          'Octubre',
          'Noviembre',
          'Diciembre'
        ];
        const startMonthIdx = (plan.start_month || 9) - 1;
        const paymentEndDay = plan.payment_end_day || 10;

        for (let i = 0; i < Number(plan.months_count); i++) {
          const conceptName = `Cuota ${(i + 1).toString().padStart(2, '0')}`;
          const targetCuotaKey = `CUOTA_${(i + 1).toString().padStart(2, '0')}`;
          const cuotaNum = i + 1;
          const exists = studentExistingInvoices.some((inv) => inv.month_number === cuotaNum || normalizeInvoiceKey(inv) === targetCuotaKey);
          if (exists) continue; // Saltar si ya existe esta mensualidad

          const mIdx = (startMonthIdx + i) % 12;
          const yOffset = baseYear + (startMonthIdx + i >= 12 ? 1 : 0);
          const dueDate = new Date(yOffset, mIdx, paymentEndDay);

          // Calcular Mensualidad con beca si corresponde
          let monthlyOriginal = Number(plan.monthly_fee);
          let monthlyFinal = monthlyOriginal;
          let monthlyDiscount = 0;

          if (
            studentScholarship &&
            (studentScholarship.applies_to === 'both' ||
              studentScholarship.applies_to === 'monthly')
          ) {
            if (studentScholarship.type === 'percentage') {
              monthlyDiscount = monthlyOriginal * (Number(studentScholarship.value) / 100);
            } else {
              monthlyDiscount = Number(studentScholarship.value);
            }
            monthlyFinal = Math.max(0, monthlyOriginal - monthlyDiscount);
          }

          newInvoices.push({
            center_id: currentCenterId,
            student_id: student.id,
            course_id: student.course_id,
            period: currentYear,
            concept: conceptName,
            month_number: i + 1,
            description: monthNames[mIdx],
            amount_original: monthlyOriginal,
            amount_final: monthlyFinal,
            discount_applied: monthlyDiscount,
            due_date: dueDate.toISOString().split('T')[0],
            status: 'pending'
          });
        }

        // 3. Guardar en DB
        if (newInvoices.length > 0) {
          const { error } = await supabase.from('finance_invoices').insert(newInvoices);
          if (!error) {
            createdCount++;
          } else {
            console.error(`Error procesando alumno ${student.names}:`, error);
            errorList.push(`${student.names} ${student.first_surname || ''}: ${error.message}`);
          }
        }
      }

      if (errorList.length > 0) {
        toast.error(`Facturación masiva completada con algunos errores:\n${errorList.slice(0, 3).join('\n')}`, {
          id: loadingToast,
          duration: 8000
        });
      } else {
        toast.success(`¡Éxito! Se generó/completó la facturación anual para ${createdCount} alumnos.`, {
          id: loadingToast
        });
      }
      refresh();
    } catch (error: any) {
      toast.error('Error en proceso masivo: ' + error.message, { id: loadingToast });
    } finally {
      isBatchProcessingRef.current = false;
      setIsBatchProcessing(false);
    }
  };

  const handleSyncPrices = async () => {
    const pendingInvoices = invoices.filter((i) => i.status === 'pending');

    if (pendingInvoices.length === 0) {
      toast.success('No hay facturas pendientes para actualizar.');
      return;
    }

    if (
      !window.confirm(
        `¿Deseas ACTUALIZAR los precios de las ${pendingInvoices.length} facturas PENDIENTES? Las facturas pagadas no se alterarán.`
      )
    )
      return;

    setIsBatchProcessing(true);
    const loadingToast = toast.loading(
      `Sincronizando precios para ${pendingInvoices.length} facturas...`
    );

    try {
      let updatedCount = 0;

      for (const inv of pendingInvoices) {
        // 1. Buscar Plan
        const course = state.courses?.find((c) => c.id === inv.course_id);
        const cleanLevel = course?.level?.split(' ')?.[0]?.trim();

        let plan = paymentPlans.find((p) => p.course_id === inv.course_id);
        if (!plan && cleanLevel) {
          plan = paymentPlans.find((p) => {
            const c = state.courses?.find((x) => x.id === p.course_id);
            return c?.level?.trim() === cleanLevel;
          });
        }

        if (!plan) continue;

        // 2. Determinar nuevo precio
        const isEnrollment = inv.concept.toLowerCase().includes('inscripción');
        const newPrice = isEnrollment ? Number(plan.enrollment_fee) : Number(plan.monthly_fee);

        // 3. Solo actualizar si el precio cambió
        if (Number(inv.amount_original) !== newPrice) {
          const { error } = await supabase
            .from('finance_invoices')
            .update({
              amount_original: newPrice,
              amount_final: newPrice // Aquí podrías restar descuentos si existieran
            })
            .eq('id', inv.id);

          if (!error) updatedCount++;
        }
      }

      toast.success(
        `¡Sincronización terminada! Se actualizaron ${updatedCount} facturas con los nuevos precios.`,
        { id: loadingToast }
      );
      // Corregir también las entradas contables mal categorizadas de Tela retroactivamente
      try {
        await supabase
          .from('finance_ledger_entries')
          .update({ account: 'INGRESOS: UNIFORMES' })
          .eq('account', 'INGRESOS: INVENTARIO (OTROS)')
          .ilike('description', '%Tela%');
      } catch (e) {
        console.error('Error correcting ledger entries:', e);
      }

      refresh();
    } catch (error: any) {
      toast.error('Error en sincronización: ' + error.message, { id: loadingToast });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleBulkCleanupDuplicates = async () => {
    if (!window.confirm('¿Deseas escanear y eliminar todas las facturas duplicadas de la escuela en este ciclo? (Se conservarán las facturas pagadas si hay duplicados).')) return;
    setIsBatchProcessing(true);
    const loadingToast = toast.loading('Escaneando facturas duplicadas...');

    try {
      const currentYear = selectedYear || '2025-2026';
      // Agrupar facturas por student_id y concepto unificado
      const studentConceptGroups: { [key: string]: any[] } = {};
      invoices.forEach((inv) => {
        if (inv.product_id || inv.period !== currentYear) return;
        const normKey = normalizeInvoiceKey(inv);
        if (normKey === 'UNKNOWN' || (!normKey.startsWith('CUOTA_') && normKey !== 'INSCRIPCION')) return;
        const key = `${inv.student_id}_${normKey}`;
        if (!studentConceptGroups[key]) {
          studentConceptGroups[key] = [];
        }
        studentConceptGroups[key].push(inv);
      });

      const idsToDelete: string[] = [];

      Object.keys(studentConceptGroups).forEach((key) => {
        const group = studentConceptGroups[key];
        if (group.length > 1) {
          const sorted = [...group].sort((a, b) => {
            const score = (status: string) => (status === 'paid' ? 3 : status === 'partial' ? 2 : 1);
            return score(b.status) - score(a.status);
          });
          for (let i = 1; i < sorted.length; i++) {
            idsToDelete.push(sorted[i].id);
          }
        }
      });

      if (idsToDelete.length === 0) {
        toast.success('No se encontraron facturas duplicadas en la escuela.', { id: loadingToast });
        setIsBatchProcessing(false);
        return;
      }

      // Borrar de Supabase
      const { error } = await supabase
        .from('finance_invoices')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      toast.success(`¡Éxito! Se eliminaron ${idsToDelete.length} facturas duplicadas de la escuela.`, { id: loadingToast });
      
      // Corregir también las entradas contables mal categorizadas de Tela retroactivamente
      try {
        await supabase
          .from('finance_ledger_entries')
          .update({ account: 'INGRESOS: UNIFORMES' })
          .eq('account', 'INGRESOS: INVENTARIO (OTROS)')
          .ilike('description', '%Tela%');
      } catch (e) {
        console.error('Error correcting ledger entries:', e);
      }

      refresh();
    } catch (err: any) {
      console.error('Error bulk cleanup:', err);
      toast.error('Error al limpiar duplicados: ' + err.message, { id: loadingToast });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const students = allStudents && allStudents.length > 0 ? allStudents : (state.students || []);

  const studentBalances = useMemo(() => {
    const currentYear = selectedYear || '2026-2027';
    return students.map((student) => {
      const studentInvoices = invoices.filter((i) => i.student_id === student.id && i.period === currentYear);
      const totalDebt = studentInvoices.reduce((acc, i) => acc + Number(i.amount_final), 0);
      const paidInvoices = studentInvoices.filter((i) => i.status === 'paid');
      const totalPaid = paidInvoices.reduce((acc, i) => acc + Number(i.amount_final), 0);
      const balance = totalDebt - totalPaid;

      const hasOverdue = studentInvoices.some(
        (i) =>
          !String(i.concept).toLowerCase().includes('inscrib') &&
          !String(i.concept).toLowerCase().includes('inscrip') &&
          (i.status === 'overdue' || (i.status === 'pending' && new Date(i.due_date) < new Date()))
      );

      let status = 'Al día';
      if (hasOverdue) status = 'Mora';
      else if (balance > 0) status = 'Pendiente';
      else if (totalDebt > 0 && balance === 0) status = 'Saldado';

      return {
        ...student,
        totalDebt,
        totalPaid,
        balance,
        status,
        hasOverdue
      };
    });
  }, [students, invoices, selectedYear]);

  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  const normalizeSearch = (str: string) =>
    (str || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^A-Z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const groupedBalances = useMemo(() => {
    const groups: { [key: string]: any } = {};

    studentBalances.forEach((student) => {
      const courseId = student.course_id || 'unassigned';
      if (!groups[courseId]) {
        const course = state.courses?.find((c) => c.id === courseId);
        groups[courseId] = {
          id: courseId,
          info: course
            ? `${course.level} ${course.grade} "${course.section}"`
            : 'Sin Grado Asignado',
          students: [],
          stats: { total: 0, paid: 0, balance: 0, moraCount: 0 }
        };
      }

      groups[courseId].students.push(student);
      groups[courseId].stats.total += student.totalDebt;
      groups[courseId].stats.paid += student.totalPaid;
      groups[courseId].stats.balance += student.balance;
      if (student.hasOverdue) groups[courseId].stats.moraCount += 1;
    });

    return Object.values(groups).sort((a, b) => a.info.localeCompare(b.info));
  }, [studentBalances, state.courses]);

  // Si hay búsqueda, expandir automáticamente los cursos que tengan resultados
  useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      const tokens = normalizeSearch(searchTerm).split(' ').filter(Boolean);
      const firstMatch = groupedBalances.find((g) =>
        g.students.some((s: any) => {
          const haystack = normalizeSearch(
            `${s.first_surname || s.last_name || ''} ${s.second_surname || ''} ${s.names || s.first_name || ''} ${s.student_code || ''} ${s.rne || ''}`
          );
          return tokens.every((t) => haystack.includes(t));
        })
      );
      if (firstMatch) setExpandedCourse(firstMatch.id);
    }
  }, [searchTerm, groupedBalances]);

  if (selectedStudentId) {
    return (
      <StudentAccountDetails
        studentId={selectedStudentId}
        onBack={() => setSelectedStudentId(null)}
        onTabChange={onTabChange}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* 1. BARRA DE BÚSQUEDA INTEGRADA Y ACCIONES MASIVAS */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm w-full">
          <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              type="text"
              placeholder="Buscar alumno en cualquier grado (por nombre o apellido)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-16 pr-6 py-5 bg-slate-50 border-none rounded-[1.8rem] text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
            />
          </div>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button
            onClick={refresh}
            className="p-5 bg-white border border-slate-100 rounded-[1.8rem] text-slate-400 hover:text-slate-900 transition-all shadow-sm"
            title="Actualizar Datos"
          >
            <RefreshCw size={24} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleBulkCleanupDuplicates}
            disabled={isBatchProcessing}
            className="p-5 bg-rose-50 border border-rose-100 text-rose-600 rounded-[1.8rem] hover:bg-rose-100 transition-all shadow-sm"
            title="Eliminar facturas duplicadas de la escuela"
          >
            <Trash2 size={24} />
          </button>
          <button
            onClick={handleSyncPrices}
            disabled={isBatchProcessing}
            className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-5 bg-indigo-600 text-white rounded-[1.8rem] text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
            title="Actualizar precios de facturas pendientes"
          >
            {isBatchProcessing ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <RefreshCw size={18} />
            )}
            Sincronizar Precios
          </button>
          <button
            onClick={handleBatchBilling}
            disabled={isBatchProcessing}
            className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-5 bg-slate-900 text-white rounded-[1.8rem] text-xs font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-900/10 disabled:opacity-50"
          >
            {isBatchProcessing ? (
              <RefreshCw className="animate-spin" size={18} />
            ) : (
              <Zap size={18} className="text-amber-400 fill-amber-400" />
            )}
            Facturación Masiva
          </button>
        </div>
      </div>

      {/* 2. CUADRÍCULA DE GRADOS (ACORDEÓN) */}
      <div className="space-y-4">
        {groupedBalances.map((group) => {
          const tokens = normalizeSearch(searchTerm).split(' ').filter(Boolean);
          const filteredStudents = group.students.filter((s: any) => {
            if (tokens.length === 0) return true;
            const haystack = normalizeSearch(
              `${s.first_surname || s.last_name || ''} ${s.second_surname || ''} ${s.names || s.first_name || ''} ${s.student_code || ''} ${s.rne || ''}`
            );
            return tokens.every((t) => haystack.includes(t));
          });

          if (searchTerm.trim() && filteredStudents.length === 0) return null;

          const isExpanded = (searchTerm.trim().length >= 2 && filteredStudents.length > 0) || expandedCourse === group.id;

          return (
            <div
              key={group.id}
              className={`bg-white rounded-[2.5rem] border transition-all duration-300 overflow-hidden ${
                isExpanded
                  ? 'border-indigo-600 shadow-2xl ring-4 ring-indigo-50'
                  : 'border-slate-100 hover:border-slate-300'
              }`}
            >
              {/* TARJETA DE RESUMEN (CABECERA) */}
              <div
                onClick={() => setExpandedCourse(isExpanded ? null : group.id)}
                className="p-8 cursor-pointer flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-6">
                  <div
                    className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl transition-transform duration-500 ${
                      isExpanded ? 'bg-indigo-600 rotate-12' : 'bg-slate-900 group-hover:scale-110'
                    }`}
                  >
                    <CreditCard size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900">
                      {group.info}
                    </h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                      {group.students.length} Estudiantes Inscritos
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-10">
                  <div className="text-center hidden sm:block">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Cobrado</p>
                    <p className="text-sm font-black text-emerald-600">
                      RD$ {group.stats.paid.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Pendiente</p>
                    <p
                      className={`text-sm font-black ${group.stats.balance > 0 ? 'text-rose-600' : 'text-slate-900'}`}
                    >
                      RD$ {group.stats.balance.toLocaleString()}
                    </p>
                  </div>
                  {group.stats.moraCount > 0 && (
                    <div className="bg-rose-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 animate-pulse">
                      <AlertTriangle size={14} />
                      <span className="text-[10px] font-black uppercase">
                        {group.stats.moraCount} Mora
                      </span>
                    </div>
                  )}
                  <div
                    className={`p-3 rounded-xl transition-all ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                  >
                    <ChevronRight
                      className={`transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`}
                      size={20}
                    />
                  </div>
                </div>
              </div>

              {/* LISTADO DESPLEGABLE (ALUMNOS) */}
              {isExpanded && (
                <div className="border-t border-slate-50 bg-slate-50/30 p-8 animate-in slide-in-from-top-4 duration-300">
                  <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                          <th className="px-8 py-5">Nombre del Estudiante</th>
                          <th className="px-8 py-5">Estado Pago</th>
                          <th className="px-8 py-5 text-right">Balance</th>
                          <th className="px-8 py-5 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {filteredStudents.map((student: any) => (
                          <tr key={student.id} className="hover:bg-indigo-50/50 transition-colors">
                            <td className="px-8 py-4">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center font-black text-xs">
                                  {student.names?.[0]}
                                  {student.first_surname?.[0]}
                                </div>
                                <span className="text-xs font-black text-slate-700">
                                  {`${student.first_surname || student.last_name || ''} ${student.second_surname || ''}`.trim()
                                    ? `${`${student.first_surname || student.last_name || ''} ${student.second_surname || ''}`.trim()}, ${student.names || student.first_name || ''}`
                                    : student.names || student.first_name || 'Estudiante'}
                                </span>
                              </div>
                            </td>
                            <td className="px-8 py-4">
                              <span
                                className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center w-fit gap-1.5 ${
                                  student.status === 'Mora'
                                    ? 'bg-rose-100 text-rose-600'
                                    : student.status === 'Saldado'
                                      ? 'bg-emerald-100 text-emerald-600'
                                      : 'bg-amber-100 text-amber-600'
                                }`}
                              >
                                {student.status}
                              </span>
                            </td>
                            <td className="px-8 py-4 text-right font-black text-slate-900 text-sm">
                              RD$ {student.balance.toLocaleString()}
                            </td>
                            <td className="px-8 py-4 text-right">
                              <button
                                onClick={() => setSelectedStudentId(student.id)}
                                className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-md active:scale-95"
                              >
                                Ver Detalles
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
