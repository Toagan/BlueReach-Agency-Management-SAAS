import { NextResponse } from "next/server";
import { sendInvitationEmail } from "@/lib/email";

// POST - Send a test invitation email
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { to, inviteeName, clientName } = body;

    if (!to) {
      return NextResponse.json({ error: "to email is required" }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const loginUrl = `${baseUrl}/login`;

    const result = await sendInvitationEmail({
      to,
      inviteeName: inviteeName || to.split("@")[0],
      inviterName: "Tilman Schepke",
      clientName: clientName || "Test Client",
      loginUrl,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error sending test invitation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send" },
      { status: 500 }
    );
  }
}
