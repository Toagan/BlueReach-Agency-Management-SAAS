-- ============================================
-- BLUEREACH AGENCY PORTAL - ADD ICP COLUMN
-- ============================================
-- Run this in Supabase SQL Editor
-- This adds the ICP (Ideal Customer Profile) column to clients table
-- ============================================

-- Add ICP column to clients table
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS icp text;

-- Also ensure all Client Intelligence columns exist (in case they're missing)
ALTER TABLE clients
ADD COLUMN IF NOT EXISTS product_service text,
ADD COLUMN IF NOT EXISTS acv numeric,
ADD COLUMN IF NOT EXISTS tcv numeric,
ADD COLUMN IF NOT EXISTS verticals text[],
ADD COLUMN IF NOT EXISTS tam integer,
ADD COLUMN IF NOT EXISTS target_daily_emails integer;

-- Add a comment to document the ICP field
COMMENT ON COLUMN clients.icp IS 'Ideal Customer Profile - describes the target customer characteristics';
COMMENT ON COLUMN clients.product_service IS 'The offer - product or service description';
COMMENT ON COLUMN clients.tam IS 'Total Addressable Market - number of potential leads';
