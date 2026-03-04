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

    // Execute query with ordering
    const { data: leads, error } = await query.order("updated_at", { ascending: false });

    if (error) {
      console.error("Export query error:", error);
      return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 });
    }

    // Generate CSV with ALL fields
    const headers = [
      // Basic Info
      "Lead ID",
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
      // Status & Sales
      "Status",
      "Is Positive Reply",
      "Deal Value",
      "Next Action",
      "Next Action Date",
      // Email Stats
      "Email Open Count",
      "Email Click Count",
      "Email Reply Count",
      "Last Contacted At",
      // Instantly Integration
      "Instantly Lead ID",
      "Instantly Created At",
      // Notes
      "Notes",
      // Organization
      "Client ID",
      "Client Name",
      "Campaign ID",
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

    const rows = (leads || []).map((lead) => {
      const clientName = lead.campaigns?.clients?.name || lead.client_name || "";
      const campaignName = lead.campaigns?.name || lead.campaign_name || "";

      return [
        // Basic Info
        escapeCSV(lead.id),
        escapeCSV(lead.email),
        escapeCSV(lead.first_name),
        escapeCSV(lead.last_name),
        // Company Info
        escapeCSV(lead.company_name),
        escapeCSV(lead.company_domain),
        // Contact Info
        escapeCSV(lead.phone),
        escapeCSV(lead.linkedin_url),
        // Personalization
        escapeCSV(lead.personalization),
        // Status & Sales
        escapeCSV(lead.status),
        escapeCSV(lead.is_positive_reply ? "Yes" : "No"),
        escapeCSV(lead.deal_value),
        escapeCSV(lead.next_action),
        escapeCSV(lead.next_action_date),
        // Email Stats
        escapeCSV(lead.email_open_count || 0),
        escapeCSV(lead.email_click_count || 0),
        escapeCSV(lead.email_reply_count || 0),
        escapeCSV(formatDate(lead.last_contacted_at)),
        // Instantly Integration
        escapeCSV(lead.instantly_lead_id),
        escapeCSV(formatDate(lead.instantly_created_at)),
        // Notes
        escapeCSV(lead.notes),
        // Organization
        escapeCSV(lead.client_id),
        escapeCSV(clientName),
        escapeCSV(lead.campaign_id),
        escapeCSV(campaignName),
        // Timestamps
        escapeCSV(formatDate(lead.created_at)),
        escapeCSV(formatDate(lead.updated_at)),
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
