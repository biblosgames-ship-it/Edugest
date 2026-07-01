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
  Trash2
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

export const FinanceDashboard = () => {
  const { state } = useApp();
  const { invoices, transactions, expenses, products, createProductInvoice, loading } = useFinance({
    invoices: true,
    transactions: true,
    expenses: true,
    products: true
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

    return result;
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

  const stats = useMemo(() => {
    const totalIncome = transactions.reduce((acc, t) => acc + Number(t.amount_paid), 0);
    const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
    const netProfit = totalIncome - totalExpenses;

    const overdueInvoices = invoices.filter(
      (i) => i.status === 'overdue' || (i.status === 'pending' && new Date(i.due_date) < new Date())
    );
    const totalOverdue = overdueInvoices.reduce((acc, i) => acc + Number(i.amount_final), 0);

    // Datos para gráfico de barras (Últimos 6 meses - Simulado con datos reales si existen)
    const chartData = [
      { name: 'Ene', ingresos: 45000, gastos: 32000 },
      { name: 'Feb', ingresos: 52000, gastos: 34000 },
      { name: 'Mar', ingresos: 48000, gastos: 31000 },
      { name: 'Abr', ingresos: 61000, gastos: 38000 },
      { name: 'May', ingresos: totalIncome, gastos: totalExpenses }
    ];

    return { totalIncome, totalExpenses, netProfit, totalOverdue, chartData };
  }, [invoices, transactions, expenses]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 animate-pulse text-slate-400 font-black uppercase tracking-widest">
        Calculando Balances...
      </div>
    );

  return (
    <div className="space-y-6">
      {/* CABECERA CON ACCIONES RÁPIDAS */}
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-slate-900/20">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h2 className="text-2xl font-black uppercase tracking-tighter">Dashboard de Finanzas</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Control de balances, cobros e inventario
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenSale}
          className="flex items-center gap-3 bg-emerald-500 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-emerald-100/50"
        >
          <ShoppingCart size={18} /> Nueva Venta (Facturar)
        </button>
      </div>

      {/* 1. KPIs PRINCIPALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform">
              <TrendingUp size={20} />
            </div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Ingresos Totales
            </span>
          </div>
          <h4 className="text-3xl font-black text-slate-900 leading-none">
            RD$ {stats.totalIncome.toLocaleString()}
          </h4>
          <p className="text-[9px] font-black text-emerald-600 mt-2 flex items-center gap-1">
            <ArrowUpRight size={12} /> +12% vs mes anterior
          </p>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-200 group-hover:scale-110 transition-transform">
              <TrendingDown size={20} />
            </div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Egresos Totales
            </span>
          </div>
          <h4 className="text-3xl font-black text-slate-900 leading-none">
            RD$ {stats.totalExpenses.toLocaleString()}
          </h4>
          <p className="text-[9px] font-black text-rose-600 mt-2 flex items-center gap-1">
            <ArrowDownRight size={12} /> +5% gasto operativo
          </p>
        </div>

        <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 blur-2xl rounded-full -mr-12 -mt-12"></div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-500/40 group-hover:scale-110 transition-transform">
              <DollarSign size={20} />
            </div>
            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">
              Balance Neto
            </span>
          </div>
          <h4 className="text-3xl font-black text-white leading-none relative z-10">
            RD$ {stats.netProfit.toLocaleString()}
          </h4>
          <p className="text-[9px] font-black text-indigo-300 mt-2 relative z-10 uppercase tracking-widest">
            Flujo de caja positivo
          </p>
        </div>

        <div className="bg-amber-50 p-6 rounded-[2.5rem] border border-amber-100 shadow-sm hover:shadow-xl transition-all group">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-200 group-hover:scale-110 transition-transform">
              <AlertCircle size={20} />
            </div>
            <span className="text-[10px] font-black uppercase text-amber-600 tracking-widest">
              Morosidad
            </span>
          </div>
          <h4 className="text-3xl font-black text-amber-900 leading-none">
            RD$ {stats.totalOverdue.toLocaleString()}
          </h4>
          <p className="text-[9px] font-black text-amber-600 mt-2 uppercase tracking-widest">
            Cuentas por cobrar
          </p>
        </div>
      </div>

      {/* 2. GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Flujo de Caja Mensual
            </h3>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase">
              <Calendar size={14} /> Año Escolar 2026-2027
            </div>
          </div>
          <div className="h-[300px] w-full">
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
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '20px',
                    border: 'none',
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="ingresos"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#colorIngresos)"
                  strokeWidth={3}
                />
                <Area
                  type="monotone"
                  dataKey="gastos"
                  stroke="#f43f5e"
                  fillOpacity={1}
                  fill="url(#colorGastos)"
                  strokeWidth={3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">
            Estado de Recaudación
          </h3>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Cobrado', value: stats.totalIncome, color: '#10b981' },
                    { name: 'Pendiente', value: stats.totalOverdue, color: '#f59e0b' }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#10b981" />
                  <Cell fill="#f59e0b" />
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
              <span className="text-[10px] font-black uppercase text-slate-500">Tasa de Cobro</span>
              <span className="text-sm font-black text-emerald-600">
                {Math.round((stats.totalIncome / (stats.totalIncome + stats.totalOverdue)) * 100) ||
                  0}
                %
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. TRANSACCIONES RECIENTES */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Activity size={16} /> Últimos Pagos Registrados
          </h3>
          <button className="text-[9px] font-black uppercase text-indigo-600 hover:underline">
            Ver Todo
          </button>
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
