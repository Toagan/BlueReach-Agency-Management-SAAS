import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getStripe } from "@/lib/stripe/client";
import { PLANS, type PlanId } from "@/lib/stripe/config";
import { getServerUrl } from "@/utils/get-url";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const body = await request.json();
  const planId = body.plan as PlanId;

  if (!planId || !PLANS[planId]) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const plan = PLANS[planId];
  if (!plan.priceId) {
    return NextResponse.json(
      { error: "Plan price not configured" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const baseUrl = await getServerUrl();

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        trial_period_days: 14,
        metadata: {
          user_id: auth.user.id,
          plan: planId,
        },
      },
      metadata: {
        user_id: auth.user.id,
        plan: planId,
      },
      customer_email: auth.user.email,
      success_url: `${baseUrl}/admin?checkout=success`,
      cancel_url: `${baseUrl}/choose-plan?checkout=canceled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[Stripe Checkout] Error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
