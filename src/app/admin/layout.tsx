import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default async function AdminLayout({
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

  // Check if user is admin and get profile info
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin";

  // Non-admins can only access their specific client pages
  // The middleware handles the detailed access control

  return (
    <div className="min-h-screen bg-background">
      {/* Simple top nav */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/admin" className="flex items-center gap-2">
              <span className="text-2xl">🌊</span>
              <span className="text-xl font-bold text-primary">
                Blue<span className="text-foreground">Reach</span>
              </span>
            </Link>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <span className="text-sm text-muted-foreground">{user.email}</span>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
