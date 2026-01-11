require('dotenv').config({ path: '.env.local' });

async function test() {
  const apiKey = 'REDACTED_SMARTLEAD_API_KEY';
  const campaignId = '2413311';
  const baseUrl = 'https://server.smartlead.ai/api/v1';
  
  // Try the analytics endpoint that might have variant breakdown
  console.log('Testing campaign analytics endpoint...');
  const analyticsRes = await fetch(`${baseUrl}/campaigns/${campaignId}/analytics?api_key=${apiKey}`);
  const analytics = await analyticsRes.json();
  console.log('Analytics response keys:', Object.keys(analytics));
  console.log('Analytics data (first 500 chars):', JSON.stringify(analytics).substring(0, 500));
  
  // Check if sequences have any sent_count info
  console.log('\nChecking sequence variant data...');
  const seqRes = await fetch(`${baseUrl}/campaigns/${campaignId}/sequences?api_key=${apiKey}`);
  const seqData = await seqRes.json();
  const sequences = Array.isArray(seqData) ? seqData : seqData.email_campaign_sequences || [];
  
  if (sequences[0]?.sequence_variants?.[0]) {
    console.log('First variant keys:', Object.keys(sequences[0].sequence_variants[0]));
    // Check if there's a sent_count or emails_sent field
    const v = sequences[0].sequence_variants[0];
    console.log('First variant data sample:', JSON.stringify(v).substring(0, 500));
  }
}

test().catch(console.error);
