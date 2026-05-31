import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles, ShieldCheck } from 'lucide-react';
import { Logo } from './Logo';
import { SEO } from './SEO';

export const Login = () => {
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin }
      });
    } catch (error) {
      console.error('Login error:', error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden p-6">
      {/* Background Animated Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-blue/20 blur-[120px] rounded-full animate-pulse"></div>
      <div
        className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-accent/20 blur-[120px] rounded-full animate-pulse"
        style={{ animationDelay: '2s' }}
      ></div>

      <SEO
        title="Iniciar Sesión"
        description="Accede a la plataforma Edugest para la gestión escolar inteligente de tu centro educativo."
      />

      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none"></div>

      <div className="max-w-md w-full relative z-10">
        <div className="glass-premium p-12 rounded-[3.5rem] text-center space-y-10 border border-white/10 backdrop-blur-3xl">
          <div className="space-y-6">
            <div className="flex justify-center">
              <div className="bg-gradient-to-br from-brand-blue to-brand-accent p-6 rounded-[2.5rem] shadow-2xl shadow-brand-blue/30 transform hover:rotate-12 transition-transform duration-500">
                <Logo className="w-24 h-24 text-white" />
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-5xl font-black text-white tracking-tighter flex items-center justify-center gap-2">
                EduGest <Sparkles className="text-brand-accent w-6 h-6 animate-pulse" />
              </h1>
              <p className="text-slate-300 font-bold uppercase text-[10px] tracking-[0.3em] leading-relaxed">
                Plataforma de Gestión <br /> Educativa Inteligente
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              aria-label="Entrar con Google"
              className="w-full group relative flex items-center justify-center gap-4 bg-white text-slate-950 py-5 rounded-2xl font-black uppercase text-xs hover:bg-slate-100 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] active:scale-95 disabled:opacity-50 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000"></div>
              {loading ? (
                <span className="animate-pulse">Iniciando sesión...</span>
              ) : (
                <>
                  <img
                    src="https://www.google.com/favicon.ico"
                    className="w-5 h-5 group-hover:scale-110 transition-transform"
                    alt="Google"
                  />
                  Entrar con Google
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[10px] text-slate-500 font-black uppercase tracking-wider">
              <ShieldCheck size={14} className="text-emerald-500" />
              Acceso Seguro y Encriptado
            </div>
          </div>

          <div className="pt-4 border-t border-white/5">
            <p className="text-[9px] text-slate-500 font-medium leading-relaxed max-w-[200px] mx-auto">
              Al entrar, aceptas nuestros términos y condiciones de uso del software SaaS.
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center">
          <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">
            EduGest Cloud v6.0 © 2026
          </p>
        </div>
      </div>
    </div>
  );
};
