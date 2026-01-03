import { createClient } from "@/lib/supabase/server";
import { AdminLeadsView } from "./admin-leads-view";

interface PageProps {
  searchParams: Promise<{
    status?: string;
    positive?: string;
    client?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 100;

export default async function AdminLeadsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const page = parseInt(params.page || "1", 10);
  const offset = (page - 1) * PAGE_SIZE;

  // Build query with server-side filters
  let query = supabase
    .from("leads")
    .select("*, client_id, client_name, campaign_name, campaigns(name, client_id, clients(name))", { count: "exact" });

  // Apply filters
  if (params.client && params.client !== "all") {
    query = query.eq("client_id", params.client);
  }

  if (params.status && params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params.positive === "true") {
    query = query.eq("is_positive_reply", true);
  }

  // Apply ordering and pagination
  const { data: leads, count } = await query
    .order("updated_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  // Get all clients for filtering
  const { data: clients } = await supabase
    .from("clients")
    .select("id, name")
    .order("name");

  // Get total counts for export options
  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  const { count: positiveCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("is_positive_reply", true);

  const { count: repliedCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("status", "replied");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All Leads</h1>
        <p className="text-muted-foreground mt-1">
          Manage and track all leads across your campaigns
        </p>
      </div>

      <AdminLeadsView
        leads={leads || []}
        clients={clients || []}
        totalCount={count || 0}
        totalLeads={totalLeads || 0}
        positiveCount={positiveCount || 0}
        repliedCount={repliedCount || 0}
        currentPage={page}
        pageSize={PAGE_SIZE}
        initialStatus={params.status}
        initialClient={params.client}
        initialPositive={params.positive === "true"}
      />
    </div>
  );
}
