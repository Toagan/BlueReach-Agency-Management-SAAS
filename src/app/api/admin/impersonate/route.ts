import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth";
import { setImpersonation, clearImpersonation } from "@/lib/impersonation";

// POST - Start impersonating an agency owner
export async function POST(request: Request) {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;

  try {
    const { ownerId } = await request.json();

    if (!ownerId || typeof ownerId !== "string") {
      return NextResponse.json(
        { error: "ownerId is required" },
        { status: 400 }
      );
    }

    await setImpersonation(ownerId);
    return NextResponse.json({ success: true, viewingAs: ownerId });
  } catch (error) {
    console.error("Error setting impersonation:", error);
    return NextResponse.json(
      { error: "Failed to set impersonation" },
      { status: 500 }
    );
  }
}

// DELETE - Stop impersonating
export async function DELETE() {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;

  try {
    await clearImpersonation();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing impersonation:", error);
    return NextResponse.json(
      { error: "Failed to clear impersonation" },
      { status: 500 }
    );
  }
}
