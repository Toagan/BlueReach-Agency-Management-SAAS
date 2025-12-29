import { SupabaseClient } from "@supabase/supabase-js";
import type { Campaign } from "@/types/database";

type TypedSupabaseClient = SupabaseClient;

export async function getCampaigns(supabase: TypedSupabaseClient, clientId: string) {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("client_id", clientId)
    .order("name");

  if (error) throw error;
  return data;
}

export async function getCampaign(supabase: TypedSupabaseClient, campaignId: string) {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (error) throw error;
  return data;
}

export async function getCampaignByInstantlyId(
  supabase: TypedSupabaseClient,
  instantlyCampaignId: string
) {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("instantly_campaign_id", instantlyCampaignId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data;
}

export async function createCampaign(
  supabase: TypedSupabaseClient,
  campaign: {
    client_id: string;
    name: string;
    instantly_campaign_id?: string;
    copy_body?: string;
  }
) {
  const { data, error } = await supabase
    .from("campaigns")
    .insert(campaign)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateCampaign(
  supabase: TypedSupabaseClient,
  campaignId: string,
  updates: Partial<Campaign>
) {
  const { data, error } = await supabase
    .from("campaigns")
    .update(updates)
    .eq("id", campaignId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCampaign(supabase: TypedSupabaseClient, campaignId: string) {
  const { error } = await supabase.from("campaigns").delete().eq("id", campaignId);

  if (error) throw error;
}
