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
  Package,
  X
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useFinance } from '../../hooks/useFinance';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { PaymentModal } from './PaymentModal';

interface Props {
  studentId: string;
  onBack: () => void;
}

export const StudentAccountDetails = ({ studentId, onBack }: Props) => {
  const { state, profile } = useApp();
  const {
    invoices,
    transactions,
    paymentPlans,
    voidPayment,
    refresh,
    loading,
    products,
    createProductInvoice,
    scholarships
  } = useFinance();
  const [showProductInvoiceModal, setShowProductInvoiceModal] = useState(false);
  const [productInvoiceForm, setProductInvoiceForm] = useState({
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
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<string[]>([]);
  const hasAttempted = useRef(false);

  const student = state.students.find((s) => s.id === studentId);
  const studentInvoices = invoices.filter((i) => i.student_id === studentId);
  const studentTransactions = transactions.filter((t) => t.student_id === studentId);

  const handleGenerateInvoices = async () => {
    if (!student || isGenerating) return;

    // BUSCAR PLAN: Primero por Grado exacto, luego por Nivel como respaldo
    const cleanLevel = student.courses?.level?.trim();
    const courseId = student.course_id || student.courseId;

    let plan = paymentPlans.find((p) => p.course_id === courseId);

    if (!plan && cleanLevel) {
      // Si no hay plan por Grado, buscar cualquier plan que pertenezca al mismo Nivel
      plan = paymentPlans.find((p) => {
        const course = state.courses?.find((c) => c.id === p.course_id);
        return course?.level?.trim() === cleanLevel;
      });
    }

    if (!plan) {
      toast.error('No hay precios configurados para este grado o nivel.');
      return;
    }

    setIsGenerating(true);
    const loadingToast = toast.loading('Generando facturas...');

    try {
      const newInvoices = [];
      const currentCenterId = profile?.center_id || student.center_id;

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

      newInvoices.push({
        center_id: currentCenterId,
        student_id: studentId,
        course_id: student.course_id,
        period: '2026-2027',
        concept: 'Inscripción',
        amount_original: enrollmentOriginal,
        amount_final: enrollmentFinal,
        discount_applied: enrollmentDiscount,
        due_date: new Date().toISOString().split('T')[0],
        status: 'pending'
      });

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
      const startMonthIdx = (plan.start_month || 9) - 1; // 1-12 a 0-11
      const paymentEndDay = plan.payment_end_day || 10;

      for (let i = 0; i < Number(plan.months_count); i++) {
        const currentMonthIdx = (startMonthIdx + i) % 12;
        const currentYear = new Date().getFullYear() + (startMonthIdx + i >= 12 ? 1 : 0);

        const dueDate = new Date(currentYear, currentMonthIdx, paymentEndDay);

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
          period: '2026-2027',
          concept: `Cuota ${(i + 1).toString().padStart(2, '0')}`,
          month_number: i + 1,
          description: monthNames[currentMonthIdx],
          amount_original: monthlyOriginal,
          amount_final: monthlyFinal,
          discount_applied: monthlyDiscount,
          due_date: dueDate.toISOString().split('T')[0],
          status: 'pending'
        });
      }

      for (const inv of newInvoices) {
        const { error } = await supabase.from('finance_invoices').insert(inv);
        if (error) {
          console.error(`Error en cuota ${inv.concept}:`, error);
        }
      }

      toast.success('¡Proceso de creación finalizado!', { id: loadingToast });
      refresh();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error('Error: ' + error.message, { id: loadingToast });
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
          <button className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 shadow-sm">
            <FileText size={16} /> Estado de Cuenta PDF
          </button>
          <button
            onClick={() => setShowProductInvoiceModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 shadow-lg shadow-emerald-100"
          >
            <Package size={16} /> Facturar Producto
          </button>
          <button className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-100">
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
        {/* LISTADO DE CUOTAS */}
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-slate-900 text-white rounded-2xl">
                <DollarSign size={18} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                Plan de Pagos y Cuotas
              </h3>
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
                        {inv.status === 'pending' && new Date(inv.due_date) < new Date() && (
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
                        RD$ {Number(inv.amount_final).toLocaleString()}
                      </p>
                      <p
                        className={`text-[8px] font-black uppercase tracking-widest ${
                          inv.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'
                        }`}
                      >
                        {inv.status === 'paid' ? 'Pagado' : 'Pendiente'}
                      </p>
                    </div>
                    {inv.status !== 'paid' && (
                      <button
                        onClick={() => setSelectedInvoice([inv])}
                        className="bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
                      >
                        Cobrar
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
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
            {studentTransactions.length === 0 ? (
              <p className="text-[10px] font-bold text-slate-400 uppercase italic text-center py-10">
                No hay pagos registrados
              </p>
            ) : (
              studentTransactions.map((t) => (
                <div key={t.id} className="relative pl-12">
                  <div className="absolute left-4 top-1 w-4 h-4 bg-white border-4 border-emerald-500 rounded-full z-10"></div>
                  <div className="flex justify-between items-start mb-1">
                    <p className="text-[10px] font-black text-slate-900 uppercase">
                      Recibo #{t.receipt_number}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-black text-emerald-600">
                        RD$ {Number(t.amount_paid).toLocaleString()}
                      </span>
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
                    {new Date(t.created_at).toLocaleDateString()} • {t.payment_method}
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
