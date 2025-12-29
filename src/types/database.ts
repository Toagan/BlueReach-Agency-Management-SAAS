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
  name: string;
  copy_body: string | null;
  is_active: boolean;
}

export interface Lead {
  id: string;
  campaign_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  linkedin_url: string | null;
  status: LeadStatus;
  is_positive_reply: boolean;
  deal_value: number | null;
  next_action: string | null;
  next_action_date: string | null;
  instantly_lead_id: string | null;
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
