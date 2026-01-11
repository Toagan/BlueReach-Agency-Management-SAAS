require('dotenv').config({ path: '.env.local' });

async function test() {
  const apiKey = 'REDACTED_SMARTLEAD_API_KEY';
  const campaignId = '2413311';
  const baseUrl = 'https://server.smartlead.ai/api/v1';

  // Test different limits
  console.log('Testing limit=100...');
  const res100 = await fetch(`${baseUrl}/campaigns/${campaignId}/statistics?api_key=${apiKey}&limit=100&offset=0`);
  const data100 = await res100.json();
  console.log('limit=100 status:', res100.status, 'records:', data100.data?.length || 0);

  console.log('\nTesting limit=500...');
  const res500 = await fetch(`${baseUrl}/campaigns/${campaignId}/statistics?api_key=${apiKey}&limit=500&offset=0`);
  const data500 = await res500.json();
  console.log('limit=500 status:', res500.status, 'records:', data500.data?.length || 0);

  console.log('\nTesting limit=1000...');
  const res1000 = await fetch(`${baseUrl}/campaigns/${campaignId}/statistics?api_key=${apiKey}&limit=1000&offset=0`);
  const data1000 = await res1000.json();
  console.log('limit=1000 status:', res1000.status, 'records:', data1000.data?.length || 0);

  // Test parallel requests
  console.log('\nTesting 5 parallel requests...');
  const start = Date.now();
  const promises = [];
  for (let i = 0; i < 5; i++) {
    promises.push(
      fetch(`${baseUrl}/campaigns/${campaignId}/statistics?api_key=${apiKey}&limit=100&offset=${i * 100}`)
        .then(r => r.json())
        .then(d => d.data?.length || 0)
    );
  }
  const results = await Promise.all(promises);
  console.log('Parallel results:', results, 'time:', Date.now() - start, 'ms');
}

test().catch(console.error);
