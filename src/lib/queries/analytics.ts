// Supabase-based Analytics Queries
// Calculates analytics from local database for client and admin levels
// Campaign-level analytics can use provider API for real-time data

import { SupabaseClient } from "@supabase/supabase-js";

// ============================================
// TYPES
// ============================================

export interface AggregatedAnalytics {
  // Lead counts
  totalLeads: number;
  totalContacted: number;
  totalCompleted: number;
  // Email metrics
  totalEmailsSent: number;
  totalOpens: number;
  totalUniqueOpens: number;
  totalClicks: number;
  totalUniqueClicks: number;
  totalReplies: number;
  totalUniqueReplies: number;
  totalBounced: number;
  // Outcome metrics
  totalPositiveReplies: number;
  totalMeetingsBooked: number;
  totalWon: number;
  totalLost: number;
  totalNotInterested: number;
  // Calculated rates (percentages)
  openRate: number;
  clickRate: number;
  replyRate: number;
  positiveReplyRate: number;
  bounceRate: number;
}

export interface CampaignAnalyticsSummary extends AggregatedAnalytics {
  campaignId: string;
  campaignName: string;
  clientId: string;
  clientName: string;
  isActive: boolean;
  providerType: string;
}

export interface ClientAnalyticsSummary extends AggregatedAnalytics {
  clientId: string;
  clientName: string;
  activeCampaigns: number;
  totalCampaigns: number;
}

export interface AdminAnalyticsSummary extends AggregatedAnalytics {
  totalClients: number;
  activeClients: number;
  totalCampaigns: number;
  activeCampaigns: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100; // 2 decimal places
}

function createEmptyAnalytics(): AggregatedAnalytics {
  return {
    totalLeads: 0,
    totalContacted: 0,
    totalCompleted: 0,
    totalEmailsSent: 0,
    totalOpens: 0,
    totalUniqueOpens: 0,
    totalClicks: 0,
    totalUniqueClicks: 0,
    totalReplies: 0,
    totalUniqueReplies: 0,
    totalBounced: 0,
    totalPositiveReplies: 0,
    totalMeetingsBooked: 0,
    totalWon: 0,
    totalLost: 0,
    totalNotInterested: 0,
    openRate: 0,
    clickRate: 0,
    replyRate: 0,
    positiveReplyRate: 0,
    bounceRate: 0,
  };
}

// ============================================
// CAMPAIGN-LEVEL ANALYTICS (from Supabase)
// ============================================

export async function getCampaignAnalyticsFromSupabase(
  supabase: SupabaseClient,
  campaignId: string
): Promise<AggregatedAnalytics> {
  // Get lead-based metrics
  const { data: leadStats, error: leadError } = await supabase
    .from("leads")
    .select("status, is_positive_reply, email_open_count, email_click_count, email_reply_count")
    .eq("campaign_id", campaignId);

  if (leadError) {
    console.error("[Analytics] Error fetching lead stats:", leadError);
    return createEmptyAnalytics();
  }

  // Get email event counts
  const { data: eventStats, error: eventError } = await supabase
    .from("email_events")
    .select("event_type")
    .eq("campaign_id", campaignId);

  if (eventError) {
    console.error("[Analytics] Error fetching event stats:", eventError);
  }

  // Calculate metrics from leads
  const leads = leadStats || [];
  const events = eventStats || [];

  const totalLeads = leads.length;
  const totalContacted = leads.filter((l) => l.status !== "new" && l.status !== null).length;
  const totalCompleted = leads.filter((l) => ["won", "lost", "not_interested"].includes(l.status)).length;

  // Engagement from lead counters
  const totalOpens = leads.reduce((sum, l) => sum + (l.email_open_count || 0), 0);
  const totalUniqueOpens = leads.filter((l) => (l.email_open_count || 0) > 0).length;
  const totalClicks = leads.reduce((sum, l) => sum + (l.email_click_count || 0), 0);
  const totalUniqueClicks = leads.filter((l) => (l.email_click_count || 0) > 0).length;
  const totalReplies = leads.reduce((sum, l) => sum + (l.email_reply_count || 0), 0);
  const totalUniqueReplies = leads.filter((l) => (l.email_reply_count || 0) > 0).length;

  // Outcome metrics
  const totalPositiveReplies = leads.filter((l) => l.is_positive_reply).length;
  const totalMeetingsBooked = leads.filter((l) => l.status === "booked").length;
  const totalWon = leads.filter((l) => l.status === "won").length;
  const totalLost = leads.filter((l) => l.status === "lost").length;
  const totalNotInterested = leads.filter((l) => l.status === "not_interested").length;

  // Event-based metrics
  const totalEmailsSent = events.filter((e) => e.event_type === "sent").length;
  const totalBounced = events.filter((e) => e.event_type === "bounced").length;

  // If no sent events recorded, estimate from contacted leads
  const effectiveSent = totalEmailsSent > 0 ? totalEmailsSent : totalContacted;

  return {
    totalLeads,
    totalContacted,
    totalCompleted,
    totalEmailsSent: effectiveSent,
    totalOpens,
    totalUniqueOpens,
    totalClicks,
    totalUniqueClicks,
    totalReplies,
    totalUniqueReplies,
    totalBounced,
    totalPositiveReplies,
    totalMeetingsBooked,
    totalWon,
    totalLost,
    totalNotInterested,
    openRate: calculateRate(totalUniqueOpens, effectiveSent),
    clickRate: calculateRate(totalUniqueClicks, effectiveSent),
    replyRate: calculateRate(totalUniqueReplies, effectiveSent),
    positiveReplyRate: calculateRate(totalPositiveReplies, effectiveSent),
    bounceRate: calculateRate(totalBounced, effectiveSent),
  };
}

// ============================================
// CLIENT-LEVEL ANALYTICS (aggregated from Supabase)
// ============================================

export async function getClientAnalytics(
  supabase: SupabaseClient,
  clientId: string,
  dateRange?: { start: string; end: string }
): Promise<ClientAnalyticsSummary> {
  // Get client info
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .single();

  if (clientError || !client) {
    throw new Error(`Client not found: ${clientId}`);
  }

  // Get campaigns for this client
  const { data: campaigns, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, is_active")
    .eq("client_id", clientId);

  if (campaignError) {
    console.error("[Analytics] Error fetching campaigns:", campaignError);
  }

  const campaignList = campaigns || [];
  const campaignIds = campaignList.map((c) => c.id);
  const activeCampaigns = campaignList.filter((c) => c.is_active).length;

  if (campaignIds.length === 0) {
    return {
      ...createEmptyAnalytics(),
      clientId: client.id,
      clientName: client.name,
      activeCampaigns: 0,
      totalCampaigns: 0,
    };
  }

  // Build lead query
  let leadQuery = supabase
    .from("leads")
    .select("status, is_positive_reply, email_open_count, email_click_count, email_reply_count")
    .in("campaign_id", campaignIds);

  // Apply date filter if provided
  if (dateRange?.start) {
    leadQuery = leadQuery.gte("created_at", dateRange.start);
  }
  if (dateRange?.end) {
    leadQuery = leadQuery.lte("created_at", dateRange.end);
  }

  const { data: leads, error: leadError } = await leadQuery;

  if (leadError) {
    console.error("[Analytics] Error fetching leads:", leadError);
  }

  // Get email events
  let eventQuery = supabase
    .from("email_events")
    .select("event_type")
    .in("campaign_id", campaignIds);

  if (dateRange?.start) {
    eventQuery = eventQuery.gte("timestamp", dateRange.start);
  }
  if (dateRange?.end) {
    eventQuery = eventQuery.lte("timestamp", dateRange.end);
  }

  const { data: events, error: eventError } = await eventQuery;

  if (eventError) {
    console.error("[Analytics] Error fetching events:", eventError);
  }

  // Calculate aggregated metrics
  const leadList = leads || [];
  const eventList = events || [];

  const totalLeads = leadList.length;
  const totalContacted = leadList.filter((l) => l.status !== "new" && l.status !== null).length;
  const totalCompleted = leadList.filter((l) => ["won", "lost", "not_interested"].includes(l.status)).length;

  const totalOpens = leadList.reduce((sum, l) => sum + (l.email_open_count || 0), 0);
  const totalUniqueOpens = leadList.filter((l) => (l.email_open_count || 0) > 0).length;
  const totalClicks = leadList.reduce((sum, l) => sum + (l.email_click_count || 0), 0);
  const totalUniqueClicks = leadList.filter((l) => (l.email_click_count || 0) > 0).length;
  const totalReplies = leadList.reduce((sum, l) => sum + (l.email_reply_count || 0), 0);
  const totalUniqueReplies = leadList.filter((l) => (l.email_reply_count || 0) > 0).length;

  const totalPositiveReplies = leadList.filter((l) => l.is_positive_reply).length;
  const totalMeetingsBooked = leadList.filter((l) => l.status === "booked").length;
  const totalWon = leadList.filter((l) => l.status === "won").length;
  const totalLost = leadList.filter((l) => l.status === "lost").length;
  const totalNotInterested = leadList.filter((l) => l.status === "not_interested").length;

  const totalEmailsSent = eventList.filter((e) => e.event_type === "sent").length;
  const totalBounced = eventList.filter((e) => e.event_type === "bounced").length;

  const effectiveSent = totalEmailsSent > 0 ? totalEmailsSent : totalContacted;

  return {
    clientId: client.id,
    clientName: client.name,
    activeCampaigns,
    totalCampaigns: campaignList.length,
    totalLeads,
    totalContacted,
    totalCompleted,
    totalEmailsSent: effectiveSent,
    totalOpens,
    totalUniqueOpens,
    totalClicks,
    totalUniqueClicks,
    totalReplies,
    totalUniqueReplies,
    totalBounced,
    totalPositiveReplies,
    totalMeetingsBooked,
    totalWon,
    totalLost,
    totalNotInterested,
    openRate: calculateRate(totalUniqueOpens, effectiveSent),
    clickRate: calculateRate(totalUniqueClicks, effectiveSent),
    replyRate: calculateRate(totalUniqueReplies, effectiveSent),
    positiveReplyRate: calculateRate(totalPositiveReplies, effectiveSent),
    bounceRate: calculateRate(totalBounced, effectiveSent),
  };
}

// ============================================
// ADMIN-LEVEL ANALYTICS (all clients)
// ============================================

export async function getAdminAnalytics(
  supabase: SupabaseClient,
  dateRange?: { start: string; end: string }
): Promise<AdminAnalyticsSummary> {
  // Get all clients
  const { data: clients, error: clientError } = await supabase
    .from("clients")
    .select("id, is_active");

  if (clientError) {
    console.error("[Analytics] Error fetching clients:", clientError);
  }

  const clientList = clients || [];
  const totalClients = clientList.length;
  const activeClients = clientList.filter((c) => c.is_active !== false).length;

  // Get all campaigns
  const { data: campaigns, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, is_active");

  if (campaignError) {
    console.error("[Analytics] Error fetching campaigns:", campaignError);
  }

  const campaignList = campaigns || [];
  const totalCampaigns = campaignList.length;
  const activeCampaigns = campaignList.filter((c) => c.is_active).length;

  if (campaignList.length === 0) {
    return {
      ...createEmptyAnalytics(),
      totalClients,
      activeClients,
      totalCampaigns: 0,
      activeCampaigns: 0,
    };
  }

  // Build lead query
  let leadQuery = supabase
    .from("leads")
    .select("status, is_positive_reply, email_open_count, email_click_count, email_reply_count");

  if (dateRange?.start) {
    leadQuery = leadQuery.gte("created_at", dateRange.start);
  }
  if (dateRange?.end) {
    leadQuery = leadQuery.lte("created_at", dateRange.end);
  }

  const { data: leads, error: leadError } = await leadQuery;

  if (leadError) {
    console.error("[Analytics] Error fetching leads:", leadError);
  }

  // Get email events
  let eventQuery = supabase.from("email_events").select("event_type");

  if (dateRange?.start) {
    eventQuery = eventQuery.gte("timestamp", dateRange.start);
  }
  if (dateRange?.end) {
    eventQuery = eventQuery.lte("timestamp", dateRange.end);
  }

  const { data: events, error: eventError } = await eventQuery;

  if (eventError) {
    console.error("[Analytics] Error fetching events:", eventError);
  }

  // Calculate aggregated metrics
  const leadList = leads || [];
  const eventList = events || [];

  const totalLeads = leadList.length;
  const totalContacted = leadList.filter((l) => l.status !== "new" && l.status !== null).length;
  const totalCompleted = leadList.filter((l) => ["won", "lost", "not_interested"].includes(l.status)).length;

  const totalOpens = leadList.reduce((sum, l) => sum + (l.email_open_count || 0), 0);
  const totalUniqueOpens = leadList.filter((l) => (l.email_open_count || 0) > 0).length;
  const totalClicks = leadList.reduce((sum, l) => sum + (l.email_click_count || 0), 0);
  const totalUniqueClicks = leadList.filter((l) => (l.email_click_count || 0) > 0).length;
  const totalReplies = leadList.reduce((sum, l) => sum + (l.email_reply_count || 0), 0);
  const totalUniqueReplies = leadList.filter((l) => (l.email_reply_count || 0) > 0).length;

  const totalPositiveReplies = leadList.filter((l) => l.is_positive_reply).length;
  const totalMeetingsBooked = leadList.filter((l) => l.status === "booked").length;
  const totalWon = leadList.filter((l) => l.status === "won").length;
  const totalLost = leadList.filter((l) => l.status === "lost").length;
  const totalNotInterested = leadList.filter((l) => l.status === "not_interested").length;

  const totalEmailsSent = eventList.filter((e) => e.event_type === "sent").length;
  const totalBounced = eventList.filter((e) => e.event_type === "bounced").length;

  const effectiveSent = totalEmailsSent > 0 ? totalEmailsSent : totalContacted;

  return {
    totalClients,
    activeClients,
    totalCampaigns,
    activeCampaigns,
    totalLeads,
    totalContacted,
    totalCompleted,
    totalEmailsSent: effectiveSent,
    totalOpens,
    totalUniqueOpens,
    totalClicks,
    totalUniqueClicks,
    totalReplies,
    totalUniqueReplies,
    totalBounced,
    totalPositiveReplies,
    totalMeetingsBooked,
    totalWon,
    totalLost,
    totalNotInterested,
    openRate: calculateRate(totalUniqueOpens, effectiveSent),
    clickRate: calculateRate(totalUniqueClicks, effectiveSent),
    replyRate: calculateRate(totalUniqueReplies, effectiveSent),
    positiveReplyRate: calculateRate(totalPositiveReplies, effectiveSent),
    bounceRate: calculateRate(totalBounced, effectiveSent),
  };
}

// ============================================
// PER-CLIENT BREAKDOWN (for admin dashboard)
// ============================================

export async function getAnalyticsByClient(
  supabase: SupabaseClient,
  dateRange?: { start: string; end: string }
): Promise<ClientAnalyticsSummary[]> {
  // Get all clients
  const { data: clients, error: clientError } = await supabase
    .from("clients")
    .select("id, name, is_active")
    .order("name");

  if (clientError) {
    console.error("[Analytics] Error fetching clients:", clientError);
    return [];
  }

  // Fetch analytics for each client
  const results: ClientAnalyticsSummary[] = [];

  for (const client of clients || []) {
    try {
      const analytics = await getClientAnalytics(supabase, client.id, dateRange);
      results.push(analytics);
    } catch (error) {
      console.error(`[Analytics] Error fetching analytics for client ${client.id}:`, error);
    }
  }

  return results;
}
