import { NextResponse } from "next/server";
import { getInstantlyClient } from "@/lib/instantly";

// Lightweight status check - just verify API is configured and working
export async function GET() {
  try {
    const client = getInstantlyClient();

    if (!client.isConfigured()) {
      return NextResponse.json({
        configured: false,
        connected: false,
        campaignCount: 0,
        accountCount: 0,
      });
    }

    // Make a single lightweight request to verify connection
    // Using limit=1 to minimize data transfer
    const response = await client.get<{ items: unknown[] }>("/campaigns", { limit: 1 });

    return NextResponse.json({
      configured: true,
      connected: true,
      // We don't know exact counts without fetching all, so indicate "available"
      message: "API connected successfully",
    });
  } catch (error) {
    return NextResponse.json({
      configured: true,
      connected: false,
      error: error instanceof Error ? error.message : "Connection failed",
    });
  }
}
