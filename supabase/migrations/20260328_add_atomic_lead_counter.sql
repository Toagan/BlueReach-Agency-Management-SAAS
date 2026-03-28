-- Atomic lead counter increment function
-- Prevents race conditions when concurrent webhooks update the same lead's open/click/reply counts
CREATE OR REPLACE FUNCTION increment_lead_counter(
  lead_uuid uuid,
  counter_name text,
  increment_by integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Whitelist allowed counter columns to prevent SQL injection
  IF counter_name NOT IN (
    'email_open_count',
    'email_click_count',
    'email_reply_count'
  ) THEN
    RAISE EXCEPTION 'Invalid counter name: %', counter_name;
  END IF;

  EXECUTE format(
    'UPDATE leads SET %I = COALESCE(%I, 0) + $1, updated_at = now() WHERE id = $2',
    counter_name, counter_name
  )
  USING increment_by, lead_uuid;
END;
$$;
