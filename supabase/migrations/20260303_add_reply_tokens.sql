-- Reply tokens: short-lived server-side storage for email compose data.
-- Replaces passing full email thread content in URL query parameters.
CREATE TABLE reply_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_email  text NOT NULL,
  subject     text NOT NULL,
  body        text NOT NULL,
  lead_id     uuid,
  created_at  timestamptz DEFAULT now(),
  used_at     timestamptz
);

CREATE INDEX idx_reply_tokens_created_at ON reply_tokens(created_at);
