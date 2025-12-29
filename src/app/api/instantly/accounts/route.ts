import { NextResponse } from "next/server";
import {
  fetchAllInstantlyAccounts,
  getWarmupAnalytics,
  enableWarmup,
  disableWarmup,
  testAccountVitals,
  getInstantlyClient,
} from "@/lib/instantly";

// GET - List all accounts with warmup status
export async function GET() {
  try {
    const client = getInstantlyClient();
    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: "Instantly API not configured" },
        { status: 503 }
      );
    }

    const accounts = await fetchAllInstantlyAccounts();

    // Get warmup analytics for all accounts
    const emails = accounts.map(a => a.email);
    let warmupAnalytics: Awaited<ReturnType<typeof getWarmupAnalytics>> = [];

    if (emails.length > 0) {
      try {
        warmupAnalytics = await getWarmupAnalytics(emails);
      } catch {
        // Warmup analytics might fail if not available
        console.log("Warmup analytics not available");
      }
    }

    // Merge warmup analytics into accounts
    const warmupMap = new Map(warmupAnalytics.map(w => [w.email, w]));
    const accountsWithWarmup = accounts.map(account => ({
      ...account,
      warmup: warmupMap.get(account.email) || null,
    }));

    return NextResponse.json({ accounts: accountsWithWarmup });
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

// POST - Enable/disable warmup or test vitals
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, emails } = body as {
      action: "enable_warmup" | "disable_warmup" | "test_vitals";
      emails: string[];
    };

    if (!action || !emails || emails.length === 0) {
      return NextResponse.json(
        { error: "action and emails array are required" },
        { status: 400 }
      );
    }

    const client = getInstantlyClient();
    if (!client.isConfigured()) {
      return NextResponse.json(
        { error: "Instantly API not configured" },
        { status: 503 }
      );
    }

    let result;
    switch (action) {
      case "enable_warmup":
        result = await enableWarmup(emails);
        break;
      case "disable_warmup":
        result = await disableWarmup(emails);
        break;
      case "test_vitals":
        result = await testAccountVitals(emails);
        break;
      default:
        return NextResponse.json(
          { error: "Invalid action. Use 'enable_warmup', 'disable_warmup', or 'test_vitals'" },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, action, ...result });
  } catch (error) {
    console.error("Error processing account action:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process action" },
      { status: 500 }
    );
  }
}
