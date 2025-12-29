import { createClient } from "@supabase/supabase-js";
import { fetchAllLeadsForCampaign } from "../src/lib/instantly/leads";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function syncAllLeads() {
  console.log("Starting full lead sync...\n");

  // Get all clients
  const { data: clients, error: clientsError } = await supabase
    .from("clients")
    .select("id, name");

  if (clientsError) {
    console.error("Failed to fetch clients:", clientsError);
    return;
  }

  console.log(`Found ${clients.length} clients\n`);

  let totalUpdated = 0;
  let totalPositive = 0;

  for (const client of clients) {
    console.log(`\nProcessing client: ${client.name}`);

    // Get all campaigns for this client
    const { data: campaigns, error: campaignsError } = await supabase
      .from("campaigns")
      .select("id, name, instantly_campaign_id")
      .eq("client_id", client.id);

    if (campaignsError || !campaigns) {
      console.error(`  Failed to fetch campaigns:`, campaignsError);
      continue;
    }

    console.log(`  Found ${campaigns.length} campaigns`);

    for (const campaign of campaigns) {
      if (!campaign.instantly_campaign_id) {
        console.log(`  Skipping ${campaign.name} - no Instantly ID`);
        continue;
      }

      console.log(`  Syncing: ${campaign.name}`);

      try {
        const leads = await fetchAllLeadsForCampaign(campaign.instantly_campaign_id);
        console.log(`    Fetched ${leads.length} leads from Instantly`);

        let campaignUpdated = 0;
        let campaignPositive = 0;

        for (const lead of leads) {
          const isPositiveReply = lead.interest_status === "interested";
          if (isPositiveReply) campaignPositive++;

          // Map status
          let status = "contacted";
          if (lead.interest_status === "interested") {
            status = "replied";
          } else if (lead.interest_status === "not_interested") {
            status = "not_interested";
          }

          // Update or insert lead
          const { data: existingLead } = await supabase
            .from("leads")
            .select("id")
            .eq("campaign_id", campaign.id)
            .eq("email", lead.email)
            .single();

          if (existingLead) {
            const { error } = await supabase
              .from("leads")
              .update({
                first_name: lead.first_name || undefined,
                last_name: lead.last_name || undefined,
                company_name: lead.company_name || undefined,
                phone: lead.phone || undefined,
                instantly_lead_id: lead.id,
                is_positive_reply: isPositiveReply,
                status: status,
                client_id: client.id,
                client_name: client.name,
                campaign_name: campaign.name,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingLead.id);

            if (!error) campaignUpdated++;
          } else {
            const { error } = await supabase.from("leads").insert({
              campaign_id: campaign.id,
              client_id: client.id,
              client_name: client.name,
              campaign_name: campaign.name,
              email: lead.email,
              first_name: lead.first_name || null,
              last_name: lead.last_name || null,
              company_name: lead.company_name || null,
              phone: lead.phone || null,
              status: status,
              is_positive_reply: isPositiveReply,
              instantly_lead_id: lead.id,
            });

            if (!error) campaignUpdated++;
          }
        }

        console.log(`    Updated: ${campaignUpdated}, Positive: ${campaignPositive}`);
        totalUpdated += campaignUpdated;
        totalPositive += campaignPositive;
      } catch (error) {
        console.error(`    Error syncing:`, error);
      }
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`SYNC COMPLETE`);
  console.log(`Total leads updated: ${totalUpdated}`);
  console.log(`Total positive replies: ${totalPositive}`);
}

syncAllLeads().catch(console.error);
