import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  fetchAllLeadsForCampaign,
  createInstantlyLead,
  updateLeadInterestStatus,
  getInstantlyClient,
} from "@/lib/instantly";
import type { InstantlyLeadCreatePayload } from "@/lib/instantly";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - List leads from Instantly for a campaign
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const campaignId = searchParams.get("campaign_id");
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    const skip = parseInt(searchParams.get("skip") || "0", 10);

    if (!campaignId) {
      return NextResponse.json(
        { error: "campaign_id is required" },
        { status: 400 }
      );
    }

    const client = getInstantlyClient();
    if (!(await client.isConfiguredAsync())) {
      return NextResponse.json(
        { error: "Instantly API not configured" },
        { status: 503 }
      );
    }

    // Support pagination instead of fetching all at once
    const { fetchInstantlyLeads } = await import("@/lib/instantly");
    const leads = await fetchInstantlyLeads({
      campaign_id: campaignId,
      limit,
      skip,
    });

    return NextResponse.json({
      leads,
      pagination: {
        limit,
        skip,
        count: leads.length,
        has_more: leads.length === limit
      }
    });
  } catch (error) {
    console.error("Error fetching leads:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch leads" },
      { status: 500 }
    );
  }
}

// POST - Push leads to Instantly or sync from Instantly to local DB
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, campaign_id, leads, instantly_campaign_id } = body as {
      action: "push" | "sync" | "update_status";
      campaign_id?: string;
      instantly_campaign_id?: string;
      leads?: InstantlyLeadCreatePayload[];
      lead_email?: string;
      interest_status?: string;
      limit?: string | number;
      skip?: string | number;
    };

    const client = getInstantlyClient();
    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: "Instantly API not configured" },
        { status: 503 }
      );
    }

    if (action === "push") {
      // Push leads to Instantly
      if (!leads || leads.length === 0) {
        return NextResponse.json(
          { error: "leads array is required for push action" },
          { status: 400 }
        );
      }

      let created = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const lead of leads) {
        try {
          await createInstantlyLead(lead);
          created++;
        } catch (error) {
          failed++;
          errors.push(`Failed to push ${lead.email}: ${error instanceof Error ? error.message : "Unknown error"}`);
        }
      }

      return NextResponse.json({ success: true, created, failed, errors: errors.length > 0 ? errors : undefined });
    }

    if (action === "sync") {
      // Sync leads from Instantly to local DB (with batch support)
      if (!instantly_campaign_id || !campaign_id) {
        return NextResponse.json(
          { error: "instantly_campaign_id and campaign_id are required for sync action" },
          { status: 400 }
        );
      }

      const { fetchInstantlyLeads } = await import("@/lib/instantly");
      const syncLimit = body.limit ? parseInt(body.limit, 10) : 100;
      const syncSkip = body.skip ? parseInt(body.skip, 10) : 0;

      const supabase = getSupabase();

      // Fetch one batch of leads
      const instantlyLeads = await fetchInstantlyLeads({
        campaign_id: instantly_campaign_id,
        limit: syncLimit,
        skip: syncSkip,
      });

      let imported = 0;
      let updated = 0;
      let failed = 0;

      for (const lead of instantlyLeads) {
        // Extract additional Instantly fields (needed for both insert and update)
        const instantlyData = lead as {
          company_domain?: string;
          personalization?: string;
          timestamp_created?: string;
          timestamp_last_contact?: string;
          status_summary?: { lastStep?: Record<string, unknown> };
          email_open_count?: number;
          email_click_count?: number;
          email_reply_count?: number;
          payload?: Record<string, string>;
        };

        const { data: existingLead } = await supabase
          .from("leads")
          .select("id, status, is_positive_reply, first_name, last_name, company_name, company_domain, phone, personalization, email_open_count, email_click_count, email_reply_count")
          .eq("campaign_id", campaign_id)
          .eq("email", lead.email)
          .single();

        // Build metadata with all extra Instantly data
        const metadata: Record<string, unknown> = {};
        if (lead.website) metadata.website = lead.website;
        if (lead.lead_data) metadata.lead_data = lead.lead_data;
        if (lead.status) metadata.instantly_status = lead.status;
        if (lead.interest_status) metadata.interest_status = lead.interest_status;
        if (lead.campaign_name) metadata.campaign_name = lead.campaign_name;
        if (lead.created_at) metadata.instantly_created_at = lead.created_at;
        if (lead.updated_at) metadata.instantly_updated_at = lead.updated_at;
        if (instantlyData.payload) metadata.lead_data = instantlyData.payload;

        // Check if lead has replied using email_reply_count
        const hasReplied = ((lead as { email_reply_count?: number }).email_reply_count || 0) > 0;

        // Positive reply = manually tagged as interested/booked/etc (NOT just any reply)
        const positiveStatuses = ["interested", "meeting_booked", "meeting_completed", "closed"];
        const isPositiveReply = positiveStatuses.includes(lead.interest_status || "");

        // Map to our lead status: contacted → replied → meeting → closed_won / closed_lost
        let leadStatus: string = "contacted";
        if (lead.interest_status === "closed") {
          leadStatus = "won";
        } else if (lead.interest_status === "not_interested" || lead.interest_status === "wrong_person") {
          leadStatus = "lost";
        } else if (lead.interest_status === "meeting_booked" || lead.interest_status === "meeting_completed") {
          leadStatus = "booked";
        } else if (hasReplied || lead.interest_status === "interested") {
          leadStatus = "replied";
        }

        if (existingLead) {
          // Lead exists - UPDATE Instantly-sourced fields while preserving local-only fields
          // Status priority: won(8) > lost(7) > booked(6) > replied(5) > clicked(4) > opened(3) > contacted(2) > not_interested(1)
          const statusPriority: Record<string, number> = {
            "won": 8, "lost": 7, "booked": 6, "replied": 5,
            "clicked": 4, "opened": 3, "contacted": 2, "not_interested": 1
          };

          const currentPriority = statusPriority[existingLead.status] || 0;
          const newPriority = statusPriority[leadStatus] || 0;

          // Build update object - only update fields that should be updated
          const updateData: Record<string, unknown> = {
            // Always update these from Instantly
            last_contacted_at: instantlyData.timestamp_last_contact || null,
            last_step_info: instantlyData.status_summary?.lastStep || null,
            // Only increment counts, never decrease
            email_open_count: Math.max(instantlyData.email_open_count || 0, existingLead.email_open_count || 0),
            email_click_count: Math.max(instantlyData.email_click_count || 0, existingLead.email_click_count || 0),
            email_reply_count: Math.max(instantlyData.email_reply_count || 0, existingLead.email_reply_count || 0),
          };

          // Only update status if new status has higher priority (never downgrade)
          if (newPriority > currentPriority) {
            updateData.status = leadStatus;
          }

          // Only set is_positive_reply to true, never reset to false via sync
          if (isPositiveReply && !existingLead.is_positive_reply) {
            updateData.is_positive_reply = true;
          }

          // Fill-only fields: only update if local value is empty
          if (!existingLead.first_name && lead.first_name) updateData.first_name = lead.first_name;
          if (!existingLead.last_name && lead.last_name) updateData.last_name = lead.last_name;
          if (!existingLead.company_name && lead.company_name) updateData.company_name = lead.company_name;
          if (!existingLead.company_domain && instantlyData.company_domain) updateData.company_domain = instantlyData.company_domain;
          if (!existingLead.phone && lead.phone) updateData.phone = lead.phone;
          if (!existingLead.personalization && instantlyData.personalization) updateData.personalization = instantlyData.personalization;

          // NOTE: These fields are NEVER touched by sync (preserved):
          // - notes, deal_value, next_action, next_action_date, linkedin_url

          const { error: updateError } = await supabase
            .from("leads")
            .update(updateData)
            .eq("id", existingLead.id);

          if (updateError) {
            failed++;
          } else {
            updated++;
          }
        } else {
          // Create new lead with ALL fields
          const { error } = await supabase.from("leads").insert({
            campaign_id,
            email: lead.email,
            first_name: lead.first_name || null,
            last_name: lead.last_name || null,
            company_name: lead.company_name || null,
            company_domain: instantlyData.company_domain || null,
            phone: lead.phone || null,
            personalization: instantlyData.personalization || null,
            status: leadStatus || "contacted",
            instantly_lead_id: lead.id,
            instantly_created_at: instantlyData.timestamp_created || null,
            last_contacted_at: instantlyData.timestamp_last_contact || null,
            last_step_info: instantlyData.status_summary?.lastStep || null,
            email_reply_count: instantlyData.email_reply_count || 0,
            has_replied: hasReplied,
            is_positive_reply: isPositiveReply,
            metadata: Object.keys(metadata).length > 0 ? metadata : {},
          });

          if (error) {
            failed++;
          } else {
            imported++;
          }
        }
      }

      const hasMore = instantlyLeads.length === syncLimit;

      return NextResponse.json({
        success: true,
        imported,
        updated,
        failed,
        batch: {
          skip: syncSkip,
          limit: syncLimit,
          fetched: instantlyLeads.length,
          has_more: hasMore,
          next_skip: hasMore ? syncSkip + syncLimit : null
        }
      });
    }

    if (action === "update_status") {
      const { lead_email, interest_status } = body;
      if (!lead_email || !instantly_campaign_id || !interest_status) {
        return NextResponse.json(
          { error: "lead_email, instantly_campaign_id, and interest_status are required" },
          { status: 400 }
        );
      }

      await updateLeadInterestStatus({
        lead_email,
        campaign_id: instantly_campaign_id,
        interest_status: interest_status as "interested" | "not_interested" | "neutral",
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid action. Use 'push', 'sync', or 'update_status'" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error processing leads:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process leads" },
      { status: 500 }
    );
  }
}
