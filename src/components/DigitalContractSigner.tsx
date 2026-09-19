import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  FileText,
  Building2,
  Calendar,
  DollarSign,
  AlertCircle,
  Printer,
  Sparkles,
  Lock,
  Headphones,
  Check,
  Award
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getContractByToken, signContract, SaaSContract } from '../services/contractService';

interface Props {
  token: string;
}

export const DigitalContractSigner: React.FC<Props> = ({ token }) => {
  const [contract, setContract] = useState<SaaSContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Signature Form
  const [directorName, setDirectorName] = useState('');
  const [directorIdCard, setDirectorIdCard] = useState('');
  const [directorEmail, setDirectorEmail] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [justSigned, setJustSigned] = useState(false);

  useEffect(() => {
    const fetchContract = async () => {
      try {
        setLoading(true);
        const data = await getContractByToken(token);
        if (!data) {
          setError('El enlace de contrato no es válido o ha expirado.');
        } else {
          setContract(data);
          if (data.director_name) setDirectorName(data.director_name);
          if (data.director_id_card) setDirectorIdCard(data.director_id_card);
          if (data.director_email) setDirectorEmail(data.director_email);
          if (data.status === 'signed') setJustSigned(true);
        }
      } catch (err: any) {
        setError('Error al cargar el contrato: ' + (err.message || 'Error desconocido'));
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      fetchContract();
    }
  }, [token]);

  const handleSign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      toast.error('Debes marcar la casilla para aceptar los términos y condiciones del contrato.');
      return;
    }
    if (!directorName.trim() || !directorIdCard.trim()) {
      toast.error('Por favor completa tu nombre completo y número de documento de identidad.');
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = await signContract(token, {
        director_name: directorName,
        director_id_card: directorIdCard,
        director_email: directorEmail || contract?.director_email
      });
      setContract(updated);
      setJustSigned(true);
      toast.success('¡Contrato firmado electrónicamente con éxito!');
    } catch (err: any) {
      toast.error('Error al firmar: ' + (err.message || 'No se pudo registrar la firma'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white text-center">
        <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-black uppercase tracking-widest">Cargando Contrato Digital...</h2>
        <p className="text-slate-400 text-xs mt-2">Verificando firma criptográfica en Edugens</p>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-red-500/20 rounded-3xl p-8 text-center text-white space-y-4">
          <div className="w-14 h-14 bg-red-500/10 text-red-400 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-red-400">Enlace No Válido</h2>
          <p className="text-slate-400 text-xs leading-relaxed">
            {error || 'No pudimos encontrar los términos asociados a este enlace de firma.'}
          </p>
          <a
            href="/"
            className="inline-block bg-white text-slate-950 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
          >
            Ir al Inicio
          </a>
        </div>
      </div>
    );
  }

  const isAlreadySigned = contract.status === 'signed' || justSigned;

  return (
    <div className="min-h-screen bg-slate-100 py-10 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* ENCABEZADO INSTITUCIONAL */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-center justify-between gap-6 print:border-none print:shadow-none">
          <div className="flex items-center gap-4 text-left">
            <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 shrink-0">
              <Building2 size={32} />
            </div>
            <div>
              <span className="text-[10px] font-black bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full uppercase tracking-widest">
                Acuerdo de Servicio SaaS
              </span>
              <h1 className="text-2xl font-black text-slate-900 uppercase tracking-tight mt-1">
                {contract.center_name}
              </h1>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                Plataforma de Gestión Escolar Inteligente Edugens
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAlreadySigned ? (
              <div className="bg-emerald-50 border border-emerald-200 px-5 py-3 rounded-2xl flex items-center gap-3">
                <CheckCircle2 size={24} className="text-emerald-600" />
                <div className="text-left">
                  <span className="text-[9px] font-black text-emerald-800 uppercase tracking-widest block">
                    Estado del Documento
                  </span>
                  <span className="text-xs font-black text-emerald-950 uppercase">
                    Firmado Digitalmente
                  </span>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 px-5 py-3 rounded-2xl flex items-center gap-3">
                <ShieldCheck size={24} className="text-amber-600" />
                <div className="text-left">
                  <span className="text-[9px] font-black text-amber-800 uppercase tracking-widest block">
                    Estado del Documento
                  </span>
                  <span className="text-xs font-black text-amber-950 uppercase">
                    Pendiente de Aceptación
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={() => window.print()}
              className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all print:hidden"
              title="Imprimir o Guardar PDF"
            >
              <Printer size={20} />
            </button>
          </div>
        </div>

        {/* CUERPO DEL CONTRATO LEGAL */}
        <div className="bg-white p-8 sm:p-12 rounded-[2.5rem] shadow-sm border border-slate-200/80 text-left space-y-8 text-slate-800 leading-relaxed text-sm">
          <div className="border-b border-slate-100 pb-6 text-center">
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">
              CONTRATO DE PRESTACIÓN DE SERVICIOS EN LA NUBE (SaaS)
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
              Ref: {contract.token}
            </p>
          </div>

          {/* PARTE DECLARATORIA */}
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-2 text-xs">
            <p>
              <strong>EL PROVEEDOR:</strong> EDUGENS, plataforma de tecnología educativa especializada en software para centros escolares.
            </p>
            <p>
              <strong>LA INSTITUCIÓN EDUCATIVA:</strong> <u>{contract.center_name}</u>, representada por su Director(a) o Representante autorizado, con correo de contacto oficial <u>{contract.director_email}</u>.
            </p>
          </div>

          {/* CLÁUSULAS */}
          <div className="space-y-6 text-xs text-slate-700 leading-relaxed">
            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
                1. OBJETO Y CAPACIDAD CONTRATADA
              </h3>
              <p>
                EL PROVEEDOR otorga a LA INSTITUCIÓN EDUCATIVA una licencia de uso bajo la modalidad de Software como Servicio (SaaS) para la gestión escolar en la nube bajo el plan <strong>{contract.plan_name}</strong>, con una capacidad nominal de hasta <strong>{contract.max_students} estudiantes</strong> y <strong>{contract.max_teachers} docentes</strong>.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
                2. CONDICIONES ECONÓMICAS Y FACTURACIÓN
              </h3>
              <p>
                La tarifa del servicio convenida es de <strong>{contract.currency === 'USD' ? 'US$' : 'RD$'} {Number(contract.price).toLocaleString()}</strong> con periodicidad de cobro <strong>{contract.billing_cycle}</strong>. Las cuotas son exigibles dentro de los primeros cinco (5) días de cada período facturable.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-2">
                3. SERVICIOS Y MÓDULOS DE ALTO RENDIMIENTO (ADD-ONS)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
                <div className={`p-4 rounded-xl border ${contract.has_support_24_7 ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Headphones size={16} className={contract.has_support_24_7 ? 'text-indigo-600' : 'text-slate-400'} />
                    <span>Soporte Prioritario 24/7</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    {contract.has_support_24_7
                      ? '✓ Incluido: Atención 24/7 vía WhatsApp y telefónica con tiempo de respuesta expedito.'
                      : '✗ No incluido en este plan.'}
                  </p>
                </div>

                <div className={`p-4 rounded-xl border ${contract.has_payment_filter ? 'bg-indigo-50/50 border-indigo-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                  <div className="flex items-center gap-2 font-bold text-slate-900">
                    <Lock size={16} className={contract.has_payment_filter ? 'text-indigo-600' : 'text-slate-400'} />
                    <span>Filtro de Notas por Solvencia</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1">
                    {contract.has_payment_filter
                      ? '✓ Habilitado: Restricción automática de boletines a padres con colegiaturas pendientes.'
                      : '✗ No contratado en este plan.'}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-slate-500 italic">
                * Cláusula de expansión: LA INSTITUCIÓN EDUCATIVA tendrá derecho preferencial a adquirir nuevos módulos premium futuros desarrollados por Edugens (asistencia con IA, pasarelas de pago online, apps móviles con marca propia).
              </p>
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
                4. CLÁUSULA DE AJUSTE ANUAL POR INFLACIÓN ({contract.inflation_clause_rate}%)
              </h3>
              <p>
                Ambas partes acuerdan que al término de cada ciclo de doce (12) meses de suscripción, EL PROVEEDOR se reserva la facultad de ajustar la tarifa anual o mensual en hasta un <strong>{contract.inflation_clause_rate}%</strong>, o en un porcentaje mayor si el Índice de Precios al Consumidor (IPC) o la inflación acumulada interanual oficial reportada por el Banco Central supera dicho valor, debido a costos crecientes de infraestructura en la nube y mantenimiento.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
                5. MODALIDAD DE PUBLICIDAD Y PATROCINIO
              </h3>
              <p>
                Modalidad acordada para este centro:{' '}
                <strong>
                  {contract.ad_mode === 'ad_free'
                    ? '100% Libre de Publicidad (Experiencia Institucional Ad-Free)'
                    : contract.ad_mode === 'sponsored'
                    ? 'Plan Bonificado con Patrocinio Educativo (Solo contenidos formativos, cero rastreo de menores)'
                    : 'Publicidad Co-gestionada (El colegio coloca sus propios patrocinadores y marcas aliadas)'}
                </strong>
                .
              </p>
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
                6. SOBERANÍA Y PROPIEDAD EXCLUSIVA DE LOS DATOS
              </h3>
              <p>
                LA INSTITUCIÓN EDUCATIVA es la única y absoluta propietaria de toda la información ingresada (estudiantes, calificaciones, balances contables y familias). Edugens jamás vende, cede ni comercializa información escolar. En caso de no renovación, el centro goza de <strong>30 días de gracia con acceso de lectura</strong> para descargar todos sus datos en formatos abiertos (Excel, PDF o JSON) sin costo adicional.
              </p>
            </div>

            <div>
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider mb-1">
                7. SEGURIDAD Y PRIVACIDAD MULTI-CENTRO
              </h3>
              <p>
                Los datos residen en bases de datos con aislamiento lógico a nivel de motor SQL (Row Level Security - RLS) y cifrado de grado bancario (TLS 1.3 en tránsito y AES-256 en reposo), garantizando que ningún otro colegio o tercero pueda acceder a los registros del centro.
              </p>
            </div>
          </div>

          {/* SECCIÓN DE FIRMA DIGITAL */}
          {isAlreadySigned ? (
            <div className="border-t-2 border-slate-100 pt-8 mt-8 space-y-6">
              <div className="bg-emerald-50 border-2 border-emerald-300 p-6 rounded-3xl text-left space-y-4">
                <div className="flex items-center gap-3 text-emerald-800">
                  <Award size={28} />
                  <div>
                    <h4 className="text-base font-black uppercase tracking-tight">
                      Certificado de Firma Electrónica Verificada
                    </h4>
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                      Conforme a las leyes de comercio electrónico y firma digital
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2 border-t border-emerald-200">
                  <div>
                    <span className="text-slate-500 font-bold uppercase block text-[10px]">Firmado por:</span>
                    <span className="text-slate-900 font-black text-sm uppercase">{contract.director_name}</span>
                    <span className="text-slate-600 block">Doc. Identidad: {contract.director_id_card || 'No especificado'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-bold uppercase block text-[10px]">Fecha y Hora de Firma:</span>
                    <span className="text-slate-900 font-bold block">
                      {contract.signed_at ? new Date(contract.signed_at).toLocaleString() : 'Recientemente'}
                    </span>
                    <span className="text-slate-500 text-[10px]">Dirección IP: {contract.signer_ip || 'Registrada'}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pt-2 print:hidden">
                <p className="text-xs text-slate-500">
                  Este contrato digital ha quedado archivado con valor legal en la plataforma.
                </p>
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => window.print()}
                    className="flex-1 sm:flex-initial px-6 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Printer size={16} /> Imprimir / PDF
                  </button>
                  <a
                    href="/"
                    className="flex-1 sm:flex-initial px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md text-center"
                  >
                    Entrar a Edugens
                  </a>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSign} className="border-t-2 border-slate-100 pt-8 mt-8 space-y-6 print:hidden">
              <div className="bg-indigo-50/60 border border-indigo-100 p-6 rounded-3xl space-y-4">
                <h4 className="text-sm font-black text-indigo-950 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck size={18} className="text-indigo-600" />
                  Formulario de Firma Electrónica del Representante Legal
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Nombre y Apellidos del Director(a) / Representante *
                    </label>
                    <input
                      type="text"
                      required
                      value={directorName}
                      onChange={(e) => setDirectorName(e.target.value)}
                      placeholder="Ej. Lic. Carlos Gómez"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      Documento de Identidad (Cédula / DNI / Pasaporte) *
                    </label>
                    <input
                      type="text"
                      required
                      value={directorIdCard}
                      onChange={(e) => setDirectorIdCard(e.target.value)}
                      placeholder="Ej. 001-1234567-8"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 bg-white"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-0.5 cursor-pointer"
                    />
                    <span className="text-xs font-medium text-slate-700 leading-snug">
                      He leído íntegramente las cláusulas de este contrato, acepto los términos de servicio, las tarifas pactadas, el ajuste por inflación y las condiciones de la plataforma Edugens, <strong>firmando electrónicamente</strong> con plena validez vinculante.
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting || !acceptedTerms}
                  className="w-full sm:w-auto px-8 py-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    'Registrando Firma Criptográfica...'
                  ) : (
                    <>
                      <Check size={18} strokeWidth={3} />
                      Aceptar y Firmar Contrato Digitalmente
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
