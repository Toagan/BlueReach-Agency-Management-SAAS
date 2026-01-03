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

// Sync result type
export interface SmartleadSyncResult {
  success: boolean;
  added: number;
  updated: number;
  failed: number;
  errors?: string[];
}
