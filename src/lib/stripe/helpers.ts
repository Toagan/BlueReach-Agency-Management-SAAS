import { createClient } from "@supabase/supabase-js";

const SUPER_ADMIN_EMAILS = ["tilman@blue-reach.com"];

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

export interface UserSubscription {
  id: string;
  plan: "starter" | "growth" | "agency";
  status: string;
  client_limit: number | null;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_start: string | null;
  trial_end: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
}

/**
 * Get the user's active subscription (trialing, active, or past_due).
 */
export async function getUserSubscription(
  userId: string
): Promise<UserSubscription | null> {
  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from("stripe_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .in("status", ["trialing", "active", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data as UserSubscription | null;
}

/**
 * Check if a user has an active subscription (trialing, active, or past_due).
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const sub = await getUserSubscription(userId);
  return sub !== null;
}
