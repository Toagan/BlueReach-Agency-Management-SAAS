import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function syncProspeo(apiKey: string) {
  const res = await fetch("https://api.prospeo.io/account-information", {
    headers: { "X-KEY": apiKey },
  });
  if (!res.ok) throw new Error(`Prospeo API error: ${res.status}`);
  const json = await res.json();
  const data = json.response || json;

  const updateData: Record<string, unknown> = {};

  if (data.remaining_credits !== undefined && data.used_credits !== undefined) {
    updateData.credits_balance = data.remaining_credits;
    updateData.credits_limit = data.remaining_credits + data.used_credits;
  }
  if (data.next_quota_renewal_date) {
    updateData.renewal_date = data.next_quota_renewal_date.split(" ")[0];
  }

  return updateData;
}

async function syncLeadmagic(apiKey: string) {
  const res = await fetch("https://api.leadmagic.io/v1/credits", {
    headers: { "x-api-key": apiKey },
  });
  if (!res.ok) throw new Error(`LeadMagic API error: ${res.status}`);
  const data = await res.json();

  const updateData: Record<string, unknown> = {};

  if (data.credits !== undefined) {
    updateData.credits_balance = Math.round(data.credits);
  }

  return updateData;
}

async function syncFindymail(apiKey: string) {
  const res = await fetch("https://app.findymail.com/api/credits", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Findymail API error: ${res.status}`);
  const data = await res.json();

  const updateData: Record<string, unknown> = {};

  if (data.credits !== undefined) {
    updateData.credits_balance = data.credits;
  }
  if (data.max_credits !== undefined) {
    updateData.credits_limit = data.max_credits;
  }

  return updateData;
}

async function syncSmartlead(apiKey: string) {
  const [accountsRes, campaignsRes] = await Promise.all([
    fetch(`https://server.smartlead.ai/api/v1/email-accounts?api_key=${apiKey}`),
    fetch(`https://server.smartlead.ai/api/v1/campaigns?api_key=${apiKey}`),
  ]);
  if (!accountsRes.ok) throw new Error(`Smartlead API error: ${accountsRes.status}`);
  if (!campaignsRes.ok) throw new Error(`Smartlead API error: ${campaignsRes.status}`);

  const accounts = await accountsRes.json();
  const campaigns = await campaignsRes.json();

  const updateData: Record<string, unknown> = {};

  if (Array.isArray(accounts)) {
    updateData.credits_balance = accounts.length;
  }
  if (Array.isArray(campaigns)) {
    updateData.credits_limit = campaigns.length;
  }
  updateData.notes = `${accounts.length} email accounts, ${campaigns.length} campaigns`;

  return updateData;
}

async function syncInstantly(apiKey: string) {
  const res = await fetch(
    "https://api.instantly.ai/api/v2/workspace-billing/plan-details",
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  if (!res.ok) throw new Error(`Instantly API error: ${res.status}`);
  const data = await res.json();

  const updateData: Record<string, unknown> = {};

  if (data.credits !== undefined) {
    updateData.credits_balance = data.credits;
  }
  if (data.credits_limit !== undefined) {
    updateData.credits_limit = data.credits_limit;
  }
  if (data.renewal_date) {
    updateData.renewal_date = data.renewal_date;
  }

  return updateData;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const supabase = getSupabase();

    const { data: subscription, error: fetchError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !subscription) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    if (!subscription.provider_type || !subscription.api_key) {
      return NextResponse.json(
        { error: "No provider or API key configured" },
        { status: 400 }
      );
    }

    let updateData: Record<string, unknown>;

    switch (subscription.provider_type) {
      case "prospeo":
        updateData = await syncProspeo(subscription.api_key);
        break;
      case "leadmagic":
        updateData = await syncLeadmagic(subscription.api_key);
        break;
      case "findymail":
        updateData = await syncFindymail(subscription.api_key);
        break;
      case "smartlead":
        updateData = await syncSmartlead(subscription.api_key);
        break;
      case "instantly":
        updateData = await syncInstantly(subscription.api_key);
        break;
      default:
        return NextResponse.json(
          { error: `Unknown provider: ${subscription.provider_type}` },
          { status: 400 }
        );
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ subscription });
    }

    const { data: updated, error: updateError } = await supabase
      .from("subscriptions")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating subscription after sync:", updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ subscription: updated });
  } catch (error) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Sync failed" },
      { status: 500 }
    );
  }
}
