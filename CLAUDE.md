# Claude Code Project Configuration

This file provides context for Claude Code when working on this project.

## Project Overview

**BlueReach Agency Management Dashboard** - A Next.js 15 SaaS application for lead generation agencies to manage clients, campaigns, and leads with Instantly.ai integration.

### Key Features
- Multi-tenant client portal with role-based access
- Instantly.ai + Smartlead campaign integration with real-time webhooks
- Lead workflow management (contacted → replied → booked → won/lost)
- Email thread viewing and sync
- Infrastructure health monitoring (email accounts, DNS checks, warmup tracking)
- Dark mode modern UI for clients
- Admin command center for agency staff

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.x | App Router, Server Components, API Routes |
| TypeScript | 5.x | Type-safe development |
| React | 19.x | UI framework |
| Supabase | Latest | PostgreSQL database, Auth (Google/Microsoft OAuth), RLS |
| Tailwind CSS | 3.x | Utility-first styling |
| shadcn/ui | Latest | UI component library |
| Lucide React | Latest | Icons |

## Architecture

### Authentication Flow
```
Login (Google/Microsoft OAuth)
    ↓
Supabase Auth Callback (/auth/callback)
    ↓
Check user role from profiles table
    ↓
├── Admin → /admin (Command Center)
└── Client → /admin/clients/[clientId] (Hip UI with restricted permissions)
```

### Role-Based Access
- **Admin** (`profiles.role = 'admin'`): Full access to all routes and features
- **Client** (`profiles.role = 'client'`): Access only to `/admin/clients/[clientId]` for their linked clients
  - Can view analytics, manage lead workflow, add notes
  - Cannot link campaigns, delete campaigns, or access other admin routes

### Middleware Protection
- `/admin/*` routes protected by middleware
- Client users can only access `/admin/clients/[clientId]` if linked via `client_users` table
- Other admin routes blocked for non-admin users

## Project Structure

```
src/
├── app/
│   ├── admin/                    # Admin portal
│   │   ├── clients/[clientId]/   # Client dashboard (used by both admin & clients)
│   │   │   ├── page.tsx          # Main client page with Lead Workflow
│   │   │   ├── campaigns/        # Campaign management
│   │   │   └── settings/         # Client settings
│   │   ├── instantly/            # Instantly integration pages
│   │   ├── leads/                # Lead management
│   │   └── layout.tsx            # Admin layout (dark mode, modern)
│   ├── api/                      # API routes
│   │   ├── clients/              # Client CRUD
│   │   ├── campaigns/            # Campaign operations
│   │   ├── leads/                # Lead operations
│   │   ├── instantly/            # Instantly API proxy
│   │   └── webhooks/             # Webhook handlers
│   ├── auth/                     # Auth callbacks
│   ├── dashboard/                # Legacy client portal (redirects to admin/clients)
│   └── login/                    # OAuth login (Google + Microsoft)
├── components/
│   ├── layout/                   # Layout components
│   ├── leads/                    # Lead-specific components
│   └── ui/                       # shadcn/ui components
├── lib/
│   ├── instantly/                # Instantly API client
│   ├── smartlead/                # Smartlead API client
│   ├── dns/                      # DNS health checker (SPF/DKIM/DMARC)
│   ├── queries/                  # Database query functions
│   └── supabase/                 # Supabase client setup
└── types/
    └── database.ts               # TypeScript types for all tables
```

## Database Schema

### Core Tables

#### `profiles`
User profiles linked to Supabase Auth.
```sql
id          uuid PRIMARY KEY (references auth.users)
email       text
role        text ('admin' | 'client')
full_name   text
```

#### `clients`
Agency clients (companies being served).
```sql
id                  uuid PRIMARY KEY
name                text NOT NULL
logo_url            text
website             text
notes               text
product_service     text
acv                 numeric          -- Average Contract Value
tcv                 numeric          -- Total Contract Value
verticals           text[]           -- Target industries
tam                 integer          -- Total Addressable Market (lead count)
target_daily_emails integer
is_active           boolean
created_at          timestamptz
```

#### `client_users`
Links users to clients they can access.
```sql
client_id   uuid REFERENCES clients(id)
user_id     uuid REFERENCES auth.users(id)
role        text ('owner' | 'manager' | 'member' | 'viewer')
PRIMARY KEY (client_id, user_id)
```

#### `client_invitations`
Pending invitations for client users.
```sql
id          uuid PRIMARY KEY
client_id   uuid REFERENCES clients(id)
email       text NOT NULL
invited_by  uuid
created_at  timestamptz
accepted_at timestamptz  -- NULL until accepted
```

#### `campaigns`
Email campaigns linked to Instantly.
```sql
id                      uuid PRIMARY KEY
client_id               uuid REFERENCES clients(id)
instantly_campaign_id   text             -- ID from Instantly
provider_type           text             -- 'instantly', 'smartlead', etc.
provider_campaign_id    text
name                    text NOT NULL
original_name           text
copy_body               text             -- Email template
is_active               boolean
last_synced_at          timestamptz
```

#### `leads`
All leads with denormalized data for preservation.
```sql
id                  uuid PRIMARY KEY
campaign_id         uuid REFERENCES campaigns(id)
email               text NOT NULL
first_name          text
last_name           text
company_name        text
company_domain      text
phone               text
linkedin_url        text
status              text ('contacted'|'opened'|'clicked'|'replied'|'booked'|'won'|'lost')
is_positive_reply   boolean
has_replied         boolean
responded_at        timestamptz
meeting_at          timestamptz
closed_at           timestamptz
deal_value          numeric
notes               text
instantly_lead_id   text
email_open_count    integer
email_click_count   integer
email_reply_count   integer
metadata            jsonb
created_at          timestamptz
updated_at          timestamptz

-- Denormalized fields (preserved when parent deleted)
client_id           uuid
client_name         text
campaign_name       text
```

#### `lead_emails`
Email thread for each lead.
```sql
id                  uuid PRIMARY KEY
lead_id             uuid REFERENCES leads(id)
campaign_id         uuid REFERENCES campaigns(id)
provider_email_id   text
provider_thread_id  text
direction           text ('outbound' | 'inbound')
from_email          text
to_email            text
subject             text
body_text           text
body_html           text
sequence_step       integer
sent_at             timestamptz
opened_at           timestamptz
replied_at          timestamptz
created_at          timestamptz
```

### Supporting Tables

#### `api_providers`
Multi-provider API key storage.
```sql
id            uuid PRIMARY KEY
client_id     uuid REFERENCES clients(id)
provider_type text ('instantly'|'smartlead'|'lemlist'|'apollo')
api_key       text
workspace_id  text
is_active     boolean
label         text
```

#### `campaign_sequences`
Email sequence templates.
```sql
id              uuid PRIMARY KEY
campaign_id     uuid REFERENCES campaigns(id)
sequence_index  integer
step_number     integer
variant         text ('A', 'B', 'C')
subject         text
body_text       text
body_html       text
delay_days      integer
delay_hours     integer
```

#### `activities`
Activity log for leads.
```sql
id            uuid PRIMARY KEY
lead_id       uuid REFERENCES leads(id)
user_id       uuid
type          text ('call'|'meeting'|'email'|'note'|'status_change')
title         text
description   text
scheduled_at  timestamptz
completed_at  timestamptz
```

#### `email_events`
Tracking events from email providers.
```sql
id                  uuid PRIMARY KEY
lead_id             uuid REFERENCES leads(id)
campaign_id         uuid REFERENCES campaigns(id)
event_type          text ('sent'|'opened'|'clicked'|'replied'|'bounced')
instantly_event_id  text
timestamp           timestamptz
```

### Infrastructure Health Tables

#### `email_accounts`
Central registry of email accounts from Instantly and Smartlead.
```sql
id                    uuid PRIMARY KEY
provider_type         text NOT NULL ('instantly'|'smartlead')
provider_account_id   text
email                 text NOT NULL
client_id             uuid REFERENCES clients(id)  -- Manual assignment
domain                text GENERATED              -- Extracted from email
status                text ('active'|'error'|'disconnected'|'paused')
warmup_enabled        boolean
warmup_reputation     integer                     -- 0-100 score
warmup_emails_sent    integer
warmup_emails_received integer
daily_limit           integer
last_synced_at        timestamptz
UNIQUE(provider_type, email)
```

#### `email_account_health_history`
Daily snapshots for trend analysis.
```sql
id                    uuid PRIMARY KEY
email_account_id      uuid REFERENCES email_accounts(id)
snapshot_date         date NOT NULL
status                text
warmup_reputation     integer
warmup_emails_sent    integer
warmup_emails_received integer
emails_sent_today     integer
UNIQUE(email_account_id, snapshot_date)
```

#### `domain_health`
DNS validation cache for SPF/DKIM/DMARC.
```sql
id                uuid PRIMARY KEY
domain            text NOT NULL UNIQUE
has_spf           boolean
spf_record        text
spf_valid         boolean
has_dkim          boolean
dkim_selector     text
dkim_record       text
dkim_valid        boolean
has_dmarc         boolean
dmarc_record      text
dmarc_policy      text ('none'|'quarantine'|'reject')
dmarc_valid       boolean
health_score      integer GENERATED  -- 0-100 based on DNS records
last_checked_at   timestamptz
```

### Row Level Security (RLS)
- All tables have RLS enabled
- Admin users can access all data
- Client users can only access data for their linked clients
- Service role key bypasses RLS for webhook handlers

## Instantly API Integration

### Webhook Flow
```
Instantly Event (lead_interested, email_sent, etc.)
    ↓
POST /api/webhooks/instantly/[campaignId]
    ↓
Update lead status, create lead_emails record
    ↓
Real-time sync to dashboard
```

### API Functions (`src/lib/instantly/`)
- `client.ts` - Base HTTP client with Bearer auth
- `campaigns.ts` - List, activate, pause campaigns
- `leads.ts` - List, create, update leads
- `analytics.ts` - Campaign and account analytics
- `accounts.ts` - Email account management

### Webhook Events Handled
- `lead_interested` → `is_positive_reply = true`
- `lead_not_interested` → `is_positive_reply = false`
- `email_sent` → Increment `emails_sent` counter
- `email_opened` → Increment open count
- `email_replied` → Update `has_replied`, `replied_at`

## Smartlead API Integration

### Authentication
Smartlead uses query parameter auth: `?api_key=YOUR_API_KEY`

### API Functions (`src/lib/smartlead/`)
- `client.ts` - Base HTTP client with query param auth
- `types.ts` - SmartleadAccount, SmartleadWarmupStats interfaces
- `accounts.ts` - Fetch accounts and warmup analytics

### Key Endpoints Used
- `GET /api/v1/email-accounts` - List all email accounts
- `GET /api/v1/email-accounts/{id}/warmup-stats` - Warmup analytics

## Infrastructure Health Feature

### Overview
Monitor email account health across providers with DNS validation.

### API Routes (`/api/admin/infrastructure/`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/stats` | GET | Dashboard statistics |
| `/accounts` | GET | List accounts with filters |
| `/accounts/[id]` | PATCH | Assign client to account |
| `/sync` | POST | Sync from Instantly/Smartlead |
| `/dns` | GET | Get cached domain health |
| `/dns` | POST | Check specific domains |
| `/dns` | PATCH | Refresh all domains |
| `/history` | GET | Historical snapshots |
| `/history` | POST | Create daily snapshot |

### DNS Health Checker (`src/lib/dns/`)
Uses DNS-over-HTTPS (Google DoH) for server-side lookups:
- SPF record validation
- DKIM selector probing (common selectors: google, default, selector1, etc.)
- DMARC policy detection

### UI Features (`/admin/infrastructure`)
- Stats cards: Total accounts, active count, avg reputation, domain count
- Accounts table with client filter, provider filter, status filter
- Client assignment dialog for manual account-to-client mapping
- Domain health section with SPF/DKIM/DMARC status
- Auto-refresh every 30 seconds

## Key Workflows

### Lead Workflow (Client Dashboard)
1. **Positive Reply** - Lead marked as interested in Instantly
2. **Mark Responded** - User confirms they responded
3. **Schedule Meeting** - User books a meeting
4. **Close Won/Lost** - Deal outcome recorded

### Campaign Sync
1. Fetch campaigns from Instantly API
2. Create/update local campaign records
3. Sync analytics (sent, opened, replied counts)
4. Webhook handles real-time updates

### Client Invitation Flow
1. Admin creates invitation with email
2. Invitation stored in `client_invitations`
3. User signs up/logs in via OAuth
4. Auth callback checks for pending invitation
5. Auto-links user to client via `client_users`

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Instantly
INSTANTLY_API_KEY=
INSTANTLY_WEBHOOK_SECRET=

# Smartlead
SMARTLEAD_API_KEY=

# OAuth (configured in Supabase dashboard)
# Google and Microsoft providers
```

## Coding Conventions

### TypeScript
- Use strict TypeScript with explicit types
- Define interfaces in `src/types/database.ts`
- Use `type` for unions, `interface` for objects

### React/Next.js
- Server Components by default
- Add `"use client"` only when needed
- Use App Router conventions

### API Routes
- Route Handlers in `app/api/`
- Export named functions: `GET`, `POST`, `PUT`, `DELETE`
- Use service role client for webhook handlers (bypasses RLS)

### Styling
- Tailwind CSS exclusively
- Dark mode via CSS variables
- shadcn/ui component patterns

## Important Notes

1. **Role checks in client components** - Fetch user role and conditionally render admin features
2. **Service role for webhooks** - Use `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS
3. **Denormalized lead data** - Always include `client_id`, `client_name`, `campaign_name`
4. **Real-time updates** - Dashboard auto-refreshes every 30 seconds
5. **No emojis** in code unless explicitly requested

## Deployment

- Docker support via `Dockerfile` and `docker-compose.yml`
- Caddy for reverse proxy with auto HTTPS
- Vercel-compatible
