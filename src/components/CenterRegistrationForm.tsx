import React, { useState } from 'react';
import { School, MapPin, Building2, ChevronRight, KeyRound } from 'lucide-react';
import { dataService } from '../services/dataService';
import { toast } from 'react-hot-toast';

export const CenterRegistrationForm = () => {
  const [name, setName] = useState('');
  const [district, setDistrict] = useState('');
  const [regional, setRegional] = useState('');
  const [licenseKey, setLicenseKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !licenseKey) return;

    setIsSubmitting(true);
    const loadingToast = toast.loading('Construyendo entorno y desplegando base de datos... Por favor espera.');
    console.log('Iniciando registro con:', { name, licenseKey, district, regional });
    
    try {
      const result = await dataService.registerSchoolSaas(name, licenseKey, district, regional);
      console.log('Registro exitoso, ID de centro:', result);
      toast.success('¡Entorno construido con éxito! Reiniciando...', { id: loadingToast });

      // Esperar 1.5s antes de recargar para que se lea el toast
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error('Error al registrar escuela:', error);
      toast.error('Error detallado: ' + (error.message || 'Error desconocido'), { id: loadingToast });
      setIsSubmitting(false);
    }
  };

  const inputClass =
    'w-full pl-12 pr-4 py-4 bg-slate-50/50 border border-slate-200 rounded-2xl outline-none focus:bg-white focus:border-brand-blue focus:ring-4 focus:ring-brand-blue/10 transition-all font-medium text-slate-800 placeholder-slate-400';

  return (
    <div className="animate-fade-in space-y-6">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-gradient-to-br from-brand-blue to-brand-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-blue/30 transform rotate-3">
          <Building2 size={32} className="text-white transform -rotate-3" />
        </div>
        <h3 className="text-2xl font-extrabold text-slate-800 tracking-tight">
          Activar Institución
        </h3>
        <p className="text-slate-500 mt-2 font-medium text-sm">
          Ingresa tu llave de producto para desplegar tu servidor dedicado.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative group">
          <KeyRound
            className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-blue group-focus-within:text-brand-accent transition-colors"
            size={20}
          />
          <input
            type="text"
            placeholder="Llave SaaS (Ej: VIP-EDUGENS-2026)"
            value={licenseKey}
            onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
            className={`${inputClass} border-brand-blue/30 font-mono uppercase bg-brand-blue/5 placeholder-brand-blue/40 tracking-wider`}
            required
            autoComplete="off"
          />
        </div>

        <div className="relative group">
          <School
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-blue transition-colors"
            size={20}
          />
          <input
            type="text"
            placeholder="Nombre oficial del centro educativo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            required
            autoComplete="organization"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="relative group">
            <MapPin
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-blue transition-colors"
              size={18}
            />
            <input
              type="text"
              placeholder="Distrito (Opcional)"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              className={inputClass}
            />
          </div>
          <div className="relative group">
            <Building2
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-blue transition-colors"
              size={18}
            />
            <input
              type="text"
              placeholder="Regional (Opcional)"
              value={regional}
              onChange={(e) => setRegional(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="pt-4">
          <button
            type="submit"
            disabled={isSubmitting || !name || !licenseKey}
            className="w-full bg-slate-900 text-white px-6 py-4 rounded-2xl font-bold hover:bg-brand-blue transition-all disabled:opacity-50 shadow-xl shadow-slate-900/20 flex items-center justify-center gap-2 group"
          >
            {isSubmitting ? (
              'Construyendo Entorno...'
            ) : (
              <>
                Lanzar mi Plataforma
                <ChevronRight
                  size={20}
                  className="transform group-hover:translate-x-1 transition-transform"
                />
              </>
            )}
          </button>

          <p className="text-center text-xs text-slate-400 font-medium mt-6">
            Al registrarte aceptas que serás el súper administrador exclusivo de estos datos.
          </p>
        </div>
      </form>
    </div>
  );
};
