import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { getClient } from "@/lib/queries/clients";
import { getCampaigns } from "@/lib/queries/campaigns";
import { getClientStats } from "@/lib/queries/stats";
import { StatsCards } from "@/components/layout/stats-cards";
import { ClientLeadsView } from "./client-leads-view";

interface PageProps {
  params: Promise<{ clientId: string }>;
}

export default async function ClientDashboardPage({ params }: PageProps) {
  const { clientId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch client data
  let client;
  try {
    client = await getClient(supabase, clientId);
  } catch {
    notFound();
  }

  // Fetch campaigns and stats
  const [campaigns, stats] = await Promise.all([
    getCampaigns(supabase, clientId),
    getClientStats(supabase, clientId),
  ]);

  // Fetch leads for all campaigns
  const { data: leads } = await supabase
    .from("leads")
    .select("*, campaigns!inner(client_id, name)")
    .eq("campaigns.client_id", clientId)
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{client.name}</h1>
        <p className="text-gray-500">
          {campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""} active
        </p>
      </div>

      <StatsCards stats={stats} />

      <ClientLeadsView
        leads={leads || []}
        campaigns={campaigns}
        clientId={clientId}
      />
    </div>
  );
}
