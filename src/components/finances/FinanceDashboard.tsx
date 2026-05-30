import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Activity
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

export const FinanceDashboard = () => {
  const { invoices, transactions, expenses, loading } = useFinance();

  const stats = useMemo(() => {
    const totalIncome = transactions.reduce((acc, t) => acc + Number(t.amount_paid), 0);
    const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
    const netProfit = totalIncome - totalExpenses;
    
    const overdueInvoices = invoices.filter(i => i.status === 'overdue' || (i.status === 'pending' && new Date(i.due_date) < new Date()));
    const totalOverdue = overdueInvoices.reduce((acc, i) => acc + Number(i.amount_final), 0);

    // Datos para gráfico de barras (Últimos 6 meses - Simulado con datos reales si existen)
    const chartData = [
      { name: 'Ene', ingresos: 45000, gastos: 32000 },
      { name: 'Feb', ingresos: 52000, gastos: 34000 },
      { name: 'Mar', ingresos: 48000, gastos: 31000 },
      { name: 'Abr', ingresos: 61000, gastos: 38000 },
      { name: 'May', ingresos: totalIncome, gastos: totalExpenses },
    ];

    return { totalIncome, totalExpenses, netProfit, totalOverdue, chartData };
  }, [invoices, transactions, expenses]);

  if (loading) return (
    <div className="flex items-center justify-center py-20 animate-pulse text-slate-400 font-black uppercase tracking-widest">
      Calculando Balances...
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 1. KPIs PRINCIPALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform"><TrendingUp size={20} /></div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Ingresos Totales</span>
          </div>
          <h4 className="text-3xl font-black text-slate-900 leading-none">RD$ {stats.totalIncome.toLocaleString()}</h4>
          <p className="text-[9px] font-black text-emerald-600 mt-2 flex items-center gap-1">
            <ArrowUpRight size={12} /> +12% vs mes anterior
          </p>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-200 group-hover:scale-110 transition-transform"><TrendingDown size={20} /></div>
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Egresos Totales</span>
          </div>
          <h4 className="text-3xl font-black text-slate-900 leading-none">RD$ {stats.totalExpenses.toLocaleString()}</h4>
          <p className="text-[9px] font-black text-rose-600 mt-2 flex items-center gap-1">
            <ArrowDownRight size={12} /> +5% gasto operativo
          </p>
        </div>

        <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl group overflow-hidden relative">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 blur-2xl rounded-full -mr-12 -mt-12"></div>
          <div className="flex items-center gap-3 mb-4 relative z-10">
            <div className="p-3 bg-indigo-500 text-white rounded-2xl shadow-lg shadow-indigo-500/40 group-hover:scale-110 transition-transform"><DollarSign size={20} /></div>
            <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest">Balance Neto</span>
          </div>
          <h4 className="text-3xl font-black text-white leading-none relative z-10">RD$ {stats.netProfit.toLocaleString()}</h4>
          <p className="text-[9px] font-black text-indigo-300 mt-2 relative z-10 uppercase tracking-widest">Flujo de caja positivo</p>
        </div>

        <div className="bg-amber-50 p-6 rounded-[2.5rem] border border-amber-100 shadow-sm hover:shadow-xl transition-all group">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-200 group-hover:scale-110 transition-transform"><AlertCircle size={20} /></div>
            <span className="text-[10px] font-black uppercase text-amber-600 tracking-widest">Morosidad</span>
          </div>
          <h4 className="text-3xl font-black text-amber-900 leading-none">RD$ {stats.totalOverdue.toLocaleString()}</h4>
          <p className="text-[9px] font-black text-amber-600 mt-2 uppercase tracking-widest">Cuentas por cobrar</p>
        </div>
      </div>

      {/* 2. GRÁFICOS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Flujo de Caja Mensual</h3>
            <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase">
              <Calendar size={14} /> Año Escolar 2026-2027
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.chartData}>
                <defs>
                  <linearGradient id="colorIngresos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorGastos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)'}} />
                <Area type="monotone" dataKey="ingresos" stroke="#10b981" fillOpacity={1} fill="url(#colorIngresos)" strokeWidth={3} />
                <Area type="monotone" dataKey="gastos" stroke="#f43f5e" fillOpacity={1} fill="url(#colorGastos)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-8">Estado de Recaudación</h3>
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
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-6 space-y-4">
             <div className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                <span className="text-[10px] font-black uppercase text-slate-500">Tasa de Cobro</span>
                <span className="text-sm font-black text-emerald-600">
                  {Math.round((stats.totalIncome / (stats.totalIncome + stats.totalOverdue)) * 100) || 0}%
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
          <button className="text-[9px] font-black uppercase text-indigo-600 hover:underline">Ver Todo</button>
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
              {transactions.slice(0, 5).map((t) => (
                <tr key={t.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-black text-[10px]">
                        {t.students?.name?.[0]}{t.students?.last_name?.[0]}
                      </div>
                      <span className="text-xs font-black text-slate-700">{t.students?.name} {t.students?.last_name}</span>
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
    </div>
  );
};
