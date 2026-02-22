// Smartlead API Types

// Error types
export interface SmartleadApiError {
  error?: string;
  message?: string;
  statusCode?: number;
}

// Account types
export interface SmartleadAccount {
  id: number;
  email: string;
  from_name?: string;
  first_name?: string;
  last_name?: string;
  signature?: string;
  smtp_host?: string;
  smtp_port?: number;
  imap_host?: string;
  imap_port?: number;
  warmup_enabled?: boolean;
  total_warmup_per_day?: number;
  daily_rampup?: number;
  reply_rate_percentage?: number;
  max_email_per_day?: number;
  client_id?: number;
  type?: string;
  created_at?: string;
  updated_at?: string;
}

// Warmup statistics
export interface SmartleadWarmupDayStats {
  date: string;
  sent: number;
  inbox: number;
  spam: number;
  reputation?: number;
}

export interface SmartleadWarmupStats {
  email_account_id: number;
  email?: string;
  total_sent: number;
  total_inbox: number;
  total_spam: number;
  warmup_reputation: number;
  daily_stats?: SmartleadWarmupDayStats[];
}

// Campaign types (for reference)
export interface SmartleadCampaign {
  id: number;
  name: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

// Lead types
export interface SmartleadLead {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  phone?: string;
  website?: string;
  campaign_id?: number;
  status?: string;
  created_at?: string;
}

// API Response wrappers
export interface SmartleadListResponse<T> {
  data?: T[];
  items?: T[];
  total?: number;
}

// Campaign analytics from /campaigns/{id}/analytics
export interface SmartleadCampaignAnalytics {
  sent_count: number;
  unique_sent_count: number;
  open_count: number;
  unique_open_count: number;
  click_count: number;
  unique_click_count: number;
  reply_count: number;
  unique_reply_count: number;
  bounce_count: number;
  unsubscribe_count: number;
  total_leads: number;
}

// Webhook payload from SmartLead
export interface SmartleadWebhookPayload {
  event_type:
    | "EMAIL_SENT"
    | "EMAIL_OPEN"
    | "EMAIL_OPENED"
    | "EMAIL_LINK_CLICK"
    | "LINK_CLICKED"
    | "EMAIL_REPLY"
    | "REPLY"
    | "EMAIL_BOUNCED"
    | "LEAD_UNSUBSCRIBED"
    | "LEAD_CATEGORY_CHANGE"
    | "LEAD_CATEGORY_UPDATED";
  campaign_id?: number;
  campaign_name?: string;
  lead_id?: number;
  email?: string;
  timestamp?: string;
  // Event-specific fields
  subject?: string;
  body?: string;
  from_email?: string;
  to_email?: string;
  link_url?: string;
  category?: string;
  previous_category?: string;
  description?: string;
  // Webhook metadata fields
  webhook_id?: number;
  webhook_name?: string;
  secret_key?: string;
  app_url?: string;
  ui_master_inbox_link?: string;
  metadata?: Record<string, unknown>;
  webhook_url?: string;
  // Reply data (present in LEAD_CATEGORY_UPDATED events)
  lastReply?: {
    email_body?: string;
    reply_from_email?: string;
    time?: string;
    [key: string]: unknown;
  };
  last_reply?: {
    email_body?: string;
    reply_from_email?: string;
    time?: string;
    [key: string]: unknown;
  };
  // Additional fields
  [key: string]: unknown;
}

// Sync result type
export interface SmartleadSyncResult {
  success: boolean;
  added: number;
  updated: number;
  failed: number;
  errors?: string[];
}
