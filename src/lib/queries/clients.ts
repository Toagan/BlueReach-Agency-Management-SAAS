import { SupabaseClient } from "@supabase/supabase-js";
import type { Client } from "@/types/database";

type TypedSupabaseClient = SupabaseClient;

export async function getClients(supabase: TypedSupabaseClient) {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getClient(supabase: TypedSupabaseClient, clientId: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (error) throw error;
  return data;
}

export async function createClient(
  supabase: TypedSupabaseClient,
  client: { name: string }
) {
  const { data, error } = await supabase
    .from("clients")
    .insert(client)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateClient(
  supabase: TypedSupabaseClient,
  clientId: string,
  updates: Partial<Client>
) {
  const { data, error } = await supabase
    .from("clients")
    .update(updates)
    .eq("id", clientId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteClient(supabase: TypedSupabaseClient, clientId: string) {
  const { error } = await supabase.from("clients").delete().eq("id", clientId);

  if (error) throw error;
}

export async function getClientsForUser(supabase: TypedSupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("client_users")
    .select("clients(*)")
    .eq("user_id", userId);

  if (error) throw error;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data?.map((cu: any) => cu.clients).filter(Boolean) || []) as Client[];
}

export async function linkUserToClient(
  supabase: TypedSupabaseClient,
  userId: string,
  clientId: string
) {
  const { error } = await supabase
    .from("client_users")
    .insert({ user_id: userId, client_id: clientId });

  if (error) throw error;
}
