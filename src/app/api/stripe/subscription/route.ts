import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { isSuperAdmin, getUserSubscription } from "@/lib/stripe/helpers";
import { createClient } from "@supabase/supabase-js";

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  // Super-admin / platform admin gets synthetic agency/active response
  if (isSuperAdmin(auth.user.email)) {
    return NextResponse.json({
      plan: "agency",
      status: "active",
      clientLimit: null,
      trialEnd: null,
      isSuperAdmin: true,
    });
  }

  const subscription = await getUserSubscription(auth.user.id);

  if (!subscription) {
    return NextResponse.json({ plan: null, status: null });
  }

  // Get current client count (scoped to this owner's clients only)
  const supabase = getServiceSupabase();
  const { count } = await supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", auth.user.id);

  return NextResponse.json({
    plan: subscription.plan,
    status: subscription.status,
    clientLimit: subscription.client_limit,
    currentClients: count || 0,
    trialEnd: subscription.trial_end,
    currentPeriodEnd: subscription.current_period_end,
    cancelAt: subscription.cancel_at,
  });
}
