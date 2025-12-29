import { SupabaseClient } from "@supabase/supabase-js";

type TypedSupabaseClient = SupabaseClient;

export interface LeadStats {
  total_contacted: number;
  total_replied: number;
  total_booked: number;
  total_won: number;
  total_lost: number;
}

export async function getClientStats(
  supabase: TypedSupabaseClient,
  clientId: string
): Promise<LeadStats> {
  const { data, error } = await supabase
    .from("leads")
    .select("status, campaigns!inner(client_id)")
    .eq("campaigns.client_id", clientId);

  if (error) throw error;

  const stats: LeadStats = {
    total_contacted: 0,
    total_replied: 0,
    total_booked: 0,
    total_won: 0,
    total_lost: 0,
  };

  data?.forEach((lead) => {
    switch (lead.status) {
      case "contacted":
        stats.total_contacted++;
        break;
      case "replied":
        stats.total_replied++;
        break;
      case "booked":
        stats.total_booked++;
        break;
      case "won":
        stats.total_won++;
        break;
      case "lost":
        stats.total_lost++;
        break;
    }
  });

  return stats;
}

export async function getCampaignStats(
  supabase: TypedSupabaseClient,
  campaignId: string
): Promise<LeadStats> {
  const { data, error } = await supabase
    .from("leads")
    .select("status")
    .eq("campaign_id", campaignId);

  if (error) throw error;

  const stats: LeadStats = {
    total_contacted: 0,
    total_replied: 0,
    total_booked: 0,
    total_won: 0,
    total_lost: 0,
  };

  data?.forEach((lead) => {
    switch (lead.status) {
      case "contacted":
        stats.total_contacted++;
        break;
      case "replied":
        stats.total_replied++;
        break;
      case "booked":
        stats.total_booked++;
        break;
      case "won":
        stats.total_won++;
        break;
      case "lost":
        stats.total_lost++;
        break;
    }
  });

  return stats;
}

export async function getGlobalStats(supabase: TypedSupabaseClient): Promise<LeadStats> {
  const { data, error } = await supabase.from("leads").select("status");

  if (error) throw error;

  const stats: LeadStats = {
    total_contacted: 0,
    total_replied: 0,
    total_booked: 0,
    total_won: 0,
    total_lost: 0,
  };

  data?.forEach((lead) => {
    switch (lead.status) {
      case "contacted":
        stats.total_contacted++;
        break;
      case "replied":
        stats.total_replied++;
        break;
      case "booked":
        stats.total_booked++;
        break;
      case "won":
        stats.total_won++;
        break;
      case "lost":
        stats.total_lost++;
        break;
    }
  });

  return stats;
}
