// Provider Factory and Exports
// Central entry point for multi-provider support

import { createClient } from "@supabase/supabase-js";
import type { EmailCampaignProvider, ProviderType } from "./types";
import { ProviderError } from "./types";
import { InstantlyProvider } from "./instantly";

// Re-export types
export * from "./types";

// Re-export providers
export { InstantlyProvider } from "./instantly";

// ============================================
// PROVIDER FACTORY
// ============================================

/**
 * Create a provider instance with the given API key
 */
export function createProvider(
  providerType: ProviderType,
  apiKey: string
): EmailCampaignProvider {
  switch (providerType) {
    case "instantly":
      return new InstantlyProvider(apiKey);
    case "smartlead":
      // TODO: Implement SmartleadProvider
      throw new ProviderError(
        "Smartlead integration coming soon",
        "smartlead"
      );
    case "lemlist":
      throw new ProviderError(
        "Lemlist integration not yet implemented",
        "lemlist"
      );
    case "apollo":
      throw new ProviderError(
        "Apollo integration not yet implemented",
        "apollo"
      );
    default:
      throw new ProviderError(
        `Unsupported provider: ${providerType}`,
        providerType as ProviderType
      );
  }
}

// ============================================
// CAMPAIGN PROVIDER HELPERS
// ============================================

/**
 * Get provider for a specific campaign by fetching its config from database
 */
export async function getProviderForCampaign(
  campaignId: string
): Promise<EmailCampaignProvider> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase configuration missing");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("provider_type, api_key_encrypted")
    .eq("id", campaignId)
    .single();

  if (error || !campaign) {
    throw new Error(`Campaign not found: ${campaignId}`);
  }

  if (!campaign.api_key_encrypted) {
    throw new Error(
      "Campaign API key not configured. Please add an API key in campaign settings."
    );
  }

  // For now, we store the API key as plain text (api_key_encrypted is the field name)
  // In production, you'd want to decrypt this
  const apiKey = campaign.api_key_encrypted;

  return createProvider(campaign.provider_type as ProviderType, apiKey);
}

/**
 * Get campaign details including provider type
 */
export async function getCampaignWithProvider(
  campaignId: string
): Promise<{
  campaign: {
    id: string;
    provider_type: ProviderType;
    provider_campaign_id: string | null;
    api_key_encrypted: string | null;
    webhook_secret: string | null;
  };
  provider: EmailCampaignProvider | null;
}> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Supabase configuration missing");
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("id, provider_type, provider_campaign_id, api_key_encrypted, webhook_secret")
    .eq("id", campaignId)
    .single();

  if (error || !campaign) {
    throw new Error(`Campaign not found: ${campaignId}`);
  }

  let provider: EmailCampaignProvider | null = null;
  if (campaign.api_key_encrypted) {
    try {
      provider = createProvider(
        campaign.provider_type as ProviderType,
        campaign.api_key_encrypted
      );
    } catch {
      // Provider not available, return null
    }
  }

  return {
    campaign: campaign as {
      id: string;
      provider_type: ProviderType;
      provider_campaign_id: string | null;
      api_key_encrypted: string | null;
      webhook_secret: string | null;
    },
    provider,
  };
}

// ============================================
// VALIDATION HELPERS
// ============================================

/**
 * Validate an API key for a specific provider
 */
export async function validateProviderApiKey(
  providerType: ProviderType,
  apiKey: string
): Promise<boolean> {
  try {
    const provider = createProvider(providerType, apiKey);
    return await provider.validateApiKey();
  } catch {
    return false;
  }
}

/**
 * Get supported providers
 */
export function getSupportedProviders(): { type: ProviderType; name: string; available: boolean }[] {
  return [
    { type: "instantly", name: "Instantly", available: true },
    { type: "smartlead", name: "Smartlead", available: false },
    { type: "lemlist", name: "Lemlist", available: false },
    { type: "apollo", name: "Apollo", available: false },
  ];
}
