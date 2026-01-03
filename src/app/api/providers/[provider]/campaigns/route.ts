// Provider Campaigns List Endpoint
// Fetches available campaigns from a provider using the provided API key

import { NextResponse } from "next/server";
import { createProvider, type ProviderType, type ProviderCampaign } from "@/lib/providers";

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
        { error: `Unsupported provider: ${provider}` },
        { status: 400 }
      );
    }

    const { apiKey } = await request.json();

    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 400 }
      );
    }

    // Create provider and fetch campaigns
    const providerInstance = createProvider(provider as ProviderType, apiKey);
    const campaigns = await providerInstance.fetchCampaigns();

    // Map to response format
    const response: ProviderCampaign[] = campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      createdAt: c.createdAt,
      leadsCount: c.leadsCount,
      emailsSentCount: c.emailsSentCount,
      repliesCount: c.repliesCount,
    }));

    return NextResponse.json({ campaigns: response });
  } catch (error) {
    console.error("[Provider Campaigns] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}
