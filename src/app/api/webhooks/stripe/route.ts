import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe/client";
import { getPlanByPriceId } from "@/lib/stripe/config";
import type Stripe from "stripe";

function getServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** In Stripe SDK v20+, period dates are on subscription items, not the subscription itself. */
function getSubscriptionPeriod(subscription: Stripe.Subscription) {
  const item = subscription.items.data[0];
  return {
    current_period_start: item
      ? new Date(item.current_period_start * 1000).toISOString()
      : null,
    current_period_end: item
      ? new Date(item.current_period_end * 1000).toISOString()
      : null,
  };
}

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const sig = headersList.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const subscriptionId = session.subscription as string;
        const customerId = session.customer as string;

        if (!userId || !subscriptionId) {
          console.error("[Stripe Webhook] Missing user_id or subscription_id in checkout session");
          break;
        }

        // Get subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        const priceId = subscription.items.data[0]?.price.id;
        const plan = getPlanByPriceId(priceId);

        if (!plan) {
          console.error("[Stripe Webhook] Unknown price ID:", priceId);
          break;
        }

        const period = getSubscriptionPeriod(subscription);

        // Set stripe_customer_id on profile
        await supabase
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", userId);

        // Insert subscription record
        await supabase.from("stripe_subscriptions").upsert(
          {
            user_id: userId,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: customerId,
            plan: plan.id,
            status: subscription.status as string,
            current_period_start: period.current_period_start,
            current_period_end: period.current_period_end,
            trial_start: subscription.trial_start
              ? new Date(subscription.trial_start * 1000).toISOString()
              : null,
            trial_end: subscription.trial_end
              ? new Date(subscription.trial_end * 1000).toISOString()
              : null,
            client_limit: plan.clientLimit,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "stripe_subscription_id" }
        );

        console.log("[Stripe Webhook] Checkout completed for user:", userId, "plan:", plan.id);
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0]?.price.id;
        const plan = getPlanByPriceId(priceId);
        const period = getSubscriptionPeriod(subscription);

        const updateData: Record<string, unknown> = {
          status: subscription.status,
          current_period_start: period.current_period_start,
          current_period_end: period.current_period_end,
          trial_start: subscription.trial_start
            ? new Date(subscription.trial_start * 1000).toISOString()
            : null,
          trial_end: subscription.trial_end
            ? new Date(subscription.trial_end * 1000).toISOString()
            : null,
          cancel_at: subscription.cancel_at
            ? new Date(subscription.cancel_at * 1000).toISOString()
            : null,
          canceled_at: subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000).toISOString()
            : null,
          updated_at: new Date().toISOString(),
        };

        if (plan) {
          updateData.plan = plan.id;
          updateData.client_limit = plan.clientLimit;
        }

        await supabase
          .from("stripe_subscriptions")
          .update(updateData)
          .eq("stripe_subscription_id", subscription.id);

        console.log("[Stripe Webhook] Subscription updated:", subscription.id, "status:", subscription.status);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;

        await supabase
          .from("stripe_subscriptions")
          .update({
            status: "canceled",
            canceled_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscription.id);

        console.log("[Stripe Webhook] Subscription canceled:", subscription.id);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        // In Stripe SDK v20+, subscription is on invoice.parent.subscription_details
        const subDetails = invoice.parent?.subscription_details;
        const subscriptionRef = subDetails?.subscription;
        const subscriptionId =
          typeof subscriptionRef === "string"
            ? subscriptionRef
            : subscriptionRef?.id;

        if (subscriptionId) {
          await supabase
            .from("stripe_subscriptions")
            .update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_subscription_id", subscriptionId);

          console.log("[Stripe Webhook] Payment failed for subscription:", subscriptionId);
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const subDetails = invoice.parent?.subscription_details;
        const subscriptionRef = subDetails?.subscription;
        const subscriptionId =
          typeof subscriptionRef === "string"
            ? subscriptionRef
            : subscriptionRef?.id;

        if (subscriptionId) {
          // Reset past_due subscriptions back to active on successful payment
          const { data: existing } = await supabase
            .from("stripe_subscriptions")
            .select("status")
            .eq("stripe_subscription_id", subscriptionId)
            .single();

          if (existing?.status === "past_due") {
            await supabase
              .from("stripe_subscriptions")
              .update({
                status: "active",
                updated_at: new Date().toISOString(),
              })
              .eq("stripe_subscription_id", subscriptionId);

            console.log("[Stripe Webhook] Payment succeeded, reactivated subscription:", subscriptionId);
          }
        }
        break;
      }

      default:
        console.log("[Stripe Webhook] Unhandled event type:", event.type);
    }
  } catch (err) {
    console.error("[Stripe Webhook] Error processing event:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
