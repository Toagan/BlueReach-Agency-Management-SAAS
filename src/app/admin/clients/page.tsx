import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getImpersonatedOwnerId } from "@/lib/impersonation";
import { AddClientDialog } from "./add-client-dialog";

export default async function ClientsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Get effective owner ID (handles impersonation for platform admins)
  const serviceSupabase = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await serviceSupabase
    .from("profiles")
    .select("role, is_platform_admin")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") redirect("/login");

  let ownerId = user.id;
  if (profile.is_platform_admin) {
    const impersonatedId = await getImpersonatedOwnerId();
    if (impersonatedId) ownerId = impersonatedId;
  }

  // Always scope by owner_id — defense in depth beyond RLS
  const { data: clients } = await serviceSupabase
    .from("clients")
    .select("*, campaigns(count)")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Clients</h1>
        <AddClientDialog />
      </div>

      {!clients || clients.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <p>No clients yet. Add your first client to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Link key={client.id} href={`/admin/clients/${client.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle>{client.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">
                    {(client.campaigns as unknown as { count: number }[])?.[0]?.count || 0} campaigns
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Created {new Date(client.created_at).toLocaleDateString()}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
