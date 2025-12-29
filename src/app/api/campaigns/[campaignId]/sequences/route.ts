import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchInstantlyCampaignDetails } from "@/lib/instantly/campaigns";

// GET: Fetch sequences for a campaign (from DB, or sync from Instantly if needed)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const supabase = await createClient();

  try {
    // First, try to get sequences from database
    const { data: sequences, error: dbError } = await supabase
      .from("campaign_sequences")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("sequence_index")
      .order("step_number")
      .order("variant");

    if (dbError) {
      console.error("DB error fetching sequences:", dbError);
      // If table doesn't exist yet, return empty array
      if (dbError.code === "42P01") {
        return NextResponse.json({ sequences: [], needsSync: true });
      }
      throw dbError;
    }

    // Get campaign to check if we need to sync
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("instantly_campaign_id, last_synced_at")
      .eq("id", campaignId)
      .single();

    const needsSync = !sequences || sequences.length === 0;

    return NextResponse.json({
      sequences: sequences || [],
      needsSync,
      lastSyncedAt: campaign?.last_synced_at,
    });
  } catch (error) {
    console.error("Error fetching sequences:", error);
    return NextResponse.json(
      { error: "Failed to fetch sequences" },
      { status: 500 }
    );
  }
}

// POST: Sync sequences from Instantly
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const supabase = await createClient();

  try {
    // Get campaign to find Instantly campaign ID
    const { data: campaign, error: campaignError } = await supabase
      .from("campaigns")
      .select("id, instantly_campaign_id, name")
      .eq("id", campaignId)
      .single();

    if (campaignError || !campaign) {
      return NextResponse.json(
        { error: "Campaign not found" },
        { status: 404 }
      );
    }

    if (!campaign.instantly_campaign_id) {
      return NextResponse.json(
        { error: "Campaign not linked to Instantly" },
        { status: 400 }
      );
    }

    // Fetch campaign details from Instantly (includes sequences)
    const instantlyDetails = await fetchInstantlyCampaignDetails(
      campaign.instantly_campaign_id
    );

    if (!instantlyDetails.sequences || instantlyDetails.sequences.length === 0) {
      return NextResponse.json({
        message: "No sequences found in Instantly",
        synced: 0,
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

    // Instantly returns sequences as an array, but only first element is used
    const mainSequence = instantlyDetails.sequences[0];
    if (mainSequence && mainSequence.steps) {
      mainSequence.steps.forEach((step, stepIndex) => {
        // Check if this step has variants (A/B testing)
        // For now, treat each step as variant 'A'
        // TODO: Parse variant info if available in the API response
        sequencesToInsert.push({
          campaign_id: campaignId,
          sequence_index: 0,
          step_number: stepIndex + 1,
          variant: step.variant_id || "A",
          subject: step.subject || null,
          body_text: step.body || null,
          body_html: step.body || null, // Instantly may return HTML in body
          delay_days: step.delay || 0,
        });
      });
    }

    if (sequencesToInsert.length > 0) {
      const { error: insertError } = await supabase
        .from("campaign_sequences")
        .insert(sequencesToInsert);

      if (insertError) {
        console.error("Error inserting sequences:", insertError);
        throw insertError;
      }
    }

    // Update campaign last_synced_at
    await supabase
      .from("campaigns")
      .update({
        last_synced_at: new Date().toISOString(),
        original_name: instantlyDetails.name,
      })
      .eq("id", campaignId);

    return NextResponse.json({
      message: "Sequences synced successfully",
      synced: sequencesToInsert.length,
    });
  } catch (error) {
    console.error("Error syncing sequences:", error);
    return NextResponse.json(
      { error: "Failed to sync sequences from Instantly" },
      { status: 500 }
    );
  }
}
