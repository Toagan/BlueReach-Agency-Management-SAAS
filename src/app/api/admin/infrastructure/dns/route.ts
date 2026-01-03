import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkDomainHealth, checkDomainsHealth } from "@/lib/dns";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET - Get domain health records from database
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain");

    const supabase = getSupabase();

    if (domain) {
      // Get specific domain
      const { data, error } = await supabase
        .from("domain_summary")
        .select("*")
        .eq("domain", domain)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      return NextResponse.json({ domain: data || null });
    }

    // Get all domains
    const { data: domains, error } = await supabase
      .from("domain_summary")
      .select("*")
      .order("account_count", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ domains: domains || [] });
  } catch (error) {
    console.error("Error fetching domain health:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch domain health" },
      { status: 500 }
    );
  }
}

// POST - Check DNS health for domain(s) and store results
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const domains: string[] = body.domains || [];

    if (domains.length === 0) {
      return NextResponse.json(
        { error: "No domains provided" },
        { status: 400 }
      );
    }

    // Limit to 20 domains per request
    if (domains.length > 20) {
      return NextResponse.json(
        { error: "Maximum 20 domains per request" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Check all domains
    const results = await checkDomainsHealth(domains);

    // Store results in database
    const stored: string[] = [];
    const errors: string[] = [];

    for (const result of results) {
      try {
        const domainData = {
          domain: result.domain,
          has_spf: result.spf.found,
          spf_record: result.spf.record,
          spf_valid: result.spf.valid,
          has_dkim: result.dkim.found,
          dkim_selector: result.dkim.selector,
          dkim_record: result.dkim.record,
          dkim_valid: result.dkim.valid,
          has_dmarc: result.dmarc.found,
          dmarc_record: result.dmarc.record,
          dmarc_policy: result.dmarc.policy,
          dmarc_valid: result.dmarc.valid,
          health_score: result.healthScore,
          last_checked_at: result.checkedAt,
        };

        // Upsert domain health
        const { error } = await supabase
          .from("domain_health")
          .upsert(domainData, { onConflict: "domain" });

        if (error) {
          errors.push(`Failed to store ${result.domain}: ${error.message}`);
        } else {
          stored.push(result.domain);
        }
      } catch (error) {
        errors.push(`Failed to store ${result.domain}: ${error}`);
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      results,
      stored,
      errors,
    });
  } catch (error) {
    console.error("Error checking DNS health:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DNS check failed" },
      { status: 500 }
    );
  }
}

// PATCH - Refresh DNS health for domains from email accounts
export async function PATCH() {
  try {
    const supabase = getSupabase();

    // Get unique domains from email accounts
    const { data: accounts, error: accountsError } = await supabase
      .from("email_accounts")
      .select("domain")
      .not("domain", "is", null);

    if (accountsError) {
      throw accountsError;
    }

    // Get unique domains
    const uniqueDomains = [...new Set(accounts?.map((a) => a.domain).filter(Boolean) || [])];

    if (uniqueDomains.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No domains to check",
        checked: 0,
      });
    }

    // Check domains in batches
    const batchSize = 10;
    let checked = 0;
    const errors: string[] = [];

    for (let i = 0; i < uniqueDomains.length; i += batchSize) {
      const batch = uniqueDomains.slice(i, i + batchSize);
      const results = await checkDomainsHealth(batch);

      for (const result of results) {
        try {
          const domainData = {
            domain: result.domain,
            has_spf: result.spf.found,
            spf_record: result.spf.record,
            spf_valid: result.spf.valid,
            has_dkim: result.dkim.found,
            dkim_selector: result.dkim.selector,
            dkim_record: result.dkim.record,
            dkim_valid: result.dkim.valid,
            has_dmarc: result.dmarc.found,
            dmarc_record: result.dmarc.record,
            dmarc_policy: result.dmarc.policy,
            dmarc_valid: result.dmarc.valid,
            health_score: result.healthScore,
            last_checked_at: result.checkedAt,
          };

          await supabase.from("domain_health").upsert(domainData, { onConflict: "domain" });
          checked++;
        } catch (error) {
          errors.push(`Failed to update ${result.domain}: ${error}`);
        }
      }
    }

    return NextResponse.json({
      success: errors.length === 0,
      checked,
      total: uniqueDomains.length,
      errors,
    });
  } catch (error) {
    console.error("Error refreshing DNS health:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "DNS refresh failed" },
      { status: 500 }
    );
  }
}
