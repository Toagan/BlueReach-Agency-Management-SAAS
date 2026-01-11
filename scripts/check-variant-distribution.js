require('dotenv').config({ path: '.env.local' });

async function test() {
  const apiKey = 'REDACTED_SMARTLEAD_API_KEY';
  const campaignId = '2413311';
  const baseUrl = 'https://server.smartlead.ai/api/v1';
  
  const seqRes = await fetch(`${baseUrl}/campaigns/${campaignId}/sequences?api_key=${apiKey}`);
  const seqData = await seqRes.json();
  const sequences = Array.isArray(seqData) ? seqData : seqData.email_campaign_sequences || [];
  
  console.log('Steps:', sequences.length);
  for (const step of sequences) {
    const stepNum = step.seq_number || step.sequence_number;
    const variants = step.sequence_variants || step.seq_variants || [];
    console.log(`\nStep ${stepNum}: ${variants.length} variants`);
    
    for (const v of variants) {
      console.log(`  ${v.variant_label}: ${v.variant_distribution_percentage}% (deleted: ${v.is_deleted})`);
    }
  }
}

test().catch(console.error);
