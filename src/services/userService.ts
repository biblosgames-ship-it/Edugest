import { supabase } from '../lib/supabase';

/**
 * Crea o actualiza un perfil de usuario en la tabla 'profiles'.
 * Nota: El trigger 'on_auth_user_created' ya crea un perfil básico en la DB,
 * esta función se usa para completar los datos al registrarse con invitación.
 */
export const createUserProfile = async (
  uid: string,
  email: string,
  invitationCode: string,
  role: string = 'student',
  isActive: boolean = true,
  phone?: string,
  courseIds?: string[],
  allowedPanels?: string[],
  centerId?: string,
  fullName?: string
) => {
  try {
    // Buscar si ya existe un perfil con ese correo electrónico (insensible a mayúsculas/minúsculas)
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', email.trim())
      .maybeSingle();

    const profilePayload: any = {
      email: email.trim(),
      role,
      is_active: isActive,
      invitation_code: invitationCode,
      phone: phone || null,
      course_code: courseIds && courseIds.length > 0 ? courseIds[0] : null,
      allowed_panels: allowedPanels || [],
      center_id: centerId || null
    };

    if (fullName) {
      profilePayload.full_name = fullName.trim();
    }

    if (existingProfile) {
      // Si el perfil ya existe, actualizamos sus campos y nos aseguramos de que el ID sea el UID de Auth actual
      const { error } = await supabase
        .from('profiles')
        .update({
          id: uid, // Sincroniza el ID de autenticación
          ...profilePayload
        })
        .eq('id', existingProfile.id);

      if (error) throw error;
    } else {
      // Si no existe, creamos uno nuevo con el UID
      const { error } = await supabase.from('profiles').insert({
        id: uid,
        ...profilePayload
      });

      if (error) throw error;
    }
  } catch (error) {
    console.error('Error creating/updating user profile:', error);
    throw error;
  }
};

export const getUserProfile = async (uid: string) => {
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Error getting user profile:', error);
    return null;
  }
};

export const createInvitationCode = async (
  code: string,
  role: string,
  courseId?: string,
  centerId?: string,
  allowedPanels?: string[]
) => {
  try {
    const payload: any = {
      code: code.trim().toUpperCase().replace(/\s+/g, ''),
      role,
      course_id: courseId || null,
      is_used: false,
      allowed_panels: allowedPanels || []
    };

    if (centerId) {
      payload.center_id = centerId;
    }

    const { error } = await supabase.from('invitation_codes').insert(payload);

    if (error) throw error;
  } catch (error) {
    console.error('Error creating invitation code:', error);
    throw error;
  }
};

export const validateInvitationCode = async (code: string) => {
  try {
    const sanitizedCode = code.trim().toUpperCase().replace(/\s+/g, '');
    const { data, error } = await supabase.rpc('validate_invitation_code', {
      p_code: sanitizedCode
    });

    if (error) throw error;
    if (!data || !data.valid) {
      throw new Error(data?.message || 'Código inválido o ya utilizado');
    }
    return data;
  } catch (error) {
    console.error('Error validating invitation code:', error);
    throw error;
  }
};

export const getActiveInvitationCodes = async (centerId: string) => {
  try {
    const { data, error } = await supabase
      .from('invitation_codes')
      .select('*')
      .eq('center_id', centerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error getting invitation codes:', error);
    return [];
  }
};

export const deleteInvitationCode = async (code: string) => {
  try {
    const { error } = await supabase.from('invitation_codes').delete().eq('code', code);

    if (error) throw error;
  } catch (error) {
    console.error('Error deleting invitation code:', error);
    throw error;
  }
};

export const updateUserStatus = async (uid: string, isActive: boolean) => {
  try {
    const { error } = await supabase.from('profiles').update({ is_active: isActive }).eq('id', uid);

    if (error) throw error;
  } catch (error) {
    console.error('Error updating user status:', error);
    throw error;
  }
};

export const registerMemberWithCode = async (
  code: string,
  fullName: string,
  phone?: string,
  role?: string,
  staffId?: string
) => {
  const { data, error } = await supabase.rpc('register_member_with_code', {
    p_code: code,
    p_full_name: fullName,
    p_phone: phone || null,
    p_role: role || null,
    p_staff_id: staffId || null
  });
  if (error) throw error;
  return data;
};

export const getStaffForInvitation = async (code: string) => {
  const { data, error } = await supabase.rpc('get_staff_for_invitation', {
    p_code: code
  });
  if (error) throw error;
  return data || [];
};
