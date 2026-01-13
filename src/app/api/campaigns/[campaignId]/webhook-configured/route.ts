import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

interface RouteParams {
  params: Promise<{ campaignId: string }>;
}

// PATCH - Toggle webhook configured status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { campaignId } = await params;
    const body = await request.json();
    const { configured } = body;

    if (typeof configured !== "boolean") {
      return NextResponse.json(
        { error: "configured must be a boolean" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    const { error } = await supabase
      .from("campaigns")
      .update({ webhook_configured: configured })
      .eq("id", campaignId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      configured,
    });
  } catch (error) {
    console.error("Error updating webhook status:", error);
    return NextResponse.json(
      { error: "Failed to update webhook status" },
      { status: 500 }
    );
  }
}
