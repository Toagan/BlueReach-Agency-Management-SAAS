import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireClientAccess } from "@/lib/auth";
import { sendSlackTestPositiveReply, sendSlackTestStats } from "@/lib/slack";
import { sendSlackSetupEmail } from "@/lib/email";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Get Slack settings for a client
export async function GET(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const auth = await requireClientAccess(clientId);
    if (auth.error) return auth.error;

    const adminSupabase = getSupabaseAdmin();

    const { data: settings } = await adminSupabase
      .from("settings")
      .select("key, value")
      .in("key", [
        `client_${clientId}_slack_webhook_url`,
        `client_${clientId}_slack_positive_reply_campaigns`,
        `client_${clientId}_slack_stats_interval`,
        `client_${clientId}_slack_setup_email_sent`,
      ]);

    const settingsMap = new Map(settings?.map((s) => [s.key, s.value]) || []);

    const webhookUrl = settingsMap.get(`client_${clientId}_slack_webhook_url`) || "";
    const positiveReplyCampaignsRaw = settingsMap.get(`client_${clientId}_slack_positive_reply_campaigns`);

    let positiveReplyCampaigns: "all" | string[] = "all";
    if (positiveReplyCampaignsRaw && positiveReplyCampaignsRaw !== "all") {
      try {
        positiveReplyCampaigns = JSON.parse(positiveReplyCampaignsRaw);
      } catch {
        positiveReplyCampaigns = "all";
      }
    }

    return NextResponse.json({
      webhookUrl,
      hasWebhook: !!webhookUrl,
      positiveReplyCampaigns,
      statsInterval: settingsMap.get(`client_${clientId}_slack_stats_interval`) || "disabled",
      setupEmailSent: settingsMap.get(`client_${clientId}_slack_setup_email_sent`) || null,
    });
  } catch (error) {
    console.error("Error fetching Slack settings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// POST - Update Slack settings or perform actions
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const auth = await requireClientAccess(clientId);
    if (auth.error) return auth.error;

    const body = await request.json();
    const { action } = body as { action?: string };

    const adminSupabase = getSupabaseAdmin();

    // Action: test webhook
    if (action === "test") {
      const { data: webhookSetting } = await adminSupabase
        .from("settings")
        .select("value")
        .eq("key", `client_${clientId}_slack_webhook_url`)
        .single();

      if (!webhookSetting?.value) {
        return NextResponse.json({ error: "No webhook URL configured" }, { status: 400 });
      }

      const { data: client } = await adminSupabase
        .from("clients")
        .select("name")
        .eq("id", clientId)
        .single();

      const result = await sendSlackTestPositiveReply(webhookSetting.value, client?.name);
      if (!result.success) {
        return NextResponse.json({ error: result.error || "Test message failed" }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: "Sample positive reply sent to Slack" });
    }

    // Action: test stats only
    if (action === "testStats") {
      const { data: webhookSetting } = await adminSupabase
        .from("settings")
        .select("value")
        .eq("key", `client_${clientId}_slack_webhook_url`)
        .single();

      if (!webhookSetting?.value) {
        return NextResponse.json({ error: "No webhook URL configured" }, { status: 400 });
      }

      const { data: client } = await adminSupabase
        .from("clients")
        .select("name")
        .eq("id", clientId)
        .single();

      const result = await sendSlackTestStats(webhookSetting.value, client?.name);
      if (!result.success) {
        return NextResponse.json({ error: result.error || "Test stats failed" }, { status: 400 });
      }

      return NextResponse.json({ success: true, message: "Sample stats report sent to Slack" });
    }

    // Action: send setup email
    if (action === "sendSetupEmail") {
      const { recipientEmail } = body as { recipientEmail?: string };
      if (!recipientEmail) {
        return NextResponse.json({ error: "Recipient email is required" }, { status: 400 });
      }

      // Get client name
      const { data: client } = await adminSupabase
        .from("clients")
        .select("name")
        .eq("id", clientId)
        .single();

      const result = await sendSlackSetupEmail({
        to: recipientEmail,
        recipientName: recipientEmail.split("@")[0],
        clientName: client?.name || "Your Company",
        clientId,
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || "Failed to send email" }, { status: 500 });
      }

      // Record when setup email was sent
      await adminSupabase
        .from("settings")
        .upsert({
          key: `client_${clientId}_slack_setup_email_sent`,
          value: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });

      return NextResponse.json({ success: true, message: `Setup instructions sent to ${recipientEmail}` });
    }

    // Default action: save settings
    const { webhookUrl, positiveReplyCampaigns, statsInterval } = body as {
      webhookUrl?: string;
      positiveReplyCampaigns?: "all" | string[];
      statsInterval?: string;
    };

    // Validate webhook URL if provided
    if (webhookUrl !== undefined) {
      if (webhookUrl && !webhookUrl.startsWith("https://hooks.slack.com/")) {
        return NextResponse.json({ error: "Invalid Slack webhook URL" }, { status: 400 });
      }

      await adminSupabase
        .from("settings")
        .upsert({
          key: `client_${clientId}_slack_webhook_url`,
          value: webhookUrl,
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });
    }

    if (positiveReplyCampaigns !== undefined) {
      const value = positiveReplyCampaigns === "all" ? "all" : JSON.stringify(positiveReplyCampaigns);
      await adminSupabase
        .from("settings")
        .upsert({
          key: `client_${clientId}_slack_positive_reply_campaigns`,
          value,
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });
    }

    if (statsInterval !== undefined) {
      const validIntervals = ["disabled", "weekly", "monthly", "quarterly"];
      if (!validIntervals.includes(statsInterval)) {
        return NextResponse.json({ error: "Invalid stats interval" }, { status: 400 });
      }

      await adminSupabase
        .from("settings")
        .upsert({
          key: `client_${clientId}_slack_stats_interval`,
          value: statsInterval,
          updated_at: new Date().toISOString(),
        }, { onConflict: "key" });
    }

    return NextResponse.json({ success: true, message: "Slack settings saved" });
  } catch (error) {
    console.error("Error saving Slack settings:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save settings" },
      { status: 500 }
    );
  }
}
