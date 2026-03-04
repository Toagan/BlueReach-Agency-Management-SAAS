import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { isSuperAdmin, getUserSubscription } from "@/lib/stripe/helpers";
import { getImpersonatedOwnerId } from "@/lib/impersonation";
import { ImpersonationBanner } from "@/components/admin/impersonation-banner";

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
  const superAdmin = isSuperAdmin(user.email);

  // Get subscription for banner display (non-super-admin admins only)
  let subscription: Awaited<ReturnType<typeof getUserSubscription>> = null;
  if (isAdmin && !superAdmin) {
    subscription = await getUserSubscription(user.id);
  }

  // Check impersonation state
  let impersonatedOwner: { name: string; email: string } | null = null;
  const impersonatedId = await getImpersonatedOwnerId();
  if (impersonatedId && profile?.role === "admin") {
    const serviceSupabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: ownerProfile } = await serviceSupabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", impersonatedId)
      .single();
    if (ownerProfile) {
      impersonatedOwner = {
        name: ownerProfile.full_name || "",
        email: ownerProfile.email || "",
      };
    }
  }

  const isTrialing = subscription?.status === "trialing";
  const isPastDue = subscription?.status === "past_due";
  const trialEnd = subscription?.trial_end
    ? new Date(subscription.trial_end)
    : null;
  const trialDaysLeft = trialEnd
    ? Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  // Non-admins can only access their specific client pages
  // The middleware handles the detailed access control

  return (
    <div className="min-h-screen bg-background">
      {/* Impersonation banner */}
      {impersonatedOwner && (
        <ImpersonationBanner
          ownerName={impersonatedOwner.name}
          ownerEmail={impersonatedOwner.email}
        />
      )}
      {/* Subscription banners */}
      {isTrialing && trialDaysLeft > 0 && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-2 text-center">
          <p className="text-sm text-blue-300">
            Free trial: <strong>{trialDaysLeft} days remaining</strong>.{" "}
            <Link href="/admin/billing" className="underline hover:text-blue-200">
              View billing
            </Link>
          </p>
        </div>
      )}
      {isPastDue && (
        <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-center">
          <p className="text-sm text-red-300">
            Payment failed.{" "}
            <Link href="/admin/billing" className="underline hover:text-red-200 font-medium">
              Update your payment method
            </Link>
          </p>
        </div>
      )}

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
              {isAdmin && (
                <>
                  <Link
                    href="/admin/settings"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Settings
                  </Link>
                  <Link
                    href="/admin/billing"
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Billing
                  </Link>
                </>
              )}
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
