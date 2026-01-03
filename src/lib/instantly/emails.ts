// Instantly Emails API Functions (Unibox)

import { getInstantlyClient } from "./client";
import type { InstantlyEmail, InstantlyEmailListParams } from "./types";

interface EmailsListResponse {
  items?: InstantlyEmail[];
  data?: InstantlyEmail[];
}

// Fetch emails from Instantly V2 API - GET /emails
export async function fetchInstantlyEmails(
  params?: InstantlyEmailListParams
): Promise<InstantlyEmail[]> {
  const client = getInstantlyClient();

  // Build query params for V2 API
  // Note: V2 API uses 'search' parameter for filtering by lead email
  // 'lead' parameter expects a lead ID, not email address
  const queryParams: Record<string, string | number | boolean | undefined> = {
    limit: params?.limit || 100,
  };

  // Add optional filters
  if (params?.campaign_id) queryParams.campaign_id = params.campaign_id;
  // V2 API uses 'search' parameter to filter by lead email address
  if (params?.lead_email) queryParams.search = params.lead_email;
  if (params?.eaccount) queryParams.eaccount = params.eaccount;
  if (params?.is_unread !== undefined) queryParams.is_unread = params.is_unread;

  console.log("[Instantly] Fetching emails with params:", queryParams);

  const response = await client.get<EmailsListResponse>("/emails", queryParams);

  console.log("[Instantly] Email response:", JSON.stringify(response).slice(0, 500));

  // API may return items or data array or direct array
  if (Array.isArray(response)) {
    return response;
  }
  return response.items || response.data || [];
}

// Fetch all emails for a specific lead, optionally filtered by campaign
export async function fetchEmailsForLead(
  leadEmail: string,
  campaignId?: string
): Promise<InstantlyEmail[]> {
  console.log(`[Instantly] Fetching emails for lead: ${leadEmail}, campaign: ${campaignId || 'all'}`);

  // For now, just do a single request - pagination can be added later if needed
  const emails = await fetchInstantlyEmails({
    lead_email: leadEmail,
    campaign_id: campaignId,
    limit: 100,
  });

  console.log(`[Instantly] Total emails found for ${leadEmail}: ${emails.length}`);

  // Sort by timestamp (oldest first for conversation order)
  return emails.sort((a, b) => {
    const aTime = a.timestamp_email || a.timestamp_created || "";
    const bTime = b.timestamp_email || b.timestamp_created || "";
    return aTime.localeCompare(bTime);
  });
}

// Fetch all emails for a campaign
export async function fetchEmailsForCampaign(campaignId: string): Promise<InstantlyEmail[]> {
  console.log(`[Instantly] Fetching emails for campaign: ${campaignId}`);

  // For now, just do a single request with max limit
  const emails = await fetchInstantlyEmails({
    campaign_id: campaignId,
    limit: 100,
  });

  console.log(`[Instantly] Total emails found for campaign ${campaignId}: ${emails.length}`);
  return emails;
}

// Fetch a single email by ID - V2 API uses GET /emails/{id}
export async function fetchInstantlyEmail(emailId: string): Promise<InstantlyEmail> {
  const client = getInstantlyClient();
  return client.get<InstantlyEmail>(`/emails/${emailId}`);
}

// Mark email thread as read - V2 API uses POST /emails/threads/{id}/mark-as-read
export async function markThreadAsRead(threadId: string): Promise<{ success: boolean }> {
  const client = getInstantlyClient();
  return client.post<{ success: boolean }>(`/emails/threads/${threadId}/mark-as-read`);
}

// Get unread email count - V2 API
export async function getUnreadEmailCount(): Promise<{ count: number }> {
  const client = getInstantlyClient();
  // V2 API may not have a direct endpoint for this - fetch with is_unread filter and count
  const emails = await fetchInstantlyEmails({ is_unread: true, limit: 1 });
  // For now just return a rough count - proper implementation would need API support
  return { count: emails.length > 0 ? 1 : 0 };
}
