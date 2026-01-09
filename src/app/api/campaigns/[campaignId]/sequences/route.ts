import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getProviderForCampaign } from "@/lib/providers";

// Use service role key for admin operations
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET: Fetch sequences for a campaign (from DB)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const supabase = getSupabase();

  try {
    // Get sequences from database
    const { data: sequences, error: dbError } = await supabase
      .from("campaign_sequences")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("sequence_index")
      .order("step_number")
      .order("variant");

    if (dbError) {
      console.error("DB error fetching sequences:", dbError);
      if (dbError.code === "42P01") {
        return NextResponse.json({ sequences: [], needsSync: true });
      }
      throw dbError;
    }

    // Get campaign to check provider and sync status
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("provider_type, instantly_campaign_id, smartlead_campaign_id, last_synced_at")
      .eq("id", campaignId)
      .single();

    const needsSync = !sequences || sequences.length === 0;

    return NextResponse.json({
      sequences: sequences || [],
      needsSync,
      lastSyncedAt: campaign?.last_synced_at,
      providerType: campaign?.provider_type,
    });
  } catch (error) {
    console.error("Error fetching sequences:", error);
    return NextResponse.json(
      { error: "Failed to fetch sequences" },
      { status: 500 }
    );
  }
}

// POST: Sync sequences from provider (Instantly or Smartlead)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const supabase = getSupabase();

  try {
    // Get campaign to find provider campaign ID AND api_key_encrypted
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, provider_type, provider_campaign_id, instantly_campaign_id, smartlead_campaign_id, name, api_key_encrypted")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      console.error("[Sequences] Campaign not found:", campaignId, campaignError);
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    console.log("[Sequences] Campaign data:", {
      id: campaign.id,
      provider_type: campaign.provider_type,
      provider_campaign_id: campaign.provider_campaign_id,
      instantly_campaign_id: campaign.instantly_campaign_id,
      smartlead_campaign_id: campaign.smartlead_campaign_id,
      has_api_key: !!campaign.api_key_encrypted,
    });

    const providerCampaignId = campaign.provider_campaign_id ||
      campaign.instantly_campaign_id ||
      campaign.smartlead_campaign_id;

    if (!providerCampaignId) {
      return NextResponse.json(
        { error: "Campaign not linked to any provider" },
        { status: 400 }
      );
    }

    // Check if API key is configured
    if (!campaign.api_key_encrypted) {
      return NextResponse.json(
        { error: `No API key configured for this ${campaign.provider_type === "smartlead" ? "Smartlead" : "Instantly"} campaign. Please update the campaign settings.` },
        { status: 400 }
      );
    }

    // Get provider instance
    const provider = await getProviderForCampaign(campaignId);
    const providerType = provider.providerType;

    console.log(`[Sequences] Syncing from ${providerType} for campaign ${campaignId}`);

    // Fetch campaign details which include sequences
    const campaignDetails = await provider.fetchCampaign(providerCampaignId);

    console.log(`[Sequences] Got campaign details, sequences: ${campaignDetails.sequences?.length || 0}`);

    if (!campaignDetails.sequences || campaignDetails.sequences.length === 0) {
      return NextResponse.json({
        message: `No sequences found in ${providerType === "smartlead" ? "Smartlead" : "Instantly"} campaign`,
        synced: 0,
        providerType,
      });
    }

    // Delete existing sequences for this campaign
    await supabase
      .from("campaign_sequences")
      .delete()
      .eq("campaign_id", campaignId);

    // Parse and insert sequences
    const sequencesToInsert: Array<{
      campaign_id: string;
      sequence_index: number;
      step_number: number;
      variant: string;
      subject: string | null;
      body_text: string | null;
      body_html: string | null;
      delay_days: number;
    }> = [];

    campaignDetails.sequences.forEach((sequence, seqIndex) => {
      sequence.steps.forEach((step) => {
        step.variants.forEach((variant, variantIndex) => {
          if (!variant.isActive) return; // Skip inactive variants

          const variantLabel = step.variants.length > 1
            ? String.fromCharCode(65 + variantIndex) // A, B, C...
            : "A";

          sequencesToInsert.push({
            campaign_id: campaignId,
            sequence_index: seqIndex,
            step_number: step.stepNumber,
            variant: variantLabel,
            subject: variant.subject || null,
            body_text: variant.body || null,
            body_html: variant.body || null,
            delay_days: step.delayDays || 0,
          });
        });
      });
    });

    console.log(`[Sequences] Inserting ${sequencesToInsert.length} sequence steps`);

    if (sequencesToInsert.length === 0) {
      return NextResponse.json({
        message: "Found sequences but couldn't parse email steps",
        synced: 0,
        providerType,
      });
    }

    const { error: insertError } = await supabase
      .from("campaign_sequences")
      .insert(sequencesToInsert);

    if (insertError) {
      console.error("Error inserting sequences:", insertError);
      if (insertError.code === "42P01") {
        return NextResponse.json({
          error: "Database table 'campaign_sequences' not found",
          synced: 0,
        }, { status: 500 });
      }
      throw insertError;
    }

    // Update campaign last_synced_at and original_name
    await supabase
      .from("campaigns")
      .update({
        last_synced_at: new Date().toISOString(),
        original_name: campaignDetails.name,
      })
      .eq("id", campaignId);

    return NextResponse.json({
      message: "Sequences synced successfully",
      synced: sequencesToInsert.length,
      providerType,
    });
  } catch (error) {
    console.error("Error syncing sequences:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to sync sequences: ${errorMessage}` },
      { status: 500 }
    );
  }
}
