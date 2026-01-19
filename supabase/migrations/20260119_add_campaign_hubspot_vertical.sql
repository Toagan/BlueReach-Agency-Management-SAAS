-- Add HubSpot vertical field to campaigns table
-- This allows setting the vertical/industry for HubSpot sync per campaign

ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS hubspot_vertical text;

-- Add comment explaining the field
COMMENT ON COLUMN campaigns.hubspot_vertical IS 'The vertical/industry to sync to HubSpot for leads from this campaign (e.g., Fintechs, Universities, Asset Managers, Hedge Funds)';
