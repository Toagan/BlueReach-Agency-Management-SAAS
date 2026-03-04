import { NextResponse } from "next/server";
import { getSmartleadClient } from "@/lib/smartlead";
import type { SmartleadCampaign } from "@/lib/smartlead";
import { requireAdmin, getEffectiveOwnerId } from "@/lib/auth";

// GET - Test SmartLead API connection
export async function GET() {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const ownerId = await getEffectiveOwnerId(auth);
    const client = getSmartleadClient(ownerId);

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
