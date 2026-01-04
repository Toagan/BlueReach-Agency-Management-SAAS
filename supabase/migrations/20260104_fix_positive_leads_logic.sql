-- Fix for positive leads data corruption
--
-- Issue: The sync-leads endpoint was incorrectly setting is_positive_reply = true
-- based on interestStatus from the Instantly /leads/list API. However, this API
-- does NOT return interest_status for regular leads - it only returns it when
-- filtering by interest_status. This caused ~11,000+ leads to be incorrectly
-- marked as positive.
--
-- Fix applied in code:
-- 1. sync-leads/route.ts: Removed the incorrect positive marking logic
--    Now only marks negative statuses (not_interested) explicitly
-- 2. sync-leads/route.ts: Added reset before fetchPositiveLeads()
--    Resets is_positive_reply=false before fetching and marking actual positives
-- 3. sync-positive/route.ts: Added client-level reset at start
--    Resets ALL is_positive_reply=false for the client before re-syncing
--
-- To fix existing data:
-- Option 1: Click "Sync from Instantly" button on the client dashboard
--           This will reset + re-sync positive leads automatically
--
-- Option 2: Run manual SQL cleanup (uncomment below):

-- Reset all positive leads for a specific client:
-- UPDATE leads
-- SET is_positive_reply = false
-- WHERE client_id = 'YOUR_CLIENT_UUID_HERE'
-- AND is_positive_reply = true;

-- Then run sync-positive via API or UI to re-mark actual positives

-- Count positive leads per client (diagnostic query):
-- SELECT c.name as client_name,
--        COUNT(*) as positive_count
-- FROM leads l
-- JOIN clients c ON l.client_id = c.id
-- WHERE l.is_positive_reply = true
-- GROUP BY c.id, c.name
-- ORDER BY positive_count DESC;

COMMENT ON COLUMN leads.is_positive_reply IS 'True only for leads with positive interest status in Instantly (interested, meeting_booked, meeting_completed, closed). Reset and re-synced via sync-positive endpoint.';
