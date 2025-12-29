import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { getClientsForUser } from "@/lib/queries/clients";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  // Get clients for sidebar
  let clients: Array<{ id: string; name: string }> = [];

  if (isAdmin) {
    // Admins see all clients
    const { data } = await supabase.from("clients").select("id, name").order("name");
    clients = data || [];
  } else {
    // Regular users see only linked clients
    clients = await getClientsForUser(supabase, user.id);
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar isAdmin={false} clients={clients} />
      <div className="flex-1 flex flex-col">
        <Header email={user.email} isAdmin={isAdmin} />
        <main className="flex-1 p-6 bg-gray-50">{children}</main>
      </div>
    </div>
  );
}
