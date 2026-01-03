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
  lead_status: "STARTED" | "COMPLETED" | "BLOCKED" | "INPROGRESS";
  category?:
    | "Interested"
    | "Meeting Request"
    | "Not Interested"
    | "Do Not Contact"
    | "Information Request"
    | "Out Of Office"
    | "Wrong Person";
  created_at?: string;
  updated_at?: string;
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

    while (hasMore) {
      const response = await this.client.get<SmartleadLeadResponse>(
        `/campaigns/${campaignId}/leads`,
        { limit, offset }
      );

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
      "lead_status",
      "category",
      "created_at",
      "updated_at",
    ];

    const customFields: Record<string, string> = {};
    Object.entries(lead).forEach(([key, value]) => {
      if (!standardFields.includes(key) && typeof value === "string") {
        customFields[key] = value;
      }
    });

    return {
      id: String(lead.id),
      email: lead.email,
      firstName: lead.first_name,
      lastName: lead.last_name,
      companyName: lead.company_name,
      phone: lead.phone_number,
      website: lead.website,
      linkedinUrl: lead.linkedin_profile,
      status: this.mapLeadStatus(lead.lead_status),
      interestStatus: this.mapLeadCategory(lead.category),
      createdAt: lead.created_at,
      updatedAt: lead.updated_at,
      customFields:
        Object.keys(customFields).length > 0 ? customFields : undefined,
    };
  }

  private mapLeadStatus(status: SmartleadLead["lead_status"]): string {
    switch (status) {
      case "STARTED":
        return "contacted";
      case "INPROGRESS":
        return "in_progress";
      case "COMPLETED":
        return "completed";
      case "BLOCKED":
        return "blocked";
      default:
        return "new";
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
