import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requirePlatformAdmin } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - List all agency owners (platform admin only)
export async function GET() {
  const auth = await requirePlatformAdmin();
  if (auth.error) return auth.error;

  try {
    const supabase = getSupabase();

    // Get all admin profiles (exclude the platform admin's own row)
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, full_name")
      .eq("role", "admin")
      .neq("id", auth.user.id)
      .order("email");

    if (profilesError) {
      throw profilesError;
    }

    // Get client counts for each agency owner
    const agencies = await Promise.all(
      (profiles || []).map(async (profile) => {
        const { count } = await supabase
          .from("clients")
          .select("*", { count: "exact", head: true })
          .eq("owner_id", profile.id);

        return {
          id: profile.id,
          email: profile.email,
          name: profile.full_name,
          clientCount: count || 0,
          createdAt: null,
        };
      })
    );

    return NextResponse.json({ agencies });
  } catch (error) {
    console.error("Error fetching agencies:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch agencies" },
      { status: 500 }
    );
  }
}
