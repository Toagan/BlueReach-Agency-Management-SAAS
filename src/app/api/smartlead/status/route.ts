import { NextResponse } from "next/server";
import { getSmartleadClient } from "@/lib/smartlead";
import type { SmartleadCampaign } from "@/lib/smartlead";
import { requireAuth } from "@/lib/auth";

// GET - Test SmartLead API connection
export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth.error) return auth.error;
    const client = getSmartleadClient();

    const isConfigured = await client.isConfiguredAsync();
    if (!isConfigured) {
      return NextResponse.json({
        configured: false,
        connected: false,
        message: "Smartlead API key not configured",
      });
    }

    // Make a lightweight request (list campaigns with limit=1)
    await client.get<SmartleadCampaign[]>("/campaigns", { limit: 1 });

    return NextResponse.json({
      configured: true,
      connected: true,
      message: "API connected successfully",
    });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      connected: false,
      message: error instanceof Error ? error.message : "Connection failed",
    });
  }
}
