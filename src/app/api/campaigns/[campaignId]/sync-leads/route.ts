// Historical Lead Sync Endpoint
// Pulls ALL leads from the provider API and upserts them into Supabase

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getProviderForCampaign } from "@/lib/providers";
import { ProviderError } from "@/lib/providers/types";
import type { ProviderLead } from "@/lib/providers/types";
import { requireCampaignAccess } from "@/lib/auth";

// Increase timeout for large syncs (up to 5 minutes on Vercel Pro)
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const auth = await requireCampaignAccess(campaignId);
  if (auth.error) return auth.error;

  // Use service role to bypass RLS
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, client_id, name, provider_type, provider_campaign_id, instantly_campaign_id")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    // Check sync lock - prevent concurrent syncs
    const { data: lockCheck } = await supabase
      .from("campaigns")
      .select("sync_in_progress, sync_started_at")
      .eq("id", campaignId)
      .single();

    if (lockCheck?.sync_in_progress) {
      const syncAge = lockCheck.sync_started_at
        ? Date.now() - new Date(lockCheck.sync_started_at).getTime()
        : 0;
      const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

      if (syncAge < LOCK_TIMEOUT_MS) {
        return NextResponse.json(
          { error: "Sync already in progress", syncStartedAt: lockCheck.sync_started_at },
          { status: 409 }
        );
      }
      // Lock expired, allow this sync to proceed
      console.log(`[SyncLeads] Previous sync lock expired (${Math.round(syncAge / 1000)}s old), proceeding`);
    }

    // Acquire sync lock
    await supabase
      .from("campaigns")
      .update({ sync_in_progress: true, sync_started_at: new Date().toISOString() })
      .eq("id", campaignId);

    // Get client name for denormalization
    const { data: client } = await supabase
      .from("clients")
      .select("name")
      .eq("id", campaign.client_id)
      .single();

    // Get provider instance
    const provider = await getProviderForCampaign(campaignId);

    // Get the provider campaign ID
    const providerCampaignId =
      campaign.provider_campaign_id || campaign.instantly_campaign_id;

    if (!providerCampaignId) {
      return NextResponse.json(
        { error: "Campaign not linked to provider" },
        { status: 400 }
      );
    }

    console.log(
      `[SyncLeads] Starting sync for campaign ${campaignId} (${provider.providerType})`
    );
    console.log(`[SyncLeads] Provider campaign ID: ${providerCampaignId}`);

    // Fetch ALL leads from provider
    // For Smartlead, use fetchAllLeadsWithStats to get category/engagement data
    // The basic leads endpoint doesn't return category, so positive reply detection fails without stats
    let providerLeads;

    if (provider.providerType === "smartlead" && 'fetchAllLeadsWithStats' in provider) {
      console.log(`[SyncLeads] Fetching leads from Smartlead (with statistics for category/engagement data)`);
      providerLeads = await (provider as { fetchAllLeadsWithStats: (id: string) => Promise<ProviderLead[]> }).fetchAllLeadsWithStats(providerCampaignId);
    } else {
      providerLeads = await provider.fetchAllLeads(providerCampaignId);
    }

    console.log(`[SyncLeads] Fetched ${providerLeads.length} leads from provider`);

    // Get existing leads for this campaign
    const { data: existingLeads } = await supabase
      .from("leads")
      .select("email, provider_lead_id, instantly_lead_id, client_id")
      .eq("campaign_id", campaignId);

    // Fix any leads with missing client_id
    const leadsWithoutClientId = (existingLeads || []).filter(l => !l.client_id);
    if (leadsWithoutClientId.length > 0 && campaign.client_id) {
      console.log(`[SyncLeads] Fixing ${leadsWithoutClientId.length} leads with missing client_id`);
      await supabase
        .from("leads")
        .update({
          client_id: campaign.client_id,
          client_name: client?.name,
          campaign_name: campaign.name
        })
        .eq("campaign_id", campaignId)
        .is("client_id", null);
    }

    // Build lookup maps for ID-first matching with email fallback
    const existingByEmail = new Map<string, { provider_lead_id?: string | null; instantly_lead_id?: string | null }>();
    const existingByProviderId = new Map<string, { email: string; provider_lead_id?: string | null; instantly_lead_id?: string | null }>();

    (existingLeads || []).forEach((lead) => {
      const emailLower = lead.email.toLowerCase();
      existingByEmail.set(emailLower, lead);

      // Index by provider IDs for fast lookup
      if (lead.provider_lead_id) {
        existingByProviderId.set(lead.provider_lead_id, { ...lead, email: emailLower });
      }
      if (lead.instantly_lead_id) {
        existingByProviderId.set(lead.instantly_lead_id, { ...lead, email: emailLower });
      }
    });

    // Prepare upsert data
    const leadsToInsert: Array<Record<string, unknown>> = [];
    const leadsToUpdate: Array<{ email: string; data: Record<string, unknown> }> = [];

    for (const lead of providerLeads) {
      // Skip leads without valid email
      if (!lead.email) {
        console.warn(`[SyncLeads] Skipping lead with no email:`, { id: lead.id, firstName: lead.firstName });
        continue;
      }

      const emailLower = lead.email.toLowerCase().trim();
      const providerLeadId = lead.id;

      // MATCHING STRATEGY: ID-first with email fallback
      // 1. Try to match by provider_lead_id / instantly_lead_id (most accurate)
      // 2. Fall back to case-insensitive email match
      let existing: { email: string; provider_lead_id?: string | null; instantly_lead_id?: string | null } | undefined;
      let matchedBy: "id" | "email" | null = null;
      let needsIdBackfill = false;

      // Step 1: Try matching by provider lead ID
      if (providerLeadId) {
        existing = existingByProviderId.get(providerLeadId);
        if (existing) {
          matchedBy = "id";
        }
      }

      // Step 2: Fall back to email matching if no ID match
      if (!existing) {
        const emailMatch = existingByEmail.get(emailLower);
        if (emailMatch) {
          existing = { ...emailMatch, email: emailLower };
          matchedBy = "email";
          // Check if we need to backfill the ID
          if (providerLeadId && !emailMatch.instantly_lead_id && !emailMatch.provider_lead_id) {
            needsIdBackfill = true;
          }
        }
      }

      const leadData: Record<string, unknown> = {
        campaign_id: campaignId,
        client_id: campaign.client_id,
        client_name: client?.name,
        campaign_name: campaign.name,
        email: lead.email,
        first_name: lead.firstName,
        last_name: lead.lastName,
        company_name: lead.companyName,
        company_domain: lead.companyDomain,
        phone: lead.phone,
        linkedin_url: lead.linkedinUrl,
        // website field removed - not in leads table schema
        provider_type: provider.providerType,
        provider_lead_id: lead.id,
        email_open_count: lead.emailOpenCount || 0,
        email_click_count: lead.emailClickCount || 0,
        email_reply_count: lead.emailReplyCount || 0,
        updated_at: new Date().toISOString(),
      };

      // FIX: Set has_replied based on provider status or emailReplyCount
      // This ensures ALL leads who replied are counted, not just positive ones
      // NOTE: "completed" status means email sequence finished, NOT that lead replied
      const replyCount = lead.emailReplyCount || 0;
      const providerStatus = String(lead.status || "").toLowerCase();
      const isRepliedStatus = providerStatus === "replied"; // Don't include "completed" - it means sequence finished

      if (replyCount > 0 || isRepliedStatus) {
        leadData.has_replied = true;
        // Set responded_at from provider reply timestamp if available
        if (lead.repliedAt) {
          leadData.responded_at = lead.repliedAt;
        }
      }

      // NOTE: We do NOT set is_positive_reply here because the Instantly /leads/list endpoint
      // does NOT return interest_status for regular leads. We fetch positive leads separately
      // at the end of this sync using fetchPositiveLeads() which filters by interest_status.
      // Setting is_positive_reply based on non-existent data caused 11k+ false positives.

      // Set is_positive_reply based on interest status
      const interestStatus = lead.interestStatus;
      const positiveStatuses = ["interested", "meeting_booked", "meeting_completed", "closed", 1, 3, 4, 5, "1", "3", "4", "5"];
      const negativeStatuses = ["not_interested", 2, "2"];

      if (positiveStatuses.includes(interestStatus as string | number)) {
        leadData.is_positive_reply = true;
        leadData.has_replied = true;
        // Also update status to replied if not already set to something more specific
        if (!leadData.status || leadData.status === "contacted") {
          leadData.status = "replied";
        }
      } else if (negativeStatuses.includes(interestStatus as string | number)) {
        leadData.is_positive_reply = false;
      }

      // Map status
      if (lead.status) {
        leadData.status = mapLeadStatus(lead.status, lead.interestStatus);
      }

      // For backwards compatibility with Instantly
      if (provider.providerType === "instantly") {
        leadData.instantly_lead_id = lead.id;
        // Store original creation date from Instantly
        if (lead.createdAt) {
          leadData.instantly_created_at = lead.createdAt;
        }
      }

      // Store raw provider data and custom fields in metadata
      const metadataObj: Record<string, unknown> = {};
      if (lead.customFields && Object.keys(lead.customFields).length > 0) {
        metadataObj.customFields = lead.customFields;
      }
      if (lead.rawData && Object.keys(lead.rawData).length > 0) {
        metadataObj.rawData = lead.rawData;
      }
      if (Object.keys(metadataObj).length > 0) {
        leadData.metadata = metadataObj;
      }

      // ID Backfill: Log when we're healing data
      if (needsIdBackfill) {
        console.log(`[SyncLeads] Backfilling instantly_lead_id for ${emailLower}`);
      }

      // Add all leads to insert list - upsert will handle both new and existing
      if (!existing) {
        leadData.created_at = lead.createdAt || new Date().toISOString();
      }
      leadsToInsert.push(leadData);

      if (existing) {
        leadsToUpdate.push({ email: existing.email, data: leadData });
      }
    }

    console.log(
      `[SyncLeads] ${leadsToInsert.length - leadsToUpdate.length} new leads, ${leadsToUpdate.length} to update`
    );

    // Deduplicate leads by email (Instantly API can return duplicates)
    const deduplicatedLeads = new Map<string, Record<string, unknown>>();
    for (const lead of leadsToInsert) {
      const emailKey = (lead.email as string).toLowerCase();
      // Keep the last occurrence (most recent data)
      deduplicatedLeads.set(emailKey, lead);
    }
    const uniqueLeadsToUpsert = Array.from(deduplicatedLeads.values());

    console.log(`[SyncLeads] Deduplicated ${leadsToInsert.length} -> ${uniqueLeadsToUpsert.length} unique leads`);

    // Upsert ALL leads in batches (both new and existing - upsert handles both)
    let upsertedCount = 0;
    const upsertBatchSize = 100;
    const totalBatches = Math.ceil(uniqueLeadsToUpsert.length / upsertBatchSize);

    console.log(`[SyncLeads] Upserting ${uniqueLeadsToUpsert.length} leads in ${totalBatches} batches...`);

    for (let i = 0; i < uniqueLeadsToUpsert.length; i += upsertBatchSize) {
      const batch = uniqueLeadsToUpsert.slice(i, i + upsertBatchSize);
      const batchNum = Math.floor(i / upsertBatchSize) + 1;

      // Use upsert with onConflict to handle both inserts and updates
      const { error: upsertError } = await supabase
        .from("leads")
        .upsert(batch, {
          onConflict: "campaign_id,email",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error(`[SyncLeads] Upsert batch ${batchNum}/${totalBatches} error:`, upsertError);
      } else {
        upsertedCount += batch.length;
      }

      // Log progress every 5 batches
      if (batchNum % 5 === 0) {
        console.log(`[SyncLeads] Upserted ${upsertedCount}/${uniqueLeadsToUpsert.length} leads...`);
      }
    }

    const insertedCount = leadsToInsert.length - leadsToUpdate.length;
    const updatedCount = leadsToUpdate.length;
    console.log(`[SyncLeads] Finished upserting ${upsertedCount} leads (${insertedCount} new, ${updatedCount} updated)`);

    // Update last_lead_sync_at
    await supabase
      .from("campaigns")
      .update({ last_lead_sync_at: new Date().toISOString() })
      .eq("id", campaignId);

    // Also sync campaign analytics from the provider
    let analyticsData = null;
    try {
      const analytics = await provider.fetchCampaignAnalytics(providerCampaignId);
      if (analytics) {
        analyticsData = {
          emails_sent: analytics.emailsSentCount || 0,
          emails_opened: analytics.openCountUnique || 0,
          emails_replied: analytics.replyCount || 0,
          emails_bounced: analytics.bouncedCount || 0,
          total_opportunities: analytics.totalOpportunities || 0,
          leads_count: analytics.leadsCount || 0,
          contacted_count: analytics.contactedCount || 0,
        };

        // Also count replies from local leads table as fallback
        // (Instantly API sometimes returns 0 even when there are replies)
        const { count: localReplyCount } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
          .eq("has_replied", true);

        // Use the higher of API reply count or local reply count
        const replyCount = Math.max(analytics.replyCount || 0, localReplyCount || 0);

        // Count actual leads in our DB (more reliable than provider API count)
        const { count: localLeadsCount } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaignId);

        const { count: localContactedCount } = await supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
          .not("sent_at", "is", null);

        await supabase
          .from("campaigns")
          .update({
            cached_emails_sent: analytics.emailsSentCount || 0,
            cached_emails_opened: analytics.openCountUnique || 0,
            cached_reply_count: replyCount,
            cached_emails_bounced: analytics.bouncedCount || 0,
            cached_positive_count: analytics.totalOpportunities || 0,
            cached_leads_count: localLeadsCount || 0,
            cached_contacted_count: localContactedCount || 0,
            cache_updated_at: new Date().toISOString(),
          })
          .eq("id", campaignId);

        console.log(`[SyncLeads] Synced analytics: ${analytics.emailsSentCount} sent, ${replyCount} replies (API: ${analytics.replyCount}, local: ${localReplyCount})`);
      }
    } catch (analyticsError) {
      console.warn(`[SyncLeads] Could not sync analytics:`, analyticsError);
    }

    // Sync positive leads specifically (Instantly doesn't return interest_status in regular leads list)
    // CONSERVATIVE SYNC STRATEGY:
    // - Only set is_positive_reply = true for leads with EXPLICITLY positive interest status
    // - NEVER set is_positive_reply = false to preserve manual admin changes
    // - Validate each lead's status before updating
    let positiveLeadsSynced = 0;
    let positiveLeadsSkipped = 0;
    let positiveLeadsBackfilled = 0;
    let positiveLeadsErrors = 0;

    // Define which interestStatus values are considered explicitly positive
    const POSITIVE_INTEREST_STATUSES = ["interested", "meeting_booked", "meeting_completed", "closed"];

    try {
      // Check if provider has fetchPositiveLeads method (Instantly-specific)
      if ('fetchPositiveLeads' in provider && typeof provider.fetchPositiveLeads === 'function') {
        // NOTE: We do NOT reset is_positive_reply to false here.
        // This preserves any manual positive flags set by admins in the dashboard.
        // The fetchPositiveLeads() function now has a hard-check that only returns
        // leads with explicitly positive lt_interest_status values (1, 3, 4, 5).

        console.log(`[SyncLeads] Fetching positive leads from provider (conservative mode)...`);
        const positiveLeads = await (provider as { fetchPositiveLeads: (id: string) => Promise<ProviderLead[]> }).fetchPositiveLeads(providerCampaignId);

        console.log(`[SyncLeads] Found ${positiveLeads.length} leads from positive leads endpoint`);

        for (const lead of positiveLeads) {
          try {
            // Skip leads without valid email
            if (!lead.email) {
              console.warn(`[SyncLeads] Skipping positive lead with no email:`, { id: lead.id });
              positiveLeadsSkipped++;
              continue;
            }

            const emailLower = lead.email.toLowerCase().trim();
            const providerLeadId = lead.id;

            // CONSERVATIVE CHECK: Double-verify the lead has a positive interest status
            // This is a safety net in case fetchPositiveLeads returns unexpected data
            const isExplicitlyPositive = lead.interestStatus && POSITIVE_INTEREST_STATUSES.includes(lead.interestStatus);

            if (!isExplicitlyPositive) {
              // Lead does not have an explicitly positive status - skip to avoid incorrect marking
              console.warn(
                `[SyncLeads] SKIPPING lead ${emailLower}: interestStatus="${lead.interestStatus}" is not explicitly positive`
              );
              positiveLeadsSkipped++;
              continue;
            }

            // MATCHING STRATEGY: ID-first with email fallback
            let matchedLeadId: string | null = null;
            let needsIdBackfill = false;

            // Step 1: Try matching by provider lead ID
            let existingReplyFromStep: number | null = null;
            if (providerLeadId) {
              const { data: idMatch, error: idMatchError } = await supabase
                .from("leads")
                .select("id, instantly_lead_id, reply_from_step")
                .eq("campaign_id", campaignId)
                .eq("instantly_lead_id", providerLeadId)
                .maybeSingle();

              if (idMatchError) {
                console.warn(`[SyncLeads] Error matching by ID for ${emailLower}:`, idMatchError);
              } else if (idMatch) {
                matchedLeadId = idMatch.id;
                existingReplyFromStep = idMatch.reply_from_step;
              }
            }

            // Step 2: Fall back to email matching if no ID match
            if (!matchedLeadId) {
              const { data: emailMatch, error: emailMatchError } = await supabase
                .from("leads")
                .select("id, instantly_lead_id, reply_from_step")
                .eq("campaign_id", campaignId)
                .ilike("email", emailLower)
                .maybeSingle();

              if (emailMatchError) {
                console.warn(`[SyncLeads] Error matching by email for ${emailLower}:`, emailMatchError);
              } else if (emailMatch) {
                matchedLeadId = emailMatch.id;
                existingReplyFromStep = emailMatch.reply_from_step;
                // Check if we need to backfill the ID
                if (providerLeadId && !emailMatch.instantly_lead_id) {
                  needsIdBackfill = true;
                }
              }
            }

            if (matchedLeadId) {
              // Build update payload - ONLY set is_positive_reply to true, never false
              const updatePayload: Record<string, unknown> = {
                is_positive_reply: true, // Only set to true for explicitly positive leads
                has_replied: true,
                status: "replied",
              };

              // ID Backfill: If matched by email but ID was missing, add it now
              if (needsIdBackfill && providerLeadId) {
                updatePayload.instantly_lead_id = providerLeadId;
                updatePayload.provider_lead_id = providerLeadId;
                positiveLeadsBackfilled++;
                console.log(`[SyncLeads] Backfilling instantly_lead_id for positive lead ${emailLower}`);
              }

              // Variant tracking: If reply_from_step is not set, default to step 1
              // For Instantly, the API doesn't provide which step/variant the reply came from
              // We can only reliably track this via webhooks. For sync-based positive leads,
              // default to step 1 since most campaigns are single-step and it ensures
              // positive replies are at least counted in the variant analytics.
              if (existingReplyFromStep === null) {
                updatePayload.reply_from_step = 1; // Default to step 1
                // Note: We can't determine the specific variant (A, B, C, etc.) from Instantly API
                // The variant will show as "Unknown" in analytics, but step-level tracking works
                console.log(`[SyncLeads] Setting reply_from_step=1 for positive lead ${emailLower} (Instantly doesn't provide variant info)`);
              }

              const { error: updateError } = await supabase
                .from("leads")
                .update(updatePayload)
                .eq("id", matchedLeadId);

              if (updateError) {
                console.error(`[SyncLeads] Error updating positive lead ${emailLower}:`, updateError);
                positiveLeadsErrors++;
              } else {
                positiveLeadsSynced++;
              }
            } else {
              // Lead not found - log warning but don't create (full sync already happened)
              console.warn(`[SyncLeads] WARNING: Positive lead ${emailLower} not found in DB after full sync`);
              positiveLeadsSkipped++;
            }
          } catch (leadError) {
            // Catch errors for individual leads so one failure doesn't break the entire sync
            console.error(`[SyncLeads] Exception processing positive lead ${lead.email}:`, leadError);
            positiveLeadsErrors++;
          }
        }

        console.log(
          `[SyncLeads] Positive leads sync complete: ` +
          `${positiveLeadsSynced} marked positive, ` +
          `${positiveLeadsSkipped} skipped, ` +
          `${positiveLeadsBackfilled} IDs backfilled, ` +
          `${positiveLeadsErrors} errors`
        );
      }
    } catch (positiveError) {
      console.error(`[SyncLeads] Fatal error in positive leads sync:`, positiveError);
      // Don't throw - let the main sync complete even if positive sync fails
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: Sync email threads for leads with replies
    // This ensures all conversation history is preserved locally
    // ═══════════════════════════════════════════════════════════════════════════
    let emailsSynced = 0;
    let leadsWithEmailsSynced = 0;
    let emailSyncErrors = 0;

    try {
      // Check if provider supports email fetching
      if ('fetchEmailsForLead' in provider && typeof provider.fetchEmailsForLead === 'function') {
        console.log(`[SyncLeads] Starting email thread sync...`);

        // Get leads with ACTUAL replies for this campaign
        // Only sync emails for positive replies or leads with email_reply_count > 0
        // Skip has_replied=true as it may include false positives from status="COMPLETED"
        const { data: leadsWithReplies, error: repliesError } = await supabase
          .from("leads")
          .select("id, email, provider_lead_id, instantly_lead_id")
          .eq("campaign_id", campaignId)
          .or("is_positive_reply.eq.true,email_reply_count.gt.0");

        if (repliesError) {
          console.error(`[SyncLeads] Error fetching leads with replies:`, repliesError);
        } else if (leadsWithReplies && leadsWithReplies.length > 0) {
          console.log(`[SyncLeads] Found ${leadsWithReplies.length} leads with replies to sync emails for`);

          // Get existing email IDs to track what we already have
          const { data: existingEmails } = await supabase
            .from("lead_emails")
            .select("lead_id, provider_email_id")
            .eq("campaign_id", campaignId);

          const existingEmailsByLead = new Map<string, Set<string>>();
          (existingEmails || []).forEach((e) => {
            if (!existingEmailsByLead.has(e.lead_id)) {
              existingEmailsByLead.set(e.lead_id, new Set());
            }
            if (e.provider_email_id) {
              existingEmailsByLead.get(e.lead_id)!.add(e.provider_email_id);
            }
          });

          // Process leads in batches to avoid rate limits
          const emailBatchSize = 5;
          for (let i = 0; i < leadsWithReplies.length; i += emailBatchSize) {
            const batch = leadsWithReplies.slice(i, i + emailBatchSize);

            await Promise.all(
              batch.map(async (lead) => {
                try {
                  // Get lead ID for provider (Smartlead needs this, Instantly can look up by email)
                  const providerLeadId = lead.provider_lead_id || lead.instantly_lead_id;

                  // Fetch emails from provider
                  const emails = await (provider as { fetchEmailsForLead: (campaignId: string, email: string, leadId?: string) => Promise<Array<{
                    id?: string;
                    threadId?: string;
                    isReply?: boolean;
                    fromEmail?: string;
                    toEmail?: string;
                    subject?: string;
                    bodyText?: string;
                    bodyHtml?: string;
                    sentAt?: string;
                  }>> }).fetchEmailsForLead(providerCampaignId, lead.email, providerLeadId || undefined);

                  if (!emails || emails.length === 0) {
                    return;
                  }

                  // Filter out existing emails
                  const existingIds = existingEmailsByLead.get(lead.id) || new Set();
                  const newEmails = emails.filter(
                    (email) => !email.id || !existingIds.has(email.id)
                  );

                  // Deduplicate emails by provider_email_id (API may return duplicates)
                  const uniqueEmails: typeof newEmails = [];
                  const seenIds = new Set<string>();
                  for (const email of newEmails) {
                    if (email.id && !seenIds.has(email.id)) {
                      seenIds.add(email.id);
                      uniqueEmails.push(email);
                    } else if (!email.id) {
                      uniqueEmails.push(email);
                    }
                  }

                  if (uniqueEmails.length === 0) {
                    return;
                  }

                  // Upsert emails (update if provider_email_id exists, insert otherwise)
                  // This handles the case where emails were previously synced with wrong lead_id
                  const emailRecords = uniqueEmails.map((email) => ({
                    lead_id: lead.id,
                    campaign_id: campaignId,
                    provider_email_id: email.id,
                    provider_thread_id: email.threadId,
                    direction: email.isReply ? "inbound" : "outbound",
                    from_email: email.fromEmail,
                    to_email: email.toEmail || lead.email,
                    subject: email.subject,
                    body_text: email.bodyText,
                    body_html: email.bodyHtml,
                    sent_at: email.sentAt,
                    updated_at: new Date().toISOString(),
                  }));

                  const { error: insertError } = await supabase
                    .from("lead_emails")
                    .upsert(emailRecords, {
                      onConflict: "provider_email_id",
                      ignoreDuplicates: false,
                    });

                  if (insertError) {
                    console.error(`[SyncLeads] Error inserting emails for ${lead.email}:`, insertError);
                    emailSyncErrors++;
                  } else {
                    emailsSynced += uniqueEmails.length;
                    leadsWithEmailsSynced++;
                  }
                } catch (err) {
                  console.error(`[SyncLeads] Error syncing emails for ${lead.email}:`, err);
                  emailSyncErrors++;
                }
              })
            );

            // Small delay between batches to respect rate limits
            if (i + emailBatchSize < leadsWithReplies.length) {
              await new Promise((resolve) => setTimeout(resolve, 300));
            }

            // Log progress every 50 leads
            if ((i + emailBatchSize) % 50 === 0 || i + emailBatchSize >= leadsWithReplies.length) {
              console.log(`[SyncLeads] Email sync progress: ${Math.min(i + emailBatchSize, leadsWithReplies.length)}/${leadsWithReplies.length} leads processed`);
            }
          }

          // Update last email sync timestamp
          await supabase
            .from("campaigns")
            .update({ last_email_sync_at: new Date().toISOString() })
            .eq("id", campaignId);

          console.log(`[SyncLeads] Email sync complete: ${emailsSynced} emails synced for ${leadsWithEmailsSynced} leads (${emailSyncErrors} errors)`);
        } else {
          console.log(`[SyncLeads] No leads with replies found, skipping email sync`);
        }
      } else {
        console.log(`[SyncLeads] Provider does not support email fetching, skipping email sync`);
      }
    } catch (emailSyncError) {
      console.error(`[SyncLeads] Fatal error in email sync:`, emailSyncError);
      // Don't throw - let the main sync complete even if email sync fails
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4.5: Backfill variant info on outbound lead_emails using campaign_sequences
    // Match outbound emails missing variant data to sequence variants by subject/body
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      // Get campaign sequences (variant templates with subjects/bodies)
      const { data: sequences } = await supabase
        .from("campaign_sequences")
        .select("step_number, variant, subject, body_text")
        .eq("campaign_id", campaignId);

      if (sequences && sequences.length > 0) {
        // Get outbound emails without variant info
        const { count: missingVariantCount } = await supabase
          .from("lead_emails")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
          .eq("direction", "outbound")
          .is("sequence_variant_label", null);

        if (missingVariantCount && missingVariantCount > 0) {
          console.log(`[SyncLeads] Backfilling variant info for ${missingVariantCount} outbound emails using ${sequences.length} sequence templates`);

          let variantsBackfilled = 0;

          // For each sequence variant, update matching outbound emails by subject
          for (const seq of sequences) {
            if (!seq.subject) continue;

            // Match outbound emails by subject (case-insensitive partial match)
            // Use the subject from the sequence template
            const { count: updated } = await supabase
              .from("lead_emails")
              .update({
                sequence_step: seq.step_number || 1,
                sequence_variant_label: seq.variant,
              })
              .eq("campaign_id", campaignId)
              .eq("direction", "outbound")
              .is("sequence_variant_label", null)
              .ilike("subject", `%${seq.subject.replace(/[%_]/g, "\\$&")}%`)
              .select("id", { count: "exact", head: true });

            if (updated && updated > 0) {
              variantsBackfilled += updated;
            }
          }

          // For any remaining unmatched outbound emails, try matching by body content
          if (variantsBackfilled < missingVariantCount) {
            for (const seq of sequences) {
              if (!seq.body_text) continue;
              // Use first 50 chars of body as a fingerprint
              const bodySnippet = seq.body_text.trim().substring(0, 50).replace(/[%_]/g, "\\$&");
              if (bodySnippet.length < 10) continue;

              const { count: updated } = await supabase
                .from("lead_emails")
                .update({
                  sequence_step: seq.step_number || 1,
                  sequence_variant_label: seq.variant,
                })
                .eq("campaign_id", campaignId)
                .eq("direction", "outbound")
                .is("sequence_variant_label", null)
                .or(`body_text.ilike.%${bodySnippet}%,body_html.ilike.%${bodySnippet}%`)
                .select("id", { count: "exact", head: true });

              if (updated && updated > 0) {
                variantsBackfilled += updated;
              }
            }
          }

          // Default remaining unmatched to step 1
          const { count: stillMissing } = await supabase
            .from("lead_emails")
            .update({ sequence_step: 1 })
            .eq("campaign_id", campaignId)
            .eq("direction", "outbound")
            .is("sequence_step", null)
            .select("id", { count: "exact", head: true });

          console.log(`[SyncLeads] Variant backfill: ${variantsBackfilled} matched by template, ${stillMissing || 0} defaulted to step 1`);
        }
      }
    } catch (variantBackfillError) {
      console.error(`[SyncLeads] Error backfilling variant info:`, variantBackfillError);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 5: Sync positive leads from Smartlead statistics (category-based)
    // The basic leads endpoint doesn't return category, so we fetch from statistics
    // Also sync variant tracking info for which email triggered replies
    // ═══════════════════════════════════════════════════════════════════════════
    let positiveLeadsFromStats = 0;
    let variantsSynced = 0;

    if (provider.providerType === "smartlead" && 'fetchLeadStatisticsWithVariants' in provider) {
      try {
        console.log(`[SyncLeads] Fetching positive leads from Smartlead statistics with variant tracking...`);

        // Use the enhanced method that includes variant info
        const statsMap = await (provider as {
          fetchLeadStatisticsWithVariants: (id: string) => Promise<Map<string, {
            category: string | null;
            hasReplied: boolean;
            replyFromStep: number | null;
            replyFromVariant: number | null;
            replyFromVariantLabel: string | null;
            emailStats: Array<{
              sequenceNumber: number;
              variantId: number;
              variantLabel: string | null;
              subject: string;
              sentTime: string | null;
              replyTime: string | null;
            }>;
          }>>
        }).fetchLeadStatisticsWithVariants(providerCampaignId);

        const positiveCategories = ["Interested", "Meeting Request"];

        // Process leads with stats - update positive leads AND variant tracking
        for (const [email, stats] of statsMap) {
          const isPositive = stats.category && positiveCategories.includes(stats.category);

          // Build update payload
          const updatePayload: Record<string, unknown> = {};

          if (isPositive) {
            updatePayload.is_positive_reply = true;
            updatePayload.has_replied = true;
            updatePayload.status = "replied";
          }

          // Track which email variant triggered the reply (for all replied leads, not just positive)
          if (stats.hasReplied && stats.replyFromStep !== null) {
            updatePayload.reply_from_step = stats.replyFromStep;
            updatePayload.reply_from_variant = stats.replyFromVariant;
            updatePayload.reply_from_variant_label = stats.replyFromVariantLabel;
            variantsSynced++;
          } else if ((isPositive || stats.hasReplied) && stats.emailStats && stats.emailStats.length > 0) {
            // For replied leads without reply_time in stats, infer variant from their most recent sent email
            // Sort by sent time descending and pick the first one (most recent)
            const sortedEmails = [...stats.emailStats].sort((a, b) => {
              if (!a.sentTime) return 1;
              if (!b.sentTime) return -1;
              return b.sentTime.localeCompare(a.sentTime);
            });
            const lastEmail = sortedEmails[0];
            if (lastEmail) {
              updatePayload.reply_from_step = lastEmail.sequenceNumber;
              updatePayload.reply_from_variant = lastEmail.variantId;
              updatePayload.reply_from_variant_label = lastEmail.variantLabel;
              variantsSynced++;
              console.log(`[SyncLeads] Inferred variant for replied lead ${email}: step=${lastEmail.sequenceNumber}, variant=${lastEmail.variantLabel || 'Unknown'}`);
            }
          }

          // Only update if we have something to update
          if (Object.keys(updatePayload).length > 0) {
            const { error } = await supabase
              .from("leads")
              .update(updatePayload)
              .eq("campaign_id", campaignId)
              .ilike("email", email);

            if (!error && isPositive) {
              positiveLeadsFromStats++;
            }
          }

          // Also update lead_emails with variant info for outbound emails
          if (stats.emailStats && stats.emailStats.length > 0) {
            for (const emailStat of stats.emailStats) {
              if (emailStat.sentTime && emailStat.variantLabel) {
                // Update outbound emails with variant info based on subject + sent time match
                await supabase
                  .from("lead_emails")
                  .update({
                    sequence_step: emailStat.sequenceNumber,
                    sequence_variant: emailStat.variantId,
                    sequence_variant_label: emailStat.variantLabel,
                  })
                  .eq("campaign_id", campaignId)
                  .eq("direction", "outbound")
                  .ilike("subject", emailStat.subject);
              }
            }
          }
        }

        console.log(`[SyncLeads] Updated ${positiveLeadsFromStats} positive leads, ${variantsSynced} with variant tracking from statistics`);
      } catch (statsError) {
        console.error(`[SyncLeads] Error syncing positive leads from statistics:`, statsError);
      }
    } else if (provider.providerType === "smartlead" && 'fetchLeadStatistics' in provider) {
      // Fallback to basic stats if enhanced method not available
      try {
        console.log(`[SyncLeads] Fetching positive leads from Smartlead statistics (basic)...`);

        const statsMap = await (provider as { fetchLeadStatistics: (id: string) => Promise<Map<string, { category: string | null; hasReplied: boolean }>> }).fetchLeadStatistics(providerCampaignId);

        const positiveCategories = ["Interested", "Meeting Request"];
        const positiveEmails: string[] = [];

        statsMap.forEach((stats, email) => {
          if (stats.category && positiveCategories.includes(stats.category)) {
            positiveEmails.push(email);
          }
        });

        console.log(`[SyncLeads] Found ${positiveEmails.length} positive leads in statistics`);

        for (let i = 0; i < positiveEmails.length; i += 50) {
          const batch = positiveEmails.slice(i, i + 50);
          for (const email of batch) {
            const { error } = await supabase
              .from("leads")
              .update({
                is_positive_reply: true,
                has_replied: true,
                status: "replied",
              })
              .eq("campaign_id", campaignId)
              .ilike("email", email);

            if (!error) {
              positiveLeadsFromStats++;
            }
          }
        }

        console.log(`[SyncLeads] Updated ${positiveLeadsFromStats} positive leads from statistics`);
      } catch (statsError) {
        console.error(`[SyncLeads] Error syncing positive leads from statistics:`, statsError);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 5.5: Backfill reply_from_step on replied leads from their outbound lead_emails
    // Catches leads that Step 5 missed (not in provider statistics)
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      const { data: untrackedReplies } = await supabase
        .from("leads")
        .select("id")
        .eq("campaign_id", campaignId)
        .is("reply_from_step", null)
        .or("has_replied.eq.true,is_positive_reply.eq.true");

      if (untrackedReplies && untrackedReplies.length > 0) {
        console.log(`[SyncLeads] Backfilling reply_from_step for ${untrackedReplies.length} untracked replied leads`);
        const untrackedIds = untrackedReplies.map(l => l.id);
        let backfilledFromEmail = 0;
        let backfilledDefault = 0;

        // Fetch outbound emails with variant data for these leads
        const { data: outboundEmails } = await supabase
          .from("lead_emails")
          .select("lead_id, sequence_step, sequence_variant, sequence_variant_label, sent_at")
          .eq("campaign_id", campaignId)
          .eq("direction", "outbound")
          .in("lead_id", untrackedIds)
          .not("sequence_step", "is", null)
          .order("sent_at", { ascending: false });

        // Build map: lead_id -> most recent outbound with variant data
        const outboundMap = new Map<string, { step: number; variant: number | null; label: string | null }>();
        for (const e of outboundEmails || []) {
          if (!outboundMap.has(e.lead_id)) {
            outboundMap.set(e.lead_id, {
              step: e.sequence_step,
              variant: e.sequence_variant,
              label: e.sequence_variant_label,
            });
          }
        }

        // Update leads in batches
        const batchSize = 100;
        for (let i = 0; i < untrackedIds.length; i += batchSize) {
          const batch = untrackedIds.slice(i, i + batchSize);
          const withVariant = batch.filter(id => outboundMap.has(id));
          const withoutVariant = batch.filter(id => !outboundMap.has(id));

          // Update leads with matched variant data
          for (const id of withVariant) {
            const info = outboundMap.get(id)!;
            await supabase
              .from("leads")
              .update({
                reply_from_step: info.step,
                reply_from_variant: info.variant,
                reply_from_variant_label: info.label,
              })
              .eq("id", id);
            backfilledFromEmail++;
          }

          // Default remaining to step 1
          if (withoutVariant.length > 0) {
            await supabase
              .from("leads")
              .update({ reply_from_step: 1 })
              .in("id", withoutVariant);
            backfilledDefault += withoutVariant.length;
          }
        }

        console.log(`[SyncLeads] Reply backfill: ${backfilledFromEmail} from outbound emails, ${backfilledDefault} defaulted to step 1`);
      }
    } catch (replyBackfillError) {
      console.error(`[SyncLeads] Error backfilling reply_from_step:`, replyBackfillError);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 6: Update cached_positive_count from actual DB state
    // SmartLead's analytics API doesn't return totalOpportunities, so the cache
    // would be 0 unless we count from the local DB after syncing
    // ═══════════════════════════════════════════════════════════════════════════
    try {
      const [
        { count: positiveCount },
        { count: repliedCount },
      ] = await Promise.all([
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
          .eq("is_positive_reply", true),
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campaignId)
          .eq("has_replied", true),
      ]);

      await supabase
        .from("campaigns")
        .update({
          cached_positive_count: positiveCount || 0,
          cached_reply_count: Math.max(
            repliedCount || 0,
            // Preserve existing cached_reply_count if higher (from provider analytics)
            analyticsData?.emails_replied || 0
          ),
        })
        .eq("id", campaignId);

      console.log(`[SyncLeads] Updated cache: ${positiveCount || 0} positive, ${repliedCount || 0} replied (local DB count)`);
    } catch (err) {
      console.error(`[SyncLeads] Error updating cached counts from DB:`, err);
    }

    console.log(
      `[SyncLeads] Completed: ${insertedCount} inserted, ${updatedCount} updated, ${positiveLeadsFromStats} positive, ${emailsSynced} emails synced`
    );

    // Release sync lock
    await supabase
      .from("campaigns")
      .update({ sync_in_progress: false, sync_started_at: null })
      .eq("id", campaignId);

    return NextResponse.json({
      success: true,
      totalFromProvider: providerLeads.length,
      inserted: insertedCount,
      updated: updatedCount,
      skipped: leadsToInsert.length - insertedCount,
      positiveLeads: positiveLeadsFromStats,
      analytics: analyticsData,
      emailSync: {
        emailsSynced,
        leadsWithEmailsSynced,
        errors: emailSyncErrors,
      },
    });
  } catch (error) {
    // If provider returns 404/410, the campaign was deleted in the provider
    const isDeletedInProvider =
      (error instanceof ProviderError && (error.statusCode === 404 || error.statusCode === 410)) ||
      (error instanceof Error && (error.message.includes("not found") || error.message.includes("deleted")));

    if (isDeletedInProvider) {
      console.log(`[SyncLeads] Campaign ${campaignId} appears deleted in provider, marking inactive`);

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (supabaseUrl && supabaseServiceKey) {
        const sb = createClient(supabaseUrl, supabaseServiceKey);
        await sb
          .from("campaigns")
          .update({ is_active: false, sync_in_progress: false, sync_started_at: null })
          .eq("id", campaignId);
      }

      return NextResponse.json(
        { error: "Campaign no longer exists in provider. Marked as inactive.", campaignDeleted: true },
        { status: 410 }
      );
    }

    console.error("[SyncLeads] Error:", error);

    // Release sync lock on error
    try {
      await supabase
        .from("campaigns")
        .update({ sync_in_progress: false, sync_started_at: null })
        .eq("id", campaignId);
    } catch {
      // Ignore lock release errors
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to sync leads",
      },
      { status: 500 }
    );
  }
}

// Map provider status to our internal status
function mapLeadStatus(
  status?: string,
  interestStatus?: ProviderLead["interestStatus"]
): string {
  // Interest status takes priority (handle both string and numeric)
  const positiveStatuses = ["interested", "meeting_booked", "meeting_completed", "closed", 1, 3, "1", "3"];
  const bookedStatuses = ["meeting_booked", "meeting_completed", 3, "3"];

  if (bookedStatuses.includes(interestStatus as string | number)) {
    return "booked";
  }
  if (positiveStatuses.includes(interestStatus as string | number)) {
    return "replied";
  }

  // Fall back to status
  switch (status) {
    case "contacted":
    case "STARTED":
    case "started":
      return "contacted";
    case "opened":
      return "opened";
    case "clicked":
      return "clicked";
    case "replied":
    case "COMPLETED":
    case "completed":
      return "replied";
    default:
      return "contacted";
  }
}

// GET endpoint to check sync status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const auth = await requireCampaignAccess(campaignId);
  if (auth.error) return auth.error;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("last_lead_sync_at, last_email_sync_at")
    .eq("id", campaignId)
    .single();

  const { count: leadCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  const { count: repliedCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId)
    .or("has_replied.eq.true,is_positive_reply.eq.true");

  const { count: emailCount } = await supabase
    .from("lead_emails")
    .select("*", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  return NextResponse.json({
    lastSyncAt: campaign?.last_lead_sync_at,
    lastEmailSyncAt: campaign?.last_email_sync_at,
    leadCount: leadCount || 0,
    leadsWithReplies: repliedCount || 0,
    emailCount: emailCount || 0,
  });
}
