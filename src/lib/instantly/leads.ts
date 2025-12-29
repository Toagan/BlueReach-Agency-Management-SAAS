// Instantly Leads API Functions

import { getInstantlyClient } from "./client";
import type {
  InstantlyLead,
  InstantlyLeadCreatePayload,
  InstantlyLeadListPayload,
  InstantlyLeadInterestUpdate,
} from "./types";

interface LeadsListResponse {
  items: InstantlyLead[];
}

export async function fetchInstantlyLeads(params: InstantlyLeadListPayload): Promise<InstantlyLead[]> {
  const client = getInstantlyClient();
  // Leads list uses POST with body
  // Note: Instantly API v2 uses "campaign" not "campaign_id"
  const response = await client.post<LeadsListResponse>("/leads/list", {
    campaign: params.campaign_id,  // API expects "campaign" parameter
    limit: params.limit || 100,
    skip: params.skip || 0,
    email: params.email,
    interest_status: params.interest_status,
  });
  return response.items || [];
}

export async function fetchAllLeadsForCampaign(campaignId: string): Promise<InstantlyLead[]> {
  const allLeads: InstantlyLead[] = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const leads = await fetchInstantlyLeads({ campaign_id: campaignId, limit, skip });
    allLeads.push(...leads);

    if (leads.length < limit) {
      break;
    }
    skip += limit;
  }

  return allLeads;
}

export async function fetchInstantlyLead(leadId: string): Promise<InstantlyLead> {
  const client = getInstantlyClient();
  return client.get<InstantlyLead>(`/leads/${leadId}`);
}

export async function createInstantlyLead(payload: InstantlyLeadCreatePayload): Promise<InstantlyLead> {
  const client = getInstantlyClient();
  return client.post<InstantlyLead>("/leads", payload);
}

export async function createInstantlyLeads(leads: InstantlyLeadCreatePayload[]): Promise<{ created: number; failed: number }> {
  let created = 0;
  let failed = 0;

  for (const lead of leads) {
    try {
      await createInstantlyLead(lead);
      created++;
    } catch (error) {
      console.error(`Failed to create lead ${lead.email}:`, error);
      failed++;
    }
  }

  return { created, failed };
}

export async function updateInstantlyLead(
  leadId: string,
  updates: Partial<InstantlyLead>
): Promise<InstantlyLead> {
  const client = getInstantlyClient();
  return client.patch<InstantlyLead>(`/leads/${leadId}`, updates);
}

export async function updateLeadInterestStatus(
  payload: InstantlyLeadInterestUpdate
): Promise<{ success: boolean }> {
  const client = getInstantlyClient();
  return client.post<{ success: boolean }>("/leads/update-interest-status", payload);
}

export async function deleteInstantlyLead(leadId: string): Promise<{ success: boolean }> {
  const client = getInstantlyClient();
  return client.delete<{ success: boolean }>(`/leads/${leadId}`);
}

export async function mergeLeads(payload: {
  winning_lead_id: string;
  losing_lead_id: string;
}): Promise<InstantlyLead> {
  const client = getInstantlyClient();
  return client.post<InstantlyLead>("/leads/merge", payload);
}
