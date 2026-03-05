import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getImpersonatedOwnerId } from "@/lib/impersonation";
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

function getServiceSupabase() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function AdminLeadsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get profile to check role
  const serviceSupabase = getServiceSupabase();
  const { data: profile } = await serviceSupabase
    .from("profiles")
    .select("role, is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/login");
  }

  // Determine effective owner ID (handles impersonation)
  let ownerId = user.id;
  if (profile.is_platform_admin) {
    const impersonatedId = await getImpersonatedOwnerId();
    if (impersonatedId) {
      ownerId = impersonatedId;
    }
  }

  // Get owner's client IDs for scoping
  const { data: ownerClients } = await serviceSupabase
    .from("clients")
    .select("id, name")
    .eq("owner_id", ownerId)
    .order("name");

  const clientIds = ownerClients?.map((c) => c.id) || [];

  const page = parseInt(params.page || "1", 10);
  const offset = (page - 1) * PAGE_SIZE;

  // If owner has no clients, return empty
  if (clientIds.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">All Leads</h1>
          <p className="text-muted-foreground mt-1">
            Manage and track all leads across your campaigns
          </p>
        </div>
        <AdminLeadsView
          leads={[]}
          clients={[]}
          totalCount={0}
          totalLeads={0}
          positiveCount={0}
          repliedCount={0}
          currentPage={1}
          pageSize={PAGE_SIZE}
          initialStatus={params.status}
          initialClient={params.client}
          initialPositive={params.positive === "true"}
        />
      </div>
    );
  }

  // Build query scoped to owner's clients
  let query = serviceSupabase
    .from("leads")
    .select("*, client_id, client_name, campaign_name, campaigns(name, client_id, clients(name))", { count: "exact" })
    .in("client_id", clientIds);

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

  // Get total counts scoped to owner
  const { count: totalLeads } = await serviceSupabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .in("client_id", clientIds);

  const { count: positiveCount } = await serviceSupabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("is_positive_reply", true)
    .in("client_id", clientIds);

  const { count: repliedCount } = await serviceSupabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("status", "replied")
    .in("client_id", clientIds);

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
        clients={ownerClients || []}
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
