import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchInstantlyCampaignDetails } from "@/lib/instantly/campaigns";

// Use service role key for admin operations
function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET: Fetch sequences for a campaign (from DB, or sync from Instantly if needed)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const supabase = getSupabase();

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
  const supabase = getSupabase();

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

    console.log("Instantly campaign details:", JSON.stringify(instantlyDetails, null, 2));

    if (!instantlyDetails.sequences || instantlyDetails.sequences.length === 0) {
      return NextResponse.json({
        message: "No sequences found in Instantly campaign response",
        synced: 0,
        debug: { hasSequences: false, campaignId: campaign.instantly_campaign_id }
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
    console.log("Main sequence:", JSON.stringify(mainSequence, null, 2));

    if (mainSequence && mainSequence.steps) {
      mainSequence.steps.forEach((step: { type?: string; delay?: number; variants?: Array<{ subject?: string; body?: string; v_disabled?: boolean }> }, stepIndex: number) => {
        // Instantly V2 API has variants array inside each step
        // Each variant has subject and body
        if (step.variants && step.variants.length > 0) {
          step.variants.forEach((variant, variantIndex) => {
            if (variant.v_disabled) return; // Skip disabled variants

            const variantLabel = step.variants!.length > 1
              ? String.fromCharCode(65 + variantIndex) // A, B, C...
              : "A";

            sequencesToInsert.push({
              campaign_id: campaignId,
              sequence_index: 0,
              step_number: stepIndex + 1,
              variant: variantLabel,
              subject: variant.subject || null,
              body_text: variant.body || null,
              body_html: variant.body || null,
              delay_days: step.delay || 0,
            });
          });
        }
      });
    }

    console.log("Sequences to insert:", sequencesToInsert.length);

    if (sequencesToInsert.length === 0) {
      // Sequences array exists but couldn't parse any steps
      return NextResponse.json({
        message: "Found sequences but couldn't parse email steps. The campaign may use a different format.",
        synced: 0,
        debug: {
          sequencesCount: instantlyDetails.sequences?.length,
          stepsCount: mainSequence?.steps?.length,
          rawSequenceKeys: mainSequence ? Object.keys(mainSequence) : [],
          firstStepKeys: mainSequence?.steps?.[0] ? Object.keys(mainSequence.steps[0]) : []
        }
      });
    }

    const { error: insertError } = await supabase
      .from("campaign_sequences")
      .insert(sequencesToInsert);

    if (insertError) {
      console.error("Error inserting sequences:", insertError);
      // Check if it's a table doesn't exist error
      if (insertError.code === "42P01") {
        return NextResponse.json({
          error: "Database table 'campaign_sequences' not found. Please run the migration: 20241230_add_email_sequences_and_threads.sql",
          synced: 0,
        }, { status: 500 });
      }
      throw insertError;
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to sync sequences from Instantly: ${errorMessage}` },
      { status: 500 }
    );
  }
}
