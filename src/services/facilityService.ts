import { supabase } from '../lib/supabase';

export interface FacilityArea {
  id?: string;
  center_id: string;
  name: string;
  code: string;
  type: string;
  location?: string;
  priority: string;
  status: string;
  assignee_id?: string;
  assignee_name?: string;
  observations?: string;
  created_at?: string;
}

export interface FacilityTask {
  id?: string;
  center_id: string;
  area_id: string;
  task_type: string;
  assignee_id?: string;
  assignee_name?: string;
  frequency: string;
  due_date?: string;
  status: string;
  checklist_items: any[];
  comments?: string;
  evidence_before?: string;
  evidence_during?: string;
  evidence_after?: string;
  created_at?: string;
}

export interface FacilityIncident {
  id?: string;
  center_id: string;
  area_id: string;
  incident_type: string;
  description: string;
  urgency: string;
  evidence_url?: string;
  status: string;
  assignee_id?: string;
  assignee_name?: string;
  created_at?: string;
}

export interface FacilityInventory {
  id?: string;
  center_id: string;
  name: string;
  quantity: number;
  min_stock: number;
  unit: string;
  created_at?: string;
}

export interface FacilityAsset {
  id?: string;
  center_id: string;
  name: string;
  serial_code?: string;
  area_id?: string;
  status: string;
  purchase_date?: string;
  responsible_name?: string;
  last_maintenance?: string;
  created_at?: string;
}

export const facilityService = {
  // ÁREAS
  async getAreas(centerId: string): Promise<FacilityArea[]> {
    const { data, error } = await supabase
      .from('facility_areas')
      .select('*')
      .eq('center_id', centerId)
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createArea(area: FacilityArea): Promise<FacilityArea> {
    const cleanArea = { ...area };
    if (cleanArea.assignee_id === '') cleanArea.assignee_id = undefined;
    
    const { data, error } = await supabase
      .from('facility_areas')
      .insert(cleanArea)
      .select()
      .single();
      
    if (error) {
      if ((error.code === '23503' || error.code === '22P02') && cleanArea.assignee_id) {
        delete cleanArea.assignee_id;
        const { data: retryData, error: retryError } = await supabase
          .from('facility_areas')
          .insert(cleanArea)
          .select()
          .single();
        if (retryError) throw retryError;
        return retryData;
      }
      throw error;
    }
    return data;
  },

  async updateArea(id: string, updates: Partial<FacilityArea>): Promise<void> {
    const cleanUpdates = { ...updates };
    if (cleanUpdates.assignee_id === '') cleanUpdates.assignee_id = undefined;
    
    const { error } = await supabase
      .from('facility_areas')
      .update(cleanUpdates)
      .eq('id', id);
      
    if (error) {
      if ((error.code === '23503' || error.code === '22P02') && cleanUpdates.assignee_id) {
        delete cleanUpdates.assignee_id;
        const { error: retryError } = await supabase
          .from('facility_areas')
          .update(cleanUpdates)
          .eq('id', id);
        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }
  },

  async deleteArea(id: string): Promise<void> {
    const { error } = await supabase
      .from('facility_areas')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // TAREAS
  async getTasks(centerId: string): Promise<FacilityTask[]> {
    const { data, error } = await supabase
      .from('facility_tasks')
      .select('*')
      .eq('center_id', centerId)
      .order('due_date', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createTask(task: FacilityTask): Promise<FacilityTask> {
    const cleanTask = { ...task };
    if (cleanTask.assignee_id === '') cleanTask.assignee_id = undefined;
    
    const { data, error } = await supabase
      .from('facility_tasks')
      .insert(cleanTask)
      .select()
      .single();
      
    if (error) {
      if ((error.code === '23503' || error.code === '22P02') && cleanTask.assignee_id) {
        delete cleanTask.assignee_id;
        const { data: retryData, error: retryError } = await supabase
          .from('facility_tasks')
          .insert(cleanTask)
          .select()
          .single();
        if (retryError) throw retryError;
        return retryData;
      }
      throw error;
    }
    return data;
  },

  async updateTask(id: string, updates: Partial<FacilityTask>): Promise<void> {
    const cleanUpdates = { ...updates };
    if (cleanUpdates.assignee_id === '') cleanUpdates.assignee_id = undefined;
    
    const { error } = await supabase
      .from('facility_tasks')
      .update(cleanUpdates)
      .eq('id', id);
      
    if (error) {
      if ((error.code === '23503' || error.code === '22P02') && cleanUpdates.assignee_id) {
        delete cleanUpdates.assignee_id;
        const { error: retryError } = await supabase
          .from('facility_tasks')
          .update(cleanUpdates)
          .eq('id', id);
        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }
  },

  async deleteTask(id: string): Promise<void> {
    const { error } = await supabase
      .from('facility_tasks')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // INCIDENCIAS
  async getIncidents(centerId: string): Promise<FacilityIncident[]> {
    const { data, error } = await supabase
      .from('facility_incidents')
      .select('*')
      .eq('center_id', centerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async createIncident(incident: FacilityIncident): Promise<FacilityIncident> {
    const cleanIncident = { ...incident };
    if (cleanIncident.assignee_id === '') cleanIncident.assignee_id = undefined;
    
    const { data, error } = await supabase
      .from('facility_incidents')
      .insert(cleanIncident)
      .select()
      .single();
      
    if (error) {
      if ((error.code === '23503' || error.code === '22P02') && cleanIncident.assignee_id) {
        delete cleanIncident.assignee_id;
        const { data: retryData, error: retryError } = await supabase
          .from('facility_incidents')
          .insert(cleanIncident)
          .select()
          .single();
        if (retryError) throw retryError;
        return retryData;
      }
      throw error;
    }
    return data;
  },

  async updateIncident(id: string, updates: Partial<FacilityIncident>): Promise<void> {
    const cleanUpdates = { ...updates };
    if (cleanUpdates.assignee_id === '') cleanUpdates.assignee_id = undefined;
    
    const { error } = await supabase
      .from('facility_incidents')
      .update(cleanUpdates)
      .eq('id', id);
      
    if (error) {
      if ((error.code === '23503' || error.code === '22P02') && cleanUpdates.assignee_id) {
        delete cleanUpdates.assignee_id;
        const { error: retryError } = await supabase
          .from('facility_incidents')
          .update(cleanUpdates)
          .eq('id', id);
        if (retryError) throw retryError;
      } else {
        throw error;
      }
    }
  },

  async deleteIncident(id: string): Promise<void> {
    const { error } = await supabase
      .from('facility_incidents')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // INVENTARIO
  async getInventory(centerId: string): Promise<FacilityInventory[]> {
    const { data, error } = await supabase
      .from('facility_inventory')
      .select('*')
      .eq('center_id', centerId)
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createInventoryItem(item: FacilityInventory): Promise<FacilityInventory> {
    const { data, error } = await supabase
      .from('facility_inventory')
      .insert(item)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateInventoryItem(id: string, updates: Partial<FacilityInventory>): Promise<void> {
    const { error } = await supabase
      .from('facility_inventory')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  },

  async deleteInventoryItem(id: string): Promise<void> {
    const { error } = await supabase
      .from('facility_inventory')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ACTIVOS
  async getAssets(centerId: string): Promise<FacilityAsset[]> {
    const { data, error } = await supabase
      .from('facility_assets')
      .select('*')
      .eq('center_id', centerId)
      .order('name', { ascending: true });
    if (error) throw error;
    return data || [];
  },

  async createAsset(asset: FacilityAsset): Promise<FacilityAsset> {
    const { data, error } = await supabase
      .from('facility_assets')
      .insert(asset)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateAsset(id: string, updates: Partial<FacilityAsset>): Promise<void> {
    const { error } = await supabase
      .from('facility_assets')
      .update(updates)
      .eq('id', id);
    if (error) throw error;
  },

  async deleteAsset(id: string): Promise<void> {
    const { error } = await supabase
      .from('facility_assets')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};
