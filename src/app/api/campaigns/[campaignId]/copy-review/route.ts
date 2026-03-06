import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireCampaignAccess } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Fetch all reviews and comments for a campaign
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const auth = await requireCampaignAccess(campaignId);
  if (auth.error) return auth.error;

  const supabase = getSupabase();

  const [{ data: reviews }, { data: comments }] = await Promise.all([
    supabase
      .from("copy_reviews")
      .select("*")
      .eq("campaign_id", campaignId),
    supabase
      .from("copy_comments")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("created_at", { ascending: true }),
  ]);

  return NextResponse.json({ reviews: reviews || [], comments: comments || [] });
}

// POST - Create or update a review, or add a comment
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  const { campaignId } = await params;
  const auth = await requireCampaignAccess(campaignId);
  if (auth.error) return auth.error;

  const supabase = getSupabase();
  const body = await request.json();
  const { action } = body;

  // Get user info for display
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", auth.user.id)
    .single();

  const userName = profile?.full_name || profile?.email || "Unknown";

  if (action === "review") {
    const { stepNumber, variant, status, comment } = body;

    if (!stepNumber || !variant || !status) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["pending", "approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("copy_reviews")
      .upsert(
        {
          campaign_id: campaignId,
          step_number: stepNumber,
          variant,
          status,
          comment: comment || null,
          reviewed_by: auth.user.id,
          reviewer_name: userName,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "campaign_id,step_number,variant" }
      )
      .select()
      .single();

    if (error) {
      console.error("[CopyReview] Error upserting review:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ review: data });
  }

  if (action === "comment") {
    const { stepNumber, variant, selectedText, startOffset, endOffset, comment } = body;

    if (!stepNumber || !variant || !selectedText || !comment || startOffset === undefined || endOffset === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("copy_comments")
      .insert({
        campaign_id: campaignId,
        step_number: stepNumber,
        variant,
        selected_text: selectedText,
        start_offset: startOffset,
        end_offset: endOffset,
        comment,
        user_id: auth.user.id,
        user_name: userName,
      })
      .select()
      .single();

    if (error) {
      console.error("[CopyReview] Error inserting comment:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comment: data });
  }

  if (action === "resolve") {
    const { commentId } = body;

    if (!commentId) {
      return NextResponse.json({ error: "Missing commentId" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("copy_comments")
      .update({
        resolved: true,
        resolved_by: auth.user.id,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", commentId)
      .eq("campaign_id", campaignId)
      .select()
      .single();

    if (error) {
      console.error("[CopyReview] Error resolving comment:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comment: data });
  }

  if (action === "unresolve") {
    const { commentId } = body;

    if (!commentId) {
      return NextResponse.json({ error: "Missing commentId" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("copy_comments")
      .update({
        resolved: false,
        resolved_by: null,
        resolved_at: null,
      })
      .eq("id", commentId)
      .eq("campaign_id", campaignId)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ comment: data });
  }

  if (action === "delete-comment") {
    const { commentId } = body;

    if (!commentId) {
      return NextResponse.json({ error: "Missing commentId" }, { status: 400 });
    }

    const { error } = await supabase
      .from("copy_comments")
      .delete()
      .eq("id", commentId)
      .eq("campaign_id", campaignId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
