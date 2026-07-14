import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingDown,
  TrendingUp,
  Plus,
  Filter,
  Calendar,
  BookOpen,
  Settings2,
  Search,
  Download,
  Tag,
  Package,
  X,
  Trash2,
  Edit2,
  Printer,
  FileText,
  Zap
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useApp } from '../../context/AppContext';
import { useFinance } from '../../hooks/useFinance';

const translateMethod = (method: string) => {
  const m = String(method || '').toLowerCase().trim();
  if (m === 'cash') return 'EFECTIVO';
  if (m === 'transfer') return 'TRANSFERENCIA';
  if (m === 'card') return 'TARJETA';
  if (m === 'check') return 'CHEQUE';
  return m.toUpperCase() || 'EFECTIVO';
};

const groupLedgerEntries = (entriesList: any[]) => {
  const groupedMap = new Map<string, any>();

  entriesList.forEach((e) => {
    const key = `${e.account}_${e.item}_${e.date}_${e.method || 'cash'}`;

    if (groupedMap.has(key)) {
      const existing = groupedMap.get(key);
      existing.amount = Number(existing.amount) + Number(e.amount);
      
      if (e.account === 'INGRESOS: COLEGIATURAS') {
        existing.count = (existing.count || 1) + 1;
        existing.description = `Mensualidades (${existing.count} cuotas)`;
      } else {
        existing.description = `${existing.description} + ${e.description || ''}`;
      }
    } else {
      const copy = { ...e, amount: Number(e.amount), count: 1 };
      if (e.account === 'INGRESOS: COLEGIATURAS') {
        copy.description = `Mensualidad (1 cuota)`;
      } else {
        copy.description = e.description || '';
      }
      groupedMap.set(key, copy);
    }
  });

  return Array.from(groupedMap.values());
};

export const LedgerManager = () => {
  const [activeTab, setActiveTab] = useState(() => {
    const saved = localStorage.getItem('edugens_ledger_active_tab');
    return saved || 'daily';
  });

  const {
    ledgerCategories: categories,
    ledgerEntries: entries,
    saveLedgerCategory,
    deleteLedgerCategory,
    saveLedgerEntry,
    deleteLedgerEntry,
    loading
  } = useFinance({
    ledger: true
  });

  const hasSeeded = useRef(false);
  const hasMigrated = useRef(false);

  useEffect(() => {
    localStorage.setItem('edugens_ledger_active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!loading && categories.length === 0 && !hasSeeded.current) {
      hasSeeded.current = true;
      const defaultCats = [
        { name: 'INGRESOS: COLEGIATURAS', type: 'income', items: [] },
        { name: 'INGRESOS: INSCRIPCIONES', type: 'income', items: [] },
        { name: 'INGRESOS: UNIFORMES', type: 'income', items: [] },
        { name: 'INGRESOS: LIBROS', type: 'income', items: [] },
        { name: 'INGRESOS: MATERIALES', type: 'income', items: [] },
        { name: 'EGRESOS: SERVICIOS', type: 'expense', items: [] },
        { name: 'EGRESOS: NOMINA', type: 'expense', items: [] },
        { name: 'EGRESOS: INVENTARIO', type: 'expense', items: [] },
        { name: 'EGRESOS: OTROS', type: 'expense', items: [] }
      ];
      const seedDefaults = async () => {
        try {
          for (const cat of defaultCats) {
            if (!categories.some((c: any) => c.name === cat.name && c.type === cat.type)) {
              await saveLedgerCategory(cat);
            }
          }
        } catch (e) {
          console.error('Error seeding default ledger categories:', e);
        }
      };
      seedDefaults();
    }
  }, [loading, categories.length]);

  // RUTINA DE MIGRACIÓN: De LocalStorage a Supabase
  useEffect(() => {
    const localEntriesStr = localStorage.getItem('edugens_ledger_entries');
    if (!loading && localEntriesStr && !hasMigrated.current) {
      hasMigrated.current = true;
      try {
        const localEntries = JSON.parse(localEntriesStr);
        if (Array.isArray(localEntries) && localEntries.length > 0) {
          const migrateEntries = async () => {
            const toastId = toast.loading('Migrando transacciones locales del día a la base de datos...');
            try {
              for (const entry of localEntries) {
                await saveLedgerEntry({
                  date: entry.date,
                  account: entry.account,
                  item: entry.item,
                  description: entry.description || entry.desc || '',
                  type: entry.type,
                  amount: Number(entry.amount),
                  method: entry.method || 'cash'
                });
              }
              localStorage.removeItem('edugens_ledger_entries');
              toast.success('¡Historial local migrado con éxito a la base de datos!', { id: toastId });
            } catch (err) {
              console.error('Error migrating ledger entries:', err);
              toast.error('Error al migrar registros locales.', { id: toastId });
            }
          };
          migrateEntries();
        } else {
          localStorage.removeItem('edugens_ledger_entries');
        }
      } catch (e) {
        console.error('Error parsing local ledger entries:', e);
        localStorage.removeItem('edugens_ledger_entries');
      }
    }
  }, [loading]);

  if (loading && categories.length === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center shadow-xl shadow-slate-900/20">
              <BookOpen size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tighter">
                Libro Contable Maestro
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Gestión integral de ingresos y egresos
              </p>
            </div>
          </div>

          <div className="flex bg-slate-50 p-1.5 rounded-[1.5rem] border border-slate-100">
            {' '}
            <button
              onClick={() => setActiveTab('daily')}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'daily' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'
              }`}
            >
              Libro Diario
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                activeTab === 'config' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400'
              }`}
            >
              Cuentas
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'daily' && (
        <DailyLedger
          entries={entries}
          onSaveEntry={saveLedgerEntry}
          onDeleteEntry={deleteLedgerEntry}
          categories={categories}
        />
      )}
      {activeTab === 'config' && (
        <AccountsConfig
          categories={categories}
          onSaveCategory={saveLedgerCategory}
          onDeleteCategory={deleteLedgerCategory}
        />
      )}
    </div>
  );
};

const AccountsConfig = ({ categories, onSaveCategory, onDeleteCategory }: any) => {
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState('income');
  const [newItems, setNewItems] = useState<{ name: string; price: number }[]>([]);

  const handleSaveCategory = async () => {
    if (!newCatName) return toast.error('Escribe un nombre para la cuenta');
    const newCat = {
      ...(editingCategory?.id ? { id: editingCategory.id } : {}),
      name: newCatName,
      type: newCatType,
      items: newItems
    };
    try {
      await onSaveCategory(newCat);
      toast.success(editingCategory ? 'Cuenta actualizada' : 'Cuenta creada');
      resetModal();
    } catch (e) {
      console.error('Error saving category:', e);
    }
  };

  const resetModal = () => {
    setShowModal(false);
    setEditingCategory(null);
    setNewCatName('');
    setNewCatType('income');
    setNewItems([]);
  };

  const addItem = () => setNewItems([...newItems, { name: '', price: 0 }]);
  const removeItem = (idx: number) => setNewItems(newItems.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: string, val: any) => {
    const updated = [...newItems];
    updated[idx] = { ...updated[idx], [field]: val };
    setNewItems(updated);
  };

  const deleteCategory = async (id: string) => {
    if (window.confirm('¿Eliminar esta cuenta?')) {
      try {
        await onDeleteCategory(id);
        toast.success('Cuenta eliminada');
      } catch (e) {
        console.error('Error deleting category:', e);
      }
    }
  };

  return (
    <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm animate-fade-in relative">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h3 className="text-xl font-black uppercase tracking-tighter">Catálogo de Cuentas</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            Define tus conceptos de ingreso y egreso
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-3 bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 transition-all"
        >
          <Plus size={18} /> Nueva Cuenta
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((cat: any) => (
          <div
            key={cat.id}
            className="p-8 rounded-[2.5rem] border border-slate-100 bg-slate-50/30 relative"
          >
            <div className="flex justify-between items-start mb-6">
              <div
                className={`p-3 rounded-2xl ${cat.type === 'income' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}
              >
                {cat.type === 'income' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => deleteCategory(cat.id)}
                  className="p-2 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <h4 className="text-lg font-black text-slate-900 mb-4 uppercase tracking-tighter">
              {cat.name}
            </h4>
            <div className="space-y-2">
              {cat.items.map((item: any, idx: number) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-3 bg-white rounded-xl border border-slate-100"
                >
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {item.name}
                  </span>
                  <span className="text-[10px] font-black text-slate-900">
                    RD$ {item.price.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xl rounded-[3rem] p-10 shadow-2xl">
            <h3 className="text-xl font-black uppercase tracking-tighter mb-8">Nueva Cuenta</h3>
            <div className="space-y-6">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Nombre Cuenta"
                className="w-full px-6 py-4 bg-slate-50 rounded-2xl"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setNewCatType('income')}
                  className={`flex-1 py-4 rounded-2xl text-[10px] font-black ${newCatType === 'income' ? 'bg-emerald-500 text-white' : 'bg-slate-50'}`}
                >
                  INGRESOS
                </button>
                <button
                  onClick={() => setNewCatType('expense')}
                  className={`flex-1 py-4 rounded-2xl text-[10px] font-black ${newCatType === 'expense' ? 'bg-rose-500 text-white' : 'bg-slate-50'}`}
                >
                  EGRESOS
                </button>
              </div>
              <div>
                <div className="flex justify-between items-center mb-4">
                  <label className="text-[10px] font-black uppercase text-slate-400">Items</label>
                  <button onClick={addItem} className="text-indigo-600 text-[10px] font-black">
                    + AÑADIR
                  </button>
                </div>
                {newItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateItem(idx, 'name', e.target.value)}
                      className="flex-1 px-4 py-2 bg-slate-50 rounded-lg text-xs"
                      placeholder="Nombre"
                    />
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => updateItem(idx, 'price', Number(e.target.value))}
                      className="w-24 px-4 py-2 bg-slate-50 rounded-lg text-xs"
                      placeholder="Precio"
                    />
                    <button onClick={() => removeItem(idx)}>
                      <Trash2 size={14} className="text-rose-500" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                <button
                  onClick={resetModal}
                  className="flex-1 py-4 bg-slate-100 rounded-2xl text-xs font-black"
                >
                  CANCELAR
                </button>
                <button
                  onClick={handleSaveCategory}
                  className="flex-1 py-4 bg-slate-900 text-white rounded-2xl text-xs font-black"
                >
                  GUARDAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const getLocalDateString = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DailyLedger = ({ entries, onSaveEntry, onDeleteEntry, categories }: any) => {
  const { center, state } = useApp();

  const getStudentGrade = (studentFullName: string) => {
    const cleanName = (name: string) => (name || '').toLowerCase().trim();
    const targetName = cleanName(studentFullName);

    const std = state.students?.find((s) => {
      const fullName = cleanName(`${s.names} ${s.first_surname || ''}`);
      const fullNameWithSecond = cleanName(`${s.names} ${s.first_surname || ''} ${s.second_surname || ''}`);
      return fullName === targetName || fullNameWithSecond === targetName;
    });

    if (std && std.course_id) {
      const course = state.courses?.find((c) => c.id === std.course_id);
      return course ? course.name : '---';
    }
    return '---';
  };
  const [showModal, setShowModal] = useState(false);
  const [type, setType] = useState('income');
  const [selectedCat, setSelectedCat] = useState<any>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [amount, setAmount] = useState(0);
  const [startDate, setStartDate] = useState(getLocalDateString);
  const [endDate, setEndDate] = useState(getLocalDateString);
  const [accountFilter, setAccountFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [reportType, setReportType] = useState('detailed');
  const [methodFilter, setMethodFilter] = useState('all');
  const [entryDate, setEntryDate] = useState(getLocalDateString);

  useEffect(() => {
    if (showModal) {
      setEntryDate(getLocalDateString());
    }
  }, [showModal]);

  const handleGenerateCustomReport = () => {
    if (reportType === 'condensed') {
      handleCondensedCashClosing();
    } else {
      handleExportPDF();
    }
  };

  const filteredEntries = useMemo(() => {
    return entries.filter((e: any) => {
      const matchesDate = e.date >= startDate && e.date <= endDate;
      const matchesAccount = accountFilter === 'all' || e.account === accountFilter;
      const matchesMethod = methodFilter === 'all' || (e.method || 'cash') === methodFilter;
      const matchesSearch =
        (e.description || e.desc || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        e.item.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesDate && matchesAccount && matchesMethod && matchesSearch;
    });
  }, [entries, startDate, endDate, accountFilter, methodFilter, searchTerm]);

  const [quantity, setQuantity] = useState(1);
  const [discount, setDiscount] = useState(0);
  const [cart, setCart] = useState<any[]>([]);
  const [desc, setDesc] = useState('');

  const cartTotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + item.total, 0);
  }, [cart]);

  const handleAddToCart = () => {
    if (!selectedCat || !amount) return toast.error('Selecciona un producto');
    const newItem = {
      id: Date.now().toString(),
      account: selectedCat.name,
      name: selectedItem?.name || 'Varios',
      quantity,
      price: amount,
      discount,
      total: amount * quantity - discount
    };
    setCart([...cart, newItem]);
    // Reset temporal fields
    setAmount(0);
    setQuantity(1);
    setDiscount(0);
    setSelectedItem(null);
  };

  const removeFromCart = (id: string) => {
    setCart(cart.filter((i) => i.id !== id));
  };

  const handleSaveEntry = async () => {
    if (cart.length === 0) return toast.error('La canasta está vacía');

    const newEntry = {
      date: entryDate,
      account: cart[0].account, // Usamos la cuenta del primer item
      item: cart.map((i) => `${i.quantity}x ${i.name}`).join(', '),
      description: cart.some((i) => i.discount > 0) ? `${desc} (Incluye descuentos)` : desc,
      type,
      amount: cartTotal,
      method: 'cash'
    };

    try {
      await onSaveEntry(newEntry);
      toast.success('Transacción registrada con éxito');
      setShowModal(false);
      setCart([]);
      setDesc('');
    } catch (e) {
      console.error('Error saving ledger entry:', e);
    }
  };

  const handlePrintReceipt = (entry: any) => {
    const doc = new jsPDF({ format: [100, 150] });

    // ENCABEZADO
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(center?.name || 'EDUGEST SCHOOL', 50, 15, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(center?.address || 'Dirección del Centro Educativo', 50, 20, { align: 'center' });
    doc.text(
      `Tel: ${center?.phone || '809-000-0000'} | RNC: ${center?.rnc || '000-00000-0'}`,
      50,
      24,
      { align: 'center' }
    );
    doc.line(10, 26, 90, 26);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(entry.type === 'income' ? 'RECIBO DE INGRESO' : 'COMPROBANTE DE EGRESO', 10, 32);
    doc.text(`NO: ${entry.id.slice(-6).toUpperCase()}`, 70, 32);

    // CUERPO
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`FECHA: ${entry.date}`, 10, 42);
    doc.text(`CUENTA: ${entry.account}`, 10, 48);
    doc.text(`CONCEPTO: ${entry.item}`, 10, 54);

    doc.setFillColor(245, 245, 245);
    doc.rect(10, 65, 80, 12, 'F');
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`MONTO TOTAL: RD$ ${entry.amount.toLocaleString()}`, 15, 73);

    // FIRMAS
    doc.setFontSize(7);
    doc.line(15, 110, 45, 110);
    doc.text('FIRMA AUTORIZADA', 18, 114);

    doc.line(55, 110, 85, 110);
    doc.text('RECIBÍ CONFORME', 58, 114);

    doc.setFontSize(6);
    doc.text(`Impreso el: ${new Date().toLocaleString()}`, 10, 140);

    const blob = doc.output('bloburl');
    window.open(blob, '_blank');
  };

  const handleCashClosing = () => {
    const doc = new jsPDF();
    const closingDateText = startDate === endDate ? startDate : `${startDate} al ${endDate}`;
    if (filteredEntries.length === 0) return toast.error('Sin movimientos en el periodo seleccionado');

    // HEADER
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(center?.name || 'EDUGEST SCHOOL', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(center?.address || 'Dirección del Centro', 105, 26, { align: 'center' });
    doc.text(`Tel: ${center?.phone || '809-000-0000'}`, 105, 31, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('CUADRE DE CAJA CONTABLE', 14, 45);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`FECHA DE CIERRE: ${closingDateText}`, 14, 52);

    const groupedEntries = groupLedgerEntries(filteredEntries);

    autoTable(doc, {
      startY: 60,
      head: [['CUENTA', 'ALUMNO / CLIENTE', 'GRADO', 'DESCRIPCIÓN', 'MÉTODO DE PAGO', 'MONTO']],
      body: groupedEntries.map((e) => [
        e.account,
        e.item,
        getStudentGrade(e.item),
        e.description,
        translateMethod(e.method),
        `RD$ ${e.amount.toLocaleString()}`
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42] }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    doc.setFont('helvetica', 'bold');
    doc.line(14, finalY, 196, finalY);
    doc.text(
      `EFECTIVO EN CAJA: RD$ ${filteredEntries.reduce((acc, e) => acc + (e.type === 'income' ? e.amount : -e.amount), 0).toLocaleString()}`,
      196,
      finalY + 10,
      { align: 'right' }
    );

    // FIRMAS
    doc.line(30, finalY + 50, 80, finalY + 50);
    doc.text('ELABORADO POR', 38, finalY + 55);

    doc.line(130, finalY + 50, 180, finalY + 50);
    doc.text('REVISADO / SELLO', 140, finalY + 55);

    const blob = doc.output('bloburl');
    window.open(blob, '_blank');
  };

  const handleCondensedCashClosing = () => {
    const doc = new jsPDF({ format: [100, 150] });
    if (filteredEntries.length === 0)
      return toast.error('No hay movimientos en este rango de fechas');

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(center?.name || 'EDUGEST SCHOOL', 50, 15, { align: 'center' });
    doc.setFontSize(8);
    doc.text('RESUMEN CONTABLE CONDENSADO', 50, 22, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`PERIODO: ${startDate} al ${endDate}`, 50, 26, { align: 'center' });
    doc.line(10, 30, 90, 30);

    const summary: any = {};
    filteredEntries.forEach((e) => {
      if (!summary[e.account]) summary[e.account] = 0;
      summary[e.account] += e.type === 'income' ? e.amount : -e.amount;
    });

    let currentY = 40;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('CUENTA', 10, currentY);
    doc.text('TOTAL NETO', 90, currentY, { align: 'right' });
    doc.line(10, currentY + 2, 90, currentY + 2);
    currentY += 8;

    doc.setFont('helvetica', 'normal');
    Object.entries(summary).forEach(([account, total]: [string, any]) => {
      doc.text(account.substring(0, 25), 10, currentY);
      doc.text(`RD$ ${total.toLocaleString()}`, 90, currentY, { align: 'right' });
      currentY += 6;
    });

    const totalIncome = filteredEntries
      .filter((e) => e.type === 'income')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const totalExpense = filteredEntries
      .filter((e) => e.type === 'expense')
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const netBalance = totalIncome - totalExpense;

    currentY += 2;
    doc.line(10, currentY, 90, currentY);
    currentY += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('TOTAL INGRESOS:', 10, currentY);
    doc.text(`RD$ ${totalIncome.toLocaleString()}`, 90, currentY, { align: 'right' });
    currentY += 5;

    doc.text('TOTAL EGRESOS:', 10, currentY);
    doc.text(`RD$ ${totalExpense.toLocaleString()}`, 90, currentY, { align: 'right' });
    currentY += 5;

    doc.setFillColor(240, 240, 240);
    doc.rect(10, currentY - 4, 80, 6, 'F');
    doc.text('BALANCE DEL DÍA:', 12, currentY);
    doc.text(`RD$ ${netBalance.toLocaleString()}`, 88, currentY, { align: 'right' });
    currentY += 8;

    // DESGLOSE POR MÉTODO DE PAGO
    doc.line(10, currentY, 90, currentY);
    currentY += 6;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text('DESGLOSE POR MÉTODO:', 10, currentY);
    currentY += 6;

    const methodSummary: any = { cash: 0, transfer: 0, card: 0, check: 0 };
    filteredEntries.forEach((e) => {
      if (e.type === 'income') {
        const method = e.method || 'cash';
        if (methodSummary.hasOwnProperty(method)) methodSummary[method] += e.amount;
        else methodSummary['cash'] += e.amount;
      }
    });

    doc.setFont('helvetica', 'normal');
    const methodNames: any = {
      cash: 'Efectivo',
      transfer: 'Transferencia',
      card: 'Tarjeta',
      check: 'Cheque'
    };
    Object.entries(methodSummary).forEach(([method, total]: [string, any]) => {
      if (total > 0) {
        doc.text(methodNames[method] || method, 15, currentY);
        doc.text(`RD$ ${total.toLocaleString()}`, 90, currentY, { align: 'right' });
        currentY += 5;
      }
    });

    doc.line(10, currentY + 2, 90, currentY + 2);
    currentY += 10;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setFillColor(245, 245, 245);
    doc.rect(10, currentY - 6, 80, 10, 'F');
    const grandTotal = filteredEntries.reduce(
      (acc, e) => acc + (e.type === 'income' ? e.amount : -e.amount),
      0
    );
    doc.text(`BALANCE: RD$ ${grandTotal.toLocaleString()}`, 50, currentY, { align: 'center' });

    currentY += 25;
    doc.line(15, currentY, 45, currentY);
    doc.setFontSize(6);
    doc.text('CONTABILIDAD', 22, currentY + 4);
    doc.line(55, currentY, 85, currentY);
    doc.text('DIRECCIÓN', 65, currentY + 4);

    const blob = doc.output('bloburl');
    window.open(blob, '_blank');
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();

    // HEADER
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(center?.name || 'EDUGEST SCHOOL', 105, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(center?.address || 'Dirección del Centro', 105, 26, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.text('REPORTE CONTABLE AGRUPADO', 14, 40);
    doc.setFont('helvetica', 'normal');
    doc.text(`Periodo: ${startDate} al ${endDate}`, 14, 46);

    const groupedEntries = groupLedgerEntries(filteredEntries);

    const grouped: any = {};
    groupedEntries.forEach((e) => {
      if (!grouped[e.account]) grouped[e.account] = [];
      grouped[e.account].push(e);
    });

    let currentY = 55;
    Object.keys(grouped).forEach((accountName) => {
      const accountEntries = grouped[accountName];
      const accountTotal = accountEntries.reduce(
        (acc: any, e: any) => acc + (e.type === 'income' ? e.amount : -e.amount),
        0
      );

      autoTable(doc, {
        startY: currentY,
        head: [
          [{ content: `CUENTA: ${accountName}`, colSpan: 6, styles: { fillColor: [79, 70, 229] } }]
        ],
        body: accountEntries.map((e: any) => [
          e.date,
          e.item,
          getStudentGrade(e.item),
          e.description,
          translateMethod(e.method),
          `RD$ ${e.amount.toLocaleString()}`
        ]),
        foot: [['', '', '', '', 'TOTAL CUENTA:', `RD$ ${accountTotal.toLocaleString()}`]],
        footStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold' }
      });
      currentY = (doc as any).lastAutoTable.finalY + 10;
    });

    // FIRMAS AL FINAL DEL REPORTE
    if (currentY > 250) doc.addPage();
    const footerY = Math.min(currentY + 20, 270);
    doc.line(30, footerY, 80, footerY);
    doc.text('CONTABILIDAD', 42, footerY + 5);
    doc.line(130, footerY, 180, footerY);
    doc.text('DIRECCIÓN / SELLO', 140, footerY + 5);

    const blob = doc.output('bloburl');
    window.open(blob, '_blank');
  };

  const handleExportCSV = () => {
    const groupedEntries = groupLedgerEntries(filteredEntries);
    if (groupedEntries.length === 0) return toast.error('No hay movimientos para exportar');

    const headers = ['FECHA', 'CUENTA', 'ALUMNO_CLIENTE', 'GRADO', 'DESCRIPCION', 'METODO_PAGO', 'TIPO', 'MONTO'];
    const rows = groupedEntries.map((e) => [
      e.date,
      e.account,
      e.item,
      getStudentGrade(e.item),
      e.description,
      translateMethod(e.method),
      e.type === 'income' ? 'INGRESO' : 'EGRESO',
      e.amount
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((val) => `"${String(val || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const closingDateText = startDate === endDate ? startDate : `${startDate}_al_${endDate}`;
    link.setAttribute('download', `Cuadre_Caja_${closingDateText}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Archivo de Excel (CSV) descargado con éxito.');
  };

  return (
    <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm animate-fade-in relative">
      <div className="flex flex-col gap-6 mb-10">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setType('income');
                setShowModal(true);
              }}
              className="flex items-center gap-3 bg-emerald-500 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-100"
            >
              <TrendingUp size={18} /> Ingreso
            </button>
            <button
              onClick={() => {
                setType('expense');
                setShowModal(true);
              }}
              className="flex items-center gap-3 bg-rose-500 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-rose-100"
            >
              <TrendingDown size={18} /> Egreso
            </button>
            <button
              onClick={handleCashClosing}
              className="flex items-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl"
              title="Cuadre Diario Consolidado"
            >
              <Zap size={18} className="text-amber-400" /> Cuadre Diario
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-3 rounded-[2rem] border border-slate-100">
            <div className="flex items-center gap-2 px-4 border-r border-slate-200">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-transparent border-none text-[10px] font-black uppercase focus:ring-0 w-32"
              />
            </div>
            <div className="flex items-center gap-2 px-4 border-r border-slate-200">
              <Calendar size={16} className="text-slate-400" />
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-[9px] font-black focus:ring-0 p-0"
                />
                <span className="text-[9px] font-black text-slate-300">A</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-[9px] font-black focus:ring-0 p-0"
                />
              </div>
            </div>
          </div>
        </div>

        {/* GENERADOR DE REPORTES CONFIGURABLE */}
        <div className="bg-indigo-50/50 p-6 rounded-[2.5rem] border border-indigo-100/50 flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest px-2">
                Tipo de Reporte
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="bg-white border-none text-[10px] font-black uppercase rounded-xl px-4 py-2 shadow-sm focus:ring-2 focus:ring-indigo-500 w-40"
              >
                <option value="detailed">Reporte Detallado</option>
                <option value="condensed">Reporte Consolidado</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest px-2">
                Método de Pago
              </label>
              <select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                className="bg-white border-none text-[10px] font-black uppercase rounded-xl px-4 py-2 shadow-sm focus:ring-2 focus:ring-indigo-500 w-40"
              >
                <option value="all">Todos los Métodos</option>
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta</option>
                <option value="check">Cheque</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-black text-indigo-400 uppercase tracking-widest px-2">
                Filtrar Cuenta
              </label>
              <select
                value={accountFilter}
                onChange={(e) => setAccountFilter(e.target.value)}
                className="bg-white border-none text-[10px] font-black uppercase rounded-xl px-4 py-2 shadow-sm focus:ring-2 focus:ring-indigo-500 w-44"
              >
                <option value="all">Todas las Cuentas</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleGenerateCustomReport}
              className="flex items-center gap-3 bg-indigo-600 text-white px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-slate-900 transition-all transform active:scale-95"
            >
              <Download size={18} /> Generar Reporte
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-3 bg-emerald-600 text-white px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-100 hover:bg-slate-900 transition-all transform active:scale-95"
            >
              <FileText size={18} /> Exportar a Excel
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
              <th className="px-8 py-5">Fecha</th>
              <th className="px-8 py-5">Cuenta / Concepto</th>
              <th className="px-8 py-5">Descripción</th>
              <th className="px-8 py-5 text-right">Entrada (+)</th>
              <th className="px-8 py-5 text-right">Salida (-)</th>
              <th className="px-8 py-5 text-right">Acción</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredEntries.map((entry: any) => (
              <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-8 py-5 text-[10px] font-bold text-slate-400">{entry.date}</td>
                <td className="px-8 py-5">
                  <p className="text-xs font-black text-slate-900 uppercase">{entry.account}</p>
                  <p className="text-[9px] font-bold text-indigo-500 uppercase">{entry.item}</p>
                </td>
                <td className="px-8 py-5 text-[10px] font-bold text-slate-500 uppercase">
                  {entry.description || entry.desc}
                </td>
                <td className="px-8 py-5 text-right font-black text-emerald-600 text-sm">
                  {entry.type === 'income' ? `RD$ ${entry.amount.toLocaleString()}` : '-'}
                </td>
                <td className="px-8 py-5 text-right font-black text-rose-600 text-sm">
                  {entry.type === 'expense' ? `RD$ ${entry.amount.toLocaleString()}` : '-'}
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handlePrintReceipt(entry)}
                      className="p-2 text-slate-400 hover:text-indigo-600"
                    >
                      <Printer size={16} />
                    </button>
                    <button
                      onClick={async () => {
                        if (window.confirm('¿Anular este movimiento contable?')) {
                          try {
                            await onDeleteEntry(entry.id);
                            toast.success('Movimiento anulado');
                          } catch (e) {
                            console.error(e);
                          }
                        }
                      }}
                      className="p-2 text-slate-300 hover:text-rose-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 sm:p-6">
          <div className="bg-white w-full max-w-xl rounded-[3rem] p-8 sm:p-10 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[95vh] flex flex-col overflow-hidden">
            <div className="flex justify-between items-center mb-8 shrink-0">
              <h3 className="text-xl font-black uppercase tracking-tighter">
                Registrar {type === 'income' ? 'Ingreso' : 'Egreso'}
              </h3>
              <button
                onClick={() => {
                  setShowModal(false);
                  setCart([]);
                }}
                className="p-2 hover:bg-slate-50 rounded-full text-slate-400"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto pr-2 custom-scrollbar flex-1">
              <select
                className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-600"
                onChange={(e) => {
                  const cat = categories.find((c: any) => c.id === e.target.value);
                  setSelectedCat(cat);
                  setSelectedItem(null);
                }}
              >
                <option value="">-- Seleccionar Cuenta --</option>
                {categories
                  .filter((c: any) => c.type === type)
                  .map((cat: any) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>

              {selectedCat && (
                <select
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-600"
                  onChange={(e) => {
                    const item = selectedCat.items.find((i: any) => i.name === e.target.value);
                    setSelectedItem(item);
                    if (item) setAmount(item.price);
                  }}
                >
                  <option value="">-- Seleccionar Concepto --</option>
                  {selectedCat.items.map((item: any, i: number) => (
                    <option key={i} value={item.name}>
                      {item.name} (RD$ {item.price})
                    </option>
                  ))}
                </select>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">
                    Cantidad
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">
                    Descuento (RD$)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-600"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">
                  Precio Unitario (RD$)
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="flex-1 px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-600"
                  />
                  <button
                    onClick={handleAddToCart}
                    className="bg-indigo-600 text-white px-6 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-lg shadow-indigo-100"
                  >
                    Añadir
                  </button>
                </div>
              </div>

              {/* LISTA DE LA CANASTA */}
              <div className="space-y-3 border-y border-slate-100 py-4">
                {cart.length === 0 && (
                  <p className="text-center text-[10px] text-slate-300 py-4 uppercase font-bold">
                    La canasta está vacía
                  </p>
                )}
                {cart.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100 group"
                  >
                    <div>
                      <p className="text-[10px] font-black text-slate-900 uppercase">
                        {item.quantity}x {item.name}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase">
                        Unit: RD$ {item.price.toLocaleString()}{' '}
                        {item.discount > 0 && `(-RD$ ${item.discount})`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xs font-black text-slate-900">
                        RD$ {item.total.toLocaleString()}
                      </p>
                      <button onClick={() => removeFromCart(item.id)} className="text-rose-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-slate-900 p-6 rounded-[2rem] flex justify-between items-center text-white shadow-xl shrink-0">
                <div>
                  <p className="text-[10px] font-bold uppercase opacity-50">Total Transacción</p>
                  <p className="text-xl font-black">RD$ {cartTotal.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase opacity-50">
                    {cart.length} Products
                  </p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">
                  Fecha de la Transacción
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-600"
                />
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">
                  Nota / Comentario
                </label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  className="w-full px-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-600 h-20"
                  placeholder="Ej: Pago de uniformes..."
                />
              </div>
            </div>

            <div className="flex gap-4 pt-6 mt-2 border-t border-slate-50 shrink-0">
              <button
                onClick={() => {
                  setShowModal(false);
                  setCart([]);
                }}
                className="flex-1 py-4 bg-slate-100 rounded-2xl text-xs font-black uppercase"
              >
                CANCELAR
              </button>
              <button
                onClick={handleSaveEntry}
                disabled={cart.length === 0}
                className={`flex-1 py-4 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all ${cart.length > 0 ? (type === 'income' ? 'bg-emerald-600' : 'bg-rose-600') : 'bg-slate-200 cursor-not-allowed'}`}
              >
                REGISTRAR COBRO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
