import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getClientsForUser } from "@/lib/queries/clients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  // Get clients
  let clients: Array<{ id: string; name: string }> = [];

  if (isAdmin) {
    const { data } = await supabase.from("clients").select("id, name").order("name");
    clients = data || [];
  } else {
    clients = await getClientsForUser(supabase, user.id);
  }

  // If user has only one client, redirect directly to it
  if (clients.length === 1) {
    redirect(`/dashboard/${clients[0].id}`);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Welcome to your Dashboard</h1>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            <p>You don&apos;t have access to any clients yet.</p>
            <p className="text-sm mt-2">
              Please contact your administrator to get access.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <Link key={client.id} href={`/dashboard/${client.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <CardTitle>{client.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">Click to view campaigns and leads</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
