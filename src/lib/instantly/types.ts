// Instantly API V2 Types

// Base pagination types
export interface InstantlyPaginationParams {
  limit?: number;
  skip?: number;
}

export interface InstantlyPaginatedResponse<T> {
  items: T[];
  total_count?: number;
}

// Error types
export interface InstantlyApiError {
  error: string;
  message?: string;
  statusCode?: number;
}

// Campaign types
export interface InstantlyCampaign {
  id: string;
  name: string;
  status: "active" | "paused" | "completed" | "draft";
  created_at: string;
  updated_at?: string;
  leads_count?: number;
  emails_sent_count?: number;
  replies_count?: number;
  bounces_count?: number;
}

export interface InstantlyCampaignAnalytics {
  campaign_id: string;
  campaign_name: string;
  campaign_status?: string;
  // Lead counts
  leads_count: number;
  contacted_count: number;
  completed_count: number;
  new_leads_contacted_count: number;
  // Email metrics
  emails_sent_count: number;
  open_count: number;
  open_count_unique: number;
  reply_count: number;
  reply_count_unique: number;
  link_click_count: number;
  link_click_count_unique: number;
  bounced_count: number;
  unsubscribed_count: number;
  // Opportunities
  total_opportunities: number;
  total_opportunity_value: number;
  total_interested?: number;
  total_meeting_booked?: number;
  total_meeting_completed?: number;
  total_closed?: number;
}

export interface InstantlyCampaignDailyAnalytics {
  date: string;
  sent: number;
  contacted: number;
  new_leads_contacted: number;
  opened: number;
  unique_opened: number;
  replies: number;
  unique_replies: number;
  replies_automatic: number;
  unique_replies_automatic: number;
  clicks: number;
  unique_clicks: number;
  opportunities: number;
  unique_opportunities: number;
}

// Lead types
export interface InstantlyLead {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  phone?: string;
  website?: string;
  campaign_id?: string;
  campaign_name?: string;
  status?: string;
  interest_status?: "interested" | "not_interested" | "neutral" | "wrong_person" | "out_of_office";
  lead_data?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
}

export interface InstantlyLeadCreatePayload {
  campaign_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  phone?: string;
  website?: string;
  custom_variables?: Record<string, string>;
  skip_if_in_campaign?: boolean;
  skip_if_in_workspace?: boolean;
}

export interface InstantlyLeadListPayload {
  campaign_id: string;
  limit?: number;
  skip?: number;
  email?: string;
  interest_status?: string;
}

export interface InstantlyLeadInterestUpdate {
  lead_email: string;
  campaign_id: string;
  interest_status: "interested" | "not_interested" | "neutral";
}

// Account types
export interface InstantlyAccount {
  email: string;
  first_name?: string;
  last_name?: string;
  provider?: string;
  warmup_status?: "enabled" | "disabled" | "paused";
  warmup_reputation?: number;
  daily_limit?: number;
  status?: "active" | "error" | "disconnected";
  error_message?: string;
  created_at?: string;
}

export interface InstantlyAccountWarmupAnalytics {
  email: string;
  warmup_emails_sent: number;
  warmup_emails_received: number;
  warmup_emails_saved_from_spam: number;
  reputation: number;
  warmup_status: string;
}

export interface InstantlyAccountDailyAnalytics {
  date: string;
  email: string;
  emails_sent: number;
  emails_received: number;
  warmup_sent: number;
  warmup_received: number;
}

// Email types
export interface InstantlyEmail {
  id: string;
  from_email: string;
  to_email: string;
  subject: string;
  body?: string;
  sent_at: string;
  opened_at?: string;
  replied_at?: string;
  campaign_id?: string;
  lead_id?: string;
  thread_id?: string;
  is_reply: boolean;
}

// Workspace types
export interface InstantlyWorkspace {
  id: string;
  name: string;
  owner_email: string;
  created_at: string;
}

// API Response wrappers
export interface InstantlyListResponse<T> {
  data: T[];
  next_starting_after?: string;
  has_more?: boolean;
}

export interface InstantlySingleResponse<T> {
  data: T;
}

// Sync types (for our internal use)
export interface SyncResult {
  success: boolean;
  imported: number;
  updated: number;
  failed: number;
  errors?: string[];
}
