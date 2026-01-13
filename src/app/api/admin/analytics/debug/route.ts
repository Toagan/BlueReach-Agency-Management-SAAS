import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Debug endpoint to see all campaigns and their cached stats
export async function GET() {
  try {
    const supabase = getSupabase();

    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select(`
        id,
        name,
        client_id,
        cached_emails_sent,
        cached_reply_count,
        cached_emails_bounced,
        cached_contacted_count,
        cached_leads_count,
        cache_updated_at,
        clients!inner(name)
      `)
      .order("cached_emails_sent", { ascending: false, nullsFirst: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate totals
    const totals = {
      emails_sent: campaigns?.reduce((sum, c) => sum + (c.cached_emails_sent || 0), 0) || 0,
      replies: campaigns?.reduce((sum, c) => sum + (c.cached_reply_count || 0), 0) || 0,
      bounced: campaigns?.reduce((sum, c) => sum + (c.cached_emails_bounced || 0), 0) || 0,
    };

    return NextResponse.json({
      totals,
      campaigns: campaigns?.map(c => ({
        id: c.id,
        name: c.name,
        client: (c.clients as { name: string })?.name || "Unknown",
        cached_emails_sent: c.cached_emails_sent || 0,
        cached_reply_count: c.cached_reply_count || 0,
        cached_emails_bounced: c.cached_emails_bounced || 0,
        cached_contacted_count: c.cached_contacted_count || 0,
        cached_leads_count: c.cached_leads_count || 0,
        cache_updated_at: c.cache_updated_at,
      })) || [],
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Debug failed" },
      { status: 500 }
    );
  }
}
