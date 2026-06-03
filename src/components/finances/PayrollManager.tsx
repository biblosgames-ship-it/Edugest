import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingDown,
  Search,
  Plus,
  Tag,
  Trash2,
  Users,
  Wallet,
  CheckCircle2,
  Settings,
  Percent,
  DollarSign,
  Download,
  Printer,
  X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { useApp } from '../../context/AppContext';

export const PayrollManager = () => {
  const { state, center } = useApp();
  const [activeTab, setActiveTab] = useState('master'); // master | config
  const [search, setSearch] = useState('');

  // 1. Conceptos de Nómina (TSS, Seguro, Bonos, etc.)
  const [concepts, setConcepts] = useState<any[]>(() => {
    const saved = localStorage.getItem('edugens_payroll_concepts');
    return saved
      ? JSON.parse(saved)
      : [
          {
            id: 'tss',
            name: 'TSS (Seguro Vejez)',
            type: 'deduction',
            valueType: 'percent',
            value: 2.87
          },
          {
            id: 'sfs',
            name: 'SFS (Seguro Salud)',
            type: 'deduction',
            valueType: 'percent',
            value: 3.04
          }
        ];
  });

  // 2. Nómina Maestra (Configuración fija por empleado)
  const [masterPayroll, setMasterPayroll] = useState<any[]>(() => {
    const saved = localStorage.getItem('edugens_payroll_master');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('edugens_payroll_concepts', JSON.stringify(concepts));
  }, [concepts]);

  useEffect(() => {
    localStorage.setItem('edugens_payroll_master', JSON.stringify(masterPayroll));
  }, [masterPayroll]);

  // Filtrar personal disponible
  const availableStaff = useMemo(() => {
    return (state.teachers || []).filter(
      (t) =>
        !masterPayroll.find((m) => m.id === t.id) &&
        t.full_name.toLowerCase().includes(search.toLowerCase())
    );
  }, [state.teachers, masterPayroll, search]);

  const addToMaster = (emp: any) => {
    const newEntry = {
      id: emp.id,
      full_name: emp.full_name,
      role: emp.role,
      baseSalary: 0,
      appliedConcepts: concepts.map((c) => c.id), // Por defecto aplicamos TSS/SFS si existen
      customAdjustments: []
    };
    setMasterPayroll([...masterPayroll, newEntry]);
    toast.success(`${emp.full_name} añadido a la nómina maestra`);
  };

  const removeFromMaster = (id: string) => {
    if (window.confirm('¿Eliminar a este empleado de la nómina maestra?')) {
      setMasterPayroll(masterPayroll.filter((m) => m.id !== id));
    }
  };

  const updateMasterEntry = (id: string, field: string, value: any) => {
    setMasterPayroll(masterPayroll.map((m) => (m.id === id ? { ...m, [field]: value } : m)));
  };

  const toggleConceptForEmployee = (empId: string, conceptId: string) => {
    setMasterPayroll(
      masterPayroll.map((m) => {
        if (m.id === empId) {
          const concepts = m.appliedConcepts.includes(conceptId)
            ? m.appliedConcepts.filter((id: string) => id !== conceptId)
            : [...m.appliedConcepts, conceptId];
          return { ...m, appliedConcepts: concepts };
        }
        return m;
      })
    );
  };

  // Cálculos de Nómina
  const calculateNet = (emp: any) => {
    const base = Number(emp.baseSalary) || 0;
    let additions = 0;
    let deductions = 0;

    emp.appliedConcepts.forEach((cId: string) => {
      const concept = concepts.find((c) => c.id === cId);
      if (!concept) return;

      const value =
        concept.valueType === 'percent' ? base * (concept.value / 100) : Number(concept.value);

      if (concept.type === 'bonus') additions += value;
      else deductions += value;
    });

    return {
      bruto: base,
      additions,
      deductions,
      net: base + additions - deductions
    };
  };

  const handleProcessMonth = () => {
    const readyToPay = masterPayroll.filter((m) => m.baseSalary > 0);
    if (readyToPay.length === 0) return toast.error('Configura los sueldos en la Nómina Maestra');

    const currentEntries = JSON.parse(localStorage.getItem('edugens_ledger_entries') || '[]');
    const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date());

    const newEntries = readyToPay.map((emp) => {
      const { bruto, additions, deductions, net } = calculateNet(emp);
      return {
        id: `PAY-${Date.now()}-${emp.id}`,
        date: new Date().toISOString().split('T')[0],
        account: 'Nómina',
        item: `NÓMINA ${monthName.toUpperCase()}: ${emp.full_name}`,
        desc: `Bruto: ${bruto} | Bonos: ${additions.toFixed(2)} | Deduc: ${deductions.toFixed(2)} (Neto: ${net.toFixed(2)})`,
        type: 'expense',
        amount: net
      };
    });

    localStorage.setItem(
      'edugens_ledger_entries',
      JSON.stringify([...newEntries, ...currentEntries])
    );
    toast.success(`Nómina de ${monthName} procesada con éxito`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF('l', 'mm', 'a4');
    // center is destructured from useApp() at the component level
    const monthName = new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date());

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(center?.name || 'EDUGEST SCHOOL', 148, 20, { align: 'center' });
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `REPORTE DE NÓMINA INSTITUCIONAL - ${monthName.toUpperCase()} ${new Date().getFullYear()}`,
      148,
      26,
      { align: 'center' }
    );
    doc.text(
      `RNC: ${center?.rnc || '000-00000-0'} | Tel: ${center?.phone || '809-000-0000'}`,
      148,
      31,
      { align: 'center' }
    );

    const tableBody = masterPayroll.map((emp) => {
      const calcs = calculateNet(emp);
      return [
        emp.full_name.toUpperCase(),
        emp.role.toUpperCase(),
        `RD$ ${calcs.bruto.toLocaleString()}`,
        `RD$ ${calcs.additions.toLocaleString()}`,
        `RD$ ${calcs.deductions.toLocaleString()}`,
        `RD$ ${calcs.net.toLocaleString()}`
      ];
    });

    autoTable(doc, {
      startY: 40,
      head: [['EMPLEADO', 'CARGO', 'BRUTO', 'BONOS', 'DEDUCCIONES', 'NETO A PAGAR']],
      body: tableBody,
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], fontSize: 8 },
      styles: { fontSize: 8 },
      columnStyles: {
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right', fontStyle: 'bold' }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 30;
    doc.line(40, finalY, 110, finalY);
    doc.text('PREPARADO POR / CONTABILIDAD', 45, finalY + 5);

    doc.line(180, finalY, 250, finalY);
    doc.text('AUTORIZADO POR / DIRECCIÓN', 185, finalY + 5);

    doc.save(`Nomina_${monthName}_${new Date().getFullYear()}.pdf`);
  };

  const exportToExcel = () => {
    const data = masterPayroll.map((emp) => {
      const calcs = calculateNet(emp);
      const row: any = {
        Empleado: emp.full_name,
        Cargo: emp.role,
        'Sueldo Bruto': calcs.bruto,
        'Total Bonos': calcs.additions,
        'Total Deducciones': calcs.deductions,
        'Neto a Pagar': calcs.net
      };

      // Añadir detalle de conceptos
      concepts.forEach((c) => {
        const isApplied = emp.appliedConcepts.includes(c.id);
        const val = isApplied
          ? c.valueType === 'percent'
            ? calcs.bruto * (c.value / 100)
            : c.value
          : 0;
        row[c.name] = val;
      });

      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nomina');
    XLSX.writeFile(wb, `Nomina_Edugest_${new Date().getFullYear()}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      {/* NAVEGACIÓN SUB-TABS */}
      <div className="flex bg-slate-100 p-1.5 rounded-[2rem] w-fit mx-auto border border-slate-200">
        <button
          onClick={() => setActiveTab('master')}
          className={`flex items-center gap-2 px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'master' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400'
          }`}
        >
          <Users size={14} /> Nómina Maestra
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`flex items-center gap-2 px-8 py-3 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'config' ? 'bg-white text-slate-900 shadow-lg' : 'text-slate-400'
          }`}
        >
          <Settings size={14} /> Conceptos y TSS
        </button>
      </div>

      {activeTab === 'master' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* PANEL IZQUIERDO: AÑADIR PERSONAL */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
              <h3 className="text-[10px] font-black uppercase text-slate-400 mb-6 tracking-widest">
                Añadir a Nómina
              </h3>
              <div className="relative mb-6">
                <Search
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={14}
                />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-[10px] font-bold focus:ring-2 focus:ring-indigo-600"
                />
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {availableStaff.map((emp: any) => (
                  <div
                    key={emp.id}
                    onClick={() => addToMaster(emp)}
                    className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50 cursor-pointer transition-all group"
                  >
                    <p className="text-[10px] font-black text-slate-900 uppercase mb-1">
                      {emp.full_name}
                    </p>
                    <p className="text-[8px] font-bold text-slate-400 uppercase">{emp.role}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PANEL DERECHO: NÓMINA MAESTRA */}
          <div className="lg:col-span-9 space-y-6">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm min-h-[600px]">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h2 className="text-xl font-black uppercase tracking-tighter">
                    Nómina Fija Institucional
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Configuración permanente de pagos
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={exportToExcel}
                    className="bg-emerald-100 text-emerald-700 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-200 transition-all flex items-center gap-2"
                  >
                    <Download size={16} /> Excel
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="bg-rose-100 text-rose-700 px-6 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-200 transition-all flex items-center gap-2"
                  >
                    <Printer size={16} /> PDF
                  </button>
                  <button
                    onClick={handleProcessMonth}
                    className="bg-emerald-600 text-white px-10 py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-emerald-100 hover:scale-105 transition-all flex items-center gap-3"
                  >
                    <CheckCircle2 size={18} /> Procesar Mes
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-6">
                      <th className="pb-4 pl-6">Empleado</th>
                      <th className="pb-4">Sueldo Bruto</th>
                      <th className="pb-4">Conceptos Aplicados</th>
                      <th className="pb-4 text-right pr-6">Neto Estimado</th>
                      <th className="pb-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {masterPayroll.map((emp: any) => {
                      const calculations = calculateNet(emp);
                      return (
                        <tr
                          key={emp.id}
                          className="bg-slate-50/50 hover:bg-white hover:shadow-xl hover:shadow-slate-100/50 transition-all group"
                        >
                          <td className="py-6 pl-6 rounded-l-[2rem]">
                            <p className="text-[11px] font-black text-slate-900 uppercase mb-1">
                              {emp.full_name}
                            </p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase">
                              {emp.role}
                            </p>
                          </td>
                          <td className="py-6">
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-xl border border-slate-100 w-32">
                              <span className="text-[10px] font-black text-slate-300">RD$</span>
                              <input
                                type="number"
                                value={emp.baseSalary}
                                onChange={(e) =>
                                  updateMasterEntry(emp.id, 'baseSalary', e.target.value)
                                }
                                className="bg-transparent border-none p-0 text-[11px] font-black text-slate-900 w-full focus:ring-0"
                              />
                            </div>
                          </td>
                          <td className="py-6">
                            <div className="flex flex-wrap gap-1">
                              {concepts.map((concept: any) => {
                                const isApplied = emp.appliedConcepts.includes(concept.id);
                                return (
                                  <button
                                    key={concept.id}
                                    onClick={() => toggleConceptForEmployee(emp.id, concept.id)}
                                    className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all border ${
                                      isApplied
                                        ? 'bg-indigo-600 border-indigo-600 text-white'
                                        : 'bg-white border-slate-200 text-slate-400 opacity-40 grayscale'
                                    }`}
                                  >
                                    {concept.name}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                          <td className="py-6 text-right pr-6">
                            <p className="text-[12px] font-black text-slate-900">
                              RD$ {calculations.net.toLocaleString()}
                            </p>
                            <p className="text-[8px] font-bold text-rose-500 uppercase">
                              Deduc: RD$ {calculations.deductions.toFixed(2)}
                            </p>
                          </td>
                          <td className="py-6 rounded-r-[2rem] pr-6 text-right">
                            <button
                              onClick={() => removeFromMaster(emp.id)}
                              className="p-2 text-slate-300 hover:text-rose-500 transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {masterPayroll.length === 0 && (
                <div className="py-32 text-center text-slate-300">
                  <Wallet size={48} className="mx-auto mb-4 opacity-10" />
                  <p className="text-[10px] font-black uppercase tracking-widest">
                    Configura tu nómina maestra añadiendo personal
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* CONFIGURACIÓN DE CONCEPTOS */
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tighter">
                  Conceptos Globales
                </h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Define TSS, Seguros, Bonos y Retenciones
                </p>
              </div>
              <button
                onClick={() =>
                  setConcepts([
                    ...concepts,
                    {
                      id: Date.now().toString(),
                      name: 'Nuevo Concepto',
                      type: 'deduction',
                      valueType: 'percent',
                      value: 0
                    }
                  ])
                }
                className="flex items-center gap-3 bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 transition-all"
              >
                <Plus size={18} /> Crear Nuevo Concepto
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {concepts.map((concept: any, idx: number) => (
                <div
                  key={concept.id}
                  className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 relative group"
                >
                  <button
                    onClick={() => setConcepts(concepts.filter((c) => c.id !== concept.id))}
                    className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X size={14} />
                  </button>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[8px] font-black uppercase text-slate-400 mb-2 block">
                        Nombre del Concepto
                      </label>
                      <input
                        type="text"
                        value={concept.name}
                        onChange={(e) => {
                          const updated = [...concepts];
                          updated[idx].name = e.target.value;
                          setConcepts(updated);
                        }}
                        className="w-full bg-white border-slate-200 rounded-xl px-4 py-3 text-[11px] font-black text-slate-900 focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[8px] font-black uppercase text-slate-400 mb-2 block">
                          Tipo
                        </label>
                        <select
                          value={concept.type}
                          onChange={(e) => {
                            const updated = [...concepts];
                            updated[idx].type = e.target.value;
                            setConcepts(updated);
                          }}
                          className="w-full bg-white border-slate-200 rounded-xl px-4 py-3 text-[10px] font-black uppercase focus:ring-2 focus:ring-indigo-600"
                        >
                          <option value="deduction">DEDUCCIÓN (-)</option>
                          <option value="bonus">BONO (+)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[8px] font-black uppercase text-slate-400 mb-2 block">
                          Cálculo por
                        </label>
                        <div className="flex bg-white rounded-xl border border-slate-200 p-1">
                          <button
                            onClick={() => {
                              const updated = [...concepts];
                              updated[idx].valueType = 'percent';
                              setConcepts(updated);
                            }}
                            className={`flex-1 py-2 rounded-lg flex items-center justify-center transition-all ${concept.valueType === 'percent' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                          >
                            <Percent size={14} />
                          </button>
                          <button
                            onClick={() => {
                              const updated = [...concepts];
                              updated[idx].valueType = 'fixed';
                              setConcepts(updated);
                            }}
                            className={`flex-1 py-2 rounded-lg flex items-center justify-center transition-all ${concept.valueType === 'fixed' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
                          >
                            <DollarSign size={14} />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[8px] font-black uppercase text-slate-400 mb-2 block">
                        Valor ({concept.valueType === 'percent' ? '%' : 'RD$'})
                      </label>
                      <input
                        type="number"
                        value={concept.value}
                        onChange={(e) => {
                          const updated = [...concepts];
                          updated[idx].value = Number(e.target.value);
                          setConcepts(updated);
                        }}
                        className="w-full bg-white border-slate-200 rounded-xl px-4 py-3 text-[11px] font-black text-slate-900 focus:ring-2 focus:ring-indigo-600"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
