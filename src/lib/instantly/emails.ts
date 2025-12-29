// Instantly Emails API Functions (Unibox)

import { getInstantlyClient } from "./client";
import type { InstantlyEmail, InstantlyEmailListParams } from "./types";

interface EmailsListResponse {
  items: InstantlyEmail[];
}

// Fetch emails from Unibox
export async function fetchInstantlyEmails(
  params?: InstantlyEmailListParams
): Promise<InstantlyEmail[]> {
  const client = getInstantlyClient();
  const response = await client.get<EmailsListResponse>("/emails", {
    limit: params?.limit || 100,
    skip: params?.skip || 0,
    campaign_id: params?.campaign_id,
    lead_email: params?.lead_email,
    eaccount: params?.eaccount,
    is_unread: params?.is_unread,
  });
  return response.items || [];
}

// Fetch all emails for a specific lead
export async function fetchEmailsForLead(leadEmail: string): Promise<InstantlyEmail[]> {
  const allEmails: InstantlyEmail[] = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const emails = await fetchInstantlyEmails({
      lead_email: leadEmail,
      limit,
      skip,
    });
    allEmails.push(...emails);

    if (emails.length < limit) {
      break;
    }
    skip += limit;
  }

  // Sort by timestamp (oldest first for conversation order)
  return allEmails.sort((a, b) => {
    const aTime = a.timestamp_email || a.timestamp_created || "";
    const bTime = b.timestamp_email || b.timestamp_created || "";
    return aTime.localeCompare(bTime);
  });
}

// Fetch all emails for a campaign
export async function fetchEmailsForCampaign(campaignId: string): Promise<InstantlyEmail[]> {
  const allEmails: InstantlyEmail[] = [];
  let skip = 0;
  const limit = 100;

  while (true) {
    const emails = await fetchInstantlyEmails({
      campaign_id: campaignId,
      limit,
      skip,
    });
    allEmails.push(...emails);

    if (emails.length < limit) {
      break;
    }
    skip += limit;
  }

  return allEmails;
}

// Fetch a single email by ID
export async function fetchInstantlyEmail(emailId: string): Promise<InstantlyEmail> {
  const client = getInstantlyClient();
  return client.get<InstantlyEmail>(`/emails/${emailId}`);
}

// Mark email thread as read
export async function markThreadAsRead(threadId: string): Promise<{ success: boolean }> {
  const client = getInstantlyClient();
  return client.post<{ success: boolean }>(`/emails/threads/${threadId}/mark-as-read`);
}

// Get unread email count
export async function getUnreadEmailCount(): Promise<{ count: number }> {
  const client = getInstantlyClient();
  return client.get<{ count: number }>("/emails/unread/count");
}
