import React, { useMemo, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Activity,
  X,
  ShoppingCart,
  Users,
  Trash2,
  Banknote,
  GraduationCap
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { useFinance } from '../../hooks/useFinance';
import { useApp } from '../../context/AppContext';
import { PaymentModal } from './PaymentModal';
import { toast } from 'react-hot-toast';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#6366f1'];

export const FinanceDashboard = () => {
  const { state } = useApp();
  const { invoices, transactions, expenses, ledgerEntries, products, scholarships, loading } = useFinance({
    invoices: true,
    transactions: true,
    expenses: true,
    ledger: true,
    products: true,
    scholarships: true
  });

  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: any } = {};
    const result: any[] = [];

    transactions.forEach((t) => {
      if (t.receipt_number) {
        const rNum = t.receipt_number.toString();
        if (!groups[rNum]) {
          groups[rNum] = {
            ...t,
            amount_paid: 0,
            ids: [],
            notes_list: []
          };
          result.push(groups[rNum]);
        }
        groups[rNum].amount_paid += Number(t.amount_paid);
        groups[rNum].ids.push(t.id);
        if (t.notes) groups[rNum].notes_list.push(t.notes);
      } else {
        result.push({
          ...t,
          ids: [t.id]
        });
      }
    });

    result.forEach((t) => {
      if (t.notes_list && t.notes_list.length > 0) {
        const uniqueNotes = Array.from(new Set(t.notes_list)) as string[];
        t.notes = uniqueNotes.join(' • ');
      }
    });

    return result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [transactions]);

  // Estados para Modal de Venta y Carrito
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleForm, setSaleForm] = useState({
    student_id: '',
    immediate_pay: true,
    payment_method: 'cash',
    reference_number: '',
    notes: ''
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
  const [studentSearchTerm, setStudentSearchTerm] = useState('');

  // Estados para el Modal de Recibo (Impresión)
  const [receiptStudent, setReceiptStudent] = useState<any>(null);
  const [receiptInvoices, setReceiptInvoices] = useState<any[] | null>(null);

  // Filtrado de Alumnos para la Venta
  const filteredStudents = useMemo(() => {
    if (studentSearchTerm.length < 2) return [];
    return (state.students || [])
      .filter((s) => {
        const fullName = `${s.names} ${s.first_surname} ${s.second_surname || ''}`.toLowerCase();
        return fullName.includes(studentSearchTerm.toLowerCase());
      })
      .slice(0, 10);
  }, [state.students, studentSearchTerm]);

  const handleOpenSale = () => {
    setSaleForm({
      student_id: '',
      immediate_pay: true,
      payment_method: 'cash',
      reference_number: '',
      notes: ''
    });
    setCart([]);
    setSelectedProductId('');
    setSelectedQuantity(1);
    setStudentSearchTerm('');
    setShowSaleModal(true);
  };

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
    toast.success('Añadido a la canasta');
  };

  const handleRemoveFromCart = (prodId: string) => {
    setCart(cart.filter((item) => item.product_id !== prodId));
  };

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.total, 0);
  }, [cart]);

  const handleSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleForm.student_id) return toast.error('Selecciona un estudiante');
    if (cart.length === 0) return toast.error('La canasta está vacía. Añade al menos un producto.');

    try {
      const items = cart.map((item) => ({
        product_id: item.product_id,
        concept: `Venta: ${item.name}`,
        amount: item.total,
        quantity: item.quantity
      }));

      const invs = await createProductInvoice({
        student_id: saleForm.student_id,
        items,
        ...(saleForm.immediate_pay
          ? {
              payment_method: saleForm.payment_method,
              reference_number: saleForm.reference_number,
              notes: saleForm.notes || 'Cobro de venta de inventario desde dashboard'
            }
          : {})
      });
      setShowSaleModal(false);
      setCart([]);

      if (saleForm.immediate_pay && invs && invs.length > 0) {
        const studentObj = state.students.find((s) => s.id === saleForm.student_id);
        if (studentObj) {
          setReceiptStudent(studentObj);
          setReceiptInvoices(invs);
        }
      }
    } catch (err) {
      // Error se maneja en el hook
    }
  };

  const selectedProductForAdding = useMemo(() => {
    return products.find((p) => p.id === selectedProductId);
  }, [products, selectedProductId]);

  const selectedStudentForSaleObj = useMemo(() => {
    return state.students.find((s) => s.id === saleForm.student_id);
  }, [state.students, saleForm.student_id]);

  const [dashboardDate, setDashboardDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const stats = useMemo(() => {
    // === 1. CAJA CHICA Y BANCO (Día seleccionado) ===
    // Ingresos del día (Pagos de estudiantes)
    const dailyTransactions = transactions.filter(t => (t.created_at || '').startsWith(dashboardDate));
    
    // Gastos e ingresos extras del sistema viejo (finance_expenses) para ese día
    const dailyOldExpenses = expenses.filter(e => (e.created_at?.startsWith(dashboardDate) || e.date === dashboardDate));
    
    // Gastos e ingresos extras del sistema nuevo (finance_ledger_entries) para ese día
    const dailyLedger = ledgerEntries.filter(e => e.date === dashboardDate || e.created_at?.startsWith(dashboardDate));

    // Sumar ingresos
    const txIncomeCajaChica = dailyTransactions.filter(t => (t.payment_method !== 'transfer' && t.payment_method !== 'bank_transfer')).reduce((acc, t) => acc + Number(t.amount_paid), 0);
    const txIncomeBanco = dailyTransactions.filter(t => (t.payment_method === 'transfer' || t.payment_method === 'bank_transfer')).reduce((acc, t) => acc + Number(t.amount_paid), 0);

    const oldExtraIncomeCC = dailyOldExpenses.filter(e => e.type === 'income' && (e.cash_account || 'caja_chica') === 'caja_chica').reduce((acc, e) => acc + Number(e.amount), 0);
    const oldExtraIncomeBanco = dailyOldExpenses.filter(e => e.type === 'income' && (e.cash_account || 'caja_chica') === 'banco').reduce((acc, e) => acc + Number(e.amount), 0);
    
    const newExtraIncomeCC = dailyLedger.filter(e => e.type === 'income' && (e.cash_account || 'caja_chica') === 'caja_chica' && e.account !== 'INGRESOS: COLEGIATURAS' && e.account !== 'INGRESOS: INSCRIPCIONES' && !e.description?.includes('Cobro de:')).reduce((acc, e) => acc + Number(e.amount), 0);
    const newExtraIncomeBanco = dailyLedger.filter(e => e.type === 'income' && (e.cash_account || 'caja_chica') === 'banco' && e.account !== 'INGRESOS: COLEGIATURAS' && e.account !== 'INGRESOS: INSCRIPCIONES' && !e.description?.includes('Cobro de:')).reduce((acc, e) => acc + Number(e.amount), 0);

    // Sumar Egresos
    const oldOutCC = dailyOldExpenses.filter(e => e.type === 'expense' && (e.cash_account || 'caja_chica') === 'caja_chica').reduce((acc, e) => acc + Number(e.amount), 0);
    const oldOutBanco = dailyOldExpenses.filter(e => e.type === 'expense' && (e.cash_account || 'caja_chica') === 'banco').reduce((acc, e) => acc + Number(e.amount), 0);
    
    const newOutCC = dailyLedger.filter(e => e.type === 'expense' && (e.cash_account || 'caja_chica') === 'caja_chica').reduce((acc, e) => acc + Number(e.amount), 0);
    const newOutBanco = dailyLedger.filter(e => e.type === 'expense' && (e.cash_account || 'caja_chica') === 'banco').reduce((acc, e) => acc + Number(e.amount), 0);

    const inCajaChica = txIncomeCajaChica + oldExtraIncomeCC + newExtraIncomeCC;
    const inBanco = txIncomeBanco + oldExtraIncomeBanco + newExtraIncomeBanco;
    const outCajaChica = oldOutCC + newOutCC;
    const outBanco = oldOutBanco + newOutBanco;

    const cajaChica = { in: inCajaChica, out: outCajaChica, net: inCajaChica - outCajaChica };
    const banco = { in: inBanco, out: outBanco, net: inBanco - outBanco };

    // === FILTROS DE AÑO ACADÉMICO ===
    const currentYear = state.selectedYear || '2025-2026';
    const yearStart = parseInt(currentYear.split('-')[0], 10);
    const startDate = new Date(yearStart, 7, 1); // Aug 1
    const endDate = new Date(yearStart + 1, 6, 31); // Jul 31

    // Transacciones del año (por fecha)
    const yearTransactions = transactions.filter(t => {
      const d = new Date(t.created_at);
      return d >= startDate && d <= endDate;
    });
    const totalIncome = yearTransactions.reduce((acc, t) => acc + Number(t.amount_paid), 0);

    // Unificamos TODOS los gastos (históricos + nuevos) para gráficas
    const allExpenses = [
      ...expenses.filter(e => e.type === 'expense'),
      ...ledgerEntries.filter(e => e.type === 'expense')
    ].filter(e => {
      const d = new Date(e.created_at || e.date);
      return d >= startDate && d <= endDate;
    });

    // === 2. GRÁFICO FLUJO DE CAJA (Línea de Tiempo Dinámica) ===
    const chartData = [];
    
    // Encontrar la fecha mínima y máxima real en los datos del año
    let minDate = new Date();
    let maxDate = new Date();
    let hasData = false;

    const updateMinMax = (dateStr: string) => {
      if (!dateStr) return;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return;
      if (!hasData) {
        minDate = d;
        maxDate = d;
        hasData = true;
      } else {
        if (d < minDate) minDate = d;
        if (d > maxDate) maxDate = d;
      }
    };

    yearTransactions.forEach(t => updateMinMax(t.created_at));
    allExpenses.forEach(e => updateMinMax(e.created_at || e.date));

    // Si no hay datos, mostrar últimos 30 días por defecto
    if (!hasData) {
      minDate = new Date();
      minDate.setDate(minDate.getDate() - 30);
      maxDate = new Date();
    } else {
      // Asegurar que el gráfico cubra hasta la fecha actual si maxDate es anterior
      const now = new Date();
      if (maxDate < now) maxDate = now;
    }

    const diffDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 60) {
      // AGRUPAR POR DÍA
      minDate.setHours(0,0,0,0);
      
      const current = new Date(minDate);
      while (current <= maxDate) {
        const y = current.getFullYear();
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const d = String(current.getDate()).padStart(2, '0');
        const dayPrefix = `${y}-${m}-${d}`;

        const tInc = transactions.filter((t) => (t.created_at || '').startsWith(dayPrefix)).reduce((acc, t) => acc + Number(t.amount_paid), 0);
        const mOutOld = expenses.filter(e => e.type === 'expense' && e.category !== 'TRANSFERENCIA ENTRE CAJAS' && (e.created_at || e.date || '').startsWith(dayPrefix)).reduce((acc, e) => acc + Number(e.amount), 0);
        const mOutNew = ledgerEntries.filter(e => e.type === 'expense' && e.account !== 'TRANSFERENCIA ENTRE CAJAS' && (e.created_at || e.date || '').startsWith(dayPrefix)).reduce((acc, e) => acc + Number(e.amount), 0);

        chartData.push({
          name: `${d} ${new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(current).toUpperCase()}`,
          ingresos: tInc,
          gastos: mOutOld + mOutNew
        });
        
        current.setDate(current.getDate() + 1);
      }
    } else {
      // AGRUPAR POR MES
      minDate = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
      maxDate = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);

      const current = new Date(minDate);
      while (current <= maxDate) {
        const m = String(current.getMonth() + 1).padStart(2, '0');
        const y = current.getFullYear();
        const monthPrefix = `${y}-${m}`;

        const tInc = transactions.filter((t) => (t.created_at || '').startsWith(monthPrefix)).reduce((acc, t) => acc + Number(t.amount_paid), 0);
        const mOutOld = expenses.filter(e => e.type === 'expense' && e.category !== 'TRANSFERENCIA ENTRE CAJAS' && (e.created_at || e.date || '').startsWith(monthPrefix)).reduce((acc, e) => acc + Number(e.amount), 0);
        const mOutNew = ledgerEntries.filter(e => e.type === 'expense' && e.account !== 'TRANSFERENCIA ENTRE CAJAS' && (e.created_at || e.date || '').startsWith(monthPrefix)).reduce((acc, e) => acc + Number(e.amount), 0);

        chartData.push({
          name: new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(current).toUpperCase(),
          ingresos: tInc,
          gastos: mOutOld + mOutNew
        });
        
        current.setMonth(current.getMonth() + 1);
      }
    }

    // === 3. INGRESOS POR CONCEPTO ===
    const incomeByConceptMap: Record<string, number> = {};
    yearTransactions.forEach(t => {
      const inv = invoices.find(i => i.id === t.invoice_id);
      let concept = 'Otros';
      if (inv) {
        const invConcept = String(inv.concept).toUpperCase();
        if (inv.product_id || invConcept.includes('VENTA') || invConcept.includes('INVENTARIO') || invConcept.includes('TELA') || invConcept.includes('LIBRO')) concept = 'Ventas Inventario';
        else if (invConcept.includes('INSCRIPCI')) concept = 'Inscripción';
        else if (invConcept.includes('CUOTA') || invConcept.includes('COLEGIATURA') || invConcept.includes('MENSUALIDAD')) concept = 'Cuotas';
        else concept = 'Otros';
      } else {
        const tNotes = String(t.notes).toUpperCase();
        if (tNotes.includes('VENTA') || tNotes.includes('TELA') || tNotes.includes('INVENTARIO')) concept = 'Ventas Inventario';
        else if (tNotes.includes('INSCRIP')) concept = 'Inscripción';
        else concept = 'Otros';
      }
      incomeByConceptMap[concept] = (incomeByConceptMap[concept] || 0) + Number(t.amount_paid);
    });
    // Remove "Otros" if 0
    if (incomeByConceptMap['Otros'] === 0) delete incomeByConceptMap['Otros'];
    const incomeByConcept = Object.entries(incomeByConceptMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

    // === 4. EGRESOS POR CATEGORÍA ===
    const expensesByCategoryMap: Record<string, number> = {};
    allExpenses.forEach(e => {
      let cat = (e.category || e.account || 'Gastos Generales').toUpperCase();
      if (cat.includes('TRANSFERENCIA')) return; // Ignore transfers
      if (cat === 'OTROS' || cat === '') cat = 'Gastos Generales';
      expensesByCategoryMap[cat] = (expensesByCategoryMap[cat] || 0) + Number(e.amount);
    });
    const expensesByCategory = Object.entries(expensesByCategoryMap).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);

    // === 5. MOROSIDAD ===
    const overdueInvoices = invoices.filter(
      (i) =>
        !String(i.concept).toLowerCase().includes('inscrib') &&
        !String(i.concept).toLowerCase().includes('inscrip') &&
        (i.status === 'overdue' || (i.status === 'pending' && new Date(i.due_date) < new Date()))
    );
    const totalOverdue = overdueInvoices.reduce((acc, i) => acc + Number(i.amount_final), 0);
    
    // === 6. BECAS APLICADAS ===
    // We sum discount_applied from ALL invoices that fall within this academic year (by due_date)
    const yearInvoicesByDate = invoices.filter(i => {
      const d = new Date(i.due_date || i.created_at);
      return d >= startDate && d <= endDate;
    });
    const scholarshipsApplied = yearInvoicesByDate.reduce((acc, inv) => acc + Number(inv.discount_applied || 0), 0);

    return { cajaChica, banco, totalIncome, totalOverdue, chartData, incomeByConcept, expensesByCategory, scholarshipsApplied };
  }, [invoices, transactions, expenses, ledgerEntries, dashboardDate, state.selectedYear]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 animate-pulse text-slate-400 font-black uppercase tracking-widest">
        Calculando Balances...
      </div>
    );

  const renderTooltipFormatter = (value: number) => `RD$ ${value.toLocaleString()}`;

  return (
    <div className="space-y-8">
      {/* CABECERA CON ACCIONES RÁPIDAS */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-slate-900/20">
            <Activity size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Dashboard de Finanzas</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Control general de cajas, cobros e inventario
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-2">
              Fecha de Cuadre (Cajas)
            </label>
            <input
              type="date"
              value={dashboardDate}
              onChange={(e) => setDashboardDate(e.target.value)}
              className="bg-slate-50 border-none rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-200"
            />
          </div>
          <button
            onClick={handleOpenSale}
            className="flex items-center gap-3 bg-emerald-500 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-emerald-100/50"
          >
            <ShoppingCart size={18} /> Nueva Venta
          </button>
        </div>
      </div>

      {/* 1. SECCIONES DE CAJAS (CAJA CHICA Y BANCO) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        
        {/* CAJA CHICA */}
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-emerald-50/50 p-6 flex items-center gap-4 border-b border-emerald-100">
            <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-200">
              <DollarSign size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-emerald-900">Caja Chica</h3>
              <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Efectivo y pagos diarios</p>
            </div>
          </div>
          <div className="p-8 grid grid-cols-3 gap-6 flex-1">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><TrendingUp size={12} className="text-emerald-500"/> Ingresos</p>
              <p className="text-xl font-black text-slate-800">RD$ {stats.cajaChica.in.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><TrendingDown size={12} className="text-rose-500"/> Gastos</p>
              <p className="text-xl font-black text-slate-800">RD$ {stats.cajaChica.out.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-50 p-4 rounded-3xl text-center flex flex-col justify-center">
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Balance</p>
              <p className={`text-2xl font-black ${stats.cajaChica.net >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                RD$ {stats.cajaChica.net.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* BANCO */}
        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
          <div className="bg-indigo-50/50 p-6 flex items-center gap-4 border-b border-indigo-100">
            <div className="w-12 h-12 bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Banknote size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-indigo-900">Cuenta de Banco</h3>
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Fondo general e ingresos pasivos</p>
            </div>
          </div>
          <div className="p-8 grid grid-cols-3 gap-6 flex-1">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><TrendingUp size={12} className="text-emerald-500"/> Ingresos</p>
              <p className="text-xl font-black text-slate-800">RD$ {stats.banco.in.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1"><TrendingDown size={12} className="text-rose-500"/> Gastos</p>
              <p className="text-xl font-black text-slate-800">RD$ {stats.banco.out.toLocaleString()}</p>
            </div>
            <div className="bg-indigo-50 p-4 rounded-3xl text-center flex flex-col justify-center">
              <p className="text-[9px] font-black text-indigo-600 uppercase tracking-widest mb-1">Balance</p>
              <p className={`text-2xl font-black ${stats.banco.net >= 0 ? 'text-indigo-700' : 'text-rose-600'}`}>
                RD$ {stats.banco.net.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* 2. GRÁFICO DE LÍNEA DE TIEMPO */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Flujo de Caja (Histórico)
            </h3>
            <p className="text-sm font-black text-slate-800 mt-1">Comparativa Ingresos vs Egresos</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase">
            <Calendar size={14} /> Histórico
          </div>
        </div>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={stats.chartData}>
              <defs>
                <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }}
                tickFormatter={(val) => `RD$${val / 1000}k`}
              />
              <Tooltip
                formatter={renderTooltipFormatter}
                contentStyle={{
                  borderRadius: '20px',
                  border: 'none',
                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                  fontWeight: 'bold'
                }}
              />
              <Legend verticalAlign="top" height={36} iconType="circle" />
              <Area
                type="monotone"
                dataKey="ingresos"
                name="Ingresos"
                stroke="#10b981"
                fillOpacity={1}
                fill="url(#colorIngresos)"
                strokeWidth={3}
              />
              <Area
                type="monotone"
                dataKey="gastos"
                name="Egresos"
                stroke="#f43f5e"
                fillOpacity={1}
                fill="url(#colorGastos)"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 3. GRÁFICOS INFERIORES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Ingresos por Concepto */}
        <div className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 text-center w-full">Ingresos por Concepto</h3>
          <div className="h-[200px] w-full relative">
            {stats.incomeByConcept.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.incomeByConcept} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                    {stats.incomeByConcept.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={renderTooltipFormatter} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-300 font-bold uppercase">Sin Datos</div>
            )}
          </div>
          <div className="w-full mt-4 space-y-2">
            {stats.incomeByConcept.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-[9px] font-black uppercase">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[idx % COLORS.length]}}></div> {item.name}</span>
                <span className="text-slate-600">RD$ {item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Egresos por Categoría */}
        <div className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 text-center w-full">Egresos por Categoría</h3>
          <div className="h-[200px] w-full relative">
            {stats.expensesByCategory.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={stats.expensesByCategory} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                    {stats.expensesByCategory.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={renderTooltipFormatter} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-300 font-bold uppercase">Sin Datos</div>
            )}
          </div>
          <div className="w-full mt-4 space-y-2">
            {stats.expensesByCategory.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-[9px] font-black uppercase">
                <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[(idx + 4) % COLORS.length]}}></div> {item.name}</span>
                <span className="text-slate-600">RD$ {item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Estado de Recaudación y Morosidad */}
        <div className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 text-center w-full">Nivel de Cobro</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Cobrado', value: stats.totalIncome, color: '#10b981' },
                    { name: 'Morosidad', value: stats.totalOverdue, color: '#f59e0b' }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                </Pie>
                <Tooltip formatter={renderTooltipFormatter} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="w-full mt-4 p-3 bg-slate-50 rounded-2xl flex justify-between items-center">
            <span className="text-[10px] font-black uppercase text-slate-500">Tasa de Efectividad</span>
            <span className="text-sm font-black text-emerald-600">
              {Math.round((stats.totalIncome / (stats.totalIncome + stats.totalOverdue)) * 100) || 0}%
            </span>
          </div>
        </div>

        {/* Becas Aplicadas */}
        <div className="bg-white p-6 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between group overflow-hidden relative">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-amber-50 rounded-full blur-3xl z-0 opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
              <GraduationCap size={24} />
            </div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Total Becas Aplicadas</h3>
            <p className="text-3xl font-black text-amber-600 leading-none">RD$ {stats.scholarshipsApplied.toLocaleString()}</p>
          </div>
          <div className="mt-8 relative z-10 bg-amber-50/50 p-4 rounded-2xl">
            <p className="text-[9px] font-bold text-amber-700/70 uppercase tracking-widest leading-relaxed">
              Monto total descontado por becas y acuerdos especiales en el período actual.
            </p>
          </div>
        </div>

      </div>

      {/* 4. TRANSACCIONES RECIENTES */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Activity size={16} /> Últimos Pagos Registrados
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <th className="pb-4">Estudiante</th>
                <th className="pb-4">Fecha</th>
                <th className="pb-4">Método</th>
                <th className="pb-4">Recibo #</th>
                <th className="pb-4 text-right">Monto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {groupedTransactions.slice(0, 5).map((t) => (
                <tr key={t.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-black text-[10px]">
                        {t.students?.names?.[0] || 'A'}
                        {t.students?.first_surname?.[0] || ''}
                      </div>
                      <span className="text-xs font-black text-slate-700">
                        {t.students?.names ? `${t.students.names} ${t.students.first_surname || ''}` : 'Alumno'}
                      </span>
                    </div>
                  </td>
                  <td className="py-4 text-[10px] font-bold text-slate-500">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td className="py-4">
                    <span className="text-[9px] font-black uppercase bg-slate-100 px-2 py-1 rounded-full text-slate-600">
                      {t.payment_method}
                    </span>
                  </td>
                  <td className="py-4 text-[10px] font-black text-slate-400">
                    #{t.receipt_number}
                  </td>
                  <td className="py-4 text-right font-black text-emerald-600 text-sm">
                    RD$ {Number(t.amount_paid).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: NUEVA VENTA / FACTURA DIRECTA (CARRITO) */}
      {showSaleModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-[3rem] p-10 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col">
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h3 className="text-xl font-black uppercase tracking-tighter">
                Registrar Venta / Factura
              </h3>
              <button
                onClick={() => setShowSaleModal(false)}
                className="p-2 hover:bg-slate-50 rounded-full text-slate-400"
              >
                <X size={24} />
              </button>
            </div>

            <form
              onSubmit={handleSaleSubmit}
              className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1 text-left"
            >
              {/* Buscador Alumno */}
              <div className="space-y-1 relative">
                <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                  <Users size={12} className="text-indigo-500" /> Estudiante
                </label>
                {selectedStudentForSaleObj ? (
                  <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                    <div>
                      <p className="text-xs font-black text-indigo-900">
                        {selectedStudentForSaleObj.names} {selectedStudentForSaleObj.first_surname}
                      </p>
                      <p className="text-[9px] font-bold text-indigo-500 uppercase">
                        Estudiante Activo
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSaleForm({ ...saleForm, student_id: '' })}
                      className="p-1 hover:bg-indigo-100 rounded-lg text-indigo-500"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Escribe el nombre del alumno para buscar..."
                      value={studentSearchTerm}
                      onChange={(e) => setStudentSearchTerm(e.target.value)}
                      className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-xs font-bold focus:ring-2 focus:ring-indigo-600"
                    />
                    {filteredStudents.length > 0 && (
                      <div className="absolute left-0 right-0 top-full bg-white border border-slate-100 rounded-2xl shadow-xl z-20 mt-1 max-h-48 overflow-y-auto divide-y divide-slate-50">
                        {filteredStudents.map((student) => (
                          <div
                            key={student.id}
                            onClick={() => {
                              setSaleForm({ ...saleForm, student_id: student.id });
                              setStudentSearchTerm('');
                            }}
                            className="p-4 hover:bg-indigo-50 cursor-pointer text-xs font-bold text-slate-700"
                          >
                            {student.names} {student.first_surname} {student.second_surname || ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
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

                  {selectedProductForAdding && (
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
                            Number(selectedProductForAdding.price) * selectedQuantity
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
                  id="immediate_pay_dashboard"
                  checked={saleForm.immediate_pay}
                  onChange={(e) => setSaleForm({ ...saleForm, immediate_pay: e.target.checked })}
                  className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label
                  htmlFor="immediate_pay_dashboard"
                  className="text-xs font-black text-slate-700 cursor-pointer select-none uppercase tracking-wide"
                >
                  ¿Registrar Cobro de Inmediato?
                </label>
              </div>

              {/* Desglose de Pago Inmediato */}
              {saleForm.immediate_pay && (
                <div className="space-y-4 animate-in slide-in-from-top-2 duration-200 text-left">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-400">
                        Método de Pago
                      </label>
                      <select
                        value={saleForm.payment_method}
                        onChange={(e) =>
                          setSaleForm({ ...saleForm, payment_method: e.target.value })
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
                        value={saleForm.reference_number}
                        onChange={(e) =>
                          setSaleForm({ ...saleForm, reference_number: e.target.value })
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
                      value={saleForm.notes}
                      onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })}
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
                  onClick={() => setShowSaleModal(false)}
                  className="flex-1 py-4 bg-slate-100 rounded-2xl text-xs font-black uppercase"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading || !saleForm.student_id || cart.length === 0}
                  className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50"
                >
                  {loading
                    ? 'Procesando...'
                    : saleForm.immediate_pay
                      ? 'Facturar y Cobrar'
                      : 'Facturar Pendiente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE RECIBO (IMPRESIÓN) */}
      {receiptStudent && receiptInvoices && (
        <PaymentModal
          student={receiptStudent}
          courseName={
            receiptStudent.courses?.name ||
            receiptStudent.course_name ||
            state.courses?.find((c) => c.id === receiptStudent.course_id)?.name ||
            'Grado'
          }
          invoice={receiptInvoices}
          onClose={() => {
            setReceiptStudent(null);
            setReceiptInvoices(null);
          }}
          onSuccess={() => {
            setReceiptStudent(null);
            setReceiptInvoices(null);
          }}
        />
      )}
    </div>
  );
};
