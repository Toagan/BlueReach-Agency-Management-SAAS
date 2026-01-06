/**
 * Classify Replies Script
 *
 * Fetches reply content for leads marked as positive, then classifies them
 * to filter out auto-replies, unsubscribes, and negative responses.
 *
 * Classification Logic:
 * 1. NEGATIVE: Contains unsubscribe/not-interested keywords → is_positive_reply = false
 * 2. POSITIVE: Contains interested/meeting/pricing keywords → keep is_positive_reply = true
 * 3. UNCERTAIN: No clear signal → flag for manual review (or LLM classification)
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const CAMPAIGN_ID = "7df6f97e-3c1f-4370-9bbd-8bf88546e521";
const DRY_RUN = true; // Set to false to actually update the database

// ============================================
// KEYWORD CLASSIFICATION RULES
// ============================================

const NEGATIVE_KEYWORDS = [
  // English - Unsubscribe
  "unsubscribe", "remove me", "stop emailing", "stop sending", "opt out",
  "take me off", "remove from list", "don't contact", "do not contact",
  "please remove", "no longer", "not interested", "no thanks", "no thank you",
  "wrong person", "wrong email", "not the right",

  // German - Unsubscribe/Not interested
  "kein interesse", "nicht interessiert", "abmelden", "austragen",
  "keine emails", "bitte entfernen", "stoppen sie", "nicht mehr",
  "falsche adresse", "falsche person", "kein bedarf", "nein danke",
  "entfernen sie", "löschen sie",

  // Auto-replies
  "out of office", "auto-reply", "automatic reply", "auto reply",
  "automated response", "vacation", "holiday", "not in the office",
  "currently unavailable", "away from", "limited access",
  "abwesenheit", "automatische antwort", "urlaub", "nicht im büro",
  "außer haus", "bin nicht erreichbar",

  // Bounces/errors
  "delivery failed", "undeliverable", "mailbox full", "user unknown",
  "address rejected", "does not exist",
];

const POSITIVE_KEYWORDS = [
  // English - Interest signals
  "interested", "tell me more", "more information", "more info",
  "sounds good", "sounds interesting", "like to know", "want to know",
  "curious", "intrigued",

  // English - Meeting/call intent
  "schedule", "meeting", "call me", "give me a call", "let's talk",
  "set up a time", "book a", "arrange a", "discuss", "chat",
  "available", "free time", "calendar",

  // English - Pricing/business intent
  "pricing", "price", "cost", "how much", "quote", "proposal",
  "rates", "fees", "budget", "investment",
  "send me", "send over", "share", "provide",

  // English - Positive responses
  "yes", "sure", "absolutely", "definitely", "great", "perfect",
  "love to", "would like", "please do", "go ahead",

  // German - Interest signals
  "interessiert", "mehr erfahren", "mehr informationen", "klingt gut",
  "klingt interessant", "neugierig", "würde gerne",

  // German - Meeting/call intent
  "termin", "gespräch", "anrufen", "telefonat", "treffen",
  "besprechen", "unterhalten", "zeit haben",

  // German - Pricing/business intent
  "preis", "kosten", "angebot", "wie viel", "preisliste",
  "zusenden", "schicken sie", "senden sie",

  // German - Positive responses
  "ja", "gerne", "natürlich", "auf jeden fall", "klar",
];

// ============================================
// CLASSIFICATION FUNCTION
// ============================================

type Classification = "NEGATIVE" | "POSITIVE" | "UNCERTAIN";

interface ClassificationResult {
  classification: Classification;
  reason: string;
  matchedKeywords: string[];
}

function classifyReply(replyText: string): ClassificationResult {
  if (!replyText || replyText.trim().length === 0) {
    return {
      classification: "UNCERTAIN",
      reason: "Empty or no reply text",
      matchedKeywords: [],
    };
  }

  const textLower = replyText.toLowerCase();

  // Check for negative keywords first (they take priority)
  const negativeMatches: string[] = [];
  for (const keyword of NEGATIVE_KEYWORDS) {
    if (textLower.includes(keyword.toLowerCase())) {
      negativeMatches.push(keyword);
    }
  }

  if (negativeMatches.length > 0) {
    return {
      classification: "NEGATIVE",
      reason: `Contains negative keywords: ${negativeMatches.slice(0, 3).join(", ")}`,
      matchedKeywords: negativeMatches,
    };
  }

  // Check for positive keywords
  const positiveMatches: string[] = [];
  for (const keyword of POSITIVE_KEYWORDS) {
    if (textLower.includes(keyword.toLowerCase())) {
      positiveMatches.push(keyword);
    }
  }

  if (positiveMatches.length > 0) {
    return {
      classification: "POSITIVE",
      reason: `Contains positive keywords: ${positiveMatches.slice(0, 3).join(", ")}`,
      matchedKeywords: positiveMatches,
    };
  }

  // No clear signal
  return {
    classification: "UNCERTAIN",
    reason: "No clear positive or negative keywords found",
    matchedKeywords: [],
  };
}

// ============================================
// MAIN SCRIPT
// ============================================

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get campaign details for API key
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("api_key_encrypted, provider_campaign_id, instantly_campaign_id")
    .eq("id", CAMPAIGN_ID)
    .single();

  const apiKey = campaign?.api_key_encrypted;
  const providerCampaignId = campaign?.provider_campaign_id || campaign?.instantly_campaign_id;

  if (!apiKey) {
    console.error("No API key found for campaign");
    process.exit(1);
  }

  // Fetch all leads marked as positive
  console.log("=== Fetching leads with is_positive_reply=true ===\n");

  const { data: positiveLeads, error: leadsError } = await supabase
    .from("leads")
    .select("id, email, instantly_lead_id, first_name, last_name")
    .eq("campaign_id", CAMPAIGN_ID)
    .eq("is_positive_reply", true);

  if (leadsError) {
    console.error("Error fetching leads:", leadsError);
    process.exit(1);
  }

  console.log(`Found ${positiveLeads?.length || 0} leads to classify\n`);

  // Track classification results
  const results = {
    positive: [] as Array<{ email: string; reason: string }>,
    negative: [] as Array<{ email: string; reason: string; replyPreview: string }>,
    uncertain: [] as Array<{ email: string; reason: string; replyPreview: string }>,
    noReply: [] as Array<{ email: string }>,
    apiError: [] as Array<{ email: string; error: string }>,
  };

  // Process each lead
  for (let i = 0; i < (positiveLeads?.length || 0); i++) {
    const lead = positiveLeads![i];

    // Progress indicator
    if ((i + 1) % 20 === 0) {
      console.log(`Processing ${i + 1}/${positiveLeads!.length}...`);
    }

    try {
      // Fetch emails for this lead from Instantly
      const response = await fetch("https://api.instantly.ai/api/v2/emails", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
        },
      });

      // Try to get emails by searching for the lead's email
      const emailsResponse = await fetch(
        `https://api.instantly.ai/api/v2/emails?campaign_id=${providerCampaignId}&search=${encodeURIComponent(lead.email)}&limit=10`,
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
          },
        }
      );

      if (!emailsResponse.ok) {
        // Try alternative endpoint
        const altResponse = await fetch(
          `https://api.instantly.ai/api/v2/leads/${lead.instantly_lead_id}/emails`,
          {
            headers: {
              "Authorization": `Bearer ${apiKey}`,
            },
          }
        );

        if (!altResponse.ok) {
          results.apiError.push({ email: lead.email, error: `HTTP ${altResponse.status}` });
          continue;
        }
      }

      let emails: Array<{ body?: { text?: string; html?: string }; is_reply?: boolean; subject?: string }> = [];

      try {
        const emailsData = await emailsResponse.json();
        emails = emailsData.items || emailsData.data || emailsData || [];
      } catch {
        results.apiError.push({ email: lead.email, error: "Invalid JSON response" });
        continue;
      }

      // Find reply emails (is_reply = true or from the lead)
      const replies = emails.filter((e: { is_reply?: boolean }) => e.is_reply === true);

      if (replies.length === 0) {
        // No reply found in API, but we know they replied (email_reply_count > 0)
        // Mark as uncertain for manual review
        results.noReply.push({ email: lead.email });
        continue;
      }

      // Get the reply text (combine all replies)
      const replyTexts = replies.map((r: { body?: { text?: string; html?: string }; subject?: string }) => {
        const text = r.body?.text || r.body?.html || "";
        const subject = r.subject || "";
        return `${subject} ${text}`.trim();
      });

      const combinedReply = replyTexts.join(" ").substring(0, 2000); // Limit length

      // Classify the reply
      const classification = classifyReply(combinedReply);
      const replyPreview = combinedReply.substring(0, 100).replace(/\n/g, " ");

      switch (classification.classification) {
        case "NEGATIVE":
          results.negative.push({
            email: lead.email,
            reason: classification.reason,
            replyPreview,
          });
          break;
        case "POSITIVE":
          results.positive.push({
            email: lead.email,
            reason: classification.reason,
          });
          break;
        case "UNCERTAIN":
          results.uncertain.push({
            email: lead.email,
            reason: classification.reason,
            replyPreview,
          });
          break;
      }

      // Small delay to avoid rate limiting
      await sleep(100);

    } catch (err) {
      results.apiError.push({
        email: lead.email,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  // ============================================
  // PRINT RESULTS
  // ============================================

  console.log("\n" + "=".repeat(60));
  console.log("CLASSIFICATION RESULTS");
  console.log("=".repeat(60));

  console.log(`\n✅ POSITIVE (keep is_positive_reply=true): ${results.positive.length}`);
  if (results.positive.length > 0 && results.positive.length <= 20) {
    results.positive.forEach(r => console.log(`   - ${r.email}: ${r.reason}`));
  }

  console.log(`\n❌ NEGATIVE (set is_positive_reply=false): ${results.negative.length}`);
  results.negative.forEach(r => {
    console.log(`   - ${r.email}`);
    console.log(`     Reason: ${r.reason}`);
    console.log(`     Preview: "${r.replyPreview}..."`);
  });

  console.log(`\n❓ UNCERTAIN (needs manual review): ${results.uncertain.length}`);
  results.uncertain.forEach(r => {
    console.log(`   - ${r.email}`);
    console.log(`     Preview: "${r.replyPreview}..."`);
  });

  console.log(`\n📭 NO REPLY FOUND IN API: ${results.noReply.length}`);
  if (results.noReply.length <= 20) {
    results.noReply.forEach(r => console.log(`   - ${r.email}`));
  }

  console.log(`\n⚠️  API ERRORS: ${results.apiError.length}`);
  if (results.apiError.length <= 10) {
    results.apiError.forEach(r => console.log(`   - ${r.email}: ${r.error}`));
  }

  // ============================================
  // UPDATE DATABASE (if not dry run)
  // ============================================

  console.log("\n" + "=".repeat(60));
  console.log(DRY_RUN ? "DRY RUN - No changes made" : "UPDATING DATABASE");
  console.log("=".repeat(60));

  if (!DRY_RUN && results.negative.length > 0) {
    console.log(`\nUpdating ${results.negative.length} leads to is_positive_reply=false...`);

    for (const lead of results.negative) {
      const { error } = await supabase
        .from("leads")
        .update({ is_positive_reply: false })
        .eq("campaign_id", CAMPAIGN_ID)
        .ilike("email", lead.email);

      if (error) {
        console.error(`Error updating ${lead.email}:`, error);
      }
    }

    console.log("Done!");

    // Final count
    const { count } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("campaign_id", CAMPAIGN_ID)
      .eq("is_positive_reply", true);

    console.log(`\nFinal is_positive_reply=true count: ${count}`);
  }

  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total processed: ${positiveLeads?.length || 0}`);
  console.log(`Positive (keep): ${results.positive.length}`);
  console.log(`Negative (remove): ${results.negative.length}`);
  console.log(`Uncertain (review): ${results.uncertain.length}`);
  console.log(`No reply data: ${results.noReply.length}`);
  console.log(`API errors: ${results.apiError.length}`);

  if (DRY_RUN) {
    console.log(`\n⚠️  This was a DRY RUN. To apply changes, set DRY_RUN = false`);
  }
}

main().catch(console.error);
