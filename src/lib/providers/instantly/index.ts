// Instantly Provider Implementation
// Implements EmailCampaignProvider interface with per-campaign API key

import { InstantlyApiClient } from "./client";
import type {
  EmailCampaignProvider,
  ProviderCampaign,
  ProviderCampaignDetails,
  ProviderLead,
  ProviderLeadCreatePayload,
  ProviderCampaignAnalytics,
  ProviderDailyAnalytics,
  ProviderEmail,
  ProviderWebhookPayload,
  ProviderSequence,
  ProviderSequenceStep,
  WebhookEventType,
} from "../types";
import { ProviderError } from "../types";
import crypto from "crypto";

// Instantly-specific types (internal)
interface InstantlyCampaign {
  id: string;
  name: string;
  status: number | "active" | "paused" | "completed" | "draft";
  created_at: string;
  updated_at?: string;
  leads_count?: number;
  emails_sent_count?: number;
  replies_count?: number;
  bounces_count?: number;
  sequences?: InstantlySequence[];
  email_gap?: number;
  daily_limit?: number;
  stop_on_reply?: boolean;
  link_tracking?: boolean;
  open_tracking?: boolean;
}

interface InstantlySequence {
  steps: InstantlySequenceStep[];
}

interface InstantlySequenceStep {
  type?: string;
  delay?: number;
  variants?: { subject?: string; body?: string; v_disabled?: boolean }[];
  subject?: string;
  body?: string;
}

interface InstantlyLead {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  phone?: string;
  website?: string;
  campaign_id?: string;
  status?: string;
  interest_status?: string;
  lead_data?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
}

interface InstantlyAnalytics {
  campaign_id: string;
  campaign_name: string;
  leads_count: number;
  contacted_count: number;
  completed_count: number;
  emails_sent_count: number;
  open_count: number;
  open_count_unique: number;
  reply_count: number;
  reply_count_unique: number;
  link_click_count: number;
  link_click_count_unique: number;
  bounced_count: number;
  unsubscribed_count: number;
  total_opportunities?: number;
  total_interested?: number;
  total_meeting_booked?: number;
  total_closed?: number;
}

interface InstantlyDailyAnalytics {
  date: string;
  sent: number;
  opened: number;
  unique_opened: number;
  replies: number;
  unique_replies: number;
  clicks: number;
  unique_clicks: number;
}

interface InstantlyEmail {
  id: string;
  from_address_email: string;
  to_address_email_list: string[];
  cc_address_email_list?: string[];
  bcc_address_email_list?: string[];
  subject: string;
  body?: { text?: string; html?: string };
  thread_id?: string;
  i_campaign?: string;
  lead_email?: string;
  is_reply?: boolean;
  timestamp_email?: string;
  timestamp_created?: string;
}

export class InstantlyProvider implements EmailCampaignProvider {
  readonly providerType = "instantly" as const;
  private client: InstantlyApiClient;

  constructor(apiKey: string) {
    this.client = new InstantlyApiClient(apiKey);
  }

  // ============================================
  // API KEY VALIDATION
  // ============================================

  async validateApiKey(): Promise<boolean> {
    try {
      // Try to fetch campaigns - if it works, the key is valid
      await this.client.get<{ items: unknown[] }>("/campaigns", { limit: 1 });
      return true;
    } catch (error) {
      if (error instanceof ProviderError && error.statusCode === 401) {
        return false;
      }
      throw error;
    }
  }

  // ============================================
  // CAMPAIGN OPERATIONS
  // ============================================

  async fetchCampaigns(): Promise<ProviderCampaign[]> {
    const allCampaigns: ProviderCampaign[] = [];
    let skip = 0;
    const limit = 100;

    while (true) {
      const response = await this.client.get<{ items: InstantlyCampaign[] }>(
        "/campaigns",
        { limit, skip }
      );
      const campaigns = response.items || [];

      allCampaigns.push(...campaigns.map((c) => this.mapCampaign(c)));

      if (campaigns.length < limit) {
        break;
      }
      skip += limit;
    }

    return allCampaigns;
  }

  async fetchCampaign(campaignId: string): Promise<ProviderCampaignDetails> {
    const campaign = await this.client.get<InstantlyCampaign>(
      `/campaigns/${campaignId}`
    );
    return this.mapCampaignDetails(campaign);
  }

  private mapCampaign(c: InstantlyCampaign): ProviderCampaign {
    return {
      id: c.id,
      name: c.name,
      status: this.normalizeStatus(c.status),
      createdAt: c.created_at,
      updatedAt: c.updated_at,
      leadsCount: c.leads_count,
      emailsSentCount: c.emails_sent_count,
      repliesCount: c.replies_count,
      bouncesCount: c.bounces_count,
    };
  }

  private mapCampaignDetails(c: InstantlyCampaign): ProviderCampaignDetails {
    return {
      ...this.mapCampaign(c),
      sequences: c.sequences?.map((s) => this.mapSequence(s)) || [],
      emailGap: c.email_gap,
      dailyLimit: c.daily_limit,
      stopOnReply: c.stop_on_reply,
      linkTracking: c.link_tracking,
      openTracking: c.open_tracking,
    };
  }

  private mapSequence(s: InstantlySequence): ProviderSequence {
    return {
      steps: s.steps.map((step, index) => this.mapSequenceStep(step, index)),
    };
  }

  private mapSequenceStep(
    step: InstantlySequenceStep,
    index: number
  ): ProviderSequenceStep {
    return {
      stepNumber: index + 1,
      delayDays: step.delay || 0,
      variants:
        step.variants?.map((v) => ({
          subject: v.subject,
          body: v.body,
          isActive: !v.v_disabled,
        })) || [],
    };
  }

  private normalizeStatus(
    status: number | string
  ): "active" | "paused" | "draft" | "completed" {
    if (typeof status === "number") {
      return status === 1 ? "active" : "paused";
    }
    if (["active", "paused", "draft", "completed"].includes(status)) {
      return status as "active" | "paused" | "draft" | "completed";
    }
    return "paused";
  }

  // ============================================
  // LEAD OPERATIONS
  // ============================================

  async fetchLeads(
    campaignId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ProviderLead[]> {
    const response = await this.client.post<{ items: InstantlyLead[] }>(
      "/leads/list",
      {
        campaign: campaignId,
        limit: options?.limit || 100,
        skip: options?.offset || 0,
      }
    );
    return (response.items || []).map((l) => this.mapLead(l));
  }

  async fetchAllLeads(campaignId: string): Promise<ProviderLead[]> {
    const allLeads: ProviderLead[] = [];
    let skip = 0;
    const limit = 100;

    while (true) {
      const leads = await this.fetchLeads(campaignId, { limit, offset: skip });
      allLeads.push(...leads);

      if (leads.length < limit) {
        break;
      }
      skip += limit;
    }

    return allLeads;
  }

  async createLead(
    campaignId: string,
    lead: ProviderLeadCreatePayload
  ): Promise<ProviderLead> {
    const response = await this.client.post<InstantlyLead>("/leads", {
      campaign_id: campaignId,
      email: lead.email,
      first_name: lead.firstName,
      last_name: lead.lastName,
      company_name: lead.companyName,
      phone: lead.phone,
      website: lead.website,
      custom_variables: lead.customVariables,
      skip_if_in_campaign: lead.skipIfInCampaign,
      skip_if_in_workspace: lead.skipIfInWorkspace,
    });
    return this.mapLead(response);
  }

  async createLeads(
    campaignId: string,
    leads: ProviderLeadCreatePayload[]
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const lead of leads) {
      try {
        await this.createLead(campaignId, lead);
        success++;
      } catch (error) {
        console.error(`[Instantly] Failed to create lead ${lead.email}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  async updateLeadInterestStatus(
    campaignId: string,
    email: string,
    status: "interested" | "not_interested" | "neutral"
  ): Promise<void> {
    await this.client.post("/leads/update-interest-status", {
      lead_email: email,
      campaign_id: campaignId,
      interest_status: status,
    });
  }

  private mapLead(l: InstantlyLead): ProviderLead {
    return {
      id: l.id,
      email: l.email,
      firstName: l.first_name,
      lastName: l.last_name,
      companyName: l.company_name,
      phone: l.phone,
      website: l.website,
      status: l.status,
      interestStatus: l.interest_status as ProviderLead["interestStatus"],
      createdAt: l.created_at,
      updatedAt: l.updated_at,
      customFields: l.lead_data,
    };
  }

  // ============================================
  // ANALYTICS
  // ============================================

  async fetchCampaignAnalytics(
    campaignId: string
  ): Promise<ProviderCampaignAnalytics> {
    const response = await this.client.get<InstantlyAnalytics[]>(
      "/campaigns/analytics",
      { id: campaignId }
    );

    const analytics = Array.isArray(response) ? response[0] : null;

    if (!analytics) {
      throw new ProviderError(
        `No analytics found for campaign ${campaignId}`,
        "instantly"
      );
    }

    return this.mapAnalytics(analytics);
  }

  async fetchDailyAnalytics(
    campaignId: string,
    startDate: string,
    endDate: string
  ): Promise<ProviderDailyAnalytics[]> {
    const response = await this.client.get<
      { daily: InstantlyDailyAnalytics[] } | InstantlyDailyAnalytics[]
    >("/campaigns/analytics/daily", {
      id: campaignId,
      start_date: startDate,
      end_date: endDate,
    });

    const daily = Array.isArray(response) ? response : response.daily || [];

    return daily.map((d) => ({
      date: d.date,
      sent: d.sent,
      opened: d.opened,
      uniqueOpened: d.unique_opened,
      replied: d.replies,
      uniqueReplied: d.unique_replies,
      clicked: d.clicks,
      uniqueClicked: d.unique_clicks,
    }));
  }

  private mapAnalytics(a: InstantlyAnalytics): ProviderCampaignAnalytics {
    return {
      campaignId: a.campaign_id,
      campaignName: a.campaign_name,
      leadsCount: a.leads_count,
      contactedCount: a.contacted_count,
      completedCount: a.completed_count,
      emailsSentCount: a.emails_sent_count,
      openCount: a.open_count,
      openCountUnique: a.open_count_unique,
      replyCount: a.reply_count,
      replyCountUnique: a.reply_count_unique,
      linkClickCount: a.link_click_count,
      linkClickCountUnique: a.link_click_count_unique,
      bouncedCount: a.bounced_count,
      unsubscribedCount: a.unsubscribed_count,
      totalOpportunities: a.total_opportunities,
      totalInterested: a.total_interested,
      totalMeetingBooked: a.total_meeting_booked,
      totalClosed: a.total_closed,
    };
  }

  // ============================================
  // EMAIL OPERATIONS
  // ============================================

  async fetchEmailsForLead(
    campaignId: string,
    leadEmail: string
  ): Promise<ProviderEmail[]> {
    const response = await this.client.get<
      { items?: InstantlyEmail[]; data?: InstantlyEmail[] } | InstantlyEmail[]
    >("/emails", {
      campaign_id: campaignId,
      search: leadEmail,
      limit: 100,
    });

    let emails: InstantlyEmail[];
    if (Array.isArray(response)) {
      emails = response;
    } else {
      emails = response.items || response.data || [];
    }

    return emails
      .map((e) => this.mapEmail(e))
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }

  private mapEmail(e: InstantlyEmail): ProviderEmail {
    return {
      id: e.id,
      fromEmail: e.from_address_email,
      toEmail: e.to_address_email_list?.[0] || "",
      ccEmails: e.cc_address_email_list,
      bccEmails: e.bcc_address_email_list,
      subject: e.subject,
      bodyText: e.body?.text,
      bodyHtml: e.body?.html,
      threadId: e.thread_id,
      campaignId: e.i_campaign,
      leadEmail: e.lead_email,
      isReply: e.is_reply || false,
      sentAt: e.timestamp_email || e.timestamp_created || new Date().toISOString(),
    };
  }

  // ============================================
  // WEBHOOK HANDLING
  // ============================================

  parseWebhookPayload(
    rawBody: string,
    headers: Record<string, string>
  ): ProviderWebhookPayload {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new ProviderError(
        "Invalid webhook payload: not valid JSON",
        "instantly"
      );
    }

    const eventType = this.mapEventType(payload.event_type as string);

    return {
      eventType,
      providerEventId: payload.id as string | undefined,
      campaignId:
        (payload.campaign_id as string) ||
        (payload.campaign as { id?: string })?.id,
      campaignName: (payload.campaign as { name?: string })?.name,
      leadEmail:
        (payload.lead_email as string) ||
        (payload.lead as { email?: string })?.email,
      leadId: (payload.lead as { id?: string })?.id,
      timestamp: (payload.timestamp as string) || new Date().toISOString(),
      emailSubject:
        (payload.email as { subject?: string })?.subject ||
        (payload.subject as string),
      emailBody:
        (payload.email as { body?: string })?.body || (payload.body as string),
      emailFrom: (payload.email as { from?: string })?.from,
      emailTo: (payload.email as { to?: string })?.to,
      threadId: payload.thread_id as string | undefined,
      sequenceStep: payload.step as number | undefined,
      linkClicked: payload.link_url as string | undefined,
      bounceType: payload.bounce_type as "hard" | "soft" | undefined,
      bounceReason: payload.bounce_reason as string | undefined,
      rawPayload: payload,
    };
  }

  verifyWebhookSignature(
    rawBody: string,
    signature: string | null,
    secret: string | null
  ): boolean {
    // If no secret configured, accept all webhooks
    if (!secret) {
      return true;
    }

    // If secret is set but no signature provided, reject
    if (!signature) {
      return false;
    }

    // Compute expected signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");

    // Compare signatures (constant-time comparison)
    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  private mapEventType(eventType: string | undefined): WebhookEventType {
    if (!eventType) return "unknown";

    const mapping: Record<string, WebhookEventType> = {
      email_sent: "email_sent",
      sent: "email_sent",
      email_opened: "email_opened",
      opened: "email_opened",
      open: "email_opened",
      link_clicked: "link_clicked",
      clicked: "link_clicked",
      click: "link_clicked",
      reply_received: "reply_received",
      replied: "reply_received",
      reply: "reply_received",
      lead_replied: "reply_received",
      email_bounced: "email_bounced",
      bounced: "email_bounced",
      bounce: "email_bounced",
      lead_bounced: "email_bounced",
      unsubscribed: "unsubscribed",
      unsubscribe: "unsubscribed",
      lead_interested: "lead_interested",
      interested: "lead_interested",
      positive_reply: "lead_interested",
      lead_not_interested: "lead_not_interested",
      not_interested: "lead_not_interested",
      negative_reply: "lead_not_interested",
      meeting_booked: "meeting_booked",
      meeting_completed: "meeting_completed",
      out_of_office: "out_of_office",
      ooo: "out_of_office",
    };

    return mapping[eventType.toLowerCase()] || "unknown";
  }
}
