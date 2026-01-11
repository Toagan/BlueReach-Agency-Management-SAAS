import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { syncLeadToHubSpot } from "@/lib/hubspot";

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST - Test HubSpot sync with sample data
export async function POST(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  try {
    const { clientId } = await params;
    const supabase = await createServerClient();

    // Verify user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const adminSupabase = getSupabaseAdmin();

    // Get client name
    const { data: client } = await adminSupabase
      .from("clients")
      .select("name")
      .eq("id", clientId)
      .single();

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    // Create test data
    const testEmail = `test-bluereach-${Date.now()}@example.com`;

    const result = await syncLeadToHubSpot({
      leadEmail: testEmail,
      leadFirstName: "Test",
      leadLastName: "BlueReach",
      leadPhone: "+1234567890",
      companyName: "Test Company Inc.",
      campaignName: "BlueReach Test Campaign",
      clientId: clientId,
      clientName: client.name,
      emailThread: [
        {
          direction: "outbound",
          from_email: "outreach@bluereach.com",
          to_email: testEmail,
          subject: "Quick question about your business",
          body_text: `Hi Test,

I came across your company and wanted to reach out. We help businesses like yours generate more leads through targeted outreach.

Would you be open to a quick call this week?

Best regards,
BlueReach Team`,
          sent_at: new Date(Date.now() - 86400000).toISOString(), // Yesterday
        },
        {
          direction: "inbound",
          from_email: testEmail,
          to_email: "outreach@bluereach.com",
          subject: "Re: Quick question about your business",
          body_text: `Hi,

Thanks for reaching out! This sounds interesting. I'd love to learn more about what you offer.

Can we schedule a call for next week?

Best,
Test BlueReach
Test Company Inc.`,
          sent_at: new Date().toISOString(), // Now
        },
      ],
    });

    return NextResponse.json({
      success: result.success,
      testEmail,
      contactId: result.contactId,
      noteId: result.noteId,
      error: result.error,
      skipped: result.skipped,
      message: result.success
        ? `Test contact "${testEmail}" synced to HubSpot! Check your HubSpot contacts.`
        : `Sync failed: ${result.error}`,
    });
  } catch (error) {
    console.error("Error testing HubSpot sync:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to test HubSpot sync",
      },
      { status: 500 }
    );
  }
}
