# Cron Job Setup - Analytics Sync

## Overview

The analytics sync should run **once daily** to pull the latest campaign analytics from Instantly and store them in Supabase.

## Endpoint

```
POST /api/admin/analytics/sync
```

This endpoint:
- Fetches all campaign analytics from Instantly API
- Stores/updates them in the `analytics_snapshots` table
- Returns sync status with count of synced campaigns

## Setup Options

### Option 1: Vercel Cron (Recommended for Vercel deployments)

1. Create `vercel.json` in your project root:

```json
{
  "crons": [
    {
      "path": "/api/admin/analytics/sync",
      "schedule": "0 6 * * *"
    }
  ]
}
```

This runs daily at 6:00 AM UTC.

2. Add a cron secret for security. In your `.env`:

```env
CRON_SECRET=your-secure-random-string
```

3. Update the sync route to verify the cron secret (optional but recommended).

### Option 2: External Cron Service

Use services like:
- **cron-job.org** (free)
- **EasyCron**
- **Upstash QStash**

Configure them to call:
```
POST https://your-domain.com/api/admin/analytics/sync
```

Schedule: `0 6 * * *` (daily at 6 AM)

### Option 3: GitHub Actions

Create `.github/workflows/sync-analytics.yml`:

```yaml
name: Sync Analytics Daily

on:
  schedule:
    - cron: '0 6 * * *'  # Daily at 6 AM UTC
  workflow_dispatch:  # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Sync Analytics
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/admin/analytics/sync \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}"
```

Add secrets in GitHub:
- `APP_URL`: Your deployed app URL
- `CRON_SECRET`: Secret for authentication

### Option 4: Supabase Edge Functions + pg_cron

If using Supabase, you can use pg_cron extension:

```sql
-- Enable pg_cron (requires Supabase Pro plan)
SELECT cron.schedule(
  'sync-instantly-analytics',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://your-domain.com/api/admin/analytics/sync',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
```

## Manual Sync

You can always trigger a manual sync:

```bash
curl -X POST https://your-domain.com/api/admin/analytics/sync
```

Or from the browser console:
```javascript
fetch('/api/admin/analytics/sync', { method: 'POST' })
  .then(r => r.json())
  .then(console.log)
```

## Monitoring

Check the `analytics_snapshots` table in Supabase to verify syncs are working:

```sql
SELECT snapshot_date, COUNT(*) as campaigns_synced
FROM analytics_snapshots
GROUP BY snapshot_date
ORDER BY snapshot_date DESC
LIMIT 7;
```

## Recommended Schedule

- **Daily sync**: `0 6 * * *` (6 AM UTC) - recommended
- **Twice daily**: `0 6,18 * * *` (6 AM and 6 PM UTC)
- **Hourly** (if needed): `0 * * * *`

Daily sync is usually sufficient since Instantly analytics don't change frequently.
