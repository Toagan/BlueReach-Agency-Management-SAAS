import { NextResponse } from "next/server";

const SMARTLEAD_API_BASE = "https://server.smartlead.ai/api/v1";

// POST - Validate a Smartlead API key
export async function POST(request: Request) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ valid: false, error: "API key is required" });
    }

    // Test the API key by making a simple request to Smartlead
    // Smartlead uses query parameter auth: ?api_key=YOUR_API_KEY
    const response = await fetch(
      `${SMARTLEAD_API_BASE}/campaigns?api_key=${encodeURIComponent(apiKey)}&limit=1`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      return NextResponse.json({
        valid: true,
        campaigns_count: Array.isArray(data) ? data.length : 0,
      });
    }

    if (response.status === 401 || response.status === 403) {
      return NextResponse.json({ valid: false, error: "Invalid or unauthorized API key" });
    }

    // Try to get error message from response
    let errorMessage = "Failed to validate API key";
    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // Ignore JSON parse errors
    }

    return NextResponse.json({ valid: false, error: errorMessage });
  } catch (error) {
    console.error("Error validating Smartlead API key:", error);
    return NextResponse.json({ valid: false, error: "Validation failed" });
  }
}
