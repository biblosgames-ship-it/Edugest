import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft,
  Download,
  TrendingUp,
  Users,
  Briefcase,
  AlertTriangle,
  Calendar,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  CalendarDays,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface ReportProps {
  onClose: () => void;
}

export const GlobalAdminDashboardReport: React.FC<ReportProps> = ({ onClose }) => {
  const { state, center, selectedYear } = useApp();
  
  // Rango de fechas por defecto: últimos 30 días
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [loading, setLoading] = useState(false);
  const [studentsList, setStudentsList] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [activitiesList, setActivitiesList] = useState<any[]>([]);

  const courses = state.courses || [];

  const fetchData = async () => {
    if (!center?.id) return;
    setLoading(true);
    try {
      // 1. Alumnos inscritos en el rango o históricos hasta endDate
      const { data: stds, error: stdErr } = await supabase
        .from('students')
        .select('id, names, first_surname, course_id, school_year, created_at')
        .eq('center_id', center.id)
        .eq('school_year', selectedYear || '2026-2027')
        .lte('created_at', `${endDate}T23:59:59Z`);

      if (stdErr) throw stdErr;
      setStudentsList(stds || []);

      // 2. Personal registrado histórico hasta endDate
      const { data: staff, error: staffErr } = await supabase
        .from('teachers')
        .select('id, names, role, sex, created_at')
        .eq('center_id', center.id)
        .lte('created_at', `${endDate}T23:59:59Z`);

      if (staffErr) throw staffErr;
      setStaffList(staff || []);

      // 3. Entradas contables en el rango de fechas
      const { data: ledger, error: ledgerErr } = await supabase
        .from('finance_ledger_entries')
        .select('*')
        .eq('center_id', center.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (ledgerErr) throw ledgerErr;
      setLedgerEntries(ledger || []);

      // 4. Actividades de agenda e incidencias en el rango de fechas
      const { data: acts, error: actErr } = await supabase
        .from('activities')
        .select('*')
        .eq('center_id', center.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (actErr) throw actErr;
      setActivitiesList(acts || []);

    } catch (err: any) {
      console.error('Error fetching dashboard data:', err);
      toast.error('Error al cargar datos del reporte: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate, center?.id, selectedYear]);

  // --- Mapeo y Memorización de Datos para Gráficos ---

  // 1. Alumnos por grado (BarChart)
  const studentsByGradeData = useMemo(() => {
    const counts: { [key: string]: number } = {};
    studentsList.forEach((s) => {
      const course = courses.find((c) => c.id === s.course_id);
      const gradeName = course ? `${course.grade} "${course.section}"` : 'Sin Grado';
      counts[gradeName] = (counts[gradeName] || 0) + 1;
    });
    // Ordenar de mayor a menor para presentación limpia
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Cerca de los 10 principales para no colapsar el gráfico
  }, [studentsList, courses]);

  // 2. Personal por área (Cantidad)
  const staffByAreaData = useMemo(() => {
    const personnel = staffList;
    return [
      { name: 'Equipo Directivo', value: personnel.filter((p) => p.role === 'management' || p.role === 'management_teacher').length },
      { name: 'Cuerpo Docente', value: personnel.filter((p) => p.role === 'teacher' || p.role === 'management_teacher').length },
      { name: 'Personal Administrativo', value: personnel.filter((p) => p.role === 'administrative').length },
      { name: 'Personal de Apoyo', value: personnel.filter((p) => p.role === 'support').length }
    ];
  }, [staffList]);

  // 3. Reporte financiero de ingresos y gastos
  const financeData = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    const breakdown: { [key: string]: { name: string; income: number; expense: number } } = {};

    ledgerEntries.forEach((entry) => {
      const amt = Number(entry.amount);
      const acc = entry.account || 'Otros';
      if (!breakdown[acc]) {
        breakdown[acc] = { name: acc, income: 0, expense: 0 };
      }

      if (entry.type === 'income') {
        totalIncome += amt;
        breakdown[acc].income += amt;
      } else if (entry.type === 'expense') {
        totalExpense += amt;
        breakdown[acc].expense += amt;
      }
    });

    const accountsList = Object.values(breakdown);
    const summaryPieData = [
      { name: 'Ingresos', value: totalIncome, color: '#10B981' },
      { name: 'Gastos', value: totalExpense, color: '#EF4444' }
    ];

    return {
      totalIncome,
      totalExpense,
      netBalance: totalIncome - totalExpense,
      accountsList,
      summaryPieData
    };
  }, [ledgerEntries]);

  // 4. Agenda y Actividades
  const agendaData = useMemo(() => {
    const activities = activitiesList;
    const incidents = activities.filter((a) => a.type === 'incident');
    const normalActivities = activities.filter((a) => a.type !== 'incident');
    return {
      totalActivities: activities.length,
      totalIncidents: incidents.length,
      incidents,
      normalActivities
    };
  }, [activitiesList]);

  const COLORS = ['#4F46E5', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6'];

  const modalContent = (
    <div className="fixed inset-0 z-[99999] bg-slate-50 block overflow-y-auto pb-20">
      {/* Encabezado */}
      <div className="bg-white px-6 py-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between sticky top-0 z-10 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500 cursor-pointer"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black text-slate-800 uppercase tracking-tight">
              Dashboard Global Administrativo
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Análisis Consolidado de Matrícula, Personal, Finanzas y Agenda
            </p>
          </div>
        </div>

        {/* Selector de Rango de Fechas */}
        <div className="flex flex-wrap items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Desde</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-1.5 outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Hasta</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg p-1.5 outline-none focus:border-indigo-500"
            />
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center text-slate-400 space-y-4">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-black uppercase tracking-widest animate-pulse">
              Consolidando información escolar...
            </p>
          </div>
        ) : (
          <>
            {/* 1. FILA DE CONTADORES (KPIs) */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
                  <Users size={20} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Matrícula Activa
                  </p>
                  <p className="text-2xl font-black text-slate-900">{studentsList.length}</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">Ciclo: {selectedYear}</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center mb-4">
                  <Briefcase size={20} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Personal Registrado
                  </p>
                  <p className="text-2xl font-black text-slate-900">{staffList.length}</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">Directivos y Profesores</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                  <ArrowUpRight size={20} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Total Ingresos
                  </p>
                  <p className="text-2xl font-black text-emerald-600">RD$ {financeData.totalIncome.toLocaleString()}</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">En el rango seleccionado</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                <div className="w-10 h-10 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mb-4">
                  <ArrowDownRight size={20} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Total Gastos
                  </p>
                  <p className="text-2xl font-black text-rose-600">RD$ {financeData.totalExpense.toLocaleString()}</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">En el rango seleccionado</p>
                </div>
              </div>

              <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between col-span-2 lg:col-span-1">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${financeData.netBalance >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                  <DollarSign size={20} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                    Balance Neto
                  </p>
                  <p className={`text-2xl font-black ${financeData.netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    RD$ {financeData.netBalance.toLocaleString()}
                  </p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase mt-1">Ingresos menos Egresos</p>
                </div>
              </div>
            </div>

            {/* 2. GRÁFICOS DINÁMICOS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Alumnos por Grado */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                    Alumnos por Grado (Top 10)
                  </h3>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                    Distribución de estudiantes inscritos
                  </p>
                </div>
                <div className="h-72 w-full">
                  {studentsByGradeData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-350 font-bold text-xs italic">
                      Sin alumnos registrados en este ciclo
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={studentsByGradeData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                        <XAxis dataKey="name" stroke="#94A3B8" fontSize={9} tickLine={false} />
                        <YAxis stroke="#94A3B8" fontSize={9} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#4F46E5" radius={[8, 8, 0, 0]} barSize={25} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Comparativo Financiero Ingresos vs Gastos */}
              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-slate-800">
                      Balance de Flujo de Caja
                    </h3>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      Comparativa porcentual de Ingresos y Egresos
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 items-center gap-4 h-72">
                  <div className="h-56 w-full">
                    {financeData.totalIncome === 0 && financeData.totalExpense === 0 ? (
                      <div className="h-full flex items-center justify-center text-slate-350 font-bold text-xs italic">
                        Sin flujo de caja en este rango
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={financeData.summaryPieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {financeData.summaryPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  <div className="space-y-4 px-4">
                    <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[8px] font-black text-emerald-600 uppercase block tracking-wider">Ingresos Totales</span>
                        <span className="text-base font-black text-emerald-800">RD$ {financeData.totalIncome.toLocaleString()}</span>
                      </div>
                      <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg">
                        {financeData.totalIncome + financeData.totalExpense > 0 
                          ? `${((financeData.totalIncome / (financeData.totalIncome + financeData.totalExpense)) * 100).toFixed(1)}%`
                          : '0%'
                        }
                      </span>
                    </div>
                    <div className="p-4 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[8px] font-black text-rose-600 uppercase block tracking-wider">Egresos Totales</span>
                        <span className="text-base font-black text-rose-800">RD$ {financeData.totalExpense.toLocaleString()}</span>
                      </div>
                      <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2.5 py-1 rounded-lg">
                        {financeData.totalIncome + financeData.totalExpense > 0 
                          ? `${((financeData.totalExpense / (financeData.totalIncome + financeData.totalExpense)) * 100).toFixed(1)}%`
                          : '0%'
                        }
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. REPORTES TABULARES Y LISTADOS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Tabla 1: Cantidad de Personal por Área */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Personal por Área</h4>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Distribución de cargos institucionales</p>
                </div>
                <div className="space-y-3 pt-2">
                  {staffByAreaData.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{item.name}</span>
                      <span className="text-xs font-black text-slate-900 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg">
                        {item.value}
                      </span>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs font-black uppercase tracking-wider text-slate-900 px-2">
                    <span>Total Colaboradores</span>
                    <span>{staffList.length}</span>
                  </div>
                </div>
              </div>

              {/* Tabla 2: Desglose Financiero por Cuenta */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Flujo por Cuentas</h4>
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Consolidado por tipo de cuenta contable</p>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                  {financeData.accountsList.length === 0 ? (
                    <p className="text-center py-10 text-slate-400 font-bold italic text-[9px] uppercase">
                      Sin transacciones en este rango
                    </p>
                  ) : (
                    financeData.accountsList.map((item, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2">
                        <span className="text-[9px] font-black text-slate-800 uppercase block tracking-wider truncate">{item.name}</span>
                        <div className="flex justify-between items-center text-[10px]">
                          {item.income > 0 && (
                            <span className="text-emerald-600 font-bold">
                              Ingreso: RD$ {item.income.toLocaleString()}
                            </span>
                          )}
                          {item.expense > 0 && (
                            <span className="text-rose-600 font-bold">
                              Gasto: RD$ {item.expense.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Tabla 3: Agenda e Incidencias */}
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">Agenda e Incidencias</h4>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Novedades y eventos en el rango</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md">
                      {agendaData.totalActivities} Act.
                    </span>
                    <span className="text-[9px] font-black text-rose-700 bg-rose-50 px-2 py-1 rounded-md">
                      {agendaData.totalIncidents} Inc.
                    </span>
                  </div>
                </div>
                <div className="max-h-60 overflow-y-auto space-y-3 pr-1">
                  {agendaData.incidents.length === 0 && agendaData.normalActivities.length === 0 ? (
                    <p className="text-center py-10 text-slate-400 font-bold italic text-[9px] uppercase">
                      Sin novedades en agenda en este rango
                    </p>
                  ) : (
                    <>
                      {/* Lista de Incidencias Primero (Prioridad) */}
                      {agendaData.incidents.map((inc, idx) => (
                        <div key={`inc-${idx}`} className="p-3 bg-rose-50 border border-rose-100 rounded-xl space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-black text-rose-600 uppercase tracking-widest flex items-center gap-1">
                              <AlertTriangle size={10} /> Incidencia Grave
                            </span>
                            <span className="text-[8px] text-rose-400 font-bold">{format(new Date(`${inc.date}T12:00:00`), 'dd/MM/yyyy')}</span>
                          </div>
                          <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{inc.title}</p>
                          {inc.description && <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{inc.description}</p>}
                        </div>
                      ))}

                      {/* Lista de Actividades Normales */}
                      {agendaData.normalActivities.map((act, idx) => (
                        <div key={`act-${idx}`} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                              <Calendar size={10} /> Agenda General
                            </span>
                            <span className="text-[8px] text-slate-400 font-bold">{format(new Date(`${act.date}T12:00:00`), 'dd/MM/yyyy')}</span>
                          </div>
                          <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{act.title}</p>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
