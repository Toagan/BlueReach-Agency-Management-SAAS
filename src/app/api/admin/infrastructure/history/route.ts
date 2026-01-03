import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Get health history for account(s)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("account_id");
    const days = parseInt(searchParams.get("days") || "30");

    const supabase = getSupabase();

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let query = supabase
      .from("email_account_health_history")
      .select("*, email_accounts(email, provider_type)")
      .gte("snapshot_date", startDate.toISOString().split("T")[0])
      .lte("snapshot_date", endDate.toISOString().split("T")[0])
      .order("snapshot_date", { ascending: true });

    if (accountId) {
      query = query.eq("email_account_id", accountId);
    }

    const { data: history, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      history: history || [],
      start_date: startDate.toISOString().split("T")[0],
      end_date: endDate.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("Error fetching health history:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch history" },
      { status: 500 }
    );
  }
}

// POST - Create daily snapshot for all accounts
export async function POST() {
  try {
    const supabase = getSupabase();
    const today = new Date().toISOString().split("T")[0];

    // Get all current accounts
    const { data: accounts, error: accountsError } = await supabase
      .from("email_accounts")
      .select("id, status, warmup_reputation, warmup_emails_sent, warmup_emails_received, emails_sent_today");

    if (accountsError) {
      throw accountsError;
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No accounts to snapshot",
        created: 0,
      });
    }

    // Create snapshots
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        const snapshot = {
          email_account_id: account.id,
          snapshot_date: today,
          status: account.status,
          warmup_reputation: account.warmup_reputation,
          warmup_emails_sent: account.warmup_emails_sent,
          warmup_emails_received: account.warmup_emails_received,
          emails_sent_today: account.emails_sent_today || 0,
          emails_bounced_today: 0, // Would need to track bounces separately
        };

        // Upsert (one snapshot per account per day)
        const { error } = await supabase
          .from("email_account_health_history")
          .upsert(snapshot, { onConflict: "email_account_id,snapshot_date" });

        if (error) {
          errors.push(`Failed to snapshot ${account.id}: ${error.message}`);
        } else {
          created++;
        }
      } catch (error) {
        errors.push(`Failed to snapshot ${account.id}: ${error}`);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      created,
      skipped,
      total: accounts.length,
      errors,
    });
  } catch (error) {
    console.error("Error creating health snapshots:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Snapshot creation failed" },
      { status: 500 }
    );
  }
}

// DELETE - Clean up old history (retention policy)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const retentionDays = parseInt(searchParams.get("retention_days") || "90");

    const supabase = getSupabase();

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const { error, count } = await supabase
      .from("email_account_health_history")
      .delete({ count: "exact" })
      .lt("snapshot_date", cutoffDate.toISOString().split("T")[0]);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      deleted: count || 0,
      cutoff_date: cutoffDate.toISOString().split("T")[0],
    });
  } catch (error) {
    console.error("Error cleaning up history:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}
