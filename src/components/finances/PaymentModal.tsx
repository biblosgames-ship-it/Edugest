import React, { useState } from 'react';
import {
  X,
  CheckCircle2,
  DollarSign,
  CreditCard,
  Hash,
  FileText,
  Save,
  Receipt,
  GraduationCap
} from 'lucide-react';
import { useFinance } from '../../hooks/useFinance';
import { toast } from 'react-hot-toast';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';

interface Props {
  student: any;
  courseName: string;
  invoice: any;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaymentModal = ({
  student,
  courseName: initialCourseName,
  invoice,
  onClose,
  onSuccess
}: Props) => {
  const { state, profile, center } = useApp();
  const { registerPayment, loading } = useFinance({});

  // Normalizar: Siempre trabajar con un array de facturas
  const invoicesList = Array.isArray(invoice) ? invoice : [invoice];

  // BÚSQUEDA ROBUSTA DEL GRADO (Búsqueda Universal)
  const courseId = (student.course_id || invoicesList[0]?.course_id || '').toString().trim();

  // Buscar en CUALQUIER propiedad de los objetos de curso
  const foundCourse = state.courses?.find((c) => {
    return Object.values(c).some((val) => val && val.toString().trim() === courseId);
  });

  // CONSTRUIR EL NOMBRE REAL (Nivel + Grado + Sección)
  const fullCourseName = foundCourse
    ? `${foundCourse.level || ''} ${foundCourse.grade || ''} ${foundCourse.section || ''}`.trim()
    : initialCourseName || student.courses?.name || 'Grado';

  const courseName = fullCourseName;
  const totalAmount = invoicesList.reduce((acc, inv) => acc + Number(inv.amount_final), 0);
  const totalConcepts = invoicesList.map((inv) => inv.concept).join(' + ');

  const [formData, setFormData] = useState({
    amount_paid: totalAmount,
    payment_method: 'cash',
    reference_number: '',
    notes: ''
  });

  const [isSuccess, setIsSuccess] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [tutorName, setTutorName] = useState<string>('No registrado');
  const [printFormat, setPrintFormat] = useState<'letter' | 'ticket'>('letter');

  // CARGAR DATOS DEL TUTOR
  React.useEffect(() => {
    const fetchTutor = async () => {
      try {
        const { data: parents } = await supabase
          .from('parents')
          .select('*')
          .eq('student_id', student.id);
        const { data: family } = await supabase
          .from('student_family')
          .select('*')
          .eq('student_id', student.id);

        let foundName = '';
        const allData = [...(parents || []), ...(family || [])];

        if (allData.length > 0) {
          // Priorizar Tutor, luego Madre, luego Padre
          const relative =
            allData.find((f) => (f.role || f.relation || '').toLowerCase().includes('tutor')) ||
            allData.find((f) => (f.role || f.relation || '').toLowerCase().includes('madre')) ||
            allData.find((f) => (f.role || f.relation || '').toLowerCase().includes('padre')) ||
            allData[0];

          foundName = relative.name || relative.full_name || relative.first_name;
        }

        if (!foundName && student.authorized_person) {
          foundName = student.authorized_person;
        }

        if (foundName) setTutorName(foundName);
      } catch (error) {
        console.error('Error in fetchTutor:', error);
      }
    };
    fetchTutor();
  }, [student.id, student.authorized_person]);

  // DETECTAR FACTURAS YA PAGADAS PARA IR DIRECTO AL RECIBO
  React.useEffect(() => {
    const loadReceiptForPaidInvoices = async () => {
      const allPaid = invoicesList.length > 0 && invoicesList.every((inv) => inv.status === 'paid');
      if (!allPaid) return;

      try {
        const invoiceIds = invoicesList.map((inv) => inv.id);
        const { data: txs, error } = await supabase
          .from('finance_transactions')
          .select('*')
          .in('invoice_id', invoiceIds);

        if (error) throw error;

        if (txs && txs.length > 0) {
          const totalPaid = txs.reduce((acc, t) => acc + Number(t.amount_paid), 0);
          const methods = Array.from(new Set(txs.map((t) => t.payment_method))).join(', ');
          const refs = txs.map((t) => t.reference_number).filter(Boolean).join(', ');
          const receiptNums = Array.from(new Set(txs.map((t) => t.receipt_number).filter(Boolean)));

          setReceiptData({
            student,
            courseName,
            concepts: totalConcepts,
            amount: totalPaid,
            method: methods || 'cash',
            date: new Date(txs[0].created_at).toLocaleDateString(),
            ref: refs,
            receiptNumbers: receiptNums.length > 0 ? receiptNums : [1]
          });
          setFormData({
            amount_paid: totalPaid,
            payment_method: txs[0].payment_method || 'cash',
            reference_number: txs[0].reference_number || '',
            notes: txs[0].notes || ''
          });
          setIsSuccess(true);
        } else {
          // Fallback en caso de latencia de guardado
          setReceiptData({
            student,
            courseName,
            concepts: totalConcepts,
            amount: totalAmount,
            method: 'cash',
            date: new Date().toLocaleDateString(),
            ref: '',
            receiptNumbers: [1]
          });
          setIsSuccess(true);
        }
      } catch (err) {
        console.error('Error loading receipt for paid invoices:', err);
      }
    };

    loadReceiptForPaidInvoices();
  }, [invoice, student.id, courseName, totalConcepts, totalAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.amount_paid <= 0) return toast.error('El monto debe ser mayor a 0');

    try {
      const results = [];
      let firstReceiptNumber: any = undefined;

      for (const inv of invoicesList) {
        const paymentPayload: any = {
          student_id: student.id,
          invoice_id: inv.id,
          amount_paid: Number(inv.amount_final),
          payment_method: formData.payment_method,
          reference_number: formData.reference_number,
          notes:
            formData.notes + (invoicesList.length > 1 ? ` (Pago múltiple: ${totalConcepts})` : '')
        };

        // Reuse the receipt number of the first transaction for subsequent payments
        if (firstReceiptNumber !== undefined) {
          paymentPayload.receipt_number = firstReceiptNumber;
        }

        const res = await registerPayment(paymentPayload);
        results.push(res);

        if (res && res.receipt_number && firstReceiptNumber === undefined) {
          firstReceiptNumber = res.receipt_number;
        }
      }

      // === SINCRONIZACIÓN CON LIBRO CONTABLE MAESTRO ===
      try {
        const savedEntries = localStorage.getItem('edugens_ledger_entries');
        const ledgerEntries = savedEntries ? JSON.parse(savedEntries) : [];

        const isEnrollment = totalConcepts.toLowerCase().includes('inscrip');
        const accountName = isEnrollment ? 'INGRESOS: INSCRIPCIONES' : 'INGRESOS: COLEGIATURAS';

        const newLedgerEntry = {
          id: `PAY-${Date.now()}`,
          date: new Date().toISOString().split('T')[0],
          account: accountName,
          item: `${student.names} ${student.first_surname}`,
          desc: `Cobro de ${totalConcepts} - ${courseName} (Recibo #${results[0]?.receipt_number || 'S/N'}) [MÉTODO: ${formData.payment_method.toUpperCase()}]`,
          type: 'income',
          amount: formData.amount_paid,
          method: formData.payment_method
        };

        localStorage.setItem(
          'edugens_ledger_entries',
          JSON.stringify([newLedgerEntry, ...ledgerEntries])
        );

        // Asegurar que la categoría existe en el catálogo
        const savedCats = localStorage.getItem('edugens_ledger_categories');
        const ledgerCats = savedCats ? JSON.parse(savedCats) : [];
        if (!ledgerCats.some((c: any) => c.name === accountName)) {
          ledgerCats.push({
            id: `cat-${Date.now()}`,
            name: accountName,
            type: 'income',
            items: []
          });
          localStorage.setItem('edugens_ledger_categories', JSON.stringify(ledgerCats));
        }
      } catch (e) {
        console.error('Error syncing with Ledger:', e);
      }
      // ===============================================

      setReceiptData({
        student,
        courseName,
        concepts: totalConcepts,
        amount: formData.amount_paid,
        method: formData.payment_method,
        date: new Date().toLocaleDateString(),
        ref: formData.reference_number,
        receiptNumbers: results.filter((r) => r && r.receipt_number).map((r) => r.receipt_number)
      });
      setIsSuccess(true);
      // No cerramos inmediatamente para permitir imprimir
    } catch (error) {
      console.error('Payment error:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isSuccess) {
    const centerName = center?.name || 'Edugest School Management';
    const centerLogo = center?.logo_url || '';

    return (
      <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4 overflow-y-auto">
        <style>
          {`
            @media print {
              body * { visibility: hidden; }
              #printable-receipt, #printable-receipt * { visibility: visible; }
              #printable-receipt { 
                position: absolute; 
                left: 0; 
                top: 0; 
                width: ${printFormat === 'ticket' ? '76mm' : '100%'};
                padding: ${printFormat === 'ticket' ? '4mm' : '40px'};
                color: black !important;
                background: white !important;
              }
              .no-print { display: none !important; }
              @page {
                size: ${printFormat === 'ticket' ? 'auto' : 'letter'};
                margin: ${printFormat === 'ticket' ? '0mm' : '15mm'};
              }
            }
          `}
        </style>
        <div className={`bg-white w-full ${printFormat === 'ticket' ? 'max-w-[360px]' : 'max-w-md'} rounded-[3rem] shadow-2xl overflow-hidden p-8 md:p-10 text-center animate-in zoom-in duration-300 my-auto`}>
          
          {/* FORMAT SELECTOR */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 no-print gap-1 select-none">
            <button
              type="button"
              onClick={() => setPrintFormat('letter')}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                printFormat === 'letter'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Carta
            </button>
            <button
              type="button"
              onClick={() => setPrintFormat('ticket')}
              className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                printFormat === 'ticket'
                  ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Ticket (POS)
            </button>
          </div>

          <div 
            id="printable-receipt" 
            className={`text-left font-sans text-slate-900 ${
              printFormat === 'ticket' ? 'text-[10px] leading-snug p-1' : 'p-2'
            }`}
          >
            <div className={`flex items-center ${printFormat === 'ticket' ? 'gap-3 mb-4 border-b pb-3 border-slate-900' : 'gap-4 mb-8 border-b-2 pb-6 border-slate-900'}`}>
              {centerLogo && (
                <img 
                  src={centerLogo} 
                  alt="Logo" 
                  className={printFormat === 'ticket' ? 'w-10 h-10 object-contain rounded-lg' : 'w-16 h-16 object-contain rounded-xl'} 
                />
              )}
              <div className="flex-1">
                <h2 className={printFormat === 'ticket' ? 'text-sm font-black uppercase tracking-tight leading-tight' : 'text-xl font-black uppercase tracking-tighter leading-tight'}>
                  {centerName}
                </h2>
                {center?.address && (
                  <p className={printFormat === 'ticket' ? 'text-[8px] text-slate-500 font-bold uppercase mt-0.5' : 'text-xs text-slate-500 font-bold uppercase tracking-wide mt-1'}>
                    Dirección: {center.address}
                  </p>
                )}
                {center?.phone && (
                  <p className={printFormat === 'ticket' ? 'text-[8px] text-slate-500 font-bold uppercase' : 'text-xs text-slate-500 font-bold uppercase tracking-wide mt-0.5'}>
                    Teléfono: {center.phone}
                  </p>
                )}
                <p className={printFormat === 'ticket' ? 'text-[8px] font-bold text-slate-400 uppercase mt-0.5' : 'text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1'}>
                  Sistema de Gestión Escolar
                </p>
              </div>
            </div>

            <div className={printFormat === 'ticket' ? 'text-center mb-4' : 'text-center mb-8'}>
              <div className={printFormat === 'ticket' ? 'bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-xl inline-block text-sm font-black mb-1 shadow-sm' : 'bg-indigo-50 text-indigo-600 px-6 py-2 rounded-2xl inline-block text-xl font-black mb-2 shadow-sm border border-indigo-100'}>
                Recibo No. {receiptData?.receiptNumbers?.[0]?.toString().padStart(4, '0') || '0001'}
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400">
                Comprobante de Pago Oficial
              </p>
            </div>

            <div className={printFormat === 'ticket' ? 'py-2 mb-2 space-y-3' : 'py-6 mb-6 space-y-5'}>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">
                  Estudiante / Alumna
                </p>
                <p className={printFormat === 'ticket' ? 'text-base font-black text-slate-900 leading-tight' : 'text-2xl font-black text-slate-900 leading-tight'}>
                  {student.names} {student.first_surname}
                </p>
                <div className="inline-flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase mt-2">
                  {courseName}
                </div>
              </div>
              {/* Desglose de Productos / Conceptos */}
              <div className="border-t border-b border-slate-100 py-4 my-2">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-3 tracking-widest">
                  Detalle del Recibo
                </p>
                <div className="overflow-x-auto">
                  <table className={`w-full text-left border-collapse ${printFormat === 'ticket' ? 'text-[10px]' : 'text-[11px]'}`}>
                    <thead>
                      <tr className="border-b border-slate-200 text-[8px] font-black uppercase tracking-wider text-slate-400">
                        <th className="pb-2 font-black">Detalle</th>
                        <th className="pb-2 text-center font-black">Cant.</th>
                        <th className="pb-2 text-right font-black">Monto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoicesList.map((inv, idx) => {
                        const conceptName = inv.concept.startsWith('Venta: ')
                          ? inv.concept.replace('Venta: ', '')
                          : inv.concept;
                        const qty = inv.quantity || 1;
                        const price = Number(inv.amount_final) / qty;
                        return (
                          <tr key={inv.id || idx} className="hover:bg-slate-50/50">
                            <td className={`${printFormat === 'ticket' ? 'py-1.5' : 'py-2.5'} text-slate-700 font-bold pr-2 leading-tight`}>
                              {conceptName}
                              {qty > 1 && (
                                <span className="text-[9px] font-normal text-slate-400 block mt-0.5">
                                  Precio unitario: RD$ {price.toLocaleString()}
                                </span>
                              )}
                            </td>
                            <td className={`${printFormat === 'ticket' ? 'py-1.5' : 'py-2.5'} text-center text-slate-500 font-black`}>
                              {qty}
                            </td>
                            <td className={`${printFormat === 'ticket' ? 'py-1.5' : 'py-2.5'} text-right text-slate-900 font-black`}>
                              RD$ {Number(inv.amount_final).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">
                  Tutor / Responsable
                </p>
                <p className="text-sm font-bold text-slate-900 leading-tight uppercase">
                  {tutorName}
                </p>
              </div>
              <div className="flex justify-between items-end pt-4 border-t border-slate-100">
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">
                    Método de Pago
                  </p>
                  <p className="text-xs font-bold uppercase text-slate-900">
                    {formData.payment_method}{' '}
                    {formData.reference_number && `(Ref: ${formData.reference_number})`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-1 tracking-widest">
                    Total Pagado
                  </p>
                  <p className={printFormat === 'ticket' ? 'text-xl font-black text-slate-900' : 'text-3xl font-black text-slate-900'}>
                    RD$ {formData.amount_paid.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Signature / Stamp line */}
            <div className={`mt-8 mb-6 flex flex-col items-center justify-center text-center ${printFormat === 'ticket' ? 'mt-6 mb-4' : 'mt-10 mb-8'}`}>
              <div className={`border-t border-slate-400 pt-1.5 ${printFormat === 'ticket' ? 'w-36' : 'w-48'}`}></div>
              <p className={`${printFormat === 'ticket' ? 'text-[8px]' : 'text-[10px]'} font-black uppercase text-slate-400 tracking-wider`}>
                Firma Autorizada / Sello
              </p>
            </div>

            <div className={`text-center font-bold text-slate-500 uppercase border-t border-dashed border-slate-200 pt-6 ${printFormat === 'ticket' ? 'text-[10px]' : 'text-xs'}`}>
              Fecha de Emisión: {new Date().toLocaleString()}
            </div>
          </div>

          <div className="flex flex-col gap-3 no-print mt-8">
            <button
              onClick={handlePrint}
              className="w-full bg-slate-900 text-white py-4 rounded-2xl flex items-center justify-center gap-3 font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 cursor-pointer"
            >
              <Receipt size={20} /> Imprimir Recibo
            </button>
            <button
              onClick={() => {
                onSuccess();
                onClose();
              }}
              className="w-full bg-slate-50 text-slate-400 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all cursor-pointer"
            >
              Cerrar Ventana
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-start md:items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in duration-300 max-h-[95vh] flex flex-col">
        <div className="overflow-y-auto flex-1 custom-scrollbar">
          {/* HEADER PREMIUM */}
          <div className="bg-slate-900 p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 blur-[100px] rounded-full -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 blur-[80px] rounded-full -ml-20 -mb-20"></div>

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-6">
                <div className="bg-indigo-600 text-[9px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full shadow-lg shadow-indigo-500/20">
                  Recibo de Pago Oficial
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <h3 className="text-4xl font-black text-white tracking-tighter leading-none mb-4">
                {student.names} <br />
                <span className="text-indigo-400">
                  {student.first_surname} {student.second_surname}
                </span>
              </h3>

              <div className="flex flex-wrap gap-4 items-center border-t border-white/10 pt-6 mt-2">
                <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Curso / Grado
                  </p>
                  <div className="bg-white/5 border border-white/10 px-3 py-1 rounded-lg text-xs font-bold text-white">
                    {courseName}
                  </div>
                </div>
                <div className="w-px h-8 bg-white/10"></div>
                <div>
                  <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Tutor / Responsable
                  </p>
                  <p className="text-xs font-bold text-indigo-100 italic uppercase">{tutorName}</p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {/* INFO DE LA CUOTA */}
            <div className="bg-indigo-50 p-6 rounded-[2rem] border border-indigo-100 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">
                  {invoicesList.length > 1
                    ? `${invoicesList.length} Cuotas Seleccionadas`
                    : totalConcepts}
                </p>
                <p className="text-[9px] font-bold text-slate-500 uppercase">{totalConcepts}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase">Total a Liquidar</p>
                <p className="text-xl font-black text-indigo-600">
                  RD$ {totalAmount.toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                  <DollarSign size={12} className="text-emerald-500" /> Monto Recibido
                </label>
                <input
                  type="number"
                  required
                  value={formData.amount_paid}
                  onChange={(e) =>
                    setFormData({ ...formData, amount_paid: Number(e.target.value) })
                  }
                  className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-xl font-black focus:ring-2 focus:ring-indigo-600 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                  <CreditCard size={12} className="text-indigo-500" /> Método de Pago
                </label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                  className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-[10px] font-black focus:ring-2 focus:ring-indigo-600 transition-all appearance-none uppercase tracking-widest"
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                  <option value="check">Cheque</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                <Hash size={12} className="text-slate-400" /> Referencia (Opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: # Transacción o Cheque"
                value={formData.reference_number}
                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-xs font-black focus:ring-2 focus:ring-indigo-600 transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 flex items-center gap-2">
                <FileText size={12} className="text-slate-400" /> Notas adicionales
              </label>
              <textarea
                rows={2}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-xs font-bold focus:ring-2 focus:ring-indigo-600 transition-all resize-none"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-5 rounded-[2rem] flex items-center justify-center gap-3 font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-50 mt-4"
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <CheckCircle2 size={24} />
                  Confirmar y Liquidar {invoicesList.length} Facturas
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
