import { supabase } from '../lib/supabase';

export interface SaaSContract {
  id: string;
  center_id?: string | null;
  token: string;
  center_name: string;
  director_name?: string | null;
  director_id_card?: string | null;
  director_email: string;
  plan_name: string;
  max_students: number;
  max_teachers: number;
  price: number;
  billing_cycle: 'Mensual' | 'Anual';
  currency: 'USD' | 'DOP';
  has_support_24_7: boolean;
  has_payment_filter: boolean;
  ad_mode: 'ad_free' | 'sponsored' | 'co_sponsored';
  inflation_clause_rate: number;
  status: 'pending' | 'signed' | 'expired';
  contract_terms_json?: any;
  signed_at?: string | null;
  signer_ip?: string | null;
  signer_user_agent?: string | null;
  created_at: string;
  updated_at: string;
}

export const createContract = async (data: {
  center_id?: string | null;
  center_name: string;
  director_email: string;
  director_name?: string;
  director_id_card?: string;
  plan_name: string;
  max_students?: number;
  max_teachers?: number;
  price: number;
  billing_cycle?: 'Mensual' | 'Anual';
  currency?: 'USD' | 'DOP';
  has_support_24_7?: boolean;
  has_payment_filter?: boolean;
  ad_mode?: 'ad_free' | 'sponsored' | 'co_sponsored';
  inflation_clause_rate?: number;
}): Promise<SaaSContract> => {
  const token = 'ct_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);

  const payload = {
    center_id: data.center_id || null,
    token,
    center_name: data.center_name.trim(),
    director_email: data.director_email.trim().toLowerCase(),
    director_name: data.director_name?.trim() || null,
    director_id_card: data.director_id_card?.trim() || null,
    plan_name: data.plan_name || 'Estándar',
    max_students: data.max_students || 500,
    max_teachers: data.max_teachers || 50,
    price: data.price || 0,
    billing_cycle: data.billing_cycle || 'Mensual',
    currency: data.currency || 'USD',
    has_support_24_7: !!data.has_support_24_7,
    has_payment_filter: !!data.has_payment_filter,
    ad_mode: data.ad_mode || 'ad_free',
    inflation_clause_rate: data.inflation_clause_rate ?? 25.0,
    status: 'pending'
  };

  const { data: contract, error } = await supabase
    .from('saas_contracts')
    .insert([payload])
    .select()
    .single();

  if (error) {
    console.error('Error creating saas_contract:', error);
    throw error;
  }

  return contract as SaaSContract;
};

export const getContractByToken = async (token: string): Promise<SaaSContract | null> => {
  const { data, error } = await supabase
    .from('saas_contracts')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('Error fetching contract by token:', error);
    throw error;
  }

  return data as SaaSContract | null;
};

export const signContract = async (
  token: string,
  signerInfo: {
    director_name: string;
    director_id_card: string;
    director_email?: string;
  }
): Promise<SaaSContract> => {
  // Obtener IP pública del cliente mediante servicio ligero
  let clientIp = 'Desconocida';
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
    const json = await res.json();
    if (json?.ip) clientIp = json.ip;
  } catch (_) {}

  const updates = {
    director_name: signerInfo.director_name.trim(),
    director_id_card: signerInfo.director_id_card.trim(),
    ...(signerInfo.director_email ? { director_email: signerInfo.director_email.trim().toLowerCase() } : {}),
    status: 'signed',
    signed_at: new Date().toISOString(),
    signer_ip: clientIp,
    signer_user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('saas_contracts')
    .update(updates)
    .eq('token', token)
    .select()
    .single();

  if (error) {
    console.error('Error signing contract:', error);
    throw error;
  }

  return data as SaaSContract;
};

export const getAllContracts = async (): Promise<SaaSContract[]> => {
  const { data, error } = await supabase
    .from('saas_contracts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error getting contracts:', error);
    return [];
  }

  return data as SaaSContract[];
};

export const deleteContract = async (id: string): Promise<void> => {
  const { error } = await supabase.from('saas_contracts').delete().eq('id', id);
  if (error) throw error;
};
