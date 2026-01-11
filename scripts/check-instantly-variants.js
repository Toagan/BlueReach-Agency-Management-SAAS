// Check variant data for Instantly campaigns
// Run: node scripts/check-instantly-variants.js

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('Checking Instantly campaigns for variant data...\n');

  // Get Instantly campaigns
  const { data: campaigns, error: campaignError } = await supabase
    .from('campaigns')
    .select('id, name, client_id, provider_type, instantly_campaign_id')
    .eq('provider_type', 'instantly')
    .limit(10);

  if (campaignError) {
    console.error('Error fetching campaigns:', campaignError);
    return;
  }

  console.log(`Found ${campaigns.length} Instantly campaigns\n`);

  for (const campaign of campaigns) {
    console.log(`\n========== ${campaign.name} ==========`);
    console.log(`Campaign ID: ${campaign.id}`);

    // Check lead_emails for variant data
    const { data: emails, error: emailError } = await supabase
      .from('lead_emails')
      .select('sequence_step, sequence_variant, sequence_variant_label')
      .eq('campaign_id', campaign.id)
      .eq('direction', 'outbound')
      .not('sequence_step', 'is', null)
      .limit(100);

    if (emailError) {
      console.log('Error fetching emails:', emailError.message);
    } else {
      const withVariant = emails.filter(e => e.sequence_variant !== null);
      console.log(`Outbound emails with step: ${emails.length}`);
      console.log(`Emails with variant data: ${withVariant.length}`);

      if (withVariant.length > 0) {
        // Group by variant
        const variants = {};
        for (const e of withVariant) {
          const key = `Step ${e.sequence_step} - ${e.sequence_variant_label || 'Variant ' + e.sequence_variant}`;
          variants[key] = (variants[key] || 0) + 1;
        }
        console.log('Variants found:', variants);
      }
    }

    // Check leads for reply variant data
    const { data: leads, error: leadError } = await supabase
      .from('leads')
      .select('reply_from_step, reply_from_variant, reply_from_variant_label, is_positive_reply')
      .eq('campaign_id', campaign.id)
      .eq('has_replied', true)
      .not('reply_from_step', 'is', null);

    if (leadError) {
      console.log('Error fetching leads:', leadError.message);
    } else {
      console.log(`Leads with reply variant data: ${leads.length}`);

      if (leads.length > 0) {
        // Group by variant
        const replyVariants = {};
        let positiveCount = 0;
        for (const l of leads) {
          const key = `Step ${l.reply_from_step} - ${l.reply_from_variant_label || 'Variant ' + l.reply_from_variant}`;
          replyVariants[key] = (replyVariants[key] || 0) + 1;
          if (l.is_positive_reply) positiveCount++;
        }
        console.log('Reply variants:', replyVariants);
        console.log('Positive replies:', positiveCount);
      }
    }

    // Also check total replied leads without variant data
    const { count: totalReplied } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('has_replied', true);

    const { count: repliedWithVariant } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_id', campaign.id)
      .eq('has_replied', true)
      .not('reply_from_step', 'is', null);

    console.log(`\nTotal replied: ${totalReplied}, With variant data: ${repliedWithVariant}`);
  }

  console.log('\n\n========== Done ==========');
}

main().catch(console.error);
