import React, { useState, useMemo, useEffect } from 'react';
import {
  GraduationCap,
  Plus,
  Search,
  Trash2,
  UserPlus,
  TrendingDown,
  Users,
  Award,
  AlertCircle
} from 'lucide-react';
import { useFinance } from '../../hooks/useFinance';
import { ScholarshipModal } from './ScholarshipModal';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

export const ScholarshipsManager = () => {
  const { scholarships, refresh, loading } = useFinance({ scholarships: true });
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [preselectedStudent, setPreselectedStudent] = useState<any | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem('edugens_assign_scholarship_student');
    if (stored) {
      try {
        const studentInfo = JSON.parse(stored);
        setPreselectedStudent(studentInfo);
        setIsModalOpen(true);
      } catch (e) {
        console.error('Error parsing preselected student:', e);
      }
      localStorage.removeItem('edugens_assign_scholarship_student');
    }
  }, []);

  const stats = useMemo(() => {
    const totalCount = scholarships.length;
    const totalExempted = scholarships.reduce((acc, s) => {
      // Cálculo aproximado anual para el dashboard
      if (s.type === 'percentage' && s.value === 100) return acc + 15000; // Valor simbólico si es 100%
      return acc + Number(s.value);
    }, 0);
    return { totalCount, totalExempted };
  }, [scholarships]);

  const filteredScholarships = scholarships.filter((s) =>
    `${s.students?.names} ${s.students?.first_surname} ${s.students?.second_surname}`
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        '¿Estás seguro de eliminar esta beca? Los montos de las facturas no se revertirán automáticamente por seguridad.'
      )
    )
      return;
    try {
      await supabase.from('finance_scholarships').delete().eq('id', id);
      toast.success('Beca eliminada');
      refresh();
    } catch (error) {
      toast.error('Error al eliminar');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. INDICADORES DE IMPACTO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4 group hover:shadow-xl transition-all">
          <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100 group-hover:scale-110 transition-transform">
            <Users size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Alumnos Becados
            </p>
            <h4 className="text-2xl font-black text-slate-900">{stats.totalCount} Estudiantes</h4>
          </div>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-4 group hover:shadow-xl transition-all">
          <div className="p-4 bg-emerald-500 text-white rounded-2xl shadow-lg shadow-emerald-100 group-hover:scale-110 transition-transform">
            <TrendingDown size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Inversión en Becas
            </p>
            <h4 className="text-2xl font-black text-emerald-600">
              RD$ {stats.totalExempted.toLocaleString()}
            </h4>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl flex items-center justify-between group">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-indigo-500 text-white rounded-2xl shadow-lg group-hover:scale-110 transition-transform">
              <Award size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                Exoneraciones Totales
              </p>
              <h4 className="text-2xl font-black text-white">
                {scholarships.filter((s) => s.type === 'percentage' && s.value === 100).length}
              </h4>
            </div>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-3 bg-white/10 text-white rounded-xl hover:bg-white/20 transition-all"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      {/* 2. LISTADO Y BÚSQUEDA */}
      <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm min-h-[400px]">
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Buscar alumno becado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all"
            />
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-3 bg-indigo-600 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-100 hover:scale-105 transition-all w-full md:w-auto justify-center"
          >
            <UserPlus size={18} /> Asignar Nuevo Beneficio
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-50 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Estudiante</th>
                <th className="px-6 py-4">Tipo de Beneficio</th>
                <th className="px-6 py-4">Valor</th>
                <th className="px-6 py-4">Aplica A</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredScholarships.map((s) => (
                <tr key={s.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-black text-[10px]">
                        {s.students?.names?.[0]}
                        {s.students?.first_surname?.[0]}
                      </div>
                      <span className="text-xs font-black text-slate-700">
                        {s.students?.names} {s.students?.first_surname}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">
                      {s.type === 'percentage'
                        ? s.value === 100
                          ? 'Exoneración Total'
                          : 'Beca Porcentual'
                        : 'Beca Monto Fijo'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-black text-slate-900">
                      {s.type === 'percentage'
                        ? `${s.value}%`
                        : `RD$ ${Number(s.value).toLocaleString()}`}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-[9px] font-black uppercase bg-slate-100 px-3 py-1 rounded-full text-slate-500">
                      {s.applies_to === 'both'
                        ? 'Inscrip. y Mens.'
                        : s.applies_to === 'enrollment'
                          ? 'Inscripción'
                          : 'Mensualidad'}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-emerald-100 text-emerald-600 rounded-full text-[9px] font-black uppercase">
                      Activa
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="p-2 text-rose-300 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredScholarships.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center opacity-20">
                      <GraduationCap size={64} />
                      <p className="text-xs font-black uppercase tracking-widest mt-4">
                        No hay alumnos becados aún
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <ScholarshipModal
          onClose={() => {
            setIsModalOpen(false);
            setPreselectedStudent(null);
          }}
          onSuccess={() => {
            setIsModalOpen(false);
            setPreselectedStudent(null);
            refresh();
          }}
          preselectedStudent={preselectedStudent}
        />
      )}
    </div>
  );
};
