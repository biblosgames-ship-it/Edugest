import React, { useState, useMemo, useEffect } from 'react'; 
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
  RefreshCw
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useFinance } from '../../hooks/useFinance';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { StudentAccountDetails } from './StudentAccountDetails';

export const StudentAccounts = () => {
  const { state, profile, selectedYear } = useApp();
  const { invoices, paymentPlans, refresh, loading } = useFinance();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);

  const handleBatchBilling = async () => {
    const studentsWithoutInvoices = students.filter(s => !invoices.some(i => i.student_id === s.id));
    
    if (studentsWithoutInvoices.length === 0) {
      toast.success('Todos los alumnos ya tienen sus facturas generadas.');
      return;
    }

    if (!window.confirm(`¿Deseas generar AUTOMÁTICAMENTE la facturación de todo el año para ${studentsWithoutInvoices.length} alumnos? Se usarán los precios configurados para cada grado.`)) return;

    setIsBatchProcessing(true);
    const loadingToast = toast.loading(`Procesando facturación para ${studentsWithoutInvoices.length} alumnos...`);

    try {
      let createdCount = 0;
      const currentYear = selectedYear || '2025-2026';

      for (const student of studentsWithoutInvoices) {
        // 1. Buscar Plan
        const course = state.courses?.find(c => c.id === student.course_id);
        const cleanLevel = course?.level?.split(' ')?.[0]?.trim();
        
        let plan = paymentPlans.find(p => p.course_id === student.course_id);
        if (!plan && cleanLevel) {
          plan = paymentPlans.find(p => {
            const c = state.courses?.find(x => x.id === p.course_id);
            return c?.level?.trim() === cleanLevel;
          });
        }

        if (!plan) continue; // Saltar si no hay precio configurado

        // 2. Generar Pack de Facturas
        const newInvoices = [];
        const currentCenterId = profile?.center_id || student.center_id;
        
        // Inscripción
        newInvoices.push({
          center_id: currentCenterId,
          student_id: student.id,
          course_id: student.course_id,
          period: currentYear,
          concept: 'Inscripción',
          amount_original: plan.enrollment_fee,
          amount_final: plan.enrollment_fee,
          due_date: new Date().toISOString().split('T')[0],
          status: 'pending'
        });

        // Mensualidades
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const startMonthIdx = (plan.start_month || 9) - 1;
        const paymentEndDay = plan.payment_end_day || 10;

        for (let i = 0; i < Number(plan.months_count); i++) {
          const mIdx = (startMonthIdx + i) % 12;
          const yOffset = new Date().getFullYear() + (startMonthIdx + i >= 12 ? 1 : 0);
          const dueDate = new Date(yOffset, mIdx, paymentEndDay);
          
          newInvoices.push({
            center_id: currentCenterId,
            student_id: student.id,
            course_id: student.course_id,
            period: currentYear,
            concept: `Cuota ${ (i + 1).toString().padStart(2, '0') }`,
            month_number: i + 1,
            description: monthNames[mIdx],
            amount_original: Number(plan.monthly_fee),
            amount_final: Number(plan.monthly_fee),
            due_date: dueDate.toISOString().split('T')[0],
            status: 'pending'
          });
        }

        // 3. Guardar en DB
        const { error } = await supabase.from('finance_invoices').insert(newInvoices);
        if (!error) createdCount++;
      }

      toast.success(`¡Éxito! Se generó la facturación anual para ${createdCount} alumnos.`, { id: loadingToast });
      refresh();
    } catch (error: any) {
      toast.error('Error en proceso masivo: ' + error.message, { id: loadingToast });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const handleSyncPrices = async () => {
    const pendingInvoices = invoices.filter(i => i.status === 'pending');
    
    if (pendingInvoices.length === 0) {
      toast.success('No hay facturas pendientes para actualizar.');
      return;
    }

    if (!window.confirm(`¿Deseas ACTUALIZAR los precios de las ${pendingInvoices.length} facturas PENDIENTES? Las facturas pagadas no se alterarán.`)) return;

    setIsBatchProcessing(true);
    const loadingToast = toast.loading(`Sincronizando precios para ${pendingInvoices.length} facturas...`);

    try {
      let updatedCount = 0;
      
      for (const inv of pendingInvoices) {
        // 1. Buscar Plan
        const course = state.courses?.find(c => c.id === inv.course_id);
        const cleanLevel = course?.level?.split(' ')?.[0]?.trim();
        
        let plan = paymentPlans.find(p => p.course_id === inv.course_id);
        if (!plan && cleanLevel) {
          plan = paymentPlans.find(p => {
            const c = state.courses?.find(x => x.id === p.course_id);
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

      toast.success(`¡Sincronización terminada! Se actualizaron ${updatedCount} facturas con los nuevos precios.`, { id: loadingToast });
      refresh();
    } catch (error: any) {
      toast.error('Error en sincronización: ' + error.message, { id: loadingToast });
    } finally {
      setIsBatchProcessing(false);
    }
  };

  const students = state.students || [];

  const studentBalances = useMemo(() => {
    return students.map(student => {
      const studentInvoices = invoices.filter(i => i.student_id === student.id);
      const totalDebt = studentInvoices.reduce((acc, i) => acc + Number(i.amount_final), 0);
      const paidInvoices = studentInvoices.filter(i => i.status === 'paid');
      const totalPaid = paidInvoices.reduce((acc, i) => acc + Number(i.amount_final), 0);
      const balance = totalDebt - totalPaid;
      
      const hasOverdue = studentInvoices.some(i => i.status === 'overdue' || (i.status === 'pending' && new Date(i.due_date) < new Date()));
      
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
  }, [students, invoices]);

  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  const groupedBalances = useMemo(() => {
    const groups: { [key: string]: any } = {};
    
    studentBalances.forEach(student => {
      const courseId = student.course_id || 'unassigned';
      if (!groups[courseId]) {
        const course = state.courses?.find(c => c.id === courseId);
        groups[courseId] = {
          id: courseId,
          info: course ? `${course.level} ${course.grade} "${course.section}"` : 'Sin Grado Asignado',
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
    if (searchTerm.length > 2) {
      const firstMatch = groupedBalances.find(g => 
        g.students.some((s: any) => 
          `${s.names} ${s.first_surname}`.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
      if (firstMatch) setExpandedCourse(firstMatch.id);
    }
  }, [searchTerm, groupedBalances]);

  if (selectedStudentId) {
    return <StudentAccountDetails studentId={selectedStudentId} onBack={() => setSelectedStudentId(null)} />;
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
              placeholder="Buscar alumno en cualquier grado..."
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
          const isExpanded = expandedCourse === group.id;
          const filteredStudents = group.students.filter((s: any) => {
            const fullName = `${s.names || ''} ${s.first_surname || ''} ${s.second_surname || ''}`.toLowerCase();
            return fullName.includes(searchTerm.toLowerCase());
          });

          if (searchTerm && filteredStudents.length === 0) return null;

          return (
            <div 
              key={group.id} 
              className={`bg-white rounded-[2.5rem] border transition-all duration-300 overflow-hidden ${
                isExpanded ? 'border-indigo-600 shadow-2xl ring-4 ring-indigo-50' : 'border-slate-100 hover:border-slate-300'
              }`}
            >
              {/* TARJETA DE RESUMEN (CABECERA) */}
              <div 
                onClick={() => setExpandedCourse(isExpanded ? null : group.id)}
                className="p-8 cursor-pointer flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-6">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-xl transition-transform duration-500 ${
                    isExpanded ? 'bg-indigo-600 rotate-12' : 'bg-slate-900 group-hover:scale-110'
                  }`}>
                    <CreditCard size={28} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900">{group.info}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                      {group.students.length} Estudiantes Inscritos
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-10">
                  <div className="text-center hidden sm:block">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Cobrado</p>
                    <p className="text-sm font-black text-emerald-600">RD$ {group.stats.paid.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Pendiente</p>
                    <p className={`text-sm font-black ${group.stats.balance > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
                      RD$ {group.stats.balance.toLocaleString()}
                    </p>
                  </div>
                  {group.stats.moraCount > 0 && (
                    <div className="bg-rose-500 text-white px-4 py-2 rounded-xl flex items-center gap-2 animate-pulse">
                      <AlertTriangle size={14} />
                      <span className="text-[10px] font-black uppercase">{group.stats.moraCount} Mora</span>
                    </div>
                  )}
                  <div className={`p-3 rounded-xl transition-all ${isExpanded ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <ChevronRight className={`transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} size={20} />
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
                                  {student.names?.[0]}{student.first_surname?.[0]}
                                </div>
                                <span className="text-xs font-black text-slate-700">
                                  {student.names} {student.first_surname}
                                </span>
                              </div>
                            </td>
                            <td className="px-8 py-4">
                              <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center w-fit gap-1.5 ${
                                student.status === 'Mora' ? 'bg-rose-100 text-rose-600' :
                                student.status === 'Saldado' ? 'bg-emerald-100 text-emerald-600' :
                                'bg-amber-100 text-amber-600'
                              }`}>
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
