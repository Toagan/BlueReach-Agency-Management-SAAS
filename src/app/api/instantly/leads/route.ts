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
        const { data: existingLead } = await supabase
          .from("leads")
          .select("id")
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

        // Check if lead has replied using email_reply_count (more reliable than interest_status)
        const hasReplied = (lead as { email_reply_count?: number }).email_reply_count > 0;

        // Also check interest_status for manually tagged leads
        const positiveStatuses = ["interested", "meeting_booked", "meeting_completed", "closed"];
        const hasPositiveInterest = positiveStatuses.includes(lead.interest_status || "");

        // Lead is positive if they replied OR are marked as interested
        const isPositiveReply = hasReplied || hasPositiveInterest;

        // Map to our lead status
        let leadStatus: string | undefined = undefined;
        if (lead.interest_status === "meeting_booked") {
          leadStatus = "booked";
        } else if (lead.interest_status === "meeting_completed" || lead.interest_status === "closed") {
          leadStatus = "won";
        } else if (lead.interest_status === "not_interested" || lead.interest_status === "wrong_person") {
          leadStatus = "not_interested";
        } else if (hasReplied || lead.interest_status === "interested") {
          leadStatus = "replied";
        }

        if (existingLead) {
          // Lead already exists - skip it (don't update existing leads)
          // This preserves any manual changes made in the database
          updated++; // Count as "already exists"
        } else {
          // Create new lead with ALL fields
          const { error } = await supabase.from("leads").insert({
            campaign_id,
            email: lead.email,
            first_name: lead.first_name || null,
            last_name: lead.last_name || null,
            company_name: lead.company_name || null,
            phone: lead.phone || null,
            status: leadStatus || "contacted",
            instantly_lead_id: lead.id,
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
