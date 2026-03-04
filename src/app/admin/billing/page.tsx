import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isSuperAdmin, getUserSubscription } from "@/lib/stripe/helpers";
import { PLANS } from "@/lib/stripe/config";
import BillingActions from "./billing-actions";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const superAdmin = isSuperAdmin(user.email);

  if (superAdmin) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Billing</h1>
        <div className="p-6 rounded-xl border border-border bg-card">
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-lg font-semibold">Super Admin</h2>
            <span className="px-2 py-0.5 text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
              Free Access
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            You have unlimited access as a super admin. No billing required.
          </p>
        </div>
      </div>
    );
  }

  const subscription = await getUserSubscription(user.id);

  if (!subscription) {
    redirect("/choose-plan");
  }

  const plan = PLANS[subscription.plan];
  const trialEnd = subscription.trial_end
    ? new Date(subscription.trial_end)
    : null;
  const periodEnd = subscription.current_period_end
    ? new Date(subscription.current_period_end)
    : null;
  const isTrialing = subscription.status === "trialing";
  const isPastDue = subscription.status === "past_due";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Billing</h1>

      {isPastDue && (
        <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10">
          <p className="text-sm font-medium text-red-300">
            Your payment method failed. Please update it to continue using
            BlueReach.
          </p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Plan */}
        <div className="p-6 rounded-xl border border-border bg-card">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">
            Current Plan
          </h2>
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-2xl font-bold">{plan.name}</span>
            <span className="px-2 py-0.5 text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-full">
              {subscription.status}
            </span>
          </div>
          <p className="text-3xl font-bold mb-1">
            ${plan.price}
            <span className="text-base font-normal text-muted-foreground">
              /month
            </span>
          </p>
          <p className="text-sm text-muted-foreground">
            {plan.clientLimit
              ? `Up to ${plan.clientLimit} clients`
              : "Unlimited clients"}
          </p>
        </div>

        {/* Billing Period */}
        <div className="p-6 rounded-xl border border-border bg-card">
          <h2 className="text-sm font-medium text-muted-foreground mb-4">
            {isTrialing ? "Trial Period" : "Billing Period"}
          </h2>
          {isTrialing && trialEnd && (
            <>
              <p className="text-2xl font-bold mb-1">
                {Math.max(
                  0,
                  Math.ceil(
                    (trialEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
                  )
                )}{" "}
                days remaining
              </p>
              <p className="text-sm text-muted-foreground">
                Trial ends{" "}
                {trialEnd.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </>
          )}
          {!isTrialing && periodEnd && (
            <>
              <p className="text-2xl font-bold mb-1">
                Next billing{" "}
                {periodEnd.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {periodEnd.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </p>
            </>
          )}
          {subscription.cancel_at && (
            <p className="text-sm text-yellow-400 mt-2">
              Cancels on{" "}
              {new Date(subscription.cancel_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          )}
        </div>
      </div>

      <BillingActions isPastDue={isPastDue} />
    </div>
  );
}
