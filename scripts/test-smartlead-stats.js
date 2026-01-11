require('dotenv').config({ path: '.env.local' });

async function test() {
  const apiKey = 'REDACTED_SMARTLEAD_API_KEY';
  const campaignId = '2413311';
  const baseUrl = 'https://server.smartlead.ai/api/v1';
  
  const analyticsRes = await fetch(`${baseUrl}/campaigns/${campaignId}/analytics?api_key=${apiKey}`);
  const analytics = await analyticsRes.json();
  
  console.log('campaign_lead_stats:', JSON.stringify(analytics.campaign_lead_stats, null, 2));
  
  // Also check if there's a stats-by-sequence endpoint
  console.log('\nChecking stats by sequence...');
  const statsRes = await fetch(`${baseUrl}/campaigns/${campaignId}/analytics-by-sequence?api_key=${apiKey}`);
  console.log('stats-by-sequence status:', statsRes.status);
  if (statsRes.ok) {
    const stats = await statsRes.json();
    console.log('stats-by-sequence:', JSON.stringify(stats).substring(0, 1000));
  }
}

test().catch(console.error);
