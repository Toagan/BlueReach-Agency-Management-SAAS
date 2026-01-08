// Historical Lead Sync Endpoint
// Pulls ALL leads from the provider API and upserts them into Supabase

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getProviderForCampaign } from "@/lib/providers";
import type { ProviderLead } from "@/lib/providers/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;

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
    // For Smartlead, always fetch leads first, then sync positive leads from statistics
    let providerLeads;

    if (provider.providerType === "smartlead") {
      // Always use basic lead fetch for speed - we'll sync positive leads separately
      console.log(`[SyncLeads] Fetching leads from Smartlead (statistics synced separately)`);
      providerLeads = await provider.fetchAllLeads(providerCampaignId);
    } else {
      providerLeads = await provider.fetchAllLeads(providerCampaignId);
    }

    console.log(`[SyncLeads] Fetched ${providerLeads.length} leads from provider`);

    // DEBUG: Log sample of fetched leads for Smartlead debugging
    if (provider.providerType === "smartlead" && providerLeads.length > 0) {
      console.log(`[SyncLeads] Smartlead sample leads (with stats):`, providerLeads.slice(0, 3).map(l => ({
        id: l.id,
        email: l.email,
        status: l.status,
        interestStatus: l.interestStatus,
        emailReplyCount: l.emailReplyCount,
        emailOpenCount: l.emailOpenCount,
        emailClickCount: l.emailClickCount,
      })));
    }

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
      const replyCount = lead.emailReplyCount || 0;
      const providerStatus = String(lead.status || "").toLowerCase();
      const isRepliedStatus = providerStatus === "replied" || providerStatus === "completed";

      if (replyCount > 0 || isRepliedStatus) {
        leadData.has_replied = true;
        // Don't override status if already set by mapLeadStatus
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
      }

      // Store custom fields in metadata
      if (lead.customFields && Object.keys(lead.customFields).length > 0) {
        leadData.metadata = { customFields: lead.customFields };
      }

      // ID Backfill: Log when we're healing data
      if (needsIdBackfill) {
        console.log(`[SyncLeads] Backfilling instantly_lead_id for ${emailLower}`);
      }

      if (existing) {
        leadsToUpdate.push({ email: existing.email, data: leadData });
      } else {
        leadData.created_at = lead.createdAt || new Date().toISOString();
        leadsToInsert.push(leadData);
      }
    }

    console.log(
      `[SyncLeads] ${leadsToInsert.length} new leads, ${leadsToUpdate.length} to update`
    );

    // Deduplicate leads by email (Instantly API can return duplicates)
    const deduplicatedLeads = new Map<string, Record<string, unknown>>();
    for (const lead of leadsToInsert) {
      const emailKey = (lead.email as string).toLowerCase();
      // Keep the last occurrence (most recent data)
      deduplicatedLeads.set(emailKey, lead);
    }
    const uniqueLeadsToInsert = Array.from(deduplicatedLeads.values());

    console.log(`[SyncLeads] Deduplicated ${leadsToInsert.length} -> ${uniqueLeadsToInsert.length} unique leads`);

    // Insert/upsert new leads in batches
    let insertedCount = 0;
    const insertBatchSize = 100;
    const totalBatches = Math.ceil(uniqueLeadsToInsert.length / insertBatchSize);

    console.log(`[SyncLeads] Upserting ${uniqueLeadsToInsert.length} leads in ${totalBatches} batches...`);

    for (let i = 0; i < uniqueLeadsToInsert.length; i += insertBatchSize) {
      const batch = uniqueLeadsToInsert.slice(i, i + insertBatchSize);
      const batchNum = Math.floor(i / insertBatchSize) + 1;

      // Use upsert with onConflict to handle duplicates gracefully
      const { error: upsertError } = await supabase
        .from("leads")
        .upsert(batch, {
          onConflict: "campaign_id,email",
          ignoreDuplicates: false,
        });

      if (upsertError) {
        console.error(`[SyncLeads] Upsert batch ${batchNum}/${totalBatches} error:`, upsertError);
      } else {
        insertedCount += batch.length;
      }

      // Log progress every 50 batches
      if (batchNum % 50 === 0) {
        console.log(`[SyncLeads] Upserted ${insertedCount}/${uniqueLeadsToInsert.length} leads...`);
      }
    }

    console.log(`[SyncLeads] Finished upserting ${insertedCount} leads`);

    // Update existing leads in batches
    let updatedCount = 0;

    for (const { email, data } of leadsToUpdate) {
      const { error: updateError } = await supabase
        .from("leads")
        .update(data)
        .eq("campaign_id", campaignId)
        .ilike("email", email);

      if (!updateError) {
        updatedCount++;
      }
    }

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

        await supabase
          .from("campaigns")
          .update({
            cached_emails_sent: analytics.emailsSentCount || 0,
            cached_emails_opened: analytics.openCountUnique || 0,
            cached_reply_count: analytics.replyCount || 0,
            cached_emails_bounced: analytics.bouncedCount || 0,
            cached_positive_count: analytics.totalOpportunities || 0,
            cache_updated_at: new Date().toISOString(),
          })
          .eq("id", campaignId);

        console.log(`[SyncLeads] Synced analytics: ${analytics.emailsSentCount} sent, ${analytics.replyCount} replies`);
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
            if (providerLeadId) {
              const { data: idMatch, error: idMatchError } = await supabase
                .from("leads")
                .select("id, instantly_lead_id")
                .eq("campaign_id", campaignId)
                .eq("instantly_lead_id", providerLeadId)
                .maybeSingle();

              if (idMatchError) {
                console.warn(`[SyncLeads] Error matching by ID for ${emailLower}:`, idMatchError);
              } else if (idMatch) {
                matchedLeadId = idMatch.id;
              }
            }

            // Step 2: Fall back to email matching if no ID match
            if (!matchedLeadId) {
              const { data: emailMatch, error: emailMatchError } = await supabase
                .from("leads")
                .select("id, instantly_lead_id")
                .eq("campaign_id", campaignId)
                .ilike("email", emailLower)
                .maybeSingle();

              if (emailMatchError) {
                console.warn(`[SyncLeads] Error matching by email for ${emailLower}:`, emailMatchError);
              } else if (emailMatch) {
                matchedLeadId = emailMatch.id;
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
    // STEP 5: Sync positive leads from Smartlead statistics (category-based)
    // The basic leads endpoint doesn't return category, so we fetch from statistics
    // ═══════════════════════════════════════════════════════════════════════════
    let positiveLeadsFromStats = 0;

    if (provider.providerType === "smartlead" && 'fetchLeadStatistics' in provider) {
      try {
        console.log(`[SyncLeads] Fetching positive leads from Smartlead statistics...`);

        const statsMap = await (provider as { fetchLeadStatistics: (id: string) => Promise<Map<string, { category: string | null; hasReplied: boolean }>> }).fetchLeadStatistics(providerCampaignId);

        const positiveCategories = ["Interested", "Meeting Request"];
        const positiveEmails: string[] = [];

        statsMap.forEach((stats, email) => {
          if (stats.category && positiveCategories.includes(stats.category)) {
            positiveEmails.push(email);
          }
        });

        console.log(`[SyncLeads] Found ${positiveEmails.length} positive leads in statistics`);

        // Update positive leads in batches
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

    console.log(
      `[SyncLeads] Completed: ${insertedCount} inserted, ${updatedCount} updated, ${positiveLeadsFromStats} positive, ${emailsSynced} emails synced`
    );

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
    console.error("[SyncLeads] Error:", error);
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
