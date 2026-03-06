-- ============================================
-- FIX: Drop legacy unscoped RLS policy on clients table
-- The original "Admins can manage all clients" policy (from supabase-schema.sql)
-- allows ANY admin to see ALL clients regardless of owner_id.
-- This was never dropped by the multi-tenancy migration because the name
-- didn't match the DROP POLICY statements.
-- ============================================

-- Drop the leaky legacy policy
DROP POLICY IF EXISTS "Admins can manage all clients" ON clients;

-- Also drop any other possible legacy policy names that might exist
DROP POLICY IF EXISTS "Admins can manage all campaigns" ON campaigns;
DROP POLICY IF EXISTS "Admins can manage all leads" ON leads;

-- Verify the correct owner-scoped policies exist
-- (These should already be in place from 20260305_fix_rls_recursion.sql)
-- "Admin can manage own clients" ON clients
-- "Admin can manage own campaigns" ON campaigns
-- "Admin can manage own leads" ON leads
