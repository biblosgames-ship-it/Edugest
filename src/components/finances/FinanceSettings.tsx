import React, { useState, useMemo } from 'react';
import { Plus, Save, Settings2, CreditCard, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useFinance } from '../../hooks/useFinance';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

export const FinanceSettings = () => {
  const { state, profile } = useApp();
  const { paymentPlans, savePaymentPlan, loading, refresh } = useFinance({ paymentPlans: true });
  const [editingLevel, setEditingLevel] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    enrollment_fee: 0,
    monthly_fee: 0,
    months_count: 10,
    payment_start_day: 1,
    payment_end_day: 10,
    grace_days: 5,
    late_fee_percentage: 0,
    start_month: 8
  });

  const courses = state.courses || [];
  // Obtener niveles únicos
  const levels = Array.from(new Set(courses.map((c) => c.level))).filter(Boolean);

  const handleSelectLevel = (level: string) => {
    setEditingLevel(level);
    // Buscar si ya hay un plan para algún curso de este nivel para pre-cargar los datos
    const existingPlan = paymentPlans.find((p) => {
      const course = courses.find((c) => c.id === p.course_id);
      return (course?.level || '').toString().trim() === level.trim();
    });

    if (existingPlan) {
      setFormData({
        enrollment_fee: Number(existingPlan.enrollment_fee),
        monthly_fee: Number(existingPlan.monthly_fee),
        months_count: existingPlan.months_count,
        payment_start_day: existingPlan.payment_start_day || 1,
        payment_end_day: existingPlan.payment_end_day || 10,
        grace_days: existingPlan.grace_days || 5,
        late_fee_percentage: existingPlan.late_fee_percentage || 0,
        start_month: existingPlan.start_month || 8
      });
    } else {
      setFormData({
        enrollment_fee: 0,
        monthly_fee: 0,
        months_count: 10,
        payment_start_day: 1,
        payment_end_day: 10,
        grace_days: 5,
        late_fee_percentage: 0,
        start_month: 8
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLevel) return;

    const currentCenterId = profile?.center_id;
    if (!currentCenterId) {
      toast.error('FALLO CRÍTICO: No se detecta el ID del centro. Recarga la página.');
      return;
    }

    const loadingToast = toast.loading(`Guardando precios para ${editingLevel}...`);

    try {
      const targetLevel = editingLevel.toLowerCase().trim();
      const levelCourses = courses.filter(
        (c) => (c.level || '').toString().toLowerCase().trim() === targetLevel
      );

      if (levelCourses.length === 0) {
        toast.error(`No hay cursos en el nivel "${editingLevel}" para actualizar.`, {
          id: loadingToast
        });
        return;
      }

      const plansArray = levelCourses.map((course) => ({
        course_id: course.id,
        enrollment_fee: Number(formData.enrollment_fee),
        monthly_fee: Number(formData.monthly_fee),
        months_count: Number(formData.months_count),
        payment_start_day: Number(formData.payment_start_day),
        payment_end_day: Number(formData.payment_end_day),
        grace_days: Number(formData.grace_days),
        late_fee_percentage: Number(formData.late_fee_percentage),
        start_month: Number(formData.start_month)
      }));

      const { error } = await supabase.from('finance_payment_plans').upsert(
        plansArray.map((p) => ({ ...p, center_id: currentCenterId })),
        { onConflict: 'course_id' }
      );

      if (error) throw error;

      toast.success(`¡Listo! Se actualizaron ${levelCourses.length} cursos.`, { id: loadingToast });
      setEditingLevel(null);
      refresh();
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(`Error de base de datos: ${error.message}`, { id: loadingToast });
    }
  };

  const selectedLevelCount = useMemo(() => {
    if (!editingLevel) return 0;
    const target = editingLevel.toLowerCase().trim();
    return courses.filter((c) => (c.level || '').toString().toLowerCase().trim() === target).length;
  }, [editingLevel, courses]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* 1. SELECCIÓN DE NIVEL */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm">
          <div className="mb-10">
            <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">
              Configuración por Niveles
            </h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              Define los costos generales para cada etapa académica
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {levels.map((level) => {
              // Verificar si el nivel ya tiene planes configurados
              const hasConfig = paymentPlans.some((p) => {
                const course = courses.find((c) => c.id === p.course_id);
                return (course?.level || '').toString().trim() === level.trim();
              });

              return (
                <div
                  key={level}
                  onClick={() => handleSelectLevel(level)}
                  className={`p-8 rounded-[2.5rem] border transition-all cursor-pointer flex flex-col items-center text-center gap-4 ${
                    editingLevel === level
                      ? 'border-indigo-600 bg-indigo-50/50 shadow-xl scale-105'
                      : 'border-slate-100 hover:border-slate-300 bg-slate-50/50'
                  }`}
                >
                  <div
                    className={`w-16 h-16 rounded-[1.8rem] flex items-center justify-center shadow-lg ${
                      hasConfig ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'
                    }`}
                  >
                    <CreditCard size={28} />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase tracking-tighter">
                      {level}
                    </h4>
                    <p
                      className={`text-[8px] font-black uppercase mt-1 ${hasConfig ? 'text-emerald-600' : 'text-slate-400'}`}
                    >
                      {hasConfig ? 'Configurado' : 'Pendiente'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-12 p-6 bg-indigo-50/50 border border-indigo-100 rounded-[2rem] flex items-start gap-4">
            <Info className="text-indigo-600 shrink-0" size={20} />
            <p className="text-[10px] font-bold text-indigo-700 uppercase leading-relaxed tracking-widest">
              Al configurar un nivel, todos los cursos asociados (por ejemplo, desde 1ro hasta 6to
              de Secundaria) adoptarán automáticamente estos costos. Esto asegura una facturación
              uniforme y rápida.
            </p>
          </div>
        </div>
      </div>

      {/* 2. FORMULARIO DE COSTOS */}
      <div className="lg:col-span-1">
        <div className="bg-slate-900 p-8 rounded-[3rem] text-white shadow-2xl sticky top-6">
          {editingLevel ? (
            <form onSubmit={handleSave} className="space-y-8">
              <div className="flex items-center gap-4 mb-2">
                <div className="p-4 bg-indigo-500 rounded-3xl shadow-xl">
                  <Settings2 size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tighter">{editingLevel}</h3>
                  <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest">
                    {selectedLevelCount} cursos detectados
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                {selectedLevelCount === 0 && (
                  <div className="p-4 bg-rose-500/20 border border-rose-500/50 rounded-2xl flex items-start gap-3">
                    <AlertCircle size={16} className="text-rose-500 shrink-0 mt-0.5" />
                    <p className="text-[9px] font-black uppercase text-rose-500 leading-tight">
                      No se detectan cursos para este nivel. Por favor verifica los nombres en la
                      sección de Cursos.
                    </p>
                  </div>
                )}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] px-2">
                    Inscripción (DOP)
                  </label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-indigo-400 font-black">
                      RD$
                    </span>
                    <input
                      type="number"
                      required
                      value={formData.enrollment_fee}
                      onChange={(e) =>
                        setFormData({ ...formData, enrollment_fee: Number(e.target.value) })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-16 pr-6 text-2xl font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] px-2">
                    Cuota Mensual (DOP)
                  </label>
                  <div className="relative">
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-indigo-400 font-black">
                      RD$
                    </span>
                    <input
                      type="number"
                      required
                      value={formData.monthly_fee}
                      onChange={(e) =>
                        setFormData({ ...formData, monthly_fee: Number(e.target.value) })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 pl-16 pr-6 text-2xl font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] px-2">
                    Cantidad de Meses
                  </label>
                  <select
                    value={formData.months_count}
                    onChange={(e) =>
                      setFormData({ ...formData, months_count: Number(e.target.value) })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-5 px-6 text-sm font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all appearance-none uppercase tracking-widest cursor-pointer"
                  >
                    <option value={0} className="bg-slate-900">
                      0 (Solo Inscripción)
                    </option>
                    <option value={1} className="bg-slate-900">
                      1 (Pago Único)
                    </option>
                    <option value={10} className="bg-slate-900">
                      10 (Año Escolar Std)
                    </option>
                    <option value={12} className="bg-slate-900">
                      12 (Año Completo)
                    </option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] px-2">
                      Inicio Pago (Día)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.payment_start_day}
                      onChange={(e) =>
                        setFormData({ ...formData, payment_start_day: Number(e.target.value) })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-xl font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] px-2">
                      Límite Pago (Día)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={formData.payment_end_day}
                      onChange={(e) =>
                        setFormData({ ...formData, payment_end_day: Number(e.target.value) })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-xl font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-emerald-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] px-2">
                      Días de Gracia
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.grace_days}
                      onChange={(e) =>
                        setFormData({ ...formData, grace_days: Number(e.target.value) })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-xl font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] px-2">
                      % Mora
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.late_fee_percentage}
                      onChange={(e) =>
                        setFormData({ ...formData, late_fee_percentage: Number(e.target.value) })
                      }
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-xl font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-rose-400"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-indigo-300 uppercase tracking-[0.2em] px-2">
                    Mes de Inicio Escolar
                  </label>
                  <select
                    value={formData.start_month}
                    onChange={(e) =>
                      setFormData({ ...formData, start_month: Number(e.target.value) })
                    }
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 text-sm font-black focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all uppercase tracking-widest cursor-pointer"
                  >
                    {[
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
                    ].map((month, idx) => (
                      <option key={month} value={idx + 1} className="bg-slate-900">
                        {month}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full bg-indigo-500 hover:bg-indigo-600 py-6 rounded-3xl flex items-center justify-center gap-4 font-black uppercase tracking-widest shadow-2xl shadow-indigo-500/40 transition-all active:scale-95"
                >
                  <Save size={20} />
                  Aplicar al Nivel
                </button>
                <button
                  type="button"
                  onClick={() => setEditingLevel(null)}
                  className="w-full mt-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] hover:text-white transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div className="py-24 flex flex-col items-center justify-center text-center space-y-6">
              <div className="w-20 h-20 bg-white/5 rounded-[2rem] flex items-center justify-center text-indigo-400 shadow-inner">
                <Info size={40} />
              </div>
              <p className="text-[10px] font-black text-slate-500 uppercase leading-relaxed tracking-[0.2em] max-w-[180px]">
                Selecciona un nivel <br /> académico para <br /> configurar sus costos
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
