require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function addColumn() {
  // Add cached_variant_stats column
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      ALTER TABLE campaigns 
      ADD COLUMN IF NOT EXISTS cached_variant_stats JSONB DEFAULT NULL;
      
      ALTER TABLE campaigns 
      ADD COLUMN IF NOT EXISTS variant_stats_updated_at TIMESTAMPTZ DEFAULT NULL;
    `
  });
  
  if (error) {
    console.log('RPC error (expected if function doesnt exist):', error.message);
    console.log('\nRun this SQL manually in Supabase dashboard:');
    console.log(`
ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS cached_variant_stats JSONB DEFAULT NULL;

ALTER TABLE campaigns 
ADD COLUMN IF NOT EXISTS variant_stats_updated_at TIMESTAMPTZ DEFAULT NULL;
    `);
  } else {
    console.log('Columns added successfully');
  }
}

addColumn().catch(console.error);
