export type CampaignType = 'trip' | 'event' | 'survey' | 'meeting' | 'campaign';

export type CampaignResponseStatus = 'yes' | 'no' | 'undecided';

export type CampaignPaymentStatus = 'pending' | 'partial' | 'paid' | 'not_applicable';

export interface SurveyQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface SchoolCampaign {
  id: string;
  center_id: string;
  title: string;
  description?: string;
  type: CampaignType;
  location?: string;
  event_date?: string | null;
  deadline_date?: string | null;
  price: number;
  requires_permission: boolean;
  permission_text?: string;
  survey_questions?: SurveyQuestion[];
  target_courses?: string[] | null;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at?: string;
}

export interface SchoolCampaignResponse {
  id: string;
  campaign_id: string;
  center_id: string;
  student_id: string;
  parent_id?: string | null;
  response: CampaignResponseStatus;
  permission_granted: boolean;
  permission_signed_by?: string;
  permission_date?: string | null;
  emergency_contact_phone?: string;
  medical_notes?: string;
  survey_answers?: Record<string, string>;
  payment_status: CampaignPaymentStatus;
  amount_paid: number;
  payment_method?: string;
  receipt_number?: string;
  payment_date?: string | null;
  notes?: string;
  created_at: string;
  updated_at?: string;
}
