import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, getEffectiveOwnerId } from "@/lib/auth";

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const supabase = getServiceSupabase();
    const { searchParams } = new URL(request.url);

    const exportType = searchParams.get("export") || "all";
    const clientFilter = searchParams.get("client");
    const campaignFilter = searchParams.get("campaign");
    const statusFilter = searchParams.get("status");
    const positiveFilter = searchParams.get("positive") === "true";

    // Get effective owner's campaign IDs for scoping (always scoped)
    const ownerId = await getEffectiveOwnerId(auth);
    const { data: ownerClients } = await supabase
      .from("clients")
      .select("id")
      .eq("owner_id", ownerId);
    const clientIds = ownerClients?.map(c => c.id) || [];

    if (clientIds.length === 0) {
      const csvContent = "No data";
      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${exportType}_leads_${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id")
      .in("client_id", clientIds);
    const ownerCampaignIds = campaigns?.map(c => c.id) || [];

    // Build query based on export type - select all fields
    let query = supabase
      .from("leads")
      .select("*, client_id, client_name, campaign_name, campaigns(name, client_id, clients(name))");

    // Scope to owner's campaigns
    if (ownerCampaignIds.length > 0) {
      query = query.in("campaign_id", ownerCampaignIds);
    }

    switch (exportType) {
      case "current":
        // Apply current filters
        if (clientFilter && clientFilter !== "all") {
          query = query.eq("client_id", clientFilter);
        }
        if (campaignFilter && campaignFilter !== "all") {
          query = query.eq("campaign_id", campaignFilter);
        }
        if (statusFilter && statusFilter !== "all") {
          query = query.eq("status", statusFilter);
        }
        if (positiveFilter) {
          query = query.eq("is_positive_reply", true);
        }
        break;

      case "positive":
        // Only positive replies
        query = query.eq("is_positive_reply", true);
        break;

      case "replied":
        // All leads that replied
        query = query.eq("status", "replied");
        break;

      case "no_response":
        // Leads that were contacted but didn't reply
        query = query.in("status", ["contacted", "opened", "clicked"]);
        break;

      case "all":
        // No filters - get all leads
        break;
    }

    // Execute query with pagination to avoid Supabase 1000-row limit
    const pageSize = 1000;
    let offset = 0;
    let allLeads: Record<string, unknown>[] = [];
    let hasMore = true;

    while (hasMore) {
      const { data: page, error: pageError } = await query
        .order("updated_at", { ascending: false })
        .range(offset, offset + pageSize - 1);

      if (pageError) {
        console.error("Export query error:", pageError);
        return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
      }

      allLeads = allLeads.concat(page || []);
      hasMore = (page?.length || 0) === pageSize;
      offset += pageSize;
    }

    const leads = allLeads;

    // Generate CSV with ALL fields
    const headers = [
      // Basic Info
      "Email",
      "First Name",
      "Last Name",
      // Company Info
      "Company Name",
      "Company Domain",
      // Contact Info
      "Phone",
      "LinkedIn URL",
      // Personalization
      "Personalization",
      // Status & Reply Info
      "Status",
      "Has Replied",
      "Is Positive Reply",
      "Replied At",
      "Reply From Step",
      "Reply From Variant",
      // Sales
      "Deal Value",
      "Next Action",
      "Next Action Date",
      // Email Stats
      "Email Open Count",
      "Email Click Count",
      "Email Reply Count",
      "Last Contacted At",
      // Provider Info
      "Provider",
      "Provider Lead ID",
      // Notes
      "Notes",
      // Organization
      "Client Name",
      "Campaign Name",
      // Timestamps
      "Created At",
      "Updated At",
    ];

    const escapeCSV = (value: string | number | boolean | null | undefined): string => {
      if (value === null || value === undefined) return "";
      const str = String(value);
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const formatDate = (dateStr: string | null | undefined): string => {
      if (!dateStr) return "";
      try {
        return new Date(dateStr).toISOString();
      } catch {
        return "";
      }
    };

    const rows = (leads || []).map((lead: Record<string, unknown>) => {
      const campaigns = lead.campaigns as Record<string, unknown> | null;
      const clients = campaigns?.clients as Record<string, unknown> | null;
      const clientName = clients?.name || lead.client_name || "";
      const campaignName = campaigns?.name || lead.campaign_name || "";

      return [
        // Basic Info
        escapeCSV(lead.email as string),
        escapeCSV(lead.first_name as string),
        escapeCSV(lead.last_name as string),
        // Company Info
        escapeCSV(lead.company_name as string),
        escapeCSV(lead.company_domain as string),
        // Contact Info
        escapeCSV(lead.phone as string),
        escapeCSV(lead.linkedin_url as string),
        // Personalization
        escapeCSV(lead.personalization as string),
        // Status & Reply Info
        escapeCSV(lead.status as string),
        escapeCSV(lead.has_replied ? "Yes" : "No"),
        escapeCSV(lead.is_positive_reply ? "Yes" : "No"),
        escapeCSV(formatDate(lead.responded_at as string)),
        escapeCSV(lead.reply_from_step as number),
        escapeCSV(lead.reply_from_variant_label as string),
        // Sales
        escapeCSV(lead.deal_value as number),
        escapeCSV(lead.next_action as string),
        escapeCSV(lead.next_action_date as string),
        // Email Stats
        escapeCSV((lead.email_open_count as number) || 0),
        escapeCSV((lead.email_click_count as number) || 0),
        escapeCSV((lead.email_reply_count as number) || 0),
        escapeCSV(formatDate(lead.last_contacted_at as string)),
        // Provider Info
        escapeCSV(lead.provider_type as string),
        escapeCSV((lead.provider_lead_id || lead.instantly_lead_id) as string),
        // Notes
        escapeCSV(lead.notes as string),
        // Organization
        escapeCSV(clientName as string),
        escapeCSV(campaignName as string),
        // Timestamps
        escapeCSV(formatDate(lead.created_at as string)),
        escapeCSV(formatDate(lead.updated_at as string)),
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");

    // Return CSV as downloadable file
    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportType}_leads_${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}
