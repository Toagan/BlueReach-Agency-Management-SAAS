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
  company_domain?: string;
  phone?: string;
  website?: string;
  campaign_id?: string;
  status?: string;
  interest_status?: string;
  // Note: lt_interest_status is the actual field returned by Instantly API v2
  // Values: 1=Interested, -1=Not Interested, -2=Other, 0=Neutral, undefined=No status
  lt_interest_status?: number;
  lead_data?: Record<string, string>;
  created_at?: string;
  updated_at?: string;
  // Engagement metrics
  email_open_count?: number;
  email_click_count?: number;
  email_reply_count?: number;
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
    console.log(`[InstantlyProvider] Fetching leads for campaign ${campaignId}`);
    // Note: Instantly API v2 uses "campaign" not "campaign_id" for /leads/list
    const response = await this.client.post<{ items: InstantlyLead[] }>(
      "/leads/list",
      {
        campaign: campaignId,
        limit: options?.limit || 100,
        skip: options?.offset || 0,
      }
    );
    console.log(`[InstantlyProvider] Got ${response.items?.length || 0} leads`);
    return (response.items || []).map((l) => this.mapLead(l));
  }

  async fetchAllLeads(campaignId: string): Promise<ProviderLead[]> {
    const limit = 100;
    const concurrency = 5; // Stay well under 10 req/s rate limit

    // First, get total count from analytics to know how many pages we need
    let expectedLeads = 0;
    try {
      const analytics = await this.fetchCampaignAnalytics(campaignId);
      expectedLeads = analytics.leadsCount || 0;
      console.log(`[InstantlyProvider] Campaign ${campaignId} has ${expectedLeads} leads according to analytics`);
    } catch (err) {
      // If analytics fails, fall back to sequential fetching
      console.log(`[InstantlyProvider] Could not get lead count, using sequential fetch. Error:`, err);
      return this.fetchAllLeadsSequential(campaignId);
    }

    if (expectedLeads === 0) {
      return [];
    }

    // Calculate total pages needed
    const totalPages = Math.ceil(expectedLeads / limit);
    // Safety cap: never fetch more than 1.1x the expected leads (allow 10% margin)
    const maxLeads = Math.ceil(expectedLeads * 1.1);
    console.log(`[InstantlyProvider] Fetching ${expectedLeads} leads in ${totalPages} pages (${concurrency} concurrent, max ${maxLeads})`);

    // If only a few pages, just do sequential
    if (totalPages <= 3) {
      return this.fetchAllLeadsSequential(campaignId);
    }

    // Fetch in parallel batches
    const allLeads: ProviderLead[] = [];
    const pageOffsets = Array.from({ length: totalPages }, (_, i) => i * limit);

    for (let i = 0; i < pageOffsets.length; i += concurrency) {
      const batch = pageOffsets.slice(i, i + concurrency);
      const batchPromises = batch.map((offset) =>
        this.fetchLeads(campaignId, { limit, offset })
      );

      const batchResults = await Promise.all(batchPromises);
      for (const leads of batchResults) {
        allLeads.push(...leads);
      }

      // Safety check: stop if we've exceeded expected count
      if (allLeads.length > maxLeads) {
        console.warn(`[InstantlyProvider] WARNING: Fetched ${allLeads.length} leads, exceeds expected ${expectedLeads}. Stopping.`);
        break;
      }

      // Small delay between batches to stay under rate limit
      if (i + concurrency < pageOffsets.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    console.log(`[InstantlyProvider] Fetched ${allLeads.length} leads total (expected: ${expectedLeads})`);
    return allLeads;
  }

  // Sequential fallback for when we can't determine total count
  private async fetchAllLeadsSequential(campaignId: string): Promise<ProviderLead[]> {
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

  // Fetch only positive/interested leads using client-side filtering
  // NOTE: The Instantly API v2 interest_status filter parameter is broken and ignores all values.
  // We must fetch all leads and filter client-side by lt_interest_status field.
  //
  // POSITIVE STATUS VALUES (lt_interest_status):
  //   1 = Interested
  //   3 = Meeting Booked
  //   4 = Meeting Completed
  //   5 = Closed (Won)
  //
  // NON-POSITIVE VALUES:
  //   0 or null = Unknown/No status
  //   2 = Not Interested
  async fetchPositiveLeads(campaignId: string): Promise<ProviderLead[]> {
    console.log(`[InstantlyProvider] Fetching all leads to filter for positive statuses for campaign ${campaignId}`);

    // Define which lt_interest_status values are considered "positive"
    const POSITIVE_STATUS_CODES = [1, 3, 4, 5]; // interested, meeting_booked, meeting_completed, closed

    const allPositiveLeads: ProviderLead[] = [];
    let skip = 0;
    const limit = 100;
    let totalScanned = 0;
    let rejectedCount = 0;

    while (true) {
      const response = await this.client.post<{ items: InstantlyLead[] }>(
        "/leads/list",
        {
          campaign: campaignId,
          limit,
          skip,
        }
      );

      const leads = response.items || [];
      totalScanned += leads.length;

      // HARD-CHECK: Only include leads with explicitly positive lt_interest_status
      // This is the ONLY reliable way to identify positive leads in Instantly API v2
      for (const lead of leads) {
        const status = lead.lt_interest_status;

        // EXPLICIT HARD-CHECK: Must be a known positive status code
        if (status !== null && status !== undefined && POSITIVE_STATUS_CODES.includes(status)) {
          const mappedStatus = this.mapInterestStatus(status);
          allPositiveLeads.push({
            ...this.mapLead(lead),
            interestStatus: mappedStatus,
          });
        } else if (status !== null && status !== undefined && status !== 0) {
          // Warn if lead has a non-zero status that's not in our positive list
          // This helps debug unexpected status values from the API
          console.warn(
            `[InstantlyProvider] Lead ${lead.email} has lt_interest_status=${status} (not positive). Skipping.`
          );
          rejectedCount++;
        }
        // Note: status === 0 or null/undefined means no interest status set, silently skip
      }

      if (leads.length < limit) {
        break;
      }
      skip += limit;

      // Progress logging every 2000 leads
      if (skip % 2000 === 0) {
        console.log(`[InstantlyProvider] Scanned ${skip} leads, found ${allPositiveLeads.length} positive so far...`);
      }
    }

    console.log(
      `[InstantlyProvider] Scanned ${totalScanned} total leads. ` +
      `Found ${allPositiveLeads.length} positive (lt_interest_status in [1,3,4,5]). ` +
      `Rejected ${rejectedCount} with non-positive status.`
    );
    return allPositiveLeads;
  }

  private mapInterestStatus(status: number): ProviderLead["interestStatus"] {
    switch (status) {
      case 1: return "interested";
      case 2: return "not_interested";
      case 3: return "meeting_booked";
      case 4: return "meeting_completed";
      case 5: return "closed";
      default: return undefined;
    }
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
      companyDomain: l.company_domain,
      phone: l.phone,
      website: l.website,
      status: l.status,
      interestStatus: l.interest_status as ProviderLead["interestStatus"],
      createdAt: l.created_at,
      updatedAt: l.updated_at,
      customFields: l.lead_data,
      // Engagement metrics - used to determine has_replied
      emailOpenCount: l.email_open_count,
      emailClickCount: l.email_click_count,
      emailReplyCount: l.email_reply_count,
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
      campaign_id: campaignId,  // API v2 uses campaign_id, not id
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
    const allEmails: InstantlyEmail[] = [];
    let skip = 0;
    const limit = 100;

    console.log(`[InstantlyProvider] Fetching emails for lead ${leadEmail} in campaign ${campaignId}`);

    while (true) {
      const response = await this.client.get<
        { items?: InstantlyEmail[]; data?: InstantlyEmail[] } | InstantlyEmail[]
      >("/emails", {
        campaign_id: campaignId,
        search: leadEmail,
        limit,
        skip,
      });

      let emails: InstantlyEmail[];
      if (Array.isArray(response)) {
        emails = response;
      } else {
        emails = response.items || response.data || [];
      }

      allEmails.push(...emails);

      // If we got fewer than limit, we've reached the end
      if (emails.length < limit) {
        break;
      }

      skip += limit;

      // Safety cap at 1000 emails per lead
      if (skip >= 1000) {
        console.warn(`[InstantlyProvider] Hit 1000 email cap for lead ${leadEmail}`);
        break;
      }
    }

    console.log(`[InstantlyProvider] Fetched ${allEmails.length} emails for lead ${leadEmail}`);

    return allEmails
      .map((e) => this.mapEmail(e))
      .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  }

  private mapEmail(e: InstantlyEmail): ProviderEmail {
    // Ensure CC/BCC are always arrays (API sometimes returns strings)
    const normalizeEmailList = (list: string[] | string | undefined): string[] | undefined => {
      if (!list) return undefined;
      if (Array.isArray(list)) return list;
      if (typeof list === "string") return [list];
      return undefined;
    };

    return {
      id: e.id,
      fromEmail: e.from_address_email,
      toEmail: e.to_address_email_list?.[0] || "",
      ccEmails: normalizeEmailList(e.cc_address_email_list as string[] | string | undefined),
      bccEmails: normalizeEmailList(e.bcc_address_email_list as string[] | string | undefined),
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
