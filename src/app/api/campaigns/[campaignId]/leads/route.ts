import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCampaignAccess } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface RouteParams {
  params: Promise<{ campaignId: string }>;
}

// GET - Get leads for a campaign with pagination
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { campaignId } = await params;
    const auth = await requireCampaignAccess(campaignId);
    if (auth.error) return auth.error;
    const supabase = getSupabase();

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    // Get total count
    const { count: totalCount } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", campaignId);

    // Get paginated leads
    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch leads" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      leads: leads || [],
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching campaign leads:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch leads" },
      { status: 500 }
    );
  }
}
