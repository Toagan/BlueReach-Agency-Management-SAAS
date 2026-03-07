import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin, getEffectiveOwnerId } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Helper to get date range based on period
function getDateRange(period: string): { startDate: Date; endDate: Date } | null {
  if (period === "all_time") {
    return null; // No date filtering
  }

  const now = new Date();
  const endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);

  let startDate: Date;

  switch (period) {
    case "this_week": {
      // Start of current week (Monday)
      startDate = new Date(now);
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
      startDate.setDate(diff);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    case "this_month": {
      // Start of current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    case "this_quarter": {
      // Start of current quarter
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      startDate.setHours(0, 0, 0, 0);
      break;
    }
    default:
      return null; // Default to all time
  }

  return { startDate, endDate };
}

// GET - Get analytics from LOCAL Supabase database
// For date-filtered periods, uses campaign_analytics_daily table (accurate daily snapshots)
// For all-time, uses campaigns.cached_* fields (aggregated totals from Instantly API)
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "all_time";

    const supabase = getSupabase();
    const dateRange = getDateRange(period);

    // Get effective owner's campaign IDs for scoping (always scoped)
    const ownerId = await getEffectiveOwnerId(auth);
    const { data: ownerClients } = await supabase
      .from("clients")
      .select("id")
      .eq("owner_id", ownerId);
    const clientIds = ownerClients?.map(c => c.id) || [];

    if (clientIds.length === 0) {
      return NextResponse.json({
        period,
        start_date: dateRange?.startDate.toISOString().split("T")[0] || null,
        end_date: dateRange?.endDate.toISOString().split("T")[0] || null,
        leads_contacted: 0, emails_sent: 0, emails_opened: 0, emails_clicked: 0,
        bounced: 0, replies: 0, opportunities: 0, reply_rate: 0, data_source: "empty",
      });
    }

    const { data: ownerCampaigns } = await supabase
      .from("campaigns")
      .select("id")
      .in("client_id", clientIds);
    const ownerCampaignIds = ownerCampaigns?.map(c => c.id) || [];

    if (ownerCampaignIds.length === 0) {
      return NextResponse.json({
        period,
        start_date: dateRange?.startDate.toISOString().split("T")[0] || null,
        end_date: dateRange?.endDate.toISOString().split("T")[0] || null,
        leads_contacted: 0, emails_sent: 0, emails_opened: 0, emails_clicked: 0,
        bounced: 0, replies: 0, opportunities: 0, reply_rate: 0, data_source: "empty",
      });
    }

    let emailsSent = 0;
    let emailsOpened = 0;
    let emailsClicked = 0;
    let replies = 0;
    let opportunities = 0;
    let leadsContacted = 0;
    let bounced = 0;
    let dataSource = "campaigns_cached";

    if (dateRange) {
      // DATE-FILTERED: Use campaign_analytics_daily table for accurate date-based metrics
      const startDateStr = dateRange.startDate.toISOString().split("T")[0];
      const endDateStr = dateRange.endDate.toISOString().split("T")[0];

      let dailyQuery = supabase
        .from("campaign_analytics_daily")
        .select("emails_sent, emails_opened, emails_clicked, emails_replied, positive_replies, leads_contacted")
        .gte("snapshot_date", startDateStr)
        .lte("snapshot_date", endDateStr);

      dailyQuery = dailyQuery.in("campaign_id", ownerCampaignIds);

      const { data: dailyStats, error: dailyError } = await dailyQuery;

      if (dailyError) {
        console.error("Error fetching daily analytics:", dailyError);
        // Fall back to leads table with appropriate date fields
        let leadsQuery = supabase.from("leads").select("*", { count: "exact", head: true })
          .gte("created_at", dateRange.startDate.toISOString())
          .lte("created_at", dateRange.endDate.toISOString());
        let repliesQuery = supabase.from("leads").select("*", { count: "exact", head: true })
          .eq("has_replied", true)
          .gte("responded_at", dateRange.startDate.toISOString())
          .lte("responded_at", dateRange.endDate.toISOString());
        let positiveQuery = supabase.from("leads").select("*", { count: "exact", head: true })
          .eq("is_positive_reply", true)
          .gte("updated_at", dateRange.startDate.toISOString())
          .lte("updated_at", dateRange.endDate.toISOString());

        leadsQuery = leadsQuery.in("campaign_id", ownerCampaignIds);
        repliesQuery = repliesQuery.in("campaign_id", ownerCampaignIds);
        positiveQuery = positiveQuery.in("campaign_id", ownerCampaignIds);

        const [l, r, p] = await Promise.all([leadsQuery, repliesQuery, positiveQuery]);
        leadsContacted = l.count || 0;
        emailsSent = leadsContacted;
        replies = r.count || 0;
        opportunities = p.count || 0;
        dataSource = "leads_fallback";
      } else if (dailyStats && dailyStats.length > 0) {
        emailsSent = dailyStats.reduce((sum, d) => sum + (d.emails_sent || 0), 0);
        emailsOpened = dailyStats.reduce((sum, d) => sum + (d.emails_opened || 0), 0);
        emailsClicked = dailyStats.reduce((sum, d) => sum + (d.emails_clicked || 0), 0);
        replies = dailyStats.reduce((sum, d) => sum + (d.emails_replied || 0), 0);
        opportunities = dailyStats.reduce((sum, d) => sum + (d.positive_replies || 0), 0);
        leadsContacted = dailyStats.reduce((sum, d) => sum + (d.leads_contacted || 0), 0);
        dataSource = "daily_snapshots";

        // Daily snapshots from webhooks may only have positive_replies populated
        // (Smartlead campaigns skip the daily cron). Supplement with leads table data.
        if (emailsSent === 0 || replies === 0) {
          const startIso = dateRange.startDate.toISOString();
          const endIso = dateRange.endDate.toISOString();

          const [leadsRes, repliesRes, sentRes] = await Promise.all([
            // Leads created in period
            supabase.from("leads").select("*", { count: "exact", head: true })
              .in("campaign_id", ownerCampaignIds)
              .gte("created_at", startIso).lte("created_at", endIso),
            // Leads that replied in period
            supabase.from("leads").select("*", { count: "exact", head: true })
              .in("campaign_id", ownerCampaignIds)
              .eq("has_replied", true)
              .gte("responded_at", startIso).lte("responded_at", endIso),
            // Outbound emails sent in period
            supabase.from("lead_emails").select("*", { count: "exact", head: true })
              .in("campaign_id", ownerCampaignIds)
              .eq("direction", "outbound")
              .gte("sent_at", startIso).lte("sent_at", endIso),
          ]);

          if (emailsSent === 0) {
            emailsSent = sentRes.count || 0;
            leadsContacted = leadsRes.count || emailsSent;
          }
          if (replies === 0) {
            replies = repliesRes.count || 0;
          }
          dataSource = "daily_snapshots_supplemented";
        }
      } else {
        // No daily data - fall back to leads table with appropriate date fields
        // leads_contacted: leads first contacted in this period
        let leadsQuery = supabase.from("leads").select("*", { count: "exact", head: true })
          .gte("created_at", dateRange.startDate.toISOString())
          .lte("created_at", dateRange.endDate.toISOString());
        // replies: leads that replied in this period (use responded_at, fall back to updated_at)
        let repliesQuery = supabase.from("leads").select("*", { count: "exact", head: true })
          .eq("has_replied", true)
          .gte("responded_at", dateRange.startDate.toISOString())
          .lte("responded_at", dateRange.endDate.toISOString());
        // positive: leads marked positive in this period (use updated_at since is_positive_reply is set on update)
        let positiveQuery = supabase.from("leads").select("*", { count: "exact", head: true })
          .eq("is_positive_reply", true)
          .gte("updated_at", dateRange.startDate.toISOString())
          .lte("updated_at", dateRange.endDate.toISOString());

        leadsQuery = leadsQuery.in("campaign_id", ownerCampaignIds);
        repliesQuery = repliesQuery.in("campaign_id", ownerCampaignIds);
        positiveQuery = positiveQuery.in("campaign_id", ownerCampaignIds);

        const [l, r, p] = await Promise.all([leadsQuery, repliesQuery, positiveQuery]);
        leadsContacted = l.count || 0;
        emailsSent = leadsContacted;
        replies = r.count || 0;
        opportunities = p.count || 0;
        dataSource = "leads_fallback";
      }
    } else {
      // ALL-TIME: Use campaigns.cached_* for email stats, leads table for lead counts
      let leadsQuery = supabase.from("leads").select("*", { count: "exact", head: true });
      let repliesQuery = supabase.from("leads").select("*", { count: "exact", head: true }).eq("has_replied", true);
      let positiveQuery = supabase.from("leads").select("*", { count: "exact", head: true }).eq("is_positive_reply", true);
      let campaignsQuery = supabase.from("campaigns").select("cached_emails_sent, cached_emails_opened, cached_emails_bounced");

      leadsQuery = leadsQuery.in("campaign_id", ownerCampaignIds);
      repliesQuery = repliesQuery.in("campaign_id", ownerCampaignIds);
      positiveQuery = positiveQuery.in("campaign_id", ownerCampaignIds);
      campaignsQuery = campaignsQuery.in("id", ownerCampaignIds);

      const [leadsCountResult, repliesResult, positiveResult, campaignsResult] = await Promise.all([
        leadsQuery, repliesQuery, positiveQuery, campaignsQuery,
      ]);

      leadsContacted = leadsCountResult.count || 0;
      replies = repliesResult.count || 0;
      opportunities = positiveResult.count || 0;

      if (campaignsResult.data) {
        emailsSent = campaignsResult.data.reduce(
          (sum: number, c: { cached_emails_sent: number | null }) => sum + (c.cached_emails_sent || 0),
          0
        );
        emailsOpened = campaignsResult.data.reduce(
          (sum: number, c: { cached_emails_opened: number | null }) => sum + (c.cached_emails_opened || 0),
          0
        );
        bounced = campaignsResult.data.reduce(
          (sum: number, c: { cached_emails_bounced: number | null }) => sum + (c.cached_emails_bounced || 0),
          0
        );
      }
      dataSource = "campaigns_cached";
    }

    // Calculate reply rate based on emails sent (or leads contacted as fallback)
    const baseForRate = emailsSent > 0 ? emailsSent : leadsContacted;
    const replyRate = baseForRate > 0 ? (replies / baseForRate) * 100 : 0;

    return NextResponse.json({
      period,
      start_date: dateRange?.startDate.toISOString().split("T")[0] || null,
      end_date: dateRange?.endDate.toISOString().split("T")[0] || null,
      leads_contacted: leadsContacted,
      emails_sent: emailsSent,
      emails_opened: emailsOpened,
      emails_clicked: emailsClicked,
      bounced,
      replies,
      opportunities,
      reply_rate: Number(replyRate.toFixed(2)),
      data_source: dataSource,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
