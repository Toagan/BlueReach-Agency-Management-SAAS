// Smartlead Provider Implementation
// Implements EmailCampaignProvider interface for Smartlead integration

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
  WebhookEventType,
} from "../types";
import { SmartleadApiClient } from "./client";

// ============================================
// SMARTLEAD API TYPES
// ============================================

interface SmartleadCampaign {
  id: number;
  name: string;
  status: "DRAFTED" | "ACTIVE" | "COMPLETED" | "STOPPED" | "PAUSED";
  created_at: string;
  updated_at?: string;
}

interface SmartleadCampaignStats {
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

interface SmartleadLead {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  phone_number?: string;
  website?: string;
  linkedin_profile?: string;
  company_url?: string;
  location?: string;
  // API returns "status" not "lead_status"
  status?: "STARTED" | "COMPLETED" | "BLOCKED" | "INPROGRESS" | "SENT" | string;
  lead_status?: "STARTED" | "COMPLETED" | "BLOCKED" | "INPROGRESS";
  category?:
    | "Interested"
    | "Meeting Request"
    | "Not Interested"
    | "Do Not Contact"
    | "Information Request"
    | "Out Of Office"
    | "Wrong Person"
    | string;
  // Interest and engagement metrics from API
  is_interested?: boolean;
  reply_count?: number;
  open_count?: number;
  click_count?: number;
  // Sequence tracking
  last_email_sequence_sent?: number;
  is_unsubscribed?: boolean;
  // Timestamps
  created_at?: string;
  updated_at?: string;
  // Campaign-specific mapping
  campaign_lead_map_id?: number;
  // Custom fields are included as additional properties
  [key: string]: unknown;
}

interface SmartleadLeadResponse {
  data: SmartleadLead[];
  total_leads: number;
  offset: number;
  limit: number;
}

interface SmartleadEmailMessage {
  id: number;
  campaign_id: number;
  lead_id: number;
  email_account: string;
  to_email: string;
  subject: string;
  body: string;
  message_type: "SENT" | "REPLY";
  sent_at: string;
  opened_at?: string;
  clicked_at?: string;
  replied_at?: string;
}

interface SmartleadWebhookPayload {
  event_type:
    | "EMAIL_SENT"
    | "EMAIL_OPEN"
    | "EMAIL_LINK_CLICK"
    | "EMAIL_REPLY"
    | "LEAD_UNSUBSCRIBED"
    | "LEAD_CATEGORY_UPDATED";
  campaign_id: number;
  campaign_name?: string;
  lead_id: number;
  email: string;
  timestamp: string;
  // Event-specific fields
  subject?: string;
  body?: string;
  from_email?: string;
  to_email?: string;
  link_url?: string;
  category?: string;
  previous_category?: string;
}

// ============================================
// SMARTLEAD PROVIDER
// ============================================

export class SmartleadProvider implements EmailCampaignProvider {
  readonly providerType = "smartlead" as const;
  private client: SmartleadApiClient;

  constructor(apiKey: string) {
    this.client = new SmartleadApiClient(apiKey);
  }

  // ============================================
  // API KEY VALIDATION
  // ============================================

  async validateApiKey(): Promise<boolean> {
    try {
      // Fetch campaigns to validate the key
      await this.client.get<SmartleadCampaign[]>("/campaigns");
      return true;
    } catch (error) {
      console.error("[SmartleadProvider] API key validation failed:", error);
      return false;
    }
  }

  // ============================================
  // CAMPAIGN OPERATIONS
  // ============================================

  async fetchCampaigns(): Promise<ProviderCampaign[]> {
    const campaigns = await this.client.get<SmartleadCampaign[]>("/campaigns");

    return campaigns.map((campaign) => ({
      id: String(campaign.id),
      name: campaign.name,
      status: this.mapCampaignStatus(campaign.status),
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at,
    }));
  }

  async fetchCampaign(campaignId: string): Promise<ProviderCampaignDetails> {
    const campaign = await this.client.get<SmartleadCampaign>(
      `/campaigns/${campaignId}`
    );

    // Fetch stats separately
    let stats: SmartleadCampaignStats | null = null;
    try {
      stats = await this.client.get<SmartleadCampaignStats>(
        `/campaigns/${campaignId}/analytics`
      );
    } catch {
      // Stats may not be available
    }

    return {
      id: String(campaign.id),
      name: campaign.name,
      status: this.mapCampaignStatus(campaign.status),
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at,
      leadsCount: stats?.total_leads,
      emailsSentCount: stats?.sent_count,
      repliesCount: stats?.reply_count,
      bouncesCount: stats?.bounce_count,
    };
  }

  private mapCampaignStatus(
    status: SmartleadCampaign["status"]
  ): ProviderCampaign["status"] {
    switch (status) {
      case "ACTIVE":
        return "active";
      case "PAUSED":
      case "STOPPED":
        return "paused";
      case "COMPLETED":
        return "completed";
      case "DRAFTED":
      default:
        return "draft";
    }
  }

  // ============================================
  // LEAD OPERATIONS
  // ============================================

  async fetchLeads(
    campaignId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ProviderLead[]> {
    const limit = options?.limit || 100;
    const offset = options?.offset || 0;

    const response = await this.client.get<SmartleadLeadResponse>(
      `/campaigns/${campaignId}/leads`,
      { limit, offset }
    );

    return response.data.map((lead) => this.mapLead(lead));
  }

  async fetchAllLeads(campaignId: string): Promise<ProviderLead[]> {
    const allLeads: ProviderLead[] = [];
    const limit = 100;
    let offset = 0;
    let hasMore = true;

    console.log(`[SmartleadProvider] Starting fetchAllLeads for campaign ${campaignId}`);

    while (hasMore) {
      const response = await this.client.get<SmartleadLeadResponse>(
        `/campaigns/${campaignId}/leads`,
        { limit, offset }
      );

      // DEBUG: Log first response to see structure
      if (offset === 0) {
        console.log(`[SmartleadProvider] API Response structure:`, {
          total_leads: response.total_leads,
          offset: response.offset,
          limit: response.limit,
          data_length: response.data?.length || 0,
          first_lead_sample: response.data?.[0] ? {
            id: response.data[0].id,
            email: response.data[0].email,
            status: response.data[0].status,
            lead_status: response.data[0].lead_status,
            category: response.data[0].category,
            is_interested: response.data[0].is_interested,
            reply_count: response.data[0].reply_count,
            open_count: response.data[0].open_count,
            click_count: response.data[0].click_count,
          } : "NO DATA",
        });
      }

      // Handle case where response.data might be undefined or not an array
      if (!response.data || !Array.isArray(response.data)) {
        console.warn(`[SmartleadProvider] Unexpected response format:`, response);
        break;
      }

      const leads = response.data.map((lead) => this.mapLead(lead));
      allLeads.push(...leads);

      offset += limit;
      hasMore = response.data.length === limit && offset < response.total_leads;

      // Log progress for large syncs
      if (allLeads.length % 500 === 0) {
        console.log(
          `[SmartleadProvider] Fetched ${allLeads.length}/${response.total_leads} leads`
        );
      }
    }

    console.log(
      `[SmartleadProvider] Completed fetching ${allLeads.length} leads`
    );
    return allLeads;
  }

  // Fetch leads with positive interest status (Interested, Meeting Request, etc.)
  // This mirrors the Instantly fetchPositiveLeads() method for consistency
  async fetchPositiveLeads(campaignId: string): Promise<ProviderLead[]> {
    console.log(`[SmartleadProvider] Fetching positive leads for campaign ${campaignId}`);

    // Define which categories/statuses are considered "positive"
    const POSITIVE_CATEGORIES = ["Interested", "Meeting Request"];

    const allPositiveLeads: ProviderLead[] = [];
    const limit = 100;
    let offset = 0;
    let hasMore = true;
    let totalScanned = 0;

    while (hasMore) {
      const response = await this.client.get<SmartleadLeadResponse>(
        `/campaigns/${campaignId}/leads`,
        { limit, offset }
      );

      const leads = response.data || [];
      totalScanned += leads.length;

      // Filter for positive leads based on is_interested OR category
      for (const lead of leads) {
        const isPositiveByFlag = lead.is_interested === true;
        const isPositiveByCategory = lead.category && POSITIVE_CATEGORIES.includes(lead.category);
        const hasReplied = (lead.reply_count || 0) > 0;

        if (isPositiveByFlag || isPositiveByCategory) {
          const mappedLead = this.mapLead(lead);
          // Ensure interest status is set for positive leads
          if (!mappedLead.interestStatus) {
            mappedLead.interestStatus = "interested";
          }
          allPositiveLeads.push(mappedLead);
        } else if (hasReplied && !lead.category) {
          // Lead has replied but no category set - treat as potential positive
          // Log for debugging but don't auto-mark as positive
          console.log(
            `[SmartleadProvider] Lead ${lead.email} has ${lead.reply_count} replies but no category set`
          );
        }
      }

      offset += limit;
      hasMore = leads.length === limit && offset < response.total_leads;

      // Progress logging every 1000 leads
      if (totalScanned % 1000 === 0) {
        console.log(
          `[SmartleadProvider] Scanned ${totalScanned} leads, found ${allPositiveLeads.length} positive so far...`
        );
      }
    }

    console.log(
      `[SmartleadProvider] Scanned ${totalScanned} total leads. ` +
      `Found ${allPositiveLeads.length} positive (is_interested=true OR category in [${POSITIVE_CATEGORIES.join(", ")}]).`
    );

    return allPositiveLeads;
  }

  async createLead(
    campaignId: string,
    lead: ProviderLeadCreatePayload
  ): Promise<ProviderLead> {
    const response = await this.client.post<{ lead: SmartleadLead }>(
      `/campaigns/${campaignId}/leads`,
      {
        lead_list: [
          {
            email: lead.email,
            first_name: lead.firstName,
            last_name: lead.lastName,
            company_name: lead.companyName,
            phone_number: lead.phone,
            website: lead.website,
            ...lead.customVariables,
          },
        ],
        settings: {
          ignore_global_block_list: false,
          ignore_unsubscribe_list: false,
          ignore_duplicate_leads_in_other_campaign:
            !lead.skipIfInWorkspace,
        },
      }
    );

    return this.mapLead(response.lead);
  }

  async createLeads(
    campaignId: string,
    leads: ProviderLeadCreatePayload[]
  ): Promise<{ success: number; failed: number }> {
    const leadList = leads.map((lead) => ({
      email: lead.email,
      first_name: lead.firstName,
      last_name: lead.lastName,
      company_name: lead.companyName,
      phone_number: lead.phone,
      website: lead.website,
      ...lead.customVariables,
    }));

    // Smartlead accepts bulk leads
    try {
      await this.client.post(`/campaigns/${campaignId}/leads`, {
        lead_list: leadList,
        settings: {
          ignore_global_block_list: false,
          ignore_unsubscribe_list: false,
          ignore_duplicate_leads_in_other_campaign: false,
        },
      });

      return { success: leads.length, failed: 0 };
    } catch (error) {
      console.error("[SmartleadProvider] Bulk lead creation failed:", error);
      return { success: 0, failed: leads.length };
    }
  }

  async updateLeadInterestStatus(
    campaignId: string,
    email: string,
    status: "interested" | "not_interested" | "neutral"
  ): Promise<void> {
    const categoryMap = {
      interested: "Interested",
      not_interested: "Not Interested",
      neutral: null,
    };

    const category = categoryMap[status];
    if (!category) return;

    // First, find the lead by email
    const response = await this.client.get<SmartleadLeadResponse>(
      `/campaigns/${campaignId}/leads`,
      { email }
    );

    if (response.data.length === 0) {
      throw new Error(`Lead not found: ${email}`);
    }

    const leadId = response.data[0].id;

    // Update the lead category
    await this.client.post(`/campaigns/${campaignId}/leads/${leadId}/update-category`, {
      category,
    });
  }

  private mapLead(lead: SmartleadLead): ProviderLead {
    // Extract custom fields (any field not in standard fields)
    const standardFields = [
      "id",
      "email",
      "first_name",
      "last_name",
      "company_name",
      "phone_number",
      "website",
      "linkedin_profile",
      "company_url",
      "location",
      "lead_status",
      "status",
      "category",
      "is_interested",
      "reply_count",
      "open_count",
      "click_count",
      "last_email_sequence_sent",
      "is_unsubscribed",
      "created_at",
      "updated_at",
      "campaign_lead_map_id",
    ];

    const customFields: Record<string, string> = {};
    Object.entries(lead).forEach(([key, value]) => {
      if (!standardFields.includes(key) && typeof value === "string") {
        customFields[key] = value;
      }
    });

    // Determine interest status from is_interested boolean OR category
    let interestStatus = this.mapLeadCategory(lead.category);
    if (lead.is_interested === true && !interestStatus) {
      interestStatus = "interested";
    }

    // Use status field (API returns "status") or fall back to lead_status
    const statusField = lead.status || lead.lead_status;

    return {
      id: String(lead.id),
      email: lead.email,
      firstName: lead.first_name,
      lastName: lead.last_name,
      companyName: lead.company_name,
      phone: lead.phone_number,
      website: lead.website,
      linkedinUrl: lead.linkedin_profile,
      status: this.mapLeadStatus(statusField),
      interestStatus,
      // Map engagement metrics from Smartlead API
      emailReplyCount: lead.reply_count || 0,
      emailOpenCount: lead.open_count || 0,
      emailClickCount: lead.click_count || 0,
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      customFields:
        Object.keys(customFields).length > 0 ? customFields : undefined,
    };
  }

  private mapLeadStatus(status?: string): string {
    if (!status) return "contacted";

    switch (status.toUpperCase()) {
      case "STARTED":
      case "SENT":
        return "contacted";
      case "INPROGRESS":
      case "IN_PROGRESS":
        return "in_progress";
      case "COMPLETED":
        return "completed";
      case "BLOCKED":
        return "blocked";
      default:
        return "contacted";
    }
  }

  private mapLeadCategory(
    category?: SmartleadLead["category"]
  ): ProviderLead["interestStatus"] {
    switch (category) {
      case "Interested":
        return "interested";
      case "Meeting Request":
        return "meeting_booked";
      case "Not Interested":
      case "Do Not Contact":
        return "not_interested";
      case "Out Of Office":
        return "out_of_office";
      case "Wrong Person":
        return "wrong_person";
      case "Information Request":
        return "neutral";
      default:
        return undefined;
    }
  }

  // ============================================
  // ANALYTICS
  // ============================================

  async fetchCampaignAnalytics(
    campaignId: string
  ): Promise<ProviderCampaignAnalytics> {
    const stats = await this.client.get<SmartleadCampaignStats>(
      `/campaigns/${campaignId}/analytics`
    );

    const campaign = await this.client.get<SmartleadCampaign>(
      `/campaigns/${campaignId}`
    );

    return {
      campaignId,
      campaignName: campaign.name,
      leadsCount: stats.total_leads,
      contactedCount: stats.unique_sent_count,
      completedCount: 0, // Not directly available
      emailsSentCount: stats.sent_count,
      openCount: stats.open_count,
      openCountUnique: stats.unique_open_count,
      replyCount: stats.reply_count,
      replyCountUnique: stats.unique_reply_count,
      linkClickCount: stats.click_count,
      linkClickCountUnique: stats.unique_click_count,
      bouncedCount: stats.bounce_count,
      unsubscribedCount: stats.unsubscribe_count,
    };
  }

  async fetchDailyAnalytics(
    campaignId: string,
    startDate: string,
    endDate: string
  ): Promise<ProviderDailyAnalytics[]> {
    // Smartlead may have a different endpoint for daily analytics
    // For now, return empty array as daily breakdown may need custom implementation
    console.log(
      `[SmartleadProvider] Daily analytics for ${campaignId} from ${startDate} to ${endDate}`
    );

    try {
      interface DailyStats {
        date: string;
        sent: number;
        opened: number;
        unique_opened: number;
        replied: number;
        unique_replied: number;
        clicked: number;
        unique_clicked: number;
        bounced?: number;
      }

      const response = await this.client.get<DailyStats[]>(
        `/campaigns/${campaignId}/analytics/daily`,
        {
          start_date: startDate,
          end_date: endDate,
        }
      );

      return response.map((day) => ({
        date: day.date,
        sent: day.sent,
        opened: day.opened,
        uniqueOpened: day.unique_opened,
        replied: day.replied,
        uniqueReplied: day.unique_replied,
        clicked: day.clicked,
        uniqueClicked: day.unique_clicked,
        bounced: day.bounced,
      }));
    } catch {
      // Daily analytics may not be available
      return [];
    }
  }

  // ============================================
  // EMAIL OPERATIONS
  // ============================================

  async fetchEmailsForLead(
    campaignId: string,
    leadEmail: string
  ): Promise<ProviderEmail[]> {
    try {
      // First find the lead
      const leadResponse = await this.client.get<SmartleadLeadResponse>(
        `/campaigns/${campaignId}/leads`,
        { email: leadEmail }
      );

      if (leadResponse.data.length === 0) {
        return [];
      }

      const leadId = leadResponse.data[0].id;

      // Fetch messages for this lead
      const messages = await this.client.get<SmartleadEmailMessage[]>(
        `/campaigns/${campaignId}/leads/${leadId}/messages`
      );

      return messages.map((msg) => ({
        id: String(msg.id),
        fromEmail: msg.email_account,
        toEmail: msg.to_email,
        subject: msg.subject,
        bodyHtml: msg.body,
        campaignId: String(msg.campaign_id),
        leadEmail: msg.to_email,
        isReply: msg.message_type === "REPLY",
        sentAt: msg.sent_at,
        openedAt: msg.opened_at,
        repliedAt: msg.replied_at,
      }));
    } catch (error) {
      console.error("[SmartleadProvider] Error fetching emails:", error);
      return [];
    }
  }

  // ============================================
  // WEBHOOK HANDLING
  // ============================================

  parseWebhookPayload(
    rawBody: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _headers: Record<string, string>
  ): ProviderWebhookPayload {
    const payload: SmartleadWebhookPayload = JSON.parse(rawBody);

    return {
      eventType: this.mapWebhookEventType(payload.event_type),
      providerEventId: `${payload.campaign_id}-${payload.lead_id}-${payload.timestamp}`,
      campaignId: String(payload.campaign_id),
      campaignName: payload.campaign_name,
      leadEmail: payload.email,
      leadId: String(payload.lead_id),
      timestamp: payload.timestamp,
      emailSubject: payload.subject,
      emailBody: payload.body,
      emailFrom: payload.from_email,
      emailTo: payload.to_email,
      linkClicked: payload.link_url,
      rawPayload: payload,
    };
  }

  private mapWebhookEventType(
    eventType: SmartleadWebhookPayload["event_type"]
  ): WebhookEventType {
    switch (eventType) {
      case "EMAIL_SENT":
        return "email_sent";
      case "EMAIL_OPEN":
        return "email_opened";
      case "EMAIL_LINK_CLICK":
        return "link_clicked";
      case "EMAIL_REPLY":
        return "reply_received";
      case "LEAD_UNSUBSCRIBED":
        return "unsubscribed";
      case "LEAD_CATEGORY_UPDATED":
        // Map category updates to interest events
        return "lead_interested"; // Will be refined based on category
      default:
        return "unknown";
    }
  }

  verifyWebhookSignature(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _rawBody: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _signature: string | null,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _secret: string | null
  ): boolean {
    // Smartlead may not use signature verification
    // Return true for now - implement when docs specify signature method
    return true;
  }
}
