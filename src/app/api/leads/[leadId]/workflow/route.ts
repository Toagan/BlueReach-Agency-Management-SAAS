import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface WorkflowUpdate {
  action: "mark_responded" | "schedule_meeting" | "close_won" | "close_lost" | "update_notes" | "revert_status";
  meeting_at?: string;
  notes?: string;
}

// POST - Update lead workflow status
export async function POST(
  request: Request,
  { params }: { params: Promise<{ leadId: string }> }
) {
  try {
    const { leadId } = await params;
    const body: WorkflowUpdate = await request.json();
    const supabase = getSupabase();

    // Get current lead
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const now = new Date().toISOString();
    let updateData: Record<string, unknown> = {};

    switch (body.action) {
      case "mark_responded":
        // Mark that we responded to this lead
        updateData = {
          responded_at: now,
          status: lead.status === "contacted" ? "replied" : lead.status,
        };
        break;

      case "schedule_meeting":
        // Schedule a meeting
        if (!body.meeting_at) {
          return NextResponse.json(
            { error: "meeting_at is required" },
            { status: 400 }
          );
        }
        updateData = {
          meeting_at: body.meeting_at,
          status: "booked",
        };
        break;

      case "close_won":
        // Mark as closed won
        updateData = {
          closed_at: now,
          status: "won",
        };
        break;

      case "close_lost":
        // Mark as closed lost
        updateData = {
          closed_at: now,
          status: "lost",
        };
        break;

      case "update_notes":
        // Just update notes
        updateData = {
          notes: body.notes || null,
        };
        break;

      case "revert_status":
        // Revert to previous status (for mistakes)
        // Determine appropriate status based on what data exists
        if (lead.meeting_at) {
          updateData = { status: "booked", closed_at: null };
        } else if (lead.responded_at || lead.has_replied) {
          updateData = { status: "replied", meeting_at: null, closed_at: null };
        } else {
          updateData = { status: "contacted", responded_at: null, meeting_at: null, closed_at: null };
        }
        break;

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }

    // Update the lead
    const { data: updatedLead, error: updateError } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", leadId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating lead:", updateError);
      return NextResponse.json(
        { error: "Failed to update lead" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      lead: updatedLead,
    });
  } catch (error) {
    console.error("Error in workflow update:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update workflow" },
      { status: 500 }
    );
  }
}
