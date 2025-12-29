-- ============================================
-- PRESERVE LEADS MIGRATION
-- Keeps leads when clients/campaigns are deleted
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Drop existing views that depend on leads table
DROP VIEW IF EXISTS positive_replies CASCADE;
DROP VIEW IF EXISTS campaign_performance CASCADE;
DROP VIEW IF EXISTS all_leads_with_history CASCADE;

-- 2. Add client_id and client_name directly to leads (denormalized for preservation)
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS client_name text,
ADD COLUMN IF NOT EXISTS campaign_name text;

-- 3. Change campaign foreign key from CASCADE to SET NULL
-- First, drop the existing constraint
ALTER TABLE leads
DROP CONSTRAINT IF EXISTS leads_campaign_id_fkey;

-- Re-add with SET NULL instead of CASCADE
ALTER TABLE leads
ADD CONSTRAINT leads_campaign_id_fkey
FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

-- 4. Backfill client_id, client_name, and campaign_name for existing leads
UPDATE leads l
SET
  client_id = c.client_id,
  client_name = cl.name,
  campaign_name = c.name
FROM campaigns c
JOIN clients cl ON c.client_id = cl.id
WHERE l.campaign_id = c.id
  AND (l.client_id IS NULL OR l.client_name IS NULL OR l.campaign_name IS NULL);

-- 5. Create index for client_id lookups
CREATE INDEX IF NOT EXISTS idx_leads_client_id ON leads(client_id);

-- 6. Create a trigger to auto-populate client info when lead is created/updated
CREATE OR REPLACE FUNCTION populate_lead_client_info()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if campaign_id is set and client fields are empty
  IF NEW.campaign_id IS NOT NULL AND (NEW.client_id IS NULL OR NEW.client_name IS NULL OR NEW.campaign_name IS NULL) THEN
    SELECT c.client_id, cl.name, c.name
    INTO NEW.client_id, NEW.client_name, NEW.campaign_name
    FROM campaigns c
    JOIN clients cl ON c.client_id = cl.id
    WHERE c.id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_populate_lead_client_info ON leads;
CREATE TRIGGER trigger_populate_lead_client_info
  BEFORE INSERT OR UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION populate_lead_client_info();

-- 7. Recreate the positive_replies view with denormalized fields
CREATE OR REPLACE VIEW positive_replies AS
SELECT
  l.id,
  l.email,
  l.first_name,
  l.last_name,
  l.company_name,
  l.phone,
  l.status,
  l.is_positive_reply,
  l.notes,
  l.metadata,
  l.created_at,
  l.updated_at,
  l.campaign_id,
  l.client_id,
  COALESCE(l.campaign_name, c.name) as campaign_name,
  COALESCE(l.client_name, cl.name) as client_name,
  (SELECT COUNT(*) FROM activities a WHERE a.lead_id = l.id) as activity_count,
  (SELECT MAX(created_at) FROM activities a WHERE a.lead_id = l.id) as last_activity_at
FROM leads l
LEFT JOIN campaigns c ON l.campaign_id = c.id
LEFT JOIN clients cl ON COALESCE(l.client_id, c.client_id) = cl.id
WHERE l.is_positive_reply = true
ORDER BY l.updated_at DESC;

-- 8. Recreate campaign_performance view
CREATE OR REPLACE VIEW campaign_performance AS
SELECT
  c.id as campaign_id,
  c.name as campaign_name,
  cl.name as client_name,
  COUNT(DISTINCT l.id) as total_leads,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'opened') as opened_count,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'clicked') as clicked_count,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'replied') as replied_count,
  COUNT(DISTINCT l.id) FILTER (WHERE l.is_positive_reply = true) as positive_reply_count,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'booked') as booked_count,
  COUNT(DISTINCT l.id) FILTER (WHERE l.status = 'won') as won_count,
  COALESCE(SUM(l.deal_value) FILTER (WHERE l.status = 'won'), 0) as total_deal_value
FROM campaigns c
JOIN clients cl ON c.client_id = cl.id
LEFT JOIN leads l ON l.campaign_id = c.id
GROUP BY c.id, c.name, cl.name;

-- 9. Create a view to see all leads with their client info (even deleted clients)
CREATE OR REPLACE VIEW all_leads_with_history AS
SELECT
  l.id,
  l.email,
  l.first_name,
  l.last_name,
  l.company_name,
  l.phone,
  l.status,
  l.is_positive_reply,
  l.notes,
  l.instantly_lead_id,
  l.metadata,
  l.created_at,
  l.updated_at,
  -- Client info (preserved even after deletion)
  l.client_id,
  COALESCE(l.client_name, cl.name, 'Deleted Client') as client_name,
  -- Campaign info (preserved even after deletion)
  l.campaign_id,
  COALESCE(l.campaign_name, c.name, 'Deleted Campaign') as campaign_name,
  -- Current status
  CASE
    WHEN l.campaign_id IS NULL AND l.client_id IS NULL THEN 'orphaned'
    WHEN c.id IS NULL THEN 'campaign_deleted'
    WHEN cl.id IS NULL THEN 'client_deleted'
    ELSE 'active'
  END as record_status
FROM leads l
LEFT JOIN campaigns c ON l.campaign_id = c.id
LEFT JOIN clients cl ON COALESCE(l.client_id, c.client_id) = cl.id
ORDER BY l.created_at DESC;

-- ============================================
-- DONE! Leads will now be preserved.
-- ============================================

-- Summary:
-- - Dropped and recreated views
-- - Added client_id, client_name, campaign_name columns to leads
-- - Changed campaign_id foreign key from CASCADE to SET NULL
-- - Backfilled existing leads with client/campaign info
-- - Created trigger to auto-populate on insert/update
-- - Recreated views to use denormalized data
