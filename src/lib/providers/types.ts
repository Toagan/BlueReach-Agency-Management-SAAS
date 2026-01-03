// Provider Abstraction Layer Types
// Shared interfaces for multi-provider support (Instantly, Smartlead, etc.)

export type ProviderType = "instantly" | "smartlead" | "lemlist" | "apollo";

// ============================================
// CAMPAIGN TYPES
// ============================================

export interface ProviderCampaign {
  id: string;
  name: string;
  status: "active" | "paused" | "draft" | "completed";
  createdAt: string;
  updatedAt?: string;
  leadsCount?: number;
  emailsSentCount?: number;
  repliesCount?: number;
  bouncesCount?: number;
}

export interface ProviderCampaignDetails extends ProviderCampaign {
  sequences?: ProviderSequence[];
  emailGap?: number;
  dailyLimit?: number;
  stopOnReply?: boolean;
  linkTracking?: boolean;
  openTracking?: boolean;
}

export interface ProviderSequence {
  steps: ProviderSequenceStep[];
}

export interface ProviderSequenceStep {
  stepNumber: number;
  delayDays: number;
  variants: ProviderSequenceVariant[];
}

export interface ProviderSequenceVariant {
  id?: string;
  subject?: string;
  body?: string;
  isActive: boolean;
}

// ============================================
// LEAD TYPES
// ============================================

export interface ProviderLead {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  companyDomain?: string;
  phone?: string;
  linkedinUrl?: string;
  website?: string;
  status?: string;
  interestStatus?: "interested" | "not_interested" | "neutral" | "wrong_person" | "out_of_office" | "meeting_booked" | "meeting_completed" | "closed";
  createdAt?: string;
  updatedAt?: string;
  lastContactedAt?: string;
  customFields?: Record<string, string>;
  // Engagement metrics
  emailOpenCount?: number;
  emailClickCount?: number;
  emailReplyCount?: number;
}

export interface ProviderLeadCreatePayload {
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone?: string;
  website?: string;
  customVariables?: Record<string, string>;
  skipIfInCampaign?: boolean;
  skipIfInWorkspace?: boolean;
}

// ============================================
// ANALYTICS TYPES
// ============================================

export interface ProviderCampaignAnalytics {
  campaignId: string;
  campaignName: string;
  // Lead counts
  leadsCount: number;
  contactedCount: number;
  completedCount: number;
  // Email metrics
  emailsSentCount: number;
  openCount: number;
  openCountUnique: number;
  replyCount: number;
  replyCountUnique: number;
  linkClickCount: number;
  linkClickCountUnique: number;
  bouncedCount: number;
  unsubscribedCount: number;
  // Opportunities
  totalOpportunities?: number;
  totalInterested?: number;
  totalMeetingBooked?: number;
  totalClosed?: number;
}

export interface ProviderDailyAnalytics {
  date: string;
  sent: number;
  opened: number;
  uniqueOpened: number;
  replied: number;
  uniqueReplied: number;
  clicked: number;
  uniqueClicked: number;
  bounced?: number;
}

// ============================================
// WEBHOOK TYPES
// ============================================

export type WebhookEventType =
  | "email_sent"
  | "email_opened"
  | "link_clicked"
  | "reply_received"
  | "email_bounced"
  | "unsubscribed"
  | "lead_interested"
  | "lead_not_interested"
  | "meeting_booked"
  | "meeting_completed"
  | "out_of_office"
  | "unknown";

export interface ProviderWebhookPayload {
  eventType: WebhookEventType;
  providerEventId?: string;
  campaignId?: string;
  campaignName?: string;
  leadEmail?: string;
  leadId?: string;
  timestamp: string;
  // Email-specific data
  emailSubject?: string;
  emailBody?: string;
  emailFrom?: string;
  emailTo?: string;
  threadId?: string;
  sequenceStep?: number;
  // Click-specific data
  linkClicked?: string;
  // Bounce-specific data
  bounceType?: "hard" | "soft";
  bounceReason?: string;
  // Raw payload for debugging
  rawPayload: unknown;
}

// ============================================
// EMAIL TYPES
// ============================================

export interface ProviderEmail {
  id: string;
  fromEmail: string;
  toEmail: string;
  ccEmails?: string[];
  bccEmails?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  threadId?: string;
  campaignId?: string;
  leadEmail?: string;
  isReply: boolean;
  sentAt: string;
  openedAt?: string;
  repliedAt?: string;
}

// ============================================
// PROVIDER INTERFACE
// ============================================

export interface EmailCampaignProvider {
  readonly providerType: ProviderType;

  // API Key Validation
  validateApiKey(): Promise<boolean>;

  // Campaign Operations
  fetchCampaigns(): Promise<ProviderCampaign[]>;
  fetchCampaign(campaignId: string): Promise<ProviderCampaignDetails>;

  // Lead Operations
  fetchLeads(campaignId: string, options?: { limit?: number; offset?: number }): Promise<ProviderLead[]>;
  fetchAllLeads(campaignId: string): Promise<ProviderLead[]>;
  createLead(campaignId: string, lead: ProviderLeadCreatePayload): Promise<ProviderLead>;
  createLeads(campaignId: string, leads: ProviderLeadCreatePayload[]): Promise<{ success: number; failed: number }>;
  updateLeadInterestStatus(campaignId: string, email: string, status: "interested" | "not_interested" | "neutral"): Promise<void>;

  // Analytics (for campaign-level only)
  fetchCampaignAnalytics(campaignId: string): Promise<ProviderCampaignAnalytics>;
  fetchDailyAnalytics(campaignId: string, startDate: string, endDate: string): Promise<ProviderDailyAnalytics[]>;

  // Email Operations
  fetchEmailsForLead(campaignId: string, leadEmail: string): Promise<ProviderEmail[]>;

  // Webhook Handling
  parseWebhookPayload(rawBody: string, headers: Record<string, string>): ProviderWebhookPayload;
  verifyWebhookSignature(rawBody: string, signature: string | null, secret: string | null): boolean;
}

// ============================================
// PROVIDER ERROR
// ============================================

export class ProviderError extends Error {
  provider: ProviderType;
  statusCode?: number;
  details?: unknown;

  constructor(
    message: string,
    provider: ProviderType,
    statusCode?: number,
    details?: unknown
  ) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.statusCode = statusCode;
    this.details = details;
  }
}

// ============================================
// SYNC RESULT
// ============================================

export interface SyncResult {
  success: boolean;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  errors?: string[];
}
