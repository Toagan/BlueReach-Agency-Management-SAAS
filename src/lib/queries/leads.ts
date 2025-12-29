import { SupabaseClient } from "@supabase/supabase-js";
import type { LeadStatus } from "@/types/database";

type TypedSupabaseClient = SupabaseClient;

export async function getLeads(supabase: TypedSupabaseClient, campaignId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getLeadsForClient(supabase: TypedSupabaseClient, clientId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("*, campaigns!inner(client_id)")
    .eq("campaigns.client_id", clientId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getAllLeads(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("leads")
    .select("*, campaigns(name, clients(name))")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getLead(supabase: TypedSupabaseClient, leadId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (error) throw error;
  return data;
}

export async function upsertLead(
  supabase: TypedSupabaseClient,
  lead: {
    campaign_id: string;
    email: string;
    first_name?: string;
    status?: LeadStatus;
    instantly_lead_id?: string;
  }
) {
  const { data, error } = await supabase
    .from("leads")
    .upsert(
      { ...lead, updated_at: new Date().toISOString() },
      { onConflict: "campaign_id,email", ignoreDuplicates: false }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLeadStatus(
  supabase: TypedSupabaseClient,
  leadId: string,
  status: LeadStatus
) {
  const { data, error } = await supabase
    .from("leads")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateLeadNotes(
  supabase: TypedSupabaseClient,
  leadId: string,
  notes: string
) {
  const { data, error } = await supabase
    .from("leads")
    .update({ notes, updated_at: new Date().toISOString() })
    .eq("id", leadId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteLead(supabase: TypedSupabaseClient, leadId: string) {
  const { error } = await supabase.from("leads").delete().eq("id", leadId);

  if (error) throw error;
}
