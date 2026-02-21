import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { syncLeadToHubSpot, getEmailThreadForLead } from "@/lib/hubspot";
import { requireClientAccess } from "@/lib/auth";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST - Run HubSpot backfill for all positive replies
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const auth = await requireClientAccess(clientId);
    if (auth.error) return auth.error;

    const adminSupabase = getSupabaseAdmin();

    // Get client info
    const { data: client } = await adminSupabase
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get all campaigns for this client with their hubspot_vertical
    const { data: campaigns } = await adminSupabase
      .from("campaigns")
      .select("id, name, hubspot_vertical")
      .eq("client_id", clientId);

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No campaigns found for this client",
        synced: 0,
        skipped: 0,
        failed: 0,
      });
    }

    const campaignIds = campaigns.map((c) => c.id);
    const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

    // Get all positive reply leads for these campaigns
    const { data: positiveLeads } = await adminSupabase
      .from("leads")
      .select(
        "id, email, first_name, last_name, phone, company_name, campaign_id"
      )
      .in("campaign_id", campaignIds)
      .eq("is_positive_reply", true);

    if (!positiveLeads || positiveLeads.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No positive replies found for this client",
        synced: 0,
        skipped: 0,
        failed: 0,
      });
    }

    console.log(
      `[HubSpot Backfill] Found ${positiveLeads.length} positive replies for client ${client.name}`
    );

    // Sync each lead to HubSpot
    const results = {
      synced: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[],
      syncedEmails: [] as string[],
    };

    for (const lead of positiveLeads) {
      try {
        const campaign = campaignMap.get(lead.campaign_id);
        if (!campaign) {
          results.failed++;
          results.errors.push(`Campaign not found for lead ${lead.email}`);
          continue;
        }

        // Get email thread for this lead
        const emailThread = await getEmailThreadForLead(lead.id);

        // Sync to HubSpot
        const hubspotResult = await syncLeadToHubSpot({
          leadEmail: lead.email,
          leadFirstName: lead.first_name || undefined,
          leadLastName: lead.last_name || undefined,
          leadPhone: lead.phone || undefined,
          companyName: lead.company_name || undefined,
          campaignName: campaign.name,
          clientId: clientId,
          clientName: client.name,
          vertical: campaign.hubspot_vertical || undefined,
          emailThread,
        });

        if (hubspotResult.success) {
          if (hubspotResult.skipped) {
            results.skipped++;
          } else {
            results.synced++;
            results.syncedEmails.push(lead.email);
            console.log(
              `[HubSpot Backfill] Synced ${lead.email} -> contactId=${hubspotResult.contactId}`
            );
          }
        } else {
          results.failed++;
          results.errors.push(`${lead.email}: ${hubspotResult.error}`);
          console.error(
            `[HubSpot Backfill] Failed for ${lead.email}: ${hubspotResult.error}`
          );
        }

        // Small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        results.failed++;
        results.errors.push(
          `${lead.email}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
        console.error(`[HubSpot Backfill] Error for ${lead.email}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Backfill completed for ${client.name}`,
      totalPositiveReplies: positiveLeads.length,
      synced: results.synced,
      skipped: results.skipped,
      failed: results.failed,
      syncedEmails: results.syncedEmails,
      errors: results.errors.length > 0 ? results.errors : undefined,
    });
  } catch (error) {
    console.error("Error running HubSpot backfill:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to run HubSpot backfill",
      },
      { status: 500 }
    );
  }
}

// GET - Preview what would be synced (dry run)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const auth = await requireClientAccess(clientId);
    if (auth.error) return auth.error;

    const adminSupabase = getSupabaseAdmin();

    // Get client info
    const { data: client } = await adminSupabase
      .from("clients")
      .select("id, name")
      .eq("id", clientId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Get all campaigns for this client
    const { data: campaigns } = await adminSupabase
      .from("campaigns")
      .select("id, name, hubspot_vertical")
      .eq("client_id", clientId);

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        client: client.name,
        campaigns: 0,
        positiveReplies: 0,
        leads: [],
      });
    }

    const campaignIds = campaigns.map((c) => c.id);
    const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

    // Get all positive reply leads
    const { data: positiveLeads } = await adminSupabase
      .from("leads")
      .select(
        "id, email, first_name, last_name, company_name, campaign_id, created_at"
      )
      .in("campaign_id", campaignIds)
      .eq("is_positive_reply", true)
      .order("created_at", { ascending: false });

    const leadsWithCampaign = (positiveLeads || []).map((lead) => {
      const campaign = campaignMap.get(lead.campaign_id);
      return {
        email: lead.email,
        name: `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || null,
        company: lead.company_name,
        campaign: campaign?.name || "Unknown",
        vertical: campaign?.hubspot_vertical || null,
        createdAt: lead.created_at,
      };
    });

    return NextResponse.json({
      client: client.name,
      clientId: client.id,
      campaigns: campaigns.length,
      positiveReplies: positiveLeads?.length || 0,
      leads: leadsWithCampaign,
    });
  } catch (error) {
    console.error("Error previewing HubSpot backfill:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to preview backfill",
      },
      { status: 500 }
    );
  }
}
