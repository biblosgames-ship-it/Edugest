import { supabase } from '../lib/supabase';

export interface RecoveryScheduleWeek {
  weekNumber: number;
  startDate: string;
  endDate: string;
  subjectIds: string[];
  title?: string;
}

export interface RecoveryPlan {
  id: string;
  center_id: string;
  course_id: string;
  school_year: string;
  period: string; // 'P1' | 'P2' | 'P3' | 'P4' | 'FINAL'
  title: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  schedule_weeks: RecoveryScheduleWeek[];
  status: 'draft' | 'active' | 'completed';
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface RecoveryPlanStudent {
  id?: string;
  plan_id: string;
  center_id: string;
  course_id: string;
  student_id: string;
  subject_id: string;
  original_score: number;
  recovery_score?: number | null;
  status: 'pending' | 'in_progress' | 'approved' | 'failed';
  week_number?: number;
  start_date?: string;
  end_date?: string;
  notes?: string;
  student_name?: string;
  subject_name?: string;
}

export const recoveryPlanService = {
  // 1. Obtener planes de recuperación de un curso
  async getPlans(courseId: string, schoolYear?: string): Promise<RecoveryPlan[]> {
    if (!courseId) return [];
    try {
      let query = supabase
        .from('recovery_plans')
        .select('*')
        .eq('course_id', courseId)
        .order('created_at', { ascending: false });

      if (schoolYear) {
        query = query.eq('school_year', schoolYear);
      }

      const { data, error } = await query;
      if (!error && data) {
        try {
          localStorage.setItem(`edugest_recovery_plans_${courseId}`, JSON.stringify(data));
        } catch {}
        return data as RecoveryPlan[];
      }
    } catch (e) {
      console.warn('[recoveryPlanService] Error fetching recovery plans:', e);
    }

    try {
      const local = localStorage.getItem(`edugest_recovery_plans_${courseId}`);
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  },

  // 2. Obtener estudiantes asignados a un plan
  async getPlanStudents(planId: string): Promise<RecoveryPlanStudent[]> {
    if (!planId) return [];
    try {
      const { data, error } = await supabase
        .from('recovery_plan_students')
        .select('*')
        .eq('plan_id', planId);

      if (!error && data) {
        try {
          localStorage.setItem(`edugest_recovery_plan_students_${planId}`, JSON.stringify(data));
        } catch {}
        return data as RecoveryPlanStudent[];
      }
    } catch (e) {
      console.warn('[recoveryPlanService] Error fetching plan students:', e);
    }

    try {
      const local = localStorage.getItem(`edugest_recovery_plan_students_${planId}`);
      return local ? JSON.parse(local) : [];
    } catch {
      return [];
    }
  },

  // 3. Obtener planes activos de un estudiante específico (para Alumnos y Padres)
  async getStudentRecoverySubjects(studentId: string, courseId?: string): Promise<{
    plan: RecoveryPlan;
    records: RecoveryPlanStudent[];
  }[]> {
    if (!studentId) return [];
    try {
      let query = supabase
        .from('recovery_plan_students')
        .select('*, plan:recovery_plans(*)')
        .eq('student_id', studentId);

      if (courseId) {
        query = query.eq('course_id', courseId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        // Agrupar por plan
        const plansMap = new Map<string, { plan: RecoveryPlan; records: RecoveryPlanStudent[] }>();
        data.forEach((row: any) => {
          if (row.plan && (row.plan.status === 'active' || row.plan.status === 'completed')) {
            const planId = row.plan.id;
            if (!plansMap.has(planId)) {
              plansMap.set(planId, { plan: row.plan, records: [] });
            }
            plansMap.get(planId)!.records.push(row);
          }
        });
        return Array.from(plansMap.values());
      }
    } catch (e) {
      console.warn('[recoveryPlanService] Error fetching student recovery subjects:', e);
    }
    return [];
  },

  // 4. Guardar o actualizar un plan de recuperación
  async savePlan(
    planData: Partial<RecoveryPlan>,
    studentsRecords: Partial<RecoveryPlanStudent>[]
  ): Promise<RecoveryPlan | null> {
    try {
      let savedPlan: RecoveryPlan | null = null;
      const isUpdate = !!planData.id;

      if (isUpdate) {
        const { data, error } = await supabase
          .from('recovery_plans')
          .update({
            ...planData,
            updated_at: new Date().toISOString()
          })
          .eq('id', planData.id)
          .select()
          .single();

        if (error) throw error;
        savedPlan = data;
      } else {
        const { data, error } = await supabase
          .from('recovery_plans')
          .insert([planData])
          .select()
          .single();

        if (error) throw error;
        savedPlan = data;
      }

      if (!savedPlan) throw new Error('No se pudo guardar el plan.');

      // Guardar / reemplazar estudiantes asignados
      if (studentsRecords && studentsRecords.length > 0) {
        const recordsToInsert = studentsRecords.map((s) => ({
          ...s,
          plan_id: savedPlan!.id,
          center_id: savedPlan!.center_id,
          course_id: savedPlan!.course_id,
          updated_at: new Date().toISOString()
        }));

        await supabase
          .from('recovery_plan_students')
          .upsert(recordsToInsert, { onConflict: 'plan_id,student_id,subject_id' });
      }

      // Si el plan se activa ('active'), crear las entradas en el calendario / Agenda (activities)
      if (savedPlan.status === 'active' && savedPlan.schedule_weeks && savedPlan.schedule_weeks.length > 0) {
        await this.syncPlanToAgenda(savedPlan);
      }

      return savedPlan;
    } catch (err) {
      console.error('[recoveryPlanService] Error in savePlan:', err);
      throw err;
    }
  },

  // 5. Crear entradas en el calendario escolar (activities) al inicio de cada bloque / semana
  async syncPlanToAgenda(plan: RecoveryPlan) {
    if (!plan.center_id || !plan.schedule_weeks || plan.schedule_weeks.length === 0) return;

    try {
      for (const week of plan.schedule_weeks) {
        if (!week.startDate) continue;

        const title = `[Recuperación] ${plan.title || 'Plan de Recuperación'} - Sem. ${week.weekNumber}`;
        const description = `Período: ${plan.period}. Fechas: del ${week.startDate} al ${week.endDate}.`;

        // Verificar si ya existe actividad para este plan y semana
        const { data: existing } = await supabase
          .from('activities')
          .select('id')
          .eq('center_id', plan.center_id)
          .eq('date', week.startDate)
          .ilike('title', `%[Recuperación]%Sem. ${week.weekNumber}%`)
          .limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from('activities').insert([
            {
              center_id: plan.center_id,
              title,
              description,
              date: week.startDate,
              start_time: '08:00',
              end_time: '14:00',
              type: 'academic',
              suspends_classes: false
            }
          ]);
        }
      }
    } catch (e) {
      console.warn('[recoveryPlanService] Advertencia creando entradas en Agenda:', e);
    }
  },

  // 6. Eliminar un plan
  async deletePlan(planId: string): Promise<boolean> {
    try {
      const { error } = await supabase.from('recovery_plans').delete().eq('id', planId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('[recoveryPlanService] Error deleting plan:', err);
      return false;
    }
  }
};
