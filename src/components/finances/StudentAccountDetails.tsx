import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  ArrowLeft,
  Plus,
  Receipt,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  DollarSign,
  History,
  GraduationCap,
  RefreshCw,
  Trash2,
  Printer,
  Package,
  X,
  Edit2
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useFinance } from '../../hooks/useFinance';
import { useStudents } from '../../hooks/useStudents';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { PaymentModal } from './PaymentModal';

interface Props {
  studentId: string;
  onBack: () => void;
  onTabChange?: (tab: string) => void;
}
export const normalizeInvoiceKey = (inv: any) => {
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

export const StudentAccountDetails = ({ studentId, onBack, onTabChange }: Props) => {
  const { state, profile, selectedYear } = useApp();
  const { students: allStudents } = useStudents();
  const {
    invoices,
    transactions,
    paymentPlans,
    voidPayment,
    updateTransaction,
    refresh,
    loading,
    products,
    createProductInvoice,
    scholarships
  } = useFinance({
    invoices: true,
    transactions: true,
    paymentPlans: true,
    scholarships: true,
    products: true
  });
  const [showProductInvoiceModal, setShowProductInvoiceModal] = useState(false);
  const [productInvoiceForm, setProductInvoiceForm] = useState({
    immediate_pay: true,
    payment_method: 'cash',
    reference_number: '',
    notes: ''
  });
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState({
    payment_method: 'cash',
    reference_number: '',
    created_at: ''
  });

  const [cart, setCart] = useState<
    Array<{
      product_id: string;
      name: string;
      quantity: number;
      price: number;
      total: number;
    }>
  >([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);

  const handleAddToCart = () => {
    if (!selectedProductId) return toast.error('Selecciona un producto');
    if (selectedQuantity <= 0) return toast.error('La cantidad debe ser mayor a 0');

    const product = products.find((p) => p.id === selectedProductId);
    if (!product) return toast.error('Producto no encontrado');

    const existingIdx = cart.findIndex((item) => item.product_id === selectedProductId);
    const qtyInCart = existingIdx > -1 ? cart[existingIdx].quantity : 0;
    const finalQty = qtyInCart + selectedQuantity;

    if (product.stock < finalQty) {
      toast.error(`Stock insuficiente. Solo quedan ${product.stock} unidades.`);
      return;
    }

    if (existingIdx > -1) {
      const updatedCart = [...cart];
      updatedCart[existingIdx].quantity = finalQty;
      updatedCart[existingIdx].total = finalQty * Number(product.price);
      setCart(updatedCart);
    } else {
      setCart([
        ...cart,
        {
          product_id: selectedProductId,
          name: product.name,
          quantity: selectedQuantity,
          price: Number(product.price),
          total: selectedQuantity * Number(product.price)
        }
      ]);
    }

    setSelectedProductId('');
    setSelectedQuantity(1);
    toast.success('Producto añadido al carrito');
  };

  const handleRemoveFromCart = (prodId: string) => {
    setCart(cart.filter((item) => item.product_id !== prodId));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.total, 0);
  }, [cart]);

  const handleProductInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return toast.error('La canasta está vacía. Añade al menos un producto.');

    try {
      const studentName = `${student?.names} ${student?.first_surname}`;
      const items = cart.map((item) => ({
        product_id: item.product_id,
        concept: `Venta: ${item.name}`,
        amount: item.total,
        quantity: item.quantity
      }));

      await createProductInvoice({
        student_id: studentId,
        items,
        ...(productInvoiceForm.immediate_pay
          ? {
              payment_method: productInvoiceForm.payment_method,
              reference_number: productInvoiceForm.reference_number,
              notes: productInvoiceForm.notes || `Cobro inmediato de productos a ${studentName}`
            }
          : {})
      });
      setShowProductInvoiceModal(false);
      setCart([]);
      setProductInvoiceForm({
        immediate_pay: true,
        payment_method: 'cash',
        reference_number: '',
        notes: ''
      });
      refresh();
    } catch (err) {
      // Error se maneja en el hook
    }
  };

  const handleDeleteInvoice = async (invoiceId: string) => {
    if (!window.confirm('¿Deseas eliminar esta factura pendiente? Esta acción no se puede deshacer.')) return;
    try {
      const { error } = await supabase.from('finance_invoices').delete().eq('id', invoiceId);
      if (error) throw error;
      toast.success('Factura eliminada correctamente.');
      refresh();
    } catch (e: any) {
      toast.error('Error al eliminar la factura: ' + e.message);
    }
  };

  const [isGenerating, setIsGenerating] = useState(false);
  const isGeneratingRef = useRef(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const hasAttempted = useRef(false);
  const [localStudentTransactions, setLocalStudentTransactions] = useState<any[]>([]);

  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        const { data } = await supabase
          .from('finance_transactions')
          .select('*')
          .eq('student_id', studentId)
          .order('created_at', { ascending: false });
        if (data) {
          setLocalStudentTransactions(data);
        }
      } catch (err) {
        console.error('Error fetching student transactions:', err);
      }
    };
    if (studentId) {
      fetchTransactions();
    }
  }, [studentId, transactions]); // Depend on transactions so it re-fetches when a new global transaction happens

  const currentYear = selectedYear || '2026-2027';
  const student = (allStudents || []).find((s) => s.id === studentId) || state.students?.find((s) => s.id === studentId);
  const studentInvoices = invoices
    .filter((i) => i.student_id === studentId && !i.product_id && i.period === currentYear)
    .sort((a, b) => {
      const getNum = (inv: any) => {
        const key = normalizeInvoiceKey(inv);
        if (key === 'INSCRIPCION') return -1;
        if (key.startsWith('CUOTA_')) return parseInt(key.replace('CUOTA_', ''), 10);
        return 999;
      };
      const numA = getNum(a);
      const numB = getNum(b);
      if (numA !== numB) return numA - numB;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  const studentProductInvoices = invoices.filter((i) => i.student_id === studentId && i.product_id && i.period === currentYear);
  // Use local full history instead of global limited history
  const studentTransactions = localStudentTransactions;

  const course = student ? state.courses?.find((c) => c.id === student.course_id) : null;
  const cleanLevel = course?.level?.split(' ')?.[0]?.trim();
  let plan = student ? paymentPlans.find((p) => p.course_id === student.course_id) : null;
  if (student && !plan && cleanLevel) {
    plan = paymentPlans.find((p) => {
      const c = state.courses?.find((x) => x.id === p.course_id);
      return c?.level?.trim() === cleanLevel;
    }) || null;
  }

  const getInvoiceBalance = (inv: any) => {
    const paid = studentTransactions
      .filter((t) => t.invoice_id === inv.id)
      .reduce((sum, t) => sum + Number(t.amount_paid), 0);
    return Math.max(0, Number(inv.amount_final) - paid);
  };

  const formatPaymentMethod = (method: string) => {
    if (!method) return '---';
    const methodLabels: Record<string, string> = {
      cash: 'Efectivo',
      transfer: 'Transferencia',
      card: 'Tarjeta',
      check: 'Cheque'
    };
    if (method.includes('+') || method.includes(',')) {
      const parts = method.split(/[+,]/).map((p) => p.trim().toLowerCase());
      return parts
        .map((p) => methodLabels[p] || p.charAt(0).toUpperCase() + p.slice(1))
        .join(' + ');
    }
    const lower = method.trim().toLowerCase();
    return methodLabels[lower] || method;
  };

  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: any } = {};
    const result: any[] = [];

    studentTransactions.forEach((t) => {
      if (t.receipt_number) {
        const rNum = t.receipt_number.toString();
        if (!groups[rNum]) {
          groups[rNum] = {
            ...t,
            amount_paid: 0,
            ids: [],
            invoice_ids: [],
            notes_list: [],
            methods_list: []
          };
          result.push(groups[rNum]);
        }
        groups[rNum].amount_paid += Number(t.amount_paid);
        groups[rNum].ids.push(t.id);
        if (t.invoice_id) groups[rNum].invoice_ids.push(t.invoice_id);
        if (t.notes) groups[rNum].notes_list.push(t.notes);
        if (t.payment_method) groups[rNum].methods_list.push(t.payment_method);
      } else {
        result.push({
          ...t,
          ids: [t.id],
          invoice_ids: t.invoice_id ? [t.invoice_id] : [],
          methods_list: t.payment_method ? [t.payment_method] : []
        });
      }
    });

    result.forEach((t) => {
      if (t.notes_list && t.notes_list.length > 0) {
        const uniqueNotes = Array.from(new Set(t.notes_list)) as string[];
        t.notes = uniqueNotes.join(' • ');
      }
      if (t.methods_list && t.methods_list.length > 0) {
        const uniqueMethods = Array.from(new Set(t.methods_list)) as string[];
        t.payment_method = uniqueMethods.join(' + ');
      }
    });

    return result;
  }, [studentTransactions]);

  const handleReprintReceipt = (t: any) => {
    const invoicesToPrint = studentInvoices.filter((inv) => 
      t.invoice_ids && t.invoice_ids.includes(inv.id)
    );
    if (invoicesToPrint.length > 0) {
      setSelectedInvoice(invoicesToPrint);
    } else {
      toast.error('No se encontraron las facturas asociadas a este recibo.');
    }
  };

  const handleGenerateInvoices = async () => {
    if (!student || isGenerating || isGeneratingRef.current) return;
    isGeneratingRef.current = true;
    setIsGenerating(true);

    // BUSCAR PLAN: Primero por Grado exacto, luego por Nivel como respaldo
    const courseId = student.course_id || student.courseId;
    const course = state.courses?.find((c) => c.id === courseId);
    const cleanLevel = course?.level?.split(' ')?.[0]?.trim();

    let plan = paymentPlans.find((p) => p.course_id === courseId);

    if (!plan && cleanLevel) {
      // Si no hay plan por Grado, buscar cualquier plan que pertenezca al mismo Nivel
      plan = paymentPlans.find((p) => {
        const c = state.courses?.find((x) => x.id === p.course_id);
        return c?.level?.trim() === cleanLevel;
      });
    }

    if (!plan) {
      toast.error('No hay precios configurados para este grado o nivel.');
      isGeneratingRef.current = false;
      setIsGenerating(false);
      return;
    }

    const loadingToast = toast.loading('Generando/completando facturas...');

    try {
      const currentCenterId = profile?.center_id || student.center_id;
      const currentYear = selectedYear || '2025-2026';
      
      // FETCH FRESCO PARA EVITAR DUPLICADOS POR RACE CONDITIONS
      const { data: existingInvoices } = await supabase
        .from('finance_invoices')
        .select('concept, product_id, description, month_number')
        .eq('student_id', studentId)
        .eq('period', currentYear);
      
      const freshStudentInvoices = (existingInvoices || []).filter(inv => !inv.product_id);

      const newInvoices = [];
      const periodYearMatch = currentYear.match(/^(\d{4})/);
      const baseYear = periodYearMatch ? Number(periodYearMatch[1]) : new Date().getFullYear();

      // Buscar si el alumno tiene beca
      const studentScholarship = scholarships.find((s) => s.student_id === studentId);

      // Calcular Inscripción con beca si corresponde
      let enrollmentOriginal = Number(plan.enrollment_fee);
      let enrollmentFinal = enrollmentOriginal;
      let enrollmentDiscount = 0;

      if (
        studentScholarship &&
        (studentScholarship.applies_to === 'both' || studentScholarship.applies_to === 'enrollment')
      ) {
        if (studentScholarship.type === 'percentage') {
          enrollmentDiscount = enrollmentOriginal * (Number(studentScholarship.value) / 100);
        } else {
          enrollmentDiscount = Number(studentScholarship.value);
        }
        enrollmentFinal = Math.max(0, enrollmentOriginal - enrollmentDiscount);
      }

      // Inscripción (solo si no existe)
      const hasEnrollment = freshStudentInvoices.some(
        (inv) => normalizeInvoiceKey(inv) === 'INSCRIPCION'
      );
      if (!hasEnrollment) {
        newInvoices.push({
          center_id: currentCenterId,
          student_id: studentId,
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

      const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
      ];
      const startMonthIdx = (plan.start_month || 9) - 1; // 1-12 a 0-11
      const paymentEndDay = plan.payment_end_day || 10;
      
      const monthsCount = Number(plan.months_count) || 10;

      for (let i = 0; i < monthsCount; i++) {
        const conceptName = `Cuota ${(i + 1).toString().padStart(2, '0')}`;
        const targetCuotaKey = `CUOTA_${(i + 1).toString().padStart(2, '0')}`;
        const cuotaNum = i + 1;
        const exists = freshStudentInvoices.some((inv) => inv.month_number === cuotaNum || normalizeInvoiceKey(inv) === targetCuotaKey);
        if (exists) continue; // Saltar si ya existe esta mensualidad

        const currentMonthIdx = (startMonthIdx + i) % 12;
        const currentYearNum = baseYear + (startMonthIdx + i >= 12 ? 1 : 0);
        const dueDate = new Date(currentYearNum, currentMonthIdx, paymentEndDay);

        // Calcular Mensualidad con beca si corresponde
        let monthlyOriginal = Number(plan.monthly_fee);
        let monthlyFinal = monthlyOriginal;
        let monthlyDiscount = 0;

        if (
          studentScholarship &&
          (studentScholarship.applies_to === 'both' || studentScholarship.applies_to === 'monthly')
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
          student_id: studentId,
          course_id: student.course_id,
          period: currentYear,
          concept: conceptName,
          month_number: i + 1,
          description: monthNames[currentMonthIdx],
          amount_original: monthlyOriginal,
          amount_final: monthlyFinal,
          discount_applied: monthlyDiscount,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'pending'
        });
      }

      if (newInvoices.length > 0) {
        // Insert en batch atómico
        const { error } = await supabase.from('finance_invoices').insert(newInvoices);
        if (error) throw error;
        toast.success(`¡Generadas ${newInvoices.length} facturas con éxito!`, { id: loadingToast });
        refresh();
      } else {
        toast.success('Todas las cuotas de este periodo ya estaban generadas.', { id: loadingToast });
      }

    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Error al generar cuotas: ' + error.message, { id: loadingToast });
    } finally {
      isGeneratingRef.current = false;
      setIsGenerating(false);
    }
  };

  const handleCleanupDuplicates = async () => {
    setIsGenerating(true);
    const loadingToast = toast.loading('Eliminando facturas duplicadas...');

    try {
      // 1. Agrupar facturas por concepto unificado
      const conceptGroups: { [key: string]: any[] } = {};
      studentInvoices.forEach((inv) => {
        if (inv.product_id) return;
        const normKey = normalizeInvoiceKey(inv);
        if (normKey === 'UNKNOWN' || (!normKey.startsWith('CUOTA_') && normKey !== 'INSCRIPCION')) return;
        if (!conceptGroups[normKey]) {
          conceptGroups[normKey] = [];
        }
        conceptGroups[normKey].push(inv);
      });

      const idsToDelete: string[] = [];
      
      Object.keys(conceptGroups).forEach((concept) => {
        const group = conceptGroups[concept];
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
        toast.success('No se encontraron facturas duplicadas.', { id: loadingToast });
        setIsGenerating(false);
        return;
      }

      // Borrar de Supabase
      const { error } = await supabase
        .from('finance_invoices')
        .delete()
        .in('id', idsToDelete);

      if (error) throw error;

      toast.success(`Se eliminaron ${idsToDelete.length} facturas duplicadas con éxito.`, { id: loadingToast });
      
      // Corregir también las entradas contables mal categorizadas de Tela retroactivamente
      try {
        const studentName = `${student?.names} ${student?.first_surname || ''}`.trim();
        await supabase
          .from('finance_ledger_entries')
          .update({ account: 'INGRESOS: UNIFORMES' })
          .eq('account', 'INGRESOS: INVENTARIO (OTROS)')
          .eq('item', studentName)
          .ilike('description', '%Tela%');
      } catch (e) {
        console.error('Error correcting ledger entries:', e);
      }

      refresh();
    } catch (err: any) {
      console.error('Error cleaning duplicates:', err);
      toast.error('Error al limpiar duplicados: ' + err.message, { id: loadingToast });
    } finally {
      setIsGenerating(false);
    }
  };

  // 1. GENERADOR AUTOMÁTICO ELIMINADO PARA EVITAR BUCLES
  // Ahora el usuario debe dar al botón "Generar Facturas Ahora"

  const stats = useMemo(() => {
    const total = studentInvoices.reduce((acc, i) => acc + Number(i.amount_final), 0);
    const paid = studentInvoices
      .filter((i) => i.status === 'paid')
      .reduce((acc, i) => acc + Number(i.amount_final), 0);
    const balance = total - paid;
    return { total, paid, balance };
  }, [studentInvoices]);

  if (!student) return null;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={16} /> Volver al listado
        </button>
        <div className="flex gap-2">
          <button
            onClick={refresh}
            className="bg-white text-slate-600 px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-colors flex items-center gap-2"
          >
            <RefreshCw size={14} /> Actualizar
          </button>
          <button
            onClick={handleCleanupDuplicates}
            className="bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-xs font-bold border border-rose-200 hover:bg-rose-100 transition-colors flex items-center gap-2"
          >
            <Trash2 size={14} /> Limpiar Duplicados
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 shadow-sm">
            <FileText size={16} /> Estado de Cuenta PDF
          </button>
          <button
            onClick={() => setShowProductInvoiceModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-100"
          >
            <Package size={16} /> Facturar Producto
          </button>
          <button
            onClick={() => {
              if (student) {
                localStorage.setItem(
                  'edugens_assign_scholarship_student',
                  JSON.stringify({
                    id: student.id,
                    names: student.names,
                    first_surname: student.first_surname,
                    second_surname: student.second_surname
                  })
                );
                if (onTabChange) {
                  onTabChange('scholarships');
                } else {
                  toast.error('No se pudo redirigir. Ve al módulo de Becas directamente.');
                }
              }
            }}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100"
          >
            <GraduationCap size={16} /> Asignar Beca
          </button>
        </div>
      </div>

      {/* PERFIL RESUMEN */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col md:flex-row items-center gap-8">
        <div className="w-24 h-24 bg-indigo-600 text-white rounded-[2rem] flex items-center justify-center text-3xl font-black shadow-xl shadow-indigo-100">
          {student.names?.[0] || '?'}
          {student.first_surname?.[0] || ''}
        </div>
        <div className="text-center md:text-left flex-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tighter">
            {student.names} {student.first_surname} {student.second_surname}
          </h2>
          <div className="flex flex-wrap justify-center md:justify-start gap-4 mt-2">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Calendar size={12} /> Inscrito en:{' '}
              <span className="text-indigo-600">{student.courses?.name || 'S/N'}</span>
            </span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Receipt size={12} /> ID:{' '}
              <span className="text-indigo-600">{student.id_number || 'S/N'}</span>
            </span>
          </div>
        </div>
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Pagado</p>
            <p className="text-2xl font-black text-emerald-600">
              RD$ {stats.paid.toLocaleString()}
            </p>
          </div>
          <div className="w-px h-12 bg-slate-100 self-center"></div>
          <div className="text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Balance Pendiente</p>
            <p className="text-2xl font-black text-rose-600">
              RD$ {stats.balance.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* COLUMNA IZQUIERDA: PLAN DE PAGOS Y FACTURAS DE INVENTARIO */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-900 text-white rounded-2xl">
                <DollarSign size={18} />
              </div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                  Plan de Pagos y Cuotas
                </h3>
                {plan && (
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Plan activo: {plan.months_count} mensualidades de RD$ {Number(plan.monthly_fee).toLocaleString()} + Inscripción de RD$ {Number(plan.enrollment_fee).toLocaleString()}
                    </p>
                    {studentInvoices.length > 0 && studentInvoices.every((inv) => inv.status === 'paid') && (
                      <span className="bg-emerald-100 text-emerald-800 text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest animate-pulse">
                        ✓ AÑO ESCOLAR PAGADO POR COMPLETO
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-4">
              {selectedInvoices.length > 0 && (
                <button
                  onClick={() => {
                    const selected = studentInvoices.filter((i) => selectedInvoices.includes(i.id));
                    setSelectedInvoice(selected);
                  }}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl flex items-center gap-2"
                >
                  <CheckCircle2 size={14} /> Pagar {selectedInvoices.length} Seleccionadas
                </button>
              )}
              {studentInvoices.length === 0 && (
                <button
                  onClick={handleGenerateInvoices}
                  disabled={isGenerating}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg"
                >
                  {isGenerating ? 'Generando...' : 'Generar Facturas Ahora'}
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {studentInvoices.map((inv) => {
              const isSelected = selectedInvoices.includes(inv.id);
              return (
                <div
                  key={inv.id}
                  className={`p-5 rounded-3xl border transition-all flex items-center justify-between group ${
                    inv.status === 'paid'
                      ? 'bg-emerald-50/30 border-emerald-100'
                      : isSelected
                        ? 'bg-indigo-50 border-indigo-600 shadow-lg'
                        : inv.status === 'partial'
                          ? 'bg-amber-50/20 border-amber-200 hover:border-amber-300'
                          : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {inv.status !== 'paid' && (
                      <div
                        onClick={() => {
                          setSelectedInvoices((prev) =>
                            prev.includes(inv.id)
                              ? prev.filter((id) => id !== inv.id)
                              : [...prev, inv.id]
                          );
                        }}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-600 border-indigo-600'
                            : 'border-slate-200 hover:border-indigo-400'
                        }`}
                      >
                        {isSelected && <CheckCircle2 size={12} className="text-white" />}
                      </div>
                    )}
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${
                        inv.status === 'paid'
                          ? 'bg-emerald-500 text-white'
                          : inv.status === 'partial'
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {inv.status === 'paid' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase">{inv.concept}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1.5 mt-1">
                        {inv.description
                          ? `Correspondiente a ${inv.description}`
                          : `Vence: ${new Date(inv.due_date).toLocaleDateString()}`}
                        {inv.status === 'pending' &&
                          !String(inv.concept).toLowerCase().includes('inscrib') &&
                          !String(inv.concept).toLowerCase().includes('inscrip') &&
                          new Date(inv.due_date) < new Date() && (
                          <span className="text-rose-500 flex items-center gap-1">
                            <AlertCircle size={10} /> MORA
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">
                        RD$ {getInvoiceBalance(inv).toLocaleString()}
                      </p>
                      {inv.status === 'partial' && (
                        <p className="text-[9px] text-slate-400 font-bold uppercase">
                          de RD$ {Number(inv.amount_final).toLocaleString()}
                        </p>
                      )}
                      <p
                        className={`text-[8px] font-black uppercase tracking-widest ${
                          inv.status === 'paid'
                            ? 'text-emerald-600'
                            : inv.status === 'partial'
                              ? 'text-amber-500'
                              : 'text-amber-600'
                        }`}
                      >
                        {inv.status === 'paid' ? 'Pagado' : inv.status === 'partial' ? 'Parcial' : 'Pendiente'}
                      </p>
                    </div>
                    {inv.status !== 'paid' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedInvoice([inv])}
                          className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
                        >
                          Cobrar
                        </button>
                        <button
                          onClick={() => handleDeleteInvoice(inv.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                          title="Eliminar Factura"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* LISTADO DE FACTURAS DE INVENTARIO */}
        {studentProductInvoices.length > 0 && (
          <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-900 text-white rounded-2xl">
                  <Package size={18} />
                </div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                  Ventas de Inventario (Productos)
                </h3>
              </div>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {studentProductInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className={`p-5 rounded-3xl border transition-all flex items-center justify-between group ${
                    inv.status === 'paid'
                      ? 'bg-emerald-50/30 border-emerald-100'
                      : inv.status === 'partial'
                        ? 'bg-amber-50/20 border-amber-200 hover:border-amber-300'
                        : 'bg-white border-slate-100 hover:border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${
                        inv.status === 'paid'
                          ? 'bg-emerald-500 text-white'
                          : inv.status === 'partial'
                            ? 'bg-amber-500 text-white'
                            : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {inv.status === 'paid' ? <CheckCircle2 size={24} /> : <Clock size={24} />}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase">{inv.concept}</h4>
                      <p className="text-[9px] font-black text-slate-400 uppercase flex items-center gap-1.5 mt-1">
                        {inv.description || `Registrado el: ${new Date(inv.created_at).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-black text-slate-900">
                        RD$ {getInvoiceBalance(inv).toLocaleString()}
                      </p>
                      {inv.status === 'partial' && (
                        <p className="text-[9px] text-slate-400 font-bold uppercase">
                          de RD$ {Number(inv.amount_final).toLocaleString()}
                        </p>
                      )}
                      <p
                        className={`text-[8px] font-black uppercase tracking-widest ${
                          inv.status === 'paid'
                            ? 'text-emerald-600'
                            : inv.status === 'partial'
                              ? 'text-amber-500'
                              : 'text-amber-600'
                        }`}
                      >
                        {inv.status === 'paid' ? 'Pagado' : inv.status === 'partial' ? 'Parcial' : 'Pendiente'}
                      </p>
                    </div>
                    {inv.status !== 'paid' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedInvoice([inv])}
                          className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
                        >
                          Cobrar
                        </button>
                        <button
                          onClick={() => handleDeleteInvoice(inv.id)}
                          className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                          title="Eliminar Factura"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

        {/* HISTORIAL DE TRANSACCIONES */}
        <div className="lg:col-span-1 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2.5 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-100">
              <History size={18} />
            </div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
              Historial de Pagos
            </h3>
          </div>

          <div className="space-y-6 relative">
            <div className="absolute left-6 top-8 bottom-8 w-px bg-slate-100"></div>
            {groupedTransactions.length === 0 ? (
              <p className="text-[10px] font-bold text-slate-400 uppercase italic text-center py-10">
                No hay pagos registrados
              </p>
            ) : (
              groupedTransactions.map((t) => (
                <div key={t.id} className="relative pl-12">
                  <div className="absolute left-4 top-1 w-4 h-4 bg-white border-4 border-emerald-500 rounded-full z-10"></div>
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-[10px] font-black text-slate-900 uppercase">
                      Recibo #{t.receipt_number || 'S/N'}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-emerald-600 mr-1">
                        RD$ {Number(t.amount_paid).toLocaleString()}
                      </span>
                      <button
                        onClick={() => handleReprintReceipt(t)}
                        className="p-1.5 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        title="Reimprimir Recibo"
                      >
                        <Printer size={14} />
                      </button>
                      <button
                        onClick={() => {
                          setEditingTransaction(t);
                          setEditFormData({
                            payment_method: t.payment_method || 'cash',
                            reference_number: t.reference_number || '',
                            created_at: new Date(t.created_at).toISOString().split('T')[0]
                          });
                        }}
                        className="p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                        title="Editar Transacción"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => voidPayment(t.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                        title="Anular Pago"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase">
                    {new Date(t.created_at).toLocaleDateString()} • {formatPaymentMethod(t.payment_method)}
                  </p>
                  <p className="text-[9px] font-bold text-indigo-400 mt-1">
                    {t.notes || 'Pago de cuota'}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* MODAL DE EDITAR TRANSACCIÓN */}
      {editingTransaction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[3rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">
                Editar Transacción
              </h3>
              <button
                onClick={() => setEditingTransaction(null)}
                className="p-2 hover:bg-slate-50 rounded-full text-slate-400 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const loadingToast = toast.loading('Guardando cambios...');
                try {
                  await updateTransaction(editingTransaction.id, {
                    payment_method: editFormData.payment_method,
                    reference_number: editFormData.reference_number,
                    created_at: `${editFormData.created_at}T12:00:00Z`
                  });
                  toast.success('Transacción actualizada con éxito', { id: loadingToast });
                  setEditingTransaction(null);
                  refresh();
                } catch (err: any) {
                  console.error('Error updating transaction:', err);
                  toast.error('Error al actualizar: ' + err.message, { id: loadingToast });
                }
              }}
              className="space-y-4 text-left"
            >
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 block px-1">
                  Método de Pago
                </label>
                <select
                  value={editFormData.payment_method}
                  onChange={(e) => setEditFormData({ ...editFormData, payment_method: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-600 outline-none uppercase tracking-widest"
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                  <option value="check">Cheque</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 block px-1">
                  Referencia / Nº de Transacción (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: # Transacción"
                  value={editFormData.reference_number}
                  onChange={(e) => setEditFormData({ ...editFormData, reference_number: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-600 outline-none text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 block px-1">
                  Fecha del Pago
                </label>
                <input
                  type="date"
                  required
                  value={editFormData.created_at}
                  onChange={(e) => setEditFormData({ ...editFormData, created_at: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-600 outline-none text-slate-800"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingTransaction(null)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer shadow-md"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE COBRO */}
      {selectedInvoice && (
        <PaymentModal
          student={student}
          courseName={
            student.courses?.name ||
            student.course_name ||
            state.courses?.find((c) => c.id === student.course_id)?.name ||
            'Grado'
          }
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onSuccess={() => {
            setSelectedInvoice(null);
            refresh();
          }}
        />
      )}

      {/* MODAL DE FACTURAR PRODUCTO */}
      {showProductInvoiceModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-xl font-black uppercase tracking-tighter">
                Facturar Producto a Alumno
              </h3>
              <button
                onClick={() => setShowProductInvoiceModal(false)}
                className="p-2 hover:bg-slate-50 rounded-full text-slate-400"
              >
                <X size={24} />
              </button>
            </div>

            <form
              onSubmit={handleProductInvoiceSubmit}
              className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1 text-left"
            >
              {/* Info Estudiante (Solo Lectura) */}
              <div className="bg-indigo-50 p-4 border border-indigo-100 rounded-2xl">
                <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">Estudiante</p>
                <p className="text-sm font-black text-slate-900">
                  {student.names} {student.first_surname}
                </p>
                <p className="text-[9px] font-bold text-slate-500 uppercase">
                  {student.courses?.name || 'Grado'}
                </p>
              </div>

              {/* Sección Agregar Producto al Carrito */}
              <div className="border border-slate-100 rounded-3xl p-5 bg-slate-50/50 space-y-4">
                <p className="text-[10px] font-black uppercase text-slate-400">Añadir Productos</p>
                <div className="space-y-3">
                  <select
                    value={selectedProductId}
                    onChange={(e) => setSelectedProductId(e.target.value)}
                    className="w-full px-6 py-3 bg-white border border-slate-100 rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                  >
                    <option value="">-- Seleccionar Producto --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (RD$ {Number(p.price).toLocaleString()} • Stock: {p.stock})
                      </option>
                    ))}
                  </select>

                  {products.find((p) => p.id === selectedProductId) && (
                    <div className="flex gap-4 items-center">
                      <div className="w-1/3">
                        <label className="text-[8px] font-black text-slate-400 uppercase">
                          Cantidad
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={selectedQuantity}
                          onChange={(e) => setSelectedQuantity(Math.max(1, Number(e.target.value)))}
                          className="w-full px-4 py-2 bg-white border border-slate-100 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                        />
                      </div>
                      <div className="flex-1 text-right pr-2">
                        <p className="text-[8px] font-black text-slate-400 uppercase">Subtotal</p>
                        <p className="text-sm font-black text-slate-700">
                          RD${' '}
                          {(
                            Number(products.find((p) => p.id === selectedProductId)?.price || 0) *
                            selectedQuantity
                          ).toLocaleString()}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddToCart}
                        className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all self-end"
                      >
                        Añadir
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* LISTADO DE LA CANASTA (CARRITO) */}
              <div className="space-y-2.5">
                <p className="text-[10px] font-black uppercase text-slate-400">Canasta de Compra</p>
                {cart.length === 0 ? (
                  <p className="text-center text-[10px] text-slate-300 py-6 uppercase font-bold italic border border-dashed border-slate-200 rounded-2xl">
                    La canasta está vacía
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {cart.map((item) => (
                      <div
                        key={item.product_id}
                        className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm"
                      >
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase">
                            {item.quantity}x {item.name}
                          </p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">
                            Unit: RD$ {item.price.toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <p className="text-xs font-black text-slate-900">
                            RD$ {item.total.toLocaleString()}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(item.product_id)}
                            className="text-rose-500 p-2 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Total General */}
              {cart.length > 0 && (
                <div className="bg-slate-900 p-6 rounded-[2rem] flex justify-between items-center text-white shadow-xl shrink-0">
                  <div>
                    <p className="text-[10px] font-bold uppercase opacity-50">Total Venta</p>
                    <p className="text-xl font-black">RD$ {cartTotal.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase opacity-50">
                      {cart.length} Productos
                    </p>
                  </div>
                </div>
              )}

              {/* Checkbox Pago Inmediato */}
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                <input
                  type="checkbox"
                  id="immediate_pay_details"
                  checked={productInvoiceForm.immediate_pay}
                  onChange={(e) =>
                    setProductInvoiceForm({
                      ...productInvoiceForm,
                      immediate_pay: e.target.checked
                    })
                  }
                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="immediate_pay_details"
                  className="text-xs font-black text-slate-700 cursor-pointer select-none uppercase tracking-wide"
                >
                  ¿Registrar Cobro de Inmediato?
                </label>
              </div>

              {/* Desglose de Pago Inmediato */}
              {productInvoiceForm.immediate_pay && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">
                        Método de Pago
                      </label>
                      <select
                        value={productInvoiceForm.payment_method}
                        onChange={(e) =>
                          setProductInvoiceForm({
                            ...productInvoiceForm,
                            payment_method: e.target.value
                          })
                        }
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600 uppercase tracking-widest"
                      >
                        <option value="cash">Efectivo</option>
                        <option value="transfer">Transferencia</option>
                        <option value="card">Tarjeta</option>
                        <option value="check">Cheque</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">
                        Referencia (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: # Transacción"
                        value={productInvoiceForm.reference_number}
                        onChange={(e) =>
                          setProductInvoiceForm({
                            ...productInvoiceForm,
                            reference_number: e.target.value
                          })
                        }
                        className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400">
                      Notas / Comentarios
                    </label>
                    <textarea
                      placeholder="Comentarios sobre la transacción..."
                      value={productInvoiceForm.notes}
                      onChange={(e) =>
                        setProductInvoiceForm({ ...productInvoiceForm, notes: e.target.value })
                      }
                      rows={2}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* Botones de Envío */}
              <div className="flex gap-4 pt-6 border-t border-slate-50 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowProductInvoiceModal(false)}
                  className="flex-1 py-4 bg-slate-100 rounded-2xl text-xs font-black uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || cart.length === 0}
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50"
                >
                  {loading
                    ? 'Procesando...'
                    : productInvoiceForm.immediate_pay
                      ? 'Facturar y Cobrar'
                      : 'Facturar Pendiente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
