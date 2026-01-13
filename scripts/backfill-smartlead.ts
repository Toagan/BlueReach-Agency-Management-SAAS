#!/usr/bin/env npx tsx
/**
 * Local backfill script for large Smartlead campaigns
 * Run with: npx tsx scripts/backfill-smartlead.ts
 *
 * This bypasses HTTP timeout limitations by running locally.
 */

import { createClient } from "@supabase/supabase-js";

// Configuration - Finance Professors Weltweit campaign
const CAMPAIGN_ID = "ef7ec304-406f-49f6-8556-1a51ccd199a7";
const SMARTLEAD_CAMPAIGN_ID = "2413311";

// You'll need to set these environment variables or hardcode for one-time use
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yznescgbqdosilqhesib.supabase.co";
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Get API key from command line or environment
const SMARTLEAD_API_KEY = process.argv[2] || process.env.SMARTLEAD_API_KEY;

if (!SMARTLEAD_API_KEY) {
  console.error("Usage: npx tsx scripts/backfill-smartlead.ts <SMARTLEAD_API_KEY>");
  console.error("Or set SMARTLEAD_API_KEY environment variable");
  process.exit(1);
}

if (!SUPABASE_SERVICE_KEY) {
  console.error("SUPABASE_SERVICE_ROLE_KEY environment variable is required");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface SmartleadStatistic {
  lead_email: string;
  lead_category: string | null;
  sent_time: string | null;
  open_time: string | null;
  click_time: string | null;
  reply_time: string | null;
  open_count: number;
  click_count: number;
  is_bounced: boolean;
}

interface DailyStats {
  sent: number;
  opened: number;
  openedLeads: Set<string>;
  replied: number;
  repliedLeads: Set<string>;
  clicked: number;
  clickedLeads: Set<string>;
  bounced: number;
}

async function fetchSmartleadStatistics(): Promise<SmartleadStatistic[]> {
  const allStats: SmartleadStatistic[] = [];
  const limit = 100;
  let offset = 0;
  let hasMore = true;

  console.log(`\nFetching statistics from Smartlead API...`);
  const startTime = Date.now();

  while (hasMore) {
    const url = `https://server.smartlead.ai/api/v1/campaigns/${SMARTLEAD_CAMPAIGN_ID}/statistics?api_key=${SMARTLEAD_API_KEY}&limit=${limit}&offset=${offset}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Smartlead API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.data || data.data.length === 0) {
      break;
    }

    allStats.push(...data.data);
    offset += limit;
    hasMore = data.data.length === limit;

    // Progress logging
    if (allStats.length % 1000 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`  Fetched ${allStats.length} records (${elapsed}s elapsed)...`);
    }

    // Small delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  Completed: ${allStats.length} total records in ${totalTime}s\n`);

  return allStats;
}

function aggregateToDailyStats(stats: SmartleadStatistic[]): Map<string, DailyStats> {
  const dailyMap = new Map<string, DailyStats>();

  const getOrCreate = (date: string): DailyStats => {
    if (!dailyMap.has(date)) {
      dailyMap.set(date, {
        sent: 0,
        opened: 0,
        openedLeads: new Set(),
        replied: 0,
        repliedLeads: new Set(),
        clicked: 0,
        clickedLeads: new Set(),
        bounced: 0,
      });
    }
    return dailyMap.get(date)!;
  };

  for (const stat of stats) {
    // Process sent_time
    if (stat.sent_time) {
      const date = stat.sent_time.split("T")[0];
      const day = getOrCreate(date);
      day.sent += 1;
      if (stat.is_bounced) {
        day.bounced += 1;
      }
    }

    // Process open_time
    if (stat.open_time && stat.open_count > 0) {
      const date = stat.open_time.split("T")[0];
      const day = getOrCreate(date);
      day.opened += stat.open_count;
      day.openedLeads.add(stat.lead_email);
    }

    // Process click_time
    if (stat.click_time && stat.click_count > 0) {
      const date = stat.click_time.split("T")[0];
      const day = getOrCreate(date);
      day.clicked += stat.click_count;
      day.clickedLeads.add(stat.lead_email);
    }

    // Process reply_time
    if (stat.reply_time) {
      const date = stat.reply_time.split("T")[0];
      const day = getOrCreate(date);
      day.replied += 1;
      day.repliedLeads.add(stat.lead_email);
    }
  }

  return dailyMap;
}

async function upsertToSupabase(dailyMap: Map<string, DailyStats>): Promise<number> {
  const records = Array.from(dailyMap.entries()).map(([date, day]) => ({
    campaign_id: CAMPAIGN_ID,
    snapshot_date: date,
    emails_sent: day.sent,
    emails_opened: day.opened,
    emails_opened_unique: day.openedLeads.size,
    emails_clicked: day.clicked,
    emails_clicked_unique: day.clickedLeads.size,
    emails_replied: day.replied,
    emails_replied_unique: day.repliedLeads.size,
    leads_contacted: day.sent,
    positive_replies: 0,
    updated_at: new Date().toISOString(),
  }));

  // Sort by date
  records.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  console.log(`Upserting ${records.length} daily records to Supabase...`);

  // Upsert in batches of 100
  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const { error } = await supabase
      .from("campaign_analytics_daily")
      .upsert(batch, { onConflict: "campaign_id,snapshot_date" });

    if (error) {
      console.error(`  Error upserting batch ${i}-${i + batch.length}:`, error.message);
    } else {
      inserted += batch.length;
      console.log(`  Upserted ${inserted}/${records.length} records`);
    }
  }

  return inserted;
}

async function main() {
  console.log("=".repeat(60));
  console.log("Smartlead Backfill Script");
  console.log("=".repeat(60));
  console.log(`Campaign ID: ${CAMPAIGN_ID}`);
  console.log(`Smartlead Campaign ID: ${SMARTLEAD_CAMPAIGN_ID}`);

  try {
    // Step 1: Fetch all statistics from Smartlead
    const stats = await fetchSmartleadStatistics();

    if (stats.length === 0) {
      console.log("No statistics found for this campaign.");
      return;
    }

    // Step 2: Aggregate into daily buckets
    console.log("Aggregating into daily statistics...");
    const dailyMap = aggregateToDailyStats(stats);
    console.log(`  Generated ${dailyMap.size} daily records\n`);

    // Show date range
    const dates = Array.from(dailyMap.keys()).sort();
    console.log(`Date range: ${dates[0]} to ${dates[dates.length - 1]}\n`);

    // Step 3: Upsert to Supabase
    const inserted = await upsertToSupabase(dailyMap);

    console.log("\n" + "=".repeat(60));
    console.log("BACKFILL COMPLETE");
    console.log("=".repeat(60));
    console.log(`Statistics fetched: ${stats.length}`);
    console.log(`Daily records created: ${dailyMap.size}`);
    console.log(`Records upserted: ${inserted}`);

  } catch (error) {
    console.error("\nError:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
