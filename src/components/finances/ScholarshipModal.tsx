import React, { useState, useMemo } from 'react';
import { X, Search, GraduationCap, CheckCircle2, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useFinance } from '../../hooks/useFinance';
import { toast } from 'react-hot-toast';

interface ScholarshipModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const ScholarshipModal: React.FC<ScholarshipModalProps> = ({ onClose, onSuccess }) => {
  const { state } = useApp();
  const { saveScholarship, loading } = useFinance();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    type: 'percentage' as 'percentage' | 'fixed',
    value: 0,
    applies_to: 'both' as 'enrollment' | 'monthly' | 'both',
    reason: ''
  });

  const students = state.students || [];
  const filteredStudents = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];
    const search = searchTerm.toLowerCase().trim();
    return students.filter(s => {
      const fullName = `${s.names || ''} ${s.first_surname || ''} ${s.second_surname || ''}`.toLowerCase();
      const reverseName = `${s.first_surname || ''} ${s.names || ''}`.toLowerCase();
      return fullName.includes(search) || reverseName.includes(search);
    }).slice(0, 10);
  }, [students, searchTerm]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) {
      toast.error('Selecciona un estudiante de la lista');
      return;
    }

    try {
      await saveScholarship({
        student_id: selectedStudent.id,
        ...formData
      });
      onSuccess();
    } catch (error) {
      // Error manejado en el hook
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900">Asignar Beneficio</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Becas y Exoneraciones</p>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-2xl transition-colors text-slate-400">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          {/* SELECCIÓN DE ALUMNO */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">1. Seleccionar Estudiante</label>
            {!selectedStudent ? (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text"
                  placeholder="Escribe el nombre o apellido del alumno..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                />
                {filteredStudents.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-slate-100 rounded-2xl mt-2 shadow-2xl z-10 overflow-hidden max-h-[250px] overflow-y-auto border-t-4 border-t-indigo-600">
                    {filteredStudents.map(s => (
                      <div 
                        key={s.id}
                        onMouseDown={() => {
                          setSelectedStudent(s);
                          setSearchTerm('');
                        }}
                        className="p-4 hover:bg-indigo-50 cursor-pointer flex items-center justify-between border-b border-slate-50 last:border-0 group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-100 group-hover:bg-indigo-600 group-hover:text-white rounded-lg flex items-center justify-center font-black text-[10px] transition-all">
                            {s.names?.[0] || '?'}{s.first_surname?.[0] || ''}
                          </div>
                          <span className="text-xs font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                            {s.names} {s.first_surname} {s.second_surname}
                          </span>
                        </div>
                        <span className="text-[9px] font-black uppercase text-indigo-400 tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity">Seleccionar</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-4 bg-indigo-50 rounded-2xl flex items-center justify-between border border-indigo-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black">
                    {selectedStudent.names?.[0] || '?'}{selectedStudent.first_surname?.[0] || ''}
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-900">{selectedStudent.names} {selectedStudent.first_surname} {selectedStudent.second_surname}</p>
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Alumno Seleccionado</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="text-[9px] font-black text-rose-500 uppercase hover:underline"
                >
                  Cambiar
                </button>
              </div>
            )}
          </div>

          {/* CONFIGURACIÓN DE BECA */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">2. Tipo</label>
              <select 
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-xs font-bold focus:ring-2 focus:ring-indigo-500 appearance-none shadow-inner"
              >
                <option value="percentage">Porcentaje (%)</option>
                <option value="fixed">Monto Fijo (RD$)</option>
              </select>
            </div>
            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">3. Valor</label>
              <div className="relative">
                <input 
                  type="number"
                  value={formData.value}
                  onChange={(e) => setFormData({ ...formData, value: Number(e.target.value) })}
                  className="w-full bg-slate-50 border-none rounded-2xl py-4 px-6 text-xl font-black focus:ring-2 focus:ring-indigo-500 shadow-inner"
                />
                <span className="absolute right-6 top-1/2 -translate-y-1/2 font-black text-slate-300">
                  {formData.type === 'percentage' ? '%' : 'RD$'}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">4. Concepto de Aplicación</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'enrollment', label: 'Solo Insc.' },
                { id: 'monthly', label: 'Solo Mens.' },
                { id: 'both', label: 'Ambos' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, applies_to: opt.id as any })}
                  className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    formData.applies_to === opt.id 
                    ? 'bg-slate-900 text-white shadow-lg' 
                    : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button 
            type="submit"
            disabled={loading || !selectedStudent}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
          >
            <CheckCircle2 size={20} />
            Confirmar Beneficio
          </button>
        </form>
      </div>
    </div>
  );
};
