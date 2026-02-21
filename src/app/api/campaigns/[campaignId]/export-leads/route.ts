import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCampaignAccess } from "@/lib/auth";

// CSV export endpoint for campaign leads
// Supports three filters: positive_replies, replied_not_positive, no_reply

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const auth = await requireCampaignAccess(campaignId);
  if (auth.error) return auth.error;
  const { searchParams } = new URL(request.url);
  const filter = searchParams.get("filter") || "all";

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
    // Build query based on filter
    let query = supabase
      .from("leads")
      .select(`
        email,
        first_name,
        last_name,
        company_name,
        company_domain,
        phone,
        linkedin_url,
        status,
        is_positive_reply,
        has_replied,
        email_open_count,
        email_click_count,
        email_reply_count,
        responded_at,
        meeting_at,
        closed_at,
        deal_value,
        notes,
        created_at,
        updated_at,
        metadata
      `)
      .eq("campaign_id", campaignId);

    // Apply filter
    console.log(`[ExportLeads] Filter: ${filter}, Campaign: ${campaignId}`);

    switch (filter) {
      case "positive_replies":
        query = query.eq("is_positive_reply", true);
        break;
      case "replied_not_positive":
        query = query.eq("has_replied", true).neq("is_positive_reply", true);
        break;
      case "no_reply":
        // Export all leads that haven't replied
        // has_replied is null, false, or status is 'contacted' without reply
        query = query.or("has_replied.is.null,has_replied.eq.false");
        break;
      case "all":
        // Export all leads - no additional filter
        break;
      default:
        // Default to all
        break;
    }

    // Order by most recent first, no limit for exports
    query = query
      .order("updated_at", { ascending: false })
      .limit(50000); // Override default 1000 limit

    const { data: leads, error } = await query;

    console.log(`[ExportLeads] Query completed. Found ${leads?.length || 0} leads`);

    if (error) {
      console.error("[ExportLeads] Query error:", error);
      return NextResponse.json(
        { error: "Failed to fetch leads" },
        { status: 500 }
      );
    }

    if (!leads || leads.length === 0) {
      console.log(`[ExportLeads] No leads found for filter: ${filter}`);
      return NextResponse.json(
        { error: `No leads found matching "${filter.replace(/_/g, " ")}" filter` },
        { status: 404 }
      );
    }

    console.log(`[ExportLeads] Exporting ${leads.length} leads for filter: ${filter}`);

    // Get campaign name for filename
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("name")
      .eq("id", campaignId)
      .single();

    // Build CSV - export raw provider data exactly as stored
    const csvRows: string[] = [];

    // Collect ALL unique keys from rawData across all leads
    const allRawDataKeys = new Set<string>();
    for (const lead of leads) {
      const rawData = lead.metadata?.rawData || {};
      Object.keys(rawData).forEach((key) => {
        // Skip nested objects like custom_fields (we flatten those separately)
        if (typeof rawData[key] !== "object" || rawData[key] === null) {
          allRawDataKeys.add(key);
        }
      });
      // Also add flattened custom fields
      const customFields = lead.metadata?.customFields || {};
      Object.keys(customFields).forEach((key) => allRawDataKeys.add(`custom_${key}`));
    }

    // If no rawData exists, fall back to standard fields
    const hasRawData = allRawDataKeys.size > 0;

    let headers: string[];
    if (hasRawData) {
      // Use raw Smartlead field names exactly as they are
      headers = Array.from(allRawDataKeys).sort();
    } else {
      // Fallback to standard export if no rawData
      headers = [
        "email",
        "first_name",
        "last_name",
        "company_name",
        "phone",
        "linkedin_url",
        "status",
        "is_positive_reply",
        "has_replied",
      ];
    }

    csvRows.push(headers.join(","));

    // Add data rows
    for (const lead of leads) {
      if (hasRawData) {
        // Export raw provider data exactly
        const rawData = lead.metadata?.rawData || {};
        const customFields = lead.metadata?.customFields || {};

        // Merge custom fields with custom_ prefix
        const mergedData: Record<string, unknown> = { ...rawData };
        Object.entries(customFields).forEach(([key, value]) => {
          mergedData[`custom_${key}`] = value;
        });

        const row = headers.map((key) => {
          const value = mergedData[key];
          if (value === null || value === undefined) return "";
          if (typeof value === "object") return escapeCSV(JSON.stringify(value));
          return escapeCSV(String(value));
        });
        csvRows.push(row.join(","));
      } else {
        // Fallback row
        const row = [
          escapeCSV(lead.email),
          escapeCSV(lead.first_name),
          escapeCSV(lead.last_name),
          escapeCSV(lead.company_name),
          escapeCSV(lead.phone),
          escapeCSV(lead.linkedin_url),
          escapeCSV(lead.status),
          lead.is_positive_reply ? "Yes" : "No",
          lead.has_replied ? "Yes" : "No",
        ];
        csvRows.push(row.join(","));
      }
    }

    // Add UTF-8 BOM for better compatibility with Excel and other tools
    const BOM = "\uFEFF";
    const csvContent = BOM + csvRows.join("\n");

    // Generate filename
    const campaignName = campaign?.name || "campaign";
    const filterLabel = filter.replace(/_/g, "-");
    const date = new Date().toISOString().split("T")[0];
    const filename = `${sanitizeFilename(campaignName)}_${filterLabel}_${date}.csv`;

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("[ExportLeads] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Export failed" },
      { status: 500 }
    );
  }
}

// Escape CSV value to handle commas, quotes, and newlines
function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape existing quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Format date for CSV
function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return dateStr;
  }
}

// Sanitize filename - remove special characters
function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-_]/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 50);
}
