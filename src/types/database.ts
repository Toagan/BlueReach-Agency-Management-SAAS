// ============================================
// DATABASE TYPES - Schema V2
// ============================================

// Enums
export type LeadStatus = "contacted" | "opened" | "clicked" | "replied" | "booked" | "won" | "lost" | "not_interested";
export type UserRole = "admin" | "client";
export type TeamRole = "owner" | "manager" | "member" | "viewer";
export type ActivityType = "call" | "meeting" | "email" | "note" | "status_change" | "task" | "other";
export type EmailEventType = "sent" | "opened" | "clicked" | "replied" | "bounced" | "unsubscribed" | "spam_complaint";
export type AuditAction = "create" | "update" | "delete";

// ============================================
// CORE TABLES
// ============================================

export interface Profile {
  id: string;
  email: string | null;
  role: UserRole;
  full_name: string | null;
}

export interface Client {
  id: string;
  name: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  client_id: string;
  instantly_campaign_id: string | null;
  provider_type: "instantly" | "smartlead" | "lemlist" | "apollo";
  provider_campaign_id: string | null;
  name: string;
  original_name: string | null;
  copy_body: string | null;
  is_active: boolean;
  last_synced_at: string | null;
}

export interface Lead {
  id: string;
  campaign_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  company_domain: string | null;
  phone: string | null;
  linkedin_url: string | null;
  personalization: string | null;
  status: LeadStatus;
  is_positive_reply: boolean;
  deal_value: number | null;
  next_action: string | null;
  next_action_date: string | null;
  instantly_lead_id: string | null;
  instantly_created_at: string | null;
  last_contacted_at: string | null;
  last_step_info: Record<string, unknown> | null;
  email_open_count: number;
  email_click_count: number;
  email_reply_count: number;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ClientUser {
  client_id: string;
  user_id: string;
  role?: TeamRole;
}

// ============================================
// LEAD DATABASE TABLES
// ============================================

export interface LeadSource {
  id: string;
  name: string;
  file_name: string | null;
  industry: string | null;
  region: string | null;
  sub_region: string | null;
  source_type: string | null;
  scrape_date: string | null;
  tags: string[] | null;
  notes: string | null;
  custom_fields: Record<string, unknown>;
  total_records: number;
  imported_records: number;
  duplicate_records: number;
  created_at: string;
  updated_at: string;
}

export interface EnrichedLead {
  id: string;
  source_id: string | null;
  url: string | null;
  domain: string | null;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  phone: string | null;
  company_name: string | null;
  company_size: string | null;
  company_revenue: string | null;
  company_founded: number | null;
  company_linkedin: string | null;
  country: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  sub_industry: string | null;
  extra_data: Record<string, unknown>;
  contacted_at: string | null;
  campaign_id: string | null;
  lead_id: string | null;
  scraped_at: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// PROVIDER & EMAIL TABLES
// ============================================

export type ProviderType = "instantly" | "smartlead" | "lemlist" | "apollo";
export type EmailDirection = "outbound" | "inbound";

export interface ApiProvider {
  id: string;
  client_id: string;
  provider_type: ProviderType;
  api_key: string;
  workspace_id: string | null;
  is_active: boolean;
  label: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignSequence {
  id: string;
  campaign_id: string;
  sequence_index: number;
  step_number: number;
  variant: string;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  delay_days: number;
  delay_hours: number;
  send_time_start: string | null;
  send_time_end: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface LeadEmail {
  id: string;
  lead_id: string;
  campaign_id: string | null;
  provider_email_id: string | null;
  provider_thread_id: string | null;
  direction: EmailDirection;
  from_email: string;
  to_email: string;
  cc_emails: string[] | null;
  bcc_emails: string[] | null;
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  sequence_step: number | null;
  is_auto_reply: boolean;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  raw_headers: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ============================================
// NEW TABLES
// ============================================

export interface Activity {
  id: string;
  lead_id: string;
  user_id: string | null;
  type: ActivityType;
  title: string | null;
  description: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface EmailEvent {
  id: string;
  lead_id: string | null;
  campaign_id: string | null;
  event_type: EmailEventType;
  instantly_event_id: string | null;
  email_subject: string | null;
  link_clicked: string | null;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface TeamMember {
  id: string;
  client_id: string;
  user_id: string;
  role: TeamRole;
  invited_by: string | null;
  invited_at: string;
  accepted_at: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_email: string | null;
  action: AuditAction;
  table_name: string;
  record_id: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  changed_fields: string[] | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============================================
// VIEW TYPES
// ============================================

export interface PositiveReply extends Lead {
  campaign_name: string;
  client_name: string;
  activity_count: number;
  last_activity_at: string | null;
}

export interface CampaignPerformance {
  campaign_id: string;
  campaign_name: string;
  client_name: string;
  total_leads: number;
  opened_count: number;
  clicked_count: number;
  replied_count: number;
  positive_reply_count: number;
  booked_count: number;
  won_count: number;
  total_deal_value: number;
}

// ============================================
// HELPER TYPES
// ============================================

// Lead with related data
export interface LeadWithRelations extends Lead {
  campaign?: Campaign;
  activities?: Activity[];
  email_events?: EmailEvent[];
}

// Activity with user info
export interface ActivityWithUser extends Activity {
  user?: Pick<Profile, "id" | "email" | "full_name">;
}

// Team member with user info
export interface TeamMemberWithUser extends TeamMember {
  user?: Pick<Profile, "id" | "email" | "full_name">;
}

// ============================================
// SUPABASE DATABASE TYPE
// ============================================

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, "id"> & { id?: string };
        Update: Partial<Profile>;
      };
      clients: {
        Row: Client;
        Insert: Omit<Client, "id" | "created_at"> & { id?: string; created_at?: string };
        Update: Partial<Client>;
      };
      campaigns: {
        Row: Campaign;
        Insert: Omit<Campaign, "id"> & { id?: string };
        Update: Partial<Campaign>;
      };
      leads: {
        Row: Lead;
        Insert: Omit<Lead, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          is_positive_reply?: boolean;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Lead>;
      };
      client_users: {
        Row: ClientUser;
        Insert: ClientUser;
        Update: Partial<ClientUser>;
      };
      activities: {
        Row: Activity;
        Insert: Omit<Activity, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<Activity>;
      };
      email_events: {
        Row: EmailEvent;
        Insert: Omit<EmailEvent, "id" | "timestamp"> & {
          id?: string;
          timestamp?: string;
          metadata?: Record<string, unknown>;
        };
        Update: Partial<EmailEvent>;
      };
      team_members: {
        Row: TeamMember;
        Insert: Omit<TeamMember, "id" | "invited_at"> & {
          id?: string;
          invited_at?: string;
        };
        Update: Partial<TeamMember>;
      };
      audit_logs: {
        Row: AuditLog;
        Insert: Omit<AuditLog, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: never; // Audit logs should never be updated
      };
    };
    Views: {
      positive_replies: {
        Row: PositiveReply;
      };
      campaign_performance: {
        Row: CampaignPerformance;
      };
    };
    Functions: {
      log_audit: {
        Args: {
          p_user_id: string;
          p_action: AuditAction;
          p_table_name: string;
          p_record_id: string;
          p_old_data?: Record<string, unknown>;
          p_new_data?: Record<string, unknown>;
        };
        Returns: string;
      };
    };
    Enums: {
      lead_status: LeadStatus;
      user_role: UserRole;
      team_role: TeamRole;
      activity_type: ActivityType;
      email_event_type: EmailEventType;
      audit_action: AuditAction;
    };
  };
}
