import { supabase } from '../lib/supabase';

export interface SaaSPlan {
  id: string;
  name: string;
  max_students: number;
  max_teachers: number;
  max_managers: number;
  max_support: number;
  max_users: number;
  price_monthly: number;
  price_yearly: number;
  created_at: string;
}

export interface SaaSPayment {
  id: string;
  license_id: string;
  amount: number;
  payment_date: string;
  method: 'Transferencia' | 'Efectivo' | 'Tarjeta' | 'Otro';
  reference_note: string | null;
  created_at: string;
}

export interface SaaSProductKey {
  id: string;
  product_key: string;
  is_used: boolean;
  used_by_center: string | null;
  linked_email: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
  price: number;
  plan_id: string | null;
  created_at: string;
  center_name?: string;
  plan_name?: string;
}

export interface SaaSStats {
  totalLicenses: number;
  activeLicenses: number;
  pendingLicenses: number;
  totalEarnings: number; // Sum of all payments
}

export const getPlans = async (): Promise<SaaSPlan[]> => {
  const { data, error } = await supabase
    .from('saas_plans')
    .select('*')
    .order('price_monthly', { ascending: true });
  if (error) throw new Error(error.message);
  return data as SaaSPlan[];
};

export const createPlan = async (plan: Omit<SaaSPlan, 'id' | 'created_at'>): Promise<void> => {
  const { error } = await supabase.from('saas_plans').insert([plan]);
  if (error) throw new Error(error.message);
};

export const updatePlan = async (id: string, plan: Partial<SaaSPlan>): Promise<void> => {
  const { error } = await supabase.from('saas_plans').update(plan).eq('id', id);
  if (error) throw new Error(error.message);
};

export const registerPayment = async (
  licenseId: string,
  amount: number,
  method: string,
  reference: string,
  monthsToAdd: number = 1
): Promise<void> => {
  const { error } = await supabase.rpc('register_saas_payment', {
    p_license_id: licenseId,
    p_amount: amount,
    p_method: method,
    p_reference: reference,
    p_months_to_add: monthsToAdd
  });
  if (error) throw new Error(error.message);
};

export const getPayments = async (): Promise<SaaSPayment[]> => {
  const { data, error } = await supabase
    .from('saas_payments')
    .select('*')
    .order('payment_date', { ascending: false });
  if (error) throw new Error(error.message);
  return data as SaaSPayment[];
};

export const generateLicenses = async (count: number, price: number): Promise<SaaSProductKey[]> => {
  const { data, error } = await supabase.rpc('generate_saas_licenses', {
    p_count: count,
    p_price: price
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as SaaSProductKey[];
};

export const getLicenses = async (): Promise<SaaSProductKey[]> => {
  const { data, error } = await supabase
    .from('saas_licenses')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error('GetLicenses Error: ' + error.message);
  }

  // Fetch plans and centers manually to avoid PostgREST relationship errors
  const { data: plans } = await supabase.from('saas_plans').select('id, name');
  const { data: centers } = await supabase.from('centers').select('id, name');

  return data.map((item: any) => {
    const plan = plans?.find((p) => p.id === item.plan_id);
    const center = centers?.find((c) => c.id === item.used_by_center);
    return {
      ...item,
      center_name: center?.name || null,
      plan_name: plan?.name || 'Básico'
    };
  }) as SaaSProductKey[];
};

export const deleteCenter = async (centerId: string): Promise<void> => {
  const { error } = await supabase.rpc('delete_saas_center', {
    p_center_id: centerId
  });
  if (error) throw new Error(error.message);
};

export const getDashboardStats = async (): Promise<SaaSStats> => {
  // Get licenses stats
  const { data: licenses, error: licError } = await supabase
    .from('saas_licenses')
    .select('is_used');
  if (licError) throw new Error(licError.message);

  // Get payments sum for total earnings
  const { data: payments, error: payError } = await supabase.from('saas_payments').select('amount');
  if (payError) throw new Error(payError.message);

  const totalEarnings = payments.reduce((sum, p) => sum + Number(p.amount), 0);

  const stats = licenses.reduce(
    (acc: SaaSStats, license: any) => {
      acc.totalLicenses += 1;
      if (license.is_used) {
        acc.activeLicenses += 1;
      } else {
        acc.pendingLicenses += 1;
      }
      return acc;
    },
    { totalLicenses: 0, activeLicenses: 0, pendingLicenses: 0, totalEarnings }
  );

  return stats;
};

export const sendPasswordReset = async (email: string): Promise<void> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/`
  });

  if (error) {
    throw new Error(error.message);
  }
};

export const assignPlanToLicense = async (licenseId: string, planId: string): Promise<void> => {
  const { error } = await supabase
    .from('saas_licenses')
    .update({ plan_id: planId })
    .eq('id', licenseId);
  if (error) throw new Error(error.message);
};

export const switchActiveCenter = async (centerId: string): Promise<void> => {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('No autenticado.');

  const { error } = await supabase
    .from('profiles')
    .update({ center_id: centerId })
    .eq('id', user.id);

  if (error) throw new Error(error.message);
};

export const updateSubscriptionEndDate = async (
  licenseId: string,
  endDate: string | null
): Promise<void> => {
  const { error } = await supabase
    .from('saas_licenses')
    .update({ subscription_end_date: endDate })
    .eq('id', licenseId);
  if (error) throw new Error(error.message);
};

export const exportCenterData = async (centerId: string): Promise<any> => {
  const { data, error } = await supabase.rpc('export_center_data', {
    p_center_id: centerId
  });
  if (error) throw new Error(error.message);
  return data;
};

export const importCenterData = async (targetCenterId: string, backupData: any): Promise<void> => {
  const { error } = await supabase.rpc('import_center_data', {
    p_target_center_id: targetCenterId,
    p_backup_data: backupData
  });
  if (error) throw new Error(error.message);
};

export const deletePayment = async (paymentId: string): Promise<void> => {
  const { error } = await supabase.from('saas_payments').delete().eq('id', paymentId);
  if (error) throw new Error(error.message);
};

export const updatePayment = async (
  paymentId: string,
  updates: {
    amount: number;
    method: string;
    reference_note: string | null;
    payment_date: string;
  }
): Promise<void> => {
  const { error } = await supabase.from('saas_payments').update(updates).eq('id', paymentId);
  if (error) throw new Error(error.message);
};

export const createCenterWithLinkedEmail = async (params: {
  name: string;
  email: string;
  planId?: string | null;
  months?: number;
  district?: string;
  regional?: string;
  phone?: string;
}): Promise<{
  center_id: string;
  license_id?: string;
  product_key: string;
  email: string;
  end_date: string;
}> => {
  const cleanEmail = params.email.trim().toLowerCase();
  const months = params.months || 12;
  const endDate = new Date();
  endDate.setMonth(endDate.getMonth() + months);

  // 1. Intentar llamar a RPC si está disponible en la base de datos
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_saas_center_with_email', {
      p_name: params.name.trim(),
      p_email: cleanEmail,
      p_plan_id: params.planId || null,
      p_months: months,
      p_district: params.district?.trim() || null,
      p_regional: params.regional?.trim() || null,
      p_phone: params.phone?.trim() || null
    });

    if (!rpcError && rpcData && rpcData.center_id) {
      return rpcData;
    }
  } catch (e) {
    console.warn('RPC create_saas_center_with_email fallback to direct queries:', e);
  }

  // 2. Fallback resiliente: Operaciones directas en las tablas de Supabase
  // Insertar Centro
  const { data: newCenter, error: centerErr } = await supabase
    .from('centers')
    .insert([
      {
        name: params.name.trim(),
        district: params.district?.trim() || null,
        regional: params.regional?.trim() || null,
        phone: params.phone?.trim() || null
      }
    ])
    .select()
    .single();

  if (centerErr) throw new Error('Error al crear centro: ' + centerErr.message);

  // Generar Product Key única
  const randomPart =
    Math.random().toString(36).substring(2, 6).toUpperCase() +
    '-' +
    Math.random().toString(36).substring(2, 6).toUpperCase();
  const productKey = `EDUGENS-${randomPart}`;

  // Insertar Licencia vinculada al nuevo centro y al correo
  const { data: newLicense, error: licErr } = await supabase
    .from('saas_licenses')
    .insert([
      {
        product_key: productKey,
        is_used: true,
        used_by_center: newCenter.id,
        linked_email: cleanEmail,
        plan_id: params.planId || null,
        subscription_start_date: new Date().toISOString(),
        subscription_end_date: endDate.toISOString()
      }
    ])
    .select()
    .single();

  if (licErr) {
    console.warn('Error al insertar licencia:', licErr.message);
  }

  // Crear Año Escolar Inicial por defecto
  try {
    await supabase.from('school_years').insert([
      {
        center_id: newCenter.id,
        name: '2026-2027',
        is_active: true,
        status: 'activo'
      }
    ]);
  } catch {}

  // Si el usuario ya está registrado en profiles con ese correo, vincularlo de inmediato
  try {
    await supabase
      .from('profiles')
      .update({
        center_id: newCenter.id,
        role: 'admin',
        is_active: true
      })
      .ilike('email', cleanEmail);
  } catch {}

  return {
    center_id: newCenter.id,
    license_id: newLicense?.id,
    product_key: productKey,
    email: cleanEmail,
    end_date: endDate.toISOString()
  };
};

export const updateCenterLinkedEmail = async (
  licenseId: string,
  centerId: string,
  newEmail: string
): Promise<void> => {
  const cleanEmail = newEmail.trim().toLowerCase();

  // Actualizar email en saas_licenses
  const { error: licErr } = await supabase
    .from('saas_licenses')
    .update({ linked_email: cleanEmail })
    .eq('id', licenseId);

  if (licErr) throw new Error('Error al actualizar correo en licencia: ' + licErr.message);

  // Vincular usuario en profiles si ya existe con este correo
  try {
    await supabase
      .from('profiles')
      .update({
        center_id: centerId,
        role: 'admin',
        is_active: true
      })
      .ilike('email', cleanEmail);
  } catch (err: any) {
    console.warn('Error vinculando perfil existente:', err.message);
  }
};
