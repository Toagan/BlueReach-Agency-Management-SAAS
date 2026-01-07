# Stats Report Email System - Technical Documentation

## Overview

This document provides a comprehensive technical explanation of the periodic stats report email system for BlueReach SaaS. This system sends automated email reports containing campaign performance metrics to configured recipients.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TRIGGER LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Cron Job (scheduled)     → GET/POST /api/cron/stats-report?secret=XXX   │
│  2. Manual Test (UI button)  → GET /api/cron/stats-report?clientId=XXX      │
│  3. Custom Test (API)        → GET /api/cron/stats-report?clientId=X&to=Y   │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CRON ENDPOINT                                      │
│                  /api/cron/stats-report/route.ts                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Authenticate (optional CRON_SECRET)                                      │
│  2. Determine which clients need reports (from settings table)               │
│  3. For each client:                                                         │
│     a. Get date range based on interval (daily/weekly/monthly/all-time)     │
│     b. Query leads table for stats                                           │
│     c. Call sendStatsReport()                                                │
│     d. Update last_sent timestamp                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EMAIL SEND FUNCTION                                  │
│                      /lib/email/send.ts                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. Get Resend API client                                                    │
│  2. Determine recipients:                                                    │
│     - Custom recipients (if provided via params)                             │
│     - OR notification_users setting for client                               │
│     - OR fallback to all admin users                                         │
│  3. Render email template (React Email)                                      │
│  4. Send via Resend API                                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EMAIL TEMPLATE                                      │
│               /lib/email/templates/StatsReport.tsx                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  React Email component with:                                                 │
│  - Period label and date range                                               │
│  - Stats grid: Emails Sent, Replies, Positive Replies                        │
│  - Period-over-period comparison (if previousStats provided)                 │
│  - Reply rate calculation                                                    │
│  - CTA button to dashboard                                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Schema

### Settings Table (key-value store)

```sql
-- Stats report interval per client
key: "client_{clientId}_stats_report_interval"
value: "disabled" | "daily" | "weekly" | "monthly"

-- Last report sent timestamp
key: "client_{clientId}_stats_report_last_sent"
value: "2026-01-07T00:13:00.000Z" (ISO timestamp)

-- Notification recipients (shared with positive reply notifications)
key: "client_{clientId}_notification_users"
value: '["user-uuid-1", "user-uuid-2"]' (JSON array of user IDs)
```

### Leads Table (source of stats)

```sql
CREATE TABLE leads (
  id UUID PRIMARY KEY,
  client_id UUID REFERENCES clients(id),    -- Used for filtering
  email TEXT NOT NULL,
  has_replied BOOLEAN DEFAULT FALSE,        -- TRUE if lead replied
  is_positive_reply BOOLEAN DEFAULT FALSE,  -- TRUE if positive sentiment
  responded_at TIMESTAMPTZ,                 -- When they replied (for date filtering)
  created_at TIMESTAMPTZ,                   -- When lead was created/contacted
  -- ... other fields
);
```

### Profiles Table (for recipients)

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  role TEXT  -- 'admin' or 'client'
);
```

---

## Stats Calculation Logic

### For "all-time" interval:

```typescript
// Count ALL leads for this client (no date filter)
const { count: totalLeads } = await supabase
  .from("leads")
  .select("*", { count: "exact", head: true })
  .eq("client_id", clientId);

// Count ALL leads with has_replied=true
const { count: totalReplies } = await supabase
  .from("leads")
  .select("*", { count: "exact", head: true })
  .eq("client_id", clientId)
  .eq("has_replied", true);

// Count ALL leads with is_positive_reply=true
const { count: totalPositive } = await supabase
  .from("leads")
  .select("*", { count: "exact", head: true })
  .eq("client_id", clientId)
  .eq("is_positive_reply", true);

emailsSent = totalLeads;  // Total leads = emails sent
replies = totalReplies;
positiveReplies = totalPositive;
replyRate = (replies / emailsSent) * 100;
```

### For date-range intervals (daily/weekly/monthly):

```typescript
// Count leads CREATED in the date range
const { count: leadsCount } = await supabase
  .from("leads")
  .select("*", { count: "exact", head: true })
  .eq("client_id", clientId)
  .gte("created_at", startDateStr)
  .lte("created_at", endDateStr);

// Count replies WHERE responded_at is in the date range
const { count: repliesCount } = await supabase
  .from("leads")
  .select("*", { count: "exact", head: true })
  .eq("client_id", clientId)
  .eq("has_replied", true)
  .gte("responded_at", startDateStr)
  .lte("responded_at", endDateStr);

// Count positive replies WHERE responded_at is in the date range
const { count: positiveCount } = await supabase
  .from("leads")
  .select("*", { count: "exact", head: true })
  .eq("client_id", clientId)
  .eq("is_positive_reply", true)
  .gte("responded_at", startDateStr)
  .lte("responded_at", endDateStr);
```

---

## Date Range Definitions

| Interval | Start Date | End Date | Previous Period |
|----------|------------|----------|-----------------|
| daily | Yesterday 00:00 | Today 23:59 | Day before yesterday |
| weekly | 7 days ago 00:00 | Today 23:59 | Previous 7 days |
| monthly | 30 days ago 00:00 | Today 23:59 | Previous 30 days |
| all-time | Jan 1, 2020 | Today 23:59 | N/A (no comparison) |

---

## Recipient Resolution

Priority order:
1. **Custom recipients** (if `customRecipients` param provided) - for testing
2. **Client notification users** (from `client_{id}_notification_users` setting)
3. **All admin users** (fallback if no setting exists)

```typescript
// Step 1: Check for custom recipients
if (params.customRecipients && params.customRecipients.length > 0) {
  recipients = params.customRecipients;
}
// Step 2: Check client-specific notification preferences
else {
  const settingKey = `client_${params.clientId}_notification_users`;
  const { data: prefsSetting } = await supabase
    .from("settings")
    .select("value")
    .eq("key", settingKey)
    .single();

  if (prefsSetting?.value) {
    enabledUserIds = JSON.parse(prefsSetting.value);
  }
  // Step 3: Fallback to all admins
  else {
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("role", "admin");
    enabledUserIds = adminProfiles?.map((p) => p.id) || [];
  }
}
```

---

## API Endpoints

### GET/POST `/api/cron/stats-report`

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| secret | string | No* | CRON_SECRET for auth (required if env var set) |
| clientId | string | No | Force report for specific client |
| interval | string | No | Override interval (daily/weekly/monthly/all-time) |
| to | string | No | Custom recipient emails (comma-separated) |
| cc | string | No | CC recipient emails (comma-separated) |

**Response:**

```json
{
  "success": true,
  "message": "Stats reports sent for 1 clients",
  "reportsSent": 1,
  "totalRecipients": 2,
  "results": [
    {
      "clientId": "b45861a9-...",
      "clientName": "Almaron",
      "success": true,
      "sentTo": ["user@example.com"],
      "error": null
    }
  ],
  "version": "v2-alltime-fix"
}
```

### GET/POST `/api/clients/[clientId]/stats-settings`

**GET Response:**
```json
{
  "interval": "weekly",
  "lastSent": "2026-01-07T00:13:00.000Z"
}
```

**POST Body:**
```json
{
  "interval": "weekly"  // "disabled" | "daily" | "weekly" | "monthly"
}
```

---

## Email Service Configuration

### Resend API

The system uses Resend for email delivery. API key resolution:

1. Check `settings` table for key `resend_api_key`
2. Fallback to `RESEND_API_KEY` environment variable

### Branding Settings

Retrieved from `settings` table:

| Key | Default | Description |
|-----|---------|-------------|
| agency_name | "BlueReach" | Shown in email header/footer |
| agency_logo_url | null | Logo in email |
| agency_sender_name | "Tilman Schepke \| BlueReach" | From name |
| agency_sender_email | "noreply@blue-reach.com" | From email |
| agency_primary_color | "#0052FF" | Button/accent color |

---

## Potential Issues & Considerations

### 1. Stats Accuracy

**Issue:** The `emailsSent` metric counts leads in the `leads` table, NOT actual emails sent.

- A lead may receive multiple emails (sequence steps)
- The `lead_emails` table tracks actual emails but is sparsely populated (only synced emails)

**Current Behavior:** `emailsSent` = total leads contacted (1 lead = 1 "email sent")

**Recommendation:** This is acceptable for high-level reporting. For exact email counts, would need to ensure all emails are synced to `lead_emails` table.

### 2. Date Filtering for Replies

**Issue:** For date-range reports, replies are filtered by `responded_at`.

- If `responded_at` is NULL for some replied leads, they won't be counted
- Historical data may have NULL `responded_at` values

**Current Behavior:** Only counts replies where `responded_at` is within the date range.

**Recommendation:** Ensure webhooks/sync always populate `responded_at` when `has_replied` is set to true.

### 3. Reply Rate > 100%

**Possible Cause:** If replies/positive replies are counted differently than emails sent.

Example scenario:
- Leads created: 100 (in current period)
- Replies: 150 (includes replies from leads created in previous periods)

**Current Fix for All-Time:** Uses same base query (all leads for client) for both numerator and denominator.

### 4. Cron Job Scheduling

**Not Yet Implemented:** The cron endpoint exists but no scheduler is configured.

**Required Setup:**
- Railway Cron, Vercel Cron, or external service (e.g., cron-job.org)
- Call `GET /api/cron/stats-report?secret=YOUR_CRON_SECRET` on schedule
- Recommended: Daily at 8:00 AM (to catch daily/weekly/monthly reports)

### 5. Timezone Handling

**Current Behavior:** Uses server timezone (likely UTC on Railway).

- `formatDateRange()` uses "en-US" locale
- Date calculations use `new Date()` without timezone specification

**Consideration:** For clients in different timezones, "yesterday" may not align with their local day.

---

## File Locations

```
src/
├── app/
│   └── api/
│       ├── cron/
│       │   └── stats-report/
│       │       └── route.ts          # Cron endpoint
│       └── clients/
│           └── [clientId]/
│               └── stats-settings/
│                   └── route.ts      # Settings API
├── lib/
│   └── email/
│       ├── index.ts                  # Exports
│       ├── send.ts                   # sendStatsReport function
│       └── templates/
│           └── StatsReport.tsx       # Email template
└── app/
    └── admin/
        └── clients/
            └── [clientId]/
                └── settings/
                    └── page.tsx      # UI for interval settings
```

---

## Testing

### Send Test Report via API

```bash
# Send to custom recipients
curl "https://your-app.com/api/cron/stats-report?clientId=CLIENT_UUID&interval=all-time&to=test@example.com&cc=cc@example.com"

# Send to configured notification recipients
curl "https://your-app.com/api/cron/stats-report?clientId=CLIENT_UUID&interval=weekly"
```

### Send Test Report via UI

1. Go to Client Settings page
2. Scroll to "Stats Reports" section
3. Click "Send Now" button

---

## Version History

- **v1:** Initial implementation - counted from `lead_emails` table (sparse data)
- **v2-alltime-fix:** Fixed to count from `leads` table directly for accurate totals

---

## Questions for Review

1. Is the assumption "1 lead = 1 email sent" acceptable for reporting purposes?
2. Should we track actual email send counts separately from lead counts?
3. Is the `responded_at` field reliably populated for all replied leads?
4. Do we need timezone-aware date calculations for international clients?
5. Should the cron job check if a report was already sent today before sending?
