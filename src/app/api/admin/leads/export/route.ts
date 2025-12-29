import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const exportType = searchParams.get("export") || "all";
    const clientFilter = searchParams.get("client");
    const statusFilter = searchParams.get("status");
    const positiveFilter = searchParams.get("positive") === "true";

    // Build query based on export type
    let query = supabase
      .from("leads")
      .select("*, client_id, client_name, campaign_name, campaigns(name, client_id, clients(name))");

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

    // Generate CSV
    const headers = [
      "Email",
      "First Name",
      "Last Name",
      "Company",
      "Phone",
      "Status",
      "Positive Reply",
      "Client",
      "Campaign",
      "Notes",
      "Created At",
      "Updated At",
    ];

    const rows = (leads || []).map((lead) => {
      const clientName = lead.campaigns?.clients?.name || lead.client_name || "Deleted Client";
      const campaignName = lead.campaigns?.name || lead.campaign_name || "Deleted Campaign";

      return [
        lead.email || "",
        lead.first_name || "",
        lead.last_name || "",
        lead.company_name || "",
        lead.phone || "",
        lead.status || "",
        lead.is_positive_reply ? "Yes" : "No",
        clientName,
        campaignName,
        (lead.notes || "").replace(/"/g, '""'), // Escape quotes
        lead.created_at ? new Date(lead.created_at).toLocaleDateString() : "",
        lead.updated_at ? new Date(lead.updated_at).toLocaleDateString() : "",
      ];
    });

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

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
