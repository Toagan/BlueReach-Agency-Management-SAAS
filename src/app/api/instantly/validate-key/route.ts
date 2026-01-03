import { NextResponse } from "next/server";

// POST - Validate an Instantly API key
export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ valid: false, error: "API key is required" });
    }

    // Test the API key by making a simple request to Instantly
    const response = await fetch("https://api.instantly.ai/api/v2/campaigns?limit=1", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      // Try to get workspace info for additional validation
      const data = await response.json();
      return NextResponse.json({
        valid: true,
        campaigns_count: data.items?.length || 0,
      });
    }

    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({ valid: false, error: "Invalid or unauthorized API key" });
    }

    return NextResponse.json({ valid: false, error: "Failed to validate API key" });
  } catch (error) {
    console.error("Error validating Instantly API key:", error);
    return NextResponse.json({ valid: false, error: "Validation failed" });
  }
}
