import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getClientsForUser } from "@/lib/queries/clients";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { AlertCircle, Building2 } from "lucide-react";

interface DashboardPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const error = params.error;

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

  // If admin, redirect them to admin dashboard
  if (isAdmin) {
    redirect("/admin");
  }

  // Get clients for regular users
  const clients = await getClientsForUser(supabase, user.id);

  // If user has only one client, redirect directly to their client page (hip UI)
  if (clients.length === 1) {
    redirect(`/admin/clients/${clients[0].id}`);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="text-gray-600 mt-1">Select a client to view their dashboard</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Access Error</p>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      {clients.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No client access yet</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              You haven&apos;t been assigned to any clients. Please contact your administrator to request access.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {clients.map((client) => (
            <Link key={client.id} href={`/admin/clients/${client.id}`}>
              <Card className="hover:shadow-lg hover:border-blue-200 transition-all cursor-pointer group">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <Building2 className="h-5 w-5 text-blue-600" />
                    </div>
                    <CardTitle className="text-lg">{client.name}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">View campaigns, leads, and analytics</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
