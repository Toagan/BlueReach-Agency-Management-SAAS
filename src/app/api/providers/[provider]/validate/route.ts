// Provider API Key Validation Endpoint
// Validates an API key for a specific provider

import { NextResponse } from "next/server";
import { createProvider, type ProviderType } from "@/lib/providers";

const SUPPORTED_PROVIDERS: ProviderType[] = ["instantly", "smartlead"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    const { provider } = await params;

    // Validate provider
    if (!SUPPORTED_PROVIDERS.includes(provider as ProviderType)) {
      return NextResponse.json(
        { valid: false, error: `Unsupported provider: ${provider}` },
        { status: 400 }
      );
    }

    const { apiKey } = await request.json();

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { valid: false, error: "API key is required" },
        { status: 400 }
      );
    }

    // Create provider and validate
    const providerInstance = createProvider(provider as ProviderType, apiKey);
    const isValid = await providerInstance.validateApiKey();

    return NextResponse.json({ valid: isValid });
  } catch (error) {
    console.error("[Provider Validate] Error:", error);
    return NextResponse.json(
      {
        valid: false,
        error: error instanceof Error ? error.message : "Validation failed",
      },
      { status: 500 }
    );
  }
}
