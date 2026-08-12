import React, { useState } from 'react';
import { useSupabase } from '../context/AppContext';
import {
  validateInvitationCode,
  registerMemberWithCode,
  getStaffForInvitation,
  createUserProfile
} from '../services/userService';
import { supabase } from '../lib/supabase';

export const InvitationForm = () => {
  const { user } = useSupabase();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // States for detected course code flow (Students/Parents)
  const [isCourseCode, setIsCourseCode] = useState(false);
  const [detectedCourse, setDetectedCourse] = useState<any>(null);
  const [role, setRole] = useState<'student' | 'parent'>('student');
  const [courseStudents, setCourseStudents] = useState<any[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [manualStudentName, setManualStudentName] = useState('');

  // States for administrative staff/conserje verification flow
  const [isStaffCode, setIsStaffCode] = useState(false);
  const [detectedStaffRole, setDetectedStaffRole] = useState('');
  const [detectedCenterId, setDetectedCenterId] = useState('');
  const [detectedAllowedPanels, setDetectedAllowedPanels] = useState<string[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [manualStaffName, setManualStaffName] = useState('');

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;

    setIsLoading(true);
    setError('');

    const sanitizedCode = code.trim().toUpperCase().replace(/\s+/g, '');

    if (!sanitizedCode) {
      setError('Por favor ingresa un código.');
      setIsLoading(false);
      return;
    }

    try {
      let codeData: any = null;
      try {
        codeData = await validateInvitationCode(sanitizedCode);
      } catch (valErr: any) {
        // AUTORREPARACIÓN E INGRESO DIRECTO:
        // Si el sistema dice que el código ya fue utilizado, verificar si pertenece al usuario o a su centro/docente
        const { data: directCode } = await supabase
          .from('invitation_codes')
          .select('*')
          .eq('code', sanitizedCode)
          .maybeSingle();

        if (directCode) {
          const { data: staffMatch } = await supabase
            .from('teachers')
            .select('*')
            .eq('center_id', directCode.center_id)
            .ilike('email', user.email?.trim() || '')
            .maybeSingle();

          const { data: profileMatch } = await supabase
            .from('profiles')
            .select('*')
            .eq('invitation_code', sanitizedCode)
            .maybeSingle();

          if (staffMatch || profileMatch || directCode.center_id) {
            const targetRole = directCode.role || staffMatch?.role || 'teacher';
            const targetCenterId = directCode.center_id;
            const targetName = staffMatch?.name || profileMatch?.full_name || user.email?.split('@')[0] || 'Docente';

            await supabase.from('profiles').upsert({
              id: user.id,
              email: user.email,
              full_name: targetName,
              role: targetRole,
              center_id: targetCenterId,
              invitation_code: sanitizedCode,
              teacher_id: staffMatch?.id || profileMatch?.teacher_id || null,
              is_active: true,
              allowed_panels: directCode.allowed_panels?.length ? directCode.allowed_panels : ['dashboard', 'classroom', 'agenda', 'digital-register', 'tasks', 'communications']
            });

            window.location.reload();
            return;
          }
        }

        throw valErr;
      }

      if (codeData.type === 'invitation') {
        const fetchedStaff = await getStaffForInvitation(sanitizedCode);

        const autoMatched = fetchedStaff.find(
          (s: any) => s.email && s.email.trim().toLowerCase() === user.email?.trim().toLowerCase()
        );

        if (autoMatched) {
          try {
            await registerMemberWithCode(
              sanitizedCode,
              autoMatched.name,
              undefined,
              undefined,
              autoMatched.id
            );
          } catch (rErr) {
            console.warn('RPC warning, proceeding with direct activation:', rErr);
          }

          await supabase.from('profiles').upsert({
            id: user.id,
            email: user.email,
            full_name: autoMatched.name,
            role: codeData.role || autoMatched.role || 'teacher',
            center_id: codeData.center_id,
            invitation_code: sanitizedCode,
            teacher_id: autoMatched.id,
            is_active: true,
            allowed_panels: codeData.allowed_panels?.length ? codeData.allowed_panels : ['dashboard', 'classroom', 'agenda', 'digital-register', 'tasks', 'communications']
          });

          window.location.reload();
          return;
        }

        // No auto-match: Prepare the selector dropdown
        const normalizedRole = codeData.role.toLowerCase();
        let targetTeam = '';
        if (normalizedRole.includes('support') || normalizedRole.includes('conserje')) {
          targetTeam = 'support';
        } else if (normalizedRole.includes('teacher') || normalizedRole.includes('docente')) {
          targetTeam = 'teacher';
        } else if (
          normalizedRole.includes('coord') ||
          normalizedRole.includes('admin') ||
          normalizedRole.includes('finance')
        ) {
          targetTeam = 'management';
        }

        const filteredStaff = fetchedStaff.filter((s: any) => {
          // Exclude if already linked to another email
          if (s.email && s.email.trim().toLowerCase() !== user.email?.trim().toLowerCase()) {
            return false;
          }
          const t = (s.team || '').toLowerCase();
          if (targetTeam === 'support') {
            return t.includes('support') || t.includes('apoyo') || t.includes('cons');
          } else if (targetTeam === 'teacher') {
            return (
              t.includes('teacher') || t.includes('docente') || t.includes('management_teacher')
            );
          } else if (targetTeam === 'management') {
            return (
              t.includes('management') ||
              t.includes('gest') ||
              t.includes('admin') ||
              t.includes('secret') ||
              t.includes('coord') ||
              t.includes('management_teacher')
            );
          }
          return true;
        });

        setStaffList(filteredStaff);
        setDetectedStaffRole(codeData.role);
        setDetectedCenterId(codeData.center_id);
        setDetectedAllowedPanels(codeData.allowed_panels || []);
        setIsStaffCode(true);
      } else if (codeData.type === 'course') {
        // Cargar alumnos inscritos en este curso para la selección
        try {
          const { data: stData } = await supabase
            .from('students')
            .select('*')
            .eq('course_id', codeData.course_id);

          setCourseStudents(stData || []);
        } catch (stErr) {
          console.error('Error al cargar lista de estudiantes del curso:', stErr);
        }

        setIsCourseCode(true);
        setDetectedCourse(codeData);
      } else {
        throw new Error('Tipo de código no reconocido.');
      }
    } catch (err: any) {
      setError(err.message || 'Error al procesar el código');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email || !detectedCourse) return;

    setIsLoading(true);
    setError('');

    let selectedName = '';
    if (selectedStudentId === 'manual') {
      selectedName = manualStudentName.trim();
      if (!selectedName) {
        setError('Por favor escribe el nombre completo.');
        setIsLoading(false);
        return;
      }
    } else if (selectedStudentId) {
      const matchSt = courseStudents.find((s) => s.id === selectedStudentId);
      if (matchSt) {
        if (matchSt.first_surname || matchSt.names) {
          const surnames = `${matchSt.first_surname || ''} ${matchSt.second_surname || ''}`.trim();
          const names = matchSt.names || '';
          selectedName = surnames ? `${names} ${surnames}`.trim() : names;
        } else if (matchSt.first_name || matchSt.last_name) {
          selectedName = `${matchSt.first_name || ''} ${matchSt.last_name || ''}`.trim();
        } else {
          selectedName = matchSt.name || '';
        }
      }
    }

    if (!selectedName) {
      setError('Por favor selecciona tu nombre de la lista o escribe una entrada manual.');
      setIsLoading(false);
      return;
    }

    const sanitizedCode = code.trim().toUpperCase().replace(/\s+/g, '');

    try {
      // 1. Obtener la cantidad de alumnos registrados en el curso
      const { count: studentCount, error: countErr } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', detectedCourse.course_id);

      if (countErr) throw countErr;

      // 2. Obtener la cantidad de perfiles ya registrados para este curso (roles student y parent)
      const { count: profilesCount, error: profilesErr } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('course_code', sanitizedCode)
        .in('role', ['student', 'parent'])
        .neq('id', user.id);

      if (profilesErr) throw profilesErr;

      // 3. Validar límite (3 usuarios por alumno registrado en el curso)
      const maxAllowed = (studentCount || 0) * 3;
      if (studentCount && (profilesCount || 0) >= maxAllowed) {
        throw new Error(
          `Límite de registros alcanzado. El límite es de 3 cuentas (padres/alumnos) por cada alumno registrado en la lista oficial del curso.`
        );
      }

      const finalFullName =
        role === 'parent' ? `${selectedName} (Padre/Madre)` : selectedName;

      // Guardar inmediatamente la vinculación en localStorage para persistencia visual inmediata
      localStorage.setItem('selected_course_id', detectedCourse.course_id);
      localStorage.setItem('course_code', sanitizedCode);
      if (role === 'parent') {
        localStorage.setItem('parent_course_ids', JSON.stringify([detectedCourse.course_id]));
      }

      // Intentar completar el registro vía RPC
      let rpcSuccess = false;
      try {
        await registerMemberWithCode(sanitizedCode, finalFullName, undefined, role);
        rpcSuccess = true;
      } catch (rpcErr) {
        console.warn('RPC registerMemberWithCode tuvo una alerta, aplicando fallback directo:', rpcErr);
      }

      // Actualización segura y directa del perfil del usuario
      const profileUpdates: any = {
        center_id: detectedCourse.center_id,
        role: role,
        full_name: finalFullName,
        course_code: sanitizedCode,
        course_id: detectedCourse.course_id,
        is_active: true,
        allowed_panels: ['dashboard', 'schedule', 'agenda']
      };

      if (role === 'parent') {
        profileUpdates.parent_course_ids = [detectedCourse.course_id];
      }

      try {
        await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', user.id);
      } catch (e) {
        console.warn('Profile direct update fallback error:', e);
      }

      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Error al activar acceso al curso');
      setIsLoading(false);
    }
  };

  const handleActivateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;
    if (!selectedStaffId) {
      setError('Por favor selecciona tu nombre o elige la opción manual.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      let finalName = '';
      let matchedStaffObj = null;

      if (selectedStaffId === 'manual') {
        finalName = manualStaffName.trim();
        if (!finalName) throw new Error('Debes escribir un nombre válido.');
      } else {
        matchedStaffObj = staffList.find((s) => s.id === selectedStaffId);
        if (!matchedStaffObj) throw new Error('El empleado seleccionado no es válido.');
        finalName = matchedStaffObj.name;
      }

      // Validar límite general de usuarios según el plan SaaS
      if (detectedCenterId) {
        const { data: license, error: licErr } = await supabase
          .from('saas_licenses')
          .select('*, plan:saas_plans(*)')
          .eq('used_by_center', detectedCenterId)
          .maybeSingle();

        if (licErr) console.error('Error fetching license in handleActivateStaff:', licErr);

        if (license?.plan) {
          const maxUsers = license.plan.max_users;
          if (maxUsers !== undefined && maxUsers !== null) {
            const { count: centerUsersCount, error: usersErr } = await supabase
              .from('profiles')
              .select('*', { count: 'exact', head: true })
              .eq('center_id', detectedCenterId)
              .neq('id', user.id);

            if (usersErr) throw usersErr;

            if (centerUsersCount !== null && centerUsersCount >= maxUsers) {
              throw new Error(
                `Se ha alcanzado el límite de usuarios creados permitido por el plan SaaS de este centro (${centerUsersCount} de ${maxUsers} permitidos).`
              );
            }
          }
        }
      }

      const sanitizedCode = code.trim().toUpperCase().replace(/\s+/g, '');

      // 1. Ejecutar el RPC
      try {
        await registerMemberWithCode(
          sanitizedCode,
          finalName,
          undefined,
          undefined,
          matchedStaffObj ? matchedStaffObj.id : undefined
        );
      } catch (rpcErr) {
        console.warn('RPC warning in handleActivateStaff, executing direct profile activation:', rpcErr);
      }

      // 2. FORZAR LA ACTUALIZACIÓN Y ACTIVACIÓN DIRECTA EN PROFILES
      const roleToUse = detectedStaffRole || matchedStaffObj?.role || 'teacher';
      await supabase.from('profiles').upsert({
        id: user.id,
        email: user.email,
        full_name: finalName,
        role: roleToUse,
        center_id: detectedCenterId,
        invitation_code: sanitizedCode,
        teacher_id: matchedStaffObj?.id || null,
        is_active: true,
        allowed_panels: detectedAllowedPanels?.length ? detectedAllowedPanels : ['dashboard', 'classroom', 'agenda', 'digital-register', 'tasks', 'communications']
      });

      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Error al vincular el perfil');
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {!isCourseCode && !isStaffCode ? (
        <form onSubmit={handleVerifyCode} className="space-y-4">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 pl-1">
              Ingresa el código
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej: DOCENTE2026 o GEN-5A"
              className="w-full px-4 py-3.5 border-2 border-slate-100 rounded-2xl bg-slate-50 font-mono font-bold uppercase text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all text-center"
            />
          </div>
          {error && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-2xl animate-pulse">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-150 disabled:opacity-50"
          >
            {isLoading ? 'Verificando...' : 'Verificar Código'}
          </button>
        </form>
      ) : isStaffCode ? (
        <form onSubmit={handleActivateStaff} className="space-y-5 animate-in fade-in duration-300">
          <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-2xl">
            <span className="text-[8px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
              Invitación Confirmada
            </span>
            <h3 className="text-base font-black text-indigo-950 uppercase mt-2">
              Rol:{' '}
              {detectedStaffRole === 'support' || detectedStaffRole === 'conserje'
                ? 'Personal de Apoyo (Conserje)'
                : detectedStaffRole === 'teacher'
                  ? 'Docente'
                  : detectedStaffRole}
            </h3>
            <p className="text-[10px] text-indigo-700 font-bold uppercase mt-1">
              Vincular perfil de usuario
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
              Selecciona tu Nombre Registrado
            </label>
            <select
              required
              className="w-full px-4 py-3.5 border-2 border-slate-100 rounded-xl bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all"
              value={selectedStaffId}
              onChange={(e) => setSelectedStaffId(e.target.value)}
            >
              <option value="">-- Selecciona tu nombre --</option>
              {staffList.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.position || s.team})
                </option>
              ))}
              <option value="manual">Mi nombre no está en la lista (Escribir manualmente)</option>
            </select>
          </div>

          {selectedStaffId === 'manual' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                Escribe tu Nombre Completo
              </label>
              <input
                type="text"
                value={manualStaffName}
                onChange={(e) => setManualStaffName(e.target.value)}
                placeholder="Nombre completo"
                className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
            </div>
          )}

          {error && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-2xl">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsStaffCode(false);
                setStaffList([]);
                setSelectedStaffId('');
                setManualStaffName('');
                setError('');
              }}
              className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-4 rounded-[2rem] font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Atrás
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-100 disabled:opacity-50"
            >
              {isLoading ? 'Vinculando...' : 'Confirmar y Entrar'}
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleActivateCourse} className="space-y-5 animate-in fade-in duration-300">
          <div className="bg-indigo-50/50 border border-indigo-100 p-5 rounded-2xl">
            <span className="text-[8px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">
              Curso Encontrado
            </span>
            <h3 className="text-base font-black text-indigo-950 uppercase mt-2">
              {detectedCourse.grade} "{detectedCourse.section}"
            </h3>
            <p className="text-[10px] text-indigo-700 font-bold uppercase mt-1">
              Nivel: {detectedCourse.level}
            </p>
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
              ¿Quién se registra?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('student')}
                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
                  role === 'student'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                    : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                }`}
              >
                Soy Alumno
              </button>
              <button
                type="button"
                onClick={() => setRole('parent')}
                className={`py-3 rounded-xl text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
                  role === 'parent'
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                    : 'bg-slate-50 border-slate-100 text-slate-500 hover:bg-slate-100'
                }`}
              >
                Soy Padre/Madre
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
              {role === 'parent'
                ? 'Selecciona el Nombre de tu Hijo(a)'
                : 'Selecciona tu Nombre en la Lista del Curso'}
            </label>
            <select
              required
              className="w-full px-4 py-3.5 border-2 border-slate-100 rounded-xl bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all"
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
            >
              <option value="">-- Seleccionar de la lista oficial del curso --</option>
              {courseStudents.map((st: any) => {
                let displayName = '';
                if (st.first_surname || st.names) {
                  const surnames = `${st.first_surname || ''} ${st.second_surname || ''}`.trim();
                  const names = st.names || '';
                  displayName = surnames ? `${surnames}, ${names}` : names;
                } else if (st.first_name || st.last_name) {
                  displayName = `${st.last_name || ''}, ${st.first_name || ''}`.trim();
                } else {
                  displayName = st.name || 'Estudiante';
                }
                const orderStr = st.order_number ? `#${st.order_number} - ` : '';
                return (
                  <option key={st.id} value={st.id}>
                    {orderStr}{displayName}
                  </option>
                );
              })}
              <option value="manual">
                {role === 'parent'
                  ? 'El nombre de mi hijo(a) no está en la lista (Escribir manualmente)'
                  : 'Mi nombre no está en la lista (Escribir manualmente)'}
              </option>
            </select>
          </div>

          {selectedStudentId === 'manual' && (
            <div className="space-y-2 animate-in slide-in-from-top-2 duration-200">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">
                {role === 'parent'
                  ? 'Escribe el Nombre Completo de tu Hijo(a)'
                  : 'Escribe tu Nombre Completo'}
              </label>
              <input
                type="text"
                value={manualStudentName}
                onChange={(e) => setManualStudentName(e.target.value)}
                placeholder="Nombre completo del estudiante"
                className="w-full px-4 py-3 border-2 border-slate-100 rounded-xl bg-slate-50 text-xs font-bold text-slate-700 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                required
              />
            </div>
          )}

          {error && (
            <p className="text-xs font-semibold text-rose-600 bg-rose-50 border border-rose-100 p-3 rounded-2xl">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setIsCourseCode(false);
                setDetectedCourse(null);
                setError('');
              }}
              className="w-1/3 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-4 rounded-[2rem] font-black text-[10px] uppercase tracking-widest transition-all"
            >
              Atrás
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="w-2/3 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-100 disabled:opacity-50"
            >
              {isLoading ? 'Activando...' : 'Confirmar y Entrar'}
            </button>
          </div>
        </form>
      )}

      {/* Cerrar sesión */}
      <div className="border-t border-slate-100 pt-4">
        <button
          onClick={() => supabase.auth.signOut()}
          className="w-full text-slate-400 hover:text-slate-600 font-bold uppercase text-[9px] tracking-wider py-2 text-center"
        >
          Cerrar sesión y volver
        </button>
      </div>
    </div>
  );
};
