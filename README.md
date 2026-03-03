# BlueReach Agency Management Dashboard

A white-label SaaS platform for lead generation agencies to manage clients, campaigns, leads, and email infrastructure. Integrates with [Instantly.ai](https://instantly.ai), [Smartlead](https://smartlead.ai), and [HubSpot](https://hubspot.com). Built with Next.js, Supabase, and TypeScript.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Provider Integrations](#provider-integrations)
- [Webhooks](#webhooks)
- [Cron Jobs](#cron-jobs)
- [Infrastructure Health Monitoring](#infrastructure-health-monitoring)
- [Email Notifications](#email-notifications)
- [SEO](#seo-1)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

---

## Overview

BlueReach is a multi-tenant agency management platform designed for cold email outreach agencies. It provides:

- **Admin Portal**: Full control over clients, campaigns, leads, analytics, infrastructure, and settings
- **Client Portal**: Role-restricted dashboard for clients to view campaigns, manage lead workflows, and track results
- **Multi-Provider Integration**: Bidirectional sync with Instantly.ai and Smartlead for campaigns and leads, plus HubSpot CRM sync
- **Infrastructure Monitoring**: Email account health tracking, DNS validation (SPF/DKIM/DMARC), and warmup monitoring
- **Real-time Updates**: Webhook-driven data sync from email providers with auto-refreshing dashboards
- **Email Notifications**: Automated alerts for positive replies and weekly stats reports via Resend

---

## Features

### Admin Dashboard (`/admin`)

#### Command Center
- Real-time analytics filtered by time period (this week, this month, this quarter)
  - Leads contacted, emails sent, replies received, positive replies (opportunities)
  - Bounced emails, meetings held, deals closed (cumulative)
- Clickable stats that drill down into the detailed leads view
- Auto-refresh every 30 seconds

#### Client Management (`/admin/clients`)
- Create, edit, and delete clients
- Configure client details: name, website, logo, notes, product/service, ACV/TCV, target verticals, TAM, daily email targets
- Invite client users via email (OAuth-based access with Google/Microsoft)
- Assign roles to client users: owner, manager, member, viewer
- View all campaigns and metrics per client

#### Campaign Management (`/admin/clients/[clientId]`)
- Link campaigns from Instantly or Smartlead to clients
- View campaign performance: total leads, leads contacted (progress bar), emails sent, replies, positive replies
- Sync campaigns and leads from providers
- View campaign email copy/sequences
- Click campaigns to view detailed analytics with variant breakdown
- Export campaign leads to CSV
- Delete campaigns (with confirmation)

#### Campaign Details (`/admin/clients/[clientId]/campaigns/[campaignId]`)
- Detailed campaign statistics with variant-level analytics
- List of positive replies with contact info
- Email thread viewer per lead
- Campaign sequence viewer (multi-step, A/B/C variants)
- Campaign progress visualization
- Campaign diagnostics

#### Lead Management (`/admin/leads`)
- View all leads across all clients (48,000+ supported)
- Server-side filtering by client, status, and positive reply flag
- Lead statuses: `contacted`, `opened`, `clicked`, `replied`, `booked`, `won`, `lost`, `not_interested`
- Pagination: 100 leads per page with navigation
- CSV export options: current filter, positive replies, all replies, no response, all leads
- Click any lead to view/edit details in a slide-out panel

#### Lead Detail Panel
- View complete lead information (email, phone, company, LinkedIn, domain)
- Update lead status through the workflow
- Add/edit notes
- View email thread history (outbound and inbound messages)
- Track email engagement: open count, click count, reply count

#### Lead Workflow (`/admin/clients/[clientId]`)
- Track positive replies through the sales funnel
- Workflow states: Responded, Meeting Scheduled, Closed Won, Closed Lost
- Collapsible UI with summary stats in header
- Quick one-click status updates with date/time selection for meetings
- Notes per workflow stage

#### Lead Database (`/admin/lead-database`)
- Centralized lead database across all clients and campaigns

#### Notes (`/admin/notes`)
- Internal note-taking system for agency operations

#### Subscriptions (`/admin/subscriptions`)
- Track API credits and subscription status across providers
- Live sync of remaining credits

#### AI Campaigns (`/admin/ai-campaigns`)
- AI-assisted campaign creation and management

#### Scraping (`/admin/scraping`)
- Lead scraping and enrichment tools

#### Infrastructure Health (`/admin/infrastructure`)
- Monitor email account health across Instantly and Smartlead
- DNS validation: SPF, DKIM, and DMARC record checking
- Warmup tracking: reputation scores, emails sent/received
- Daily health snapshots for trend analysis
- Client-to-account assignment
- Filter by provider, status, or client
- Auto-refresh every 30 seconds

#### Agency Settings (`/admin/settings`)
- Agency logo upload
- API key management (Instantly, Smartlead)
- Webhook configuration
- Notification preferences

#### Instantly Integration Page (`/admin/instantly`)
- Connection status and API health
- Campaign sync and management
- Lead sync (bidirectional)
- Email account management with warmup status
- Provider-specific analytics

### Client Portal (`/admin/clients/[clientId]` with client role)

- OAuth login via Google or Microsoft
- View all campaigns assigned to their account
- Lead statistics: contacted, replied, positive replies, meetings, deals
- Lead workflow management (respond, schedule meetings, close deals)
- Add notes to leads
- Cannot link/delete campaigns or access other admin routes

### Authentication

- **OAuth**: Google and Microsoft sign-in via Supabase Auth
- **Role-Based Access**: Admin (full access) and Client (restricted to linked clients)
- **Client Invitations**: Admin invites client users by email; auto-linked on first login
- **Middleware Protection**: All `/admin/*` routes protected; client users restricted to their linked client pages

### Marketing Pages

- **Landing Page** (`/`): Hero with CSS dashboard mockup, stats bar (4+ hrs saved, 87% retention, etc.), problem/solution cards with mini visuals, "See it in Action" showcase (client dashboard, lead pipeline, Slack notifications), 7-feature grid (including Slack), 6 testimonials with avatar initials, and CTA
- **Features Page** (`/features`): Detailed breakdown of client portals, analytics, and lead management with mock UI visuals
- **Pricing Page** (`/pricing`): 3-tier plan comparison (Starter $49, Growth $99, Agency $249), feature comparison table, FAQ section

### SEO

- **Root metadata** (`layout.tsx`): OpenGraph tags, Twitter cards, keyword targeting, robots directives
- **Page-specific metadata**: Unique title/description for homepage, features, and pricing pages
- **Sitemap** (`/sitemap.xml`): Auto-generated from `sitemap.ts` with all public routes
- **Robots** (`/robots.txt`): Auto-generated from `robots.ts` — allows marketing pages, blocks `/admin`, `/dashboard`, `/api`, `/auth`
- **JSON-LD structured data**:
  - Homepage: `Organization`, `SoftwareApplication` (with pricing and rating), `WebSite` schemas
  - Pricing: `FAQPage` schema for Google rich snippet eligibility

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.x | App Router, Server Components, API Routes |
| **React** | 19.x | UI framework |
| **TypeScript** | 5.x | Type-safe development |
| **Supabase** | Latest | PostgreSQL database, Auth (OAuth), Row Level Security |
| **Tailwind CSS** | 4.x | Utility-first styling |
| **shadcn/ui** | Latest | UI component library (Radix UI primitives) |
| **Lucide React** | Latest | Icon library |
| **Resend** | Latest | Transactional email delivery |
| **React Email** | Latest | Email template rendering |
| **DOMPurify** | Latest | HTML sanitization for email content |
| **Docker** | Latest | Containerized deployment |
| **Caddy** | 2.x | Reverse proxy with automatic HTTPS |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Client Browser                             │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────┐  │
│  │ Admin Portal │  │ Client Portal │  │   Marketing Pages        │  │
│  │  /admin/*    │  │ /admin/clients│  │   /, /features, /pricing │  │
│  └──────────────┘  └───────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Next.js Application                             │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────┐  │
│  │ Server       │  │  API Routes   │  │  Webhook Handlers        │  │
│  │ Components   │  │  /api/*       │  │  /api/webhooks/*         │  │
│  └──────────────┘  └───────────────┘  └──────────────────────────┘  │
│  ┌──────────────┐  ┌───────────────┐  ┌──────────────────────────┐  │
│  │ Middleware   │  │  Auth         │  │  Cron Endpoints          │  │
│  │ (RLS check) │  │  (OAuth)      │  │  /api/cron/*             │  │
│  └──────────────┘  └───────────────┘  └──────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
          │                    │                       │
          ▼                    ▼                       ▼
┌──────────────────┐  ┌────────────────┐  ┌──────────────────────────┐
│    Supabase      │  │  Email         │  │   External Providers     │
│  ┌────────────┐  │  │  Providers     │  │  ┌────────────────────┐  │
│  │ PostgreSQL │  │  │  ┌──────────┐  │  │  │   Instantly API    │  │
│  │ + RLS      │  │  │  │  Resend  │  │  │  │   Smartlead API   │  │
│  ├────────────┤  │  │  └──────────┘  │  │  │   HubSpot API     │  │
│  │ Auth       │  │  └────────────────┘  │  └────────────────────┘  │
│  │ (OAuth)    │  │                      │  ┌────────────────────┐  │
│  ├────────────┤  │                      │  │  Google DoH (DNS)  │  │
│  │ Storage    │  │                      │  └────────────────────┘  │
│  └────────────┘  │                      └──────────────────────────┘
└──────────────────┘
```

### Authentication Flow

```
User clicks "Sign in with Google/Microsoft"
    ↓
Supabase OAuth redirect
    ↓
/auth/callback
    ↓
Check profiles table for role
    ↓
├── role = 'admin'  → Redirect to /admin (Command Center)
└── role = 'client' → Redirect to /admin/clients/[clientId] (restricted view)
```

### Client Invitation Flow

```
Admin creates invitation (email)
    ↓
Invitation stored in client_invitations table
    ↓
Invited user signs in via OAuth
    ↓
/auth/callback checks for pending invitation matching email
    ↓
Auto-links user to client via client_users table
    ↓
Invitation marked as accepted
```

### Data Flow

1. **Instantly/Smartlead → Supabase**: Campaigns and leads sync via API calls or real-time webhooks
2. **Supabase → Next.js**: Server components fetch data directly with RLS enforcement
3. **Next.js → Browser**: React renders the UI with auto-refresh every 30 seconds
4. **Browser → API Routes**: Client-side actions (status updates, workflow changes, exports)
5. **Webhooks → Supabase**: Real-time lead status updates from email providers
6. **Cron → API Routes**: Scheduled analytics snapshots and stats reports

### Role-Based Access Control

| Feature | Admin | Client (Owner/Manager) | Client (Member/Viewer) |
|---------|-------|----------------------|----------------------|
| View client dashboard | All clients | Linked clients only | Linked clients only |
| Manage lead workflow | Yes | Yes | View only |
| Link/delete campaigns | Yes | No | No |
| Access other admin routes | Yes | No | No |
| Invite client users | Yes | No | No |
| Manage settings | Yes | No | No |
| Infrastructure monitoring | Yes | No | No |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account (with Google and/or Microsoft OAuth configured)
- Instantly.ai account with API access (optional)
- Smartlead account with API access (optional)
- Resend account for email notifications (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/Toagan/BlueReach-Agency-Management-SAAS.git
cd BlueReach-Agency-Management-SAAS

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials (see Environment Variables section)

# Run database migrations in Supabase SQL Editor (in order):
# 1. supabase-schema.sql       — Core tables: clients, campaigns, leads
# 2. supabase-schema-v2.sql    — Denormalized fields, multi-provider support
# 3. supabase-settings.sql     — Settings table
# 4. supabase-preserve-leads.sql — Triggers to preserve lead data on deletion
# 5. supabase-analytics.sql    — Analytics views, snapshots, and functions
# 6. supabase-add-icp.sql      — ICP (Ideal Customer Profile) fields

# Start development server
npm run dev
```

### Development Commands

```bash
npm run dev        # Start development server (http://localhost:3000)
npm run build      # Build for production
npm start          # Start production server
npm run lint       # Run ESLint
```

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase (Required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# App URL (Required)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email Notifications (Required for notifications)
RESEND_API_KEY=re_your-resend-api-key

# Instantly API (Optional — can be configured via Admin Settings UI)
INSTANTLY_API_KEY=your-instantly-api-key
INSTANTLY_WEBHOOK_SECRET=your-webhook-secret

# Smartlead API (Optional — can be configured via Admin Settings UI)
SMARTLEAD_API_KEY=your-smartlead-api-key
```

### Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only, bypasses RLS) |
| `NEXT_PUBLIC_APP_URL` | Yes | Your app's public URL (used for links in emails, webhooks) |
| `RESEND_API_KEY` | No | Resend API key for sending email notifications |
| `INSTANTLY_API_KEY` | No | Instantly API key (Settings → Integrations → API) |
| `INSTANTLY_WEBHOOK_SECRET` | No | Secret for validating Instantly webhook payloads |
| `SMARTLEAD_API_KEY` | No | Smartlead API key for campaign and account sync |

---

## Database Schema

### Core Tables

#### `profiles`
User profiles linked to Supabase Auth.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key (references `auth.users`) |
| `email` | text | User email |
| `role` | text | `'admin'` or `'client'` |
| `full_name` | text | Display name |

#### `clients`
Agency clients (companies being served).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | text | Client company name |
| `logo_url` | text | Client logo URL |
| `website` | text | Client website |
| `notes` | text | Internal notes |
| `product_service` | text | What the client sells |
| `acv` | numeric | Average Contract Value |
| `tcv` | numeric | Total Contract Value |
| `verticals` | text[] | Target industries |
| `tam` | integer | Total Addressable Market (lead count) |
| `target_daily_emails` | integer | Daily sending target |
| `is_active` | boolean | Active flag |
| `created_at` | timestamptz | Creation timestamp |

#### `client_users`
Links users to clients with role-based access.

| Column | Type | Description |
|--------|------|-------------|
| `client_id` | uuid | FK → `clients(id)` |
| `user_id` | uuid | FK → `auth.users(id)` |
| `role` | text | `'owner'`, `'manager'`, `'member'`, or `'viewer'` |

Primary key: `(client_id, user_id)`

#### `client_invitations`
Pending invitations for client users.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `client_id` | uuid | FK → `clients(id)` |
| `email` | text | Invited user's email |
| `invited_by` | uuid | Admin who sent the invite |
| `created_at` | timestamptz | When the invite was created |
| `accepted_at` | timestamptz | When accepted (NULL if pending) |

#### `campaigns`
Email campaigns linked to external providers.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `client_id` | uuid | FK → `clients(id)` |
| `instantly_campaign_id` | text | Legacy Instantly campaign ID |
| `provider_type` | text | `'instantly'`, `'smartlead'`, etc. |
| `provider_campaign_id` | text | Provider-specific campaign ID |
| `name` | text | Campaign display name |
| `original_name` | text | Original name from provider |
| `copy_body` | text | Email template/copy |
| `is_active` | boolean | Active flag |
| `last_synced_at` | timestamptz | Last sync timestamp |

#### `campaign_sequences`
Email sequence steps with A/B/C variants.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `campaign_id` | uuid | FK → `campaigns(id)` |
| `sequence_index` | integer | Position in sequence |
| `step_number` | integer | Step number |
| `variant` | text | `'A'`, `'B'`, or `'C'` |
| `subject` | text | Email subject line |
| `body_text` | text | Plain text body |
| `body_html` | text | HTML body |
| `delay_days` | integer | Days to wait before sending |
| `delay_hours` | integer | Hours to wait before sending |

#### `leads`
All leads with denormalized data for preservation.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `campaign_id` | uuid | FK → `campaigns(id)` |
| `client_id` | uuid | Denormalized client ID |
| `client_name` | text | Denormalized client name |
| `campaign_name` | text | Denormalized campaign name |
| `email` | text | Lead email address |
| `first_name` | text | Lead first name |
| `last_name` | text | Lead last name |
| `company_name` | text | Lead company |
| `company_domain` | text | Lead company domain |
| `phone` | text | Lead phone number |
| `linkedin_url` | text | Lead LinkedIn profile |
| `status` | text | See lead statuses below |
| `is_positive_reply` | boolean | Whether reply was positive |
| `has_replied` | boolean | Whether lead has replied |
| `responded_at` | timestamptz | When marked as responded |
| `meeting_at` | timestamptz | Scheduled meeting date/time |
| `closed_at` | timestamptz | When deal was closed |
| `deal_value` | numeric | Value of the deal |
| `notes` | text | Admin/workflow notes |
| `instantly_lead_id` | text | Instantly lead ID |
| `email_open_count` | integer | Number of email opens |
| `email_click_count` | integer | Number of link clicks |
| `email_reply_count` | integer | Number of replies |
| `metadata` | jsonb | Additional provider-specific data |
| `created_at` | timestamptz | Creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |

**Lead Status Values:**

| Status | Description |
|--------|-------------|
| `contacted` | Initial outreach sent |
| `opened` | Email was opened |
| `clicked` | Link in email was clicked |
| `replied` | Lead replied to email |
| `booked` | Meeting was booked |
| `won` | Deal closed (won) |
| `lost` | Deal closed (lost) |
| `not_interested` | Lead declined |

#### `lead_emails`
Email thread for each lead (outbound and inbound messages).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `lead_id` | uuid | FK → `leads(id)` |
| `campaign_id` | uuid | FK → `campaigns(id)` |
| `provider_email_id` | text | Provider-specific email ID |
| `provider_thread_id` | text | Provider-specific thread ID |
| `direction` | text | `'outbound'` or `'inbound'` |
| `from_email` | text | Sender email |
| `to_email` | text | Recipient email |
| `subject` | text | Email subject |
| `body_text` | text | Plain text body |
| `body_html` | text | HTML body |
| `sequence_step` | integer | Which sequence step this is |
| `sent_at` | timestamptz | When the email was sent |
| `opened_at` | timestamptz | When the email was opened |
| `replied_at` | timestamptz | When a reply was received |
| `created_at` | timestamptz | Record creation timestamp |

#### `activities`
Activity log for leads.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `lead_id` | uuid | FK → `leads(id)` |
| `user_id` | uuid | User who created the activity |
| `type` | text | `'call'`, `'meeting'`, `'email'`, `'note'`, `'status_change'` |
| `title` | text | Activity title |
| `description` | text | Activity description |
| `scheduled_at` | timestamptz | Scheduled time (if applicable) |
| `completed_at` | timestamptz | Completion time |

#### `email_events`
Tracking events from email providers.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `lead_id` | uuid | FK → `leads(id)` |
| `campaign_id` | uuid | FK → `campaigns(id)` |
| `event_type` | text | `'sent'`, `'opened'`, `'clicked'`, `'replied'`, `'bounced'` |
| `instantly_event_id` | text | Provider event ID |
| `timestamp` | timestamptz | When the event occurred |

### Provider Tables

#### `api_providers`
Multi-provider API key storage (per-client or global).

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `client_id` | uuid | FK → `clients(id)` (NULL for global) |
| `provider_type` | text | `'instantly'`, `'smartlead'`, `'lemlist'`, `'apollo'` |
| `api_key` | text | Encrypted API key |
| `workspace_id` | text | Provider workspace/account ID |
| `is_active` | boolean | Active flag |
| `label` | text | Display label |

### Infrastructure Health Tables

#### `email_accounts`
Central registry of email accounts from Instantly and Smartlead.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `provider_type` | text | `'instantly'` or `'smartlead'` |
| `provider_account_id` | text | Provider-specific account ID |
| `email` | text | Email address |
| `client_id` | uuid | FK → `clients(id)` (manual assignment) |
| `domain` | text | Generated from email address |
| `status` | text | `'active'`, `'error'`, `'disconnected'`, `'paused'` |
| `warmup_enabled` | boolean | Whether warmup is active |
| `warmup_reputation` | integer | Reputation score (0–100) |
| `warmup_emails_sent` | integer | Warmup emails sent |
| `warmup_emails_received` | integer | Warmup emails received |
| `daily_limit` | integer | Daily sending limit |
| `last_synced_at` | timestamptz | Last sync timestamp |

Unique constraint: `(provider_type, email)`

#### `email_account_health_history`
Daily snapshots for trend analysis.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `email_account_id` | uuid | FK → `email_accounts(id)` |
| `snapshot_date` | date | Snapshot date |
| `status` | text | Account status at snapshot time |
| `warmup_reputation` | integer | Reputation at snapshot time |
| `warmup_emails_sent` | integer | Warmup sent count |
| `warmup_emails_received` | integer | Warmup received count |
| `emails_sent_today` | integer | Emails sent that day |

Unique constraint: `(email_account_id, snapshot_date)`

#### `domain_health`
DNS validation cache for SPF/DKIM/DMARC.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `domain` | text | Domain name (unique) |
| `has_spf` | boolean | SPF record exists |
| `spf_record` | text | Raw SPF record |
| `spf_valid` | boolean | SPF record is valid |
| `has_dkim` | boolean | DKIM record found |
| `dkim_selector` | text | DKIM selector used |
| `dkim_record` | text | Raw DKIM record |
| `dkim_valid` | boolean | DKIM record is valid |
| `has_dmarc` | boolean | DMARC record exists |
| `dmarc_record` | text | Raw DMARC record |
| `dmarc_policy` | text | `'none'`, `'quarantine'`, or `'reject'` |
| `dmarc_valid` | boolean | DMARC record is valid |
| `health_score` | integer | Generated score (0–100) based on DNS records |
| `last_checked_at` | timestamptz | Last check timestamp |

### Settings Table

#### `settings`
Application settings (singleton, `id` always = 1).

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Always 1 |
| `webhook_url` | text | Instantly webhook URL |
| `sync_interval` | integer | Auto-sync interval (minutes) |
| `updated_at` | timestamptz | Last update timestamp |

### Row Level Security (RLS)

All tables have RLS enabled:
- **Admin users** can access all data
- **Client users** can only access data for clients linked via `client_users`
- **Service role key** bypasses RLS for webhook handlers and cron jobs

### SQL Migration Files

Run these in order in the Supabase SQL Editor:

| File | Purpose |
|------|---------|
| `supabase-schema.sql` | Core tables: clients, campaigns, leads, profiles |
| `supabase-schema-v2.sql` | Denormalized fields, multi-provider support, lead_emails, client_users, client_invitations |
| `supabase-settings.sql` | Settings table |
| `supabase-preserve-leads.sql` | Triggers to preserve lead data when clients/campaigns are deleted |
| `supabase-analytics.sql` | Analytics views, snapshot tables, and aggregation functions |
| `supabase-add-icp.sql` | ICP fields on clients (product_service, acv, tcv, verticals, tam) |

---

## API Reference

### Admin APIs

#### Settings
```
GET    /api/admin/settings              # Get all settings (sensitive values masked)
POST   /api/admin/settings              # Update a setting
DELETE /api/admin/settings?key=x        # Clear a setting
POST   /api/admin/settings/logo         # Upload agency logo
```

#### Analytics
```
GET    /api/admin/analytics?period=this_week
POST   /api/admin/analytics/sync        # Trigger analytics sync from providers
```

**Query Parameters:**
- `period`: `this_week` | `this_month` | `this_quarter`

**Response:**
```json
{
  "leads_contacted": 150,
  "emails_sent": 500,
  "replies": 25,
  "opportunities": 10,
  "bounced_cumulative": 15,
  "meetings_held_cumulative": 5,
  "deals_closed_cumulative": 2,
  "reply_rate": 5.0
}
```

#### Lead Export
```
GET    /api/admin/leads/export?export=positive
```

**Export Types:**
- `current` — Current filter results (supports `client`, `status`, `positive` params)
- `positive` — All positive replies
- `replied` — All replies
- `no_response` — Contacted but no reply
- `all` — All leads

#### Customers (Clients)
```
GET    /api/admin/customers             # List all clients
POST   /api/admin/customers             # Create client
GET    /api/admin/customers/[id]        # Get client details
PUT    /api/admin/customers/[id]        # Update client
DELETE /api/admin/customers/[id]        # Delete client
```

#### Invitations
```
GET    /api/admin/invitations           # List pending invitations
POST   /api/admin/invitations           # Create invitation
DELETE /api/admin/invitations/[id]      # Revoke invitation
```

#### Lead Database
```
GET    /api/admin/lead-database         # Query centralized lead database
```

#### Notes
```
GET    /api/admin/notes                 # List notes
POST   /api/admin/notes                 # Create note
```

#### Subscriptions
```
GET    /api/admin/subscriptions         # Get subscription/credit status
```

#### Notification Preferences
```
GET    /api/admin/notification-preferences
POST   /api/admin/notification-preferences
```

### Client APIs

```
GET    /api/clients/[clientId]                          # Get client details
PATCH  /api/clients/[clientId]                          # Update client
GET    /api/clients/[clientId]/campaigns                # List client campaigns
GET    /api/clients/[clientId]/leads                    # Get leads (?positive=true)
POST   /api/clients/[clientId]/logo                     # Upload client logo
GET    /api/clients/[clientId]/invitations              # List invitations
POST   /api/clients/[clientId]/invitations              # Create invitation
POST   /api/clients/[clientId]/sync-positive            # Sync positive replies
GET    /api/clients/[clientId]/stats-settings           # Get stats display settings
POST   /api/clients/[clientId]/stats-settings           # Update stats display settings
GET    /api/clients/[clientId]/notification-preferences  # Get notification prefs
POST   /api/clients/[clientId]/notification-preferences  # Update notification prefs
GET    /api/clients/[clientId]/tool-links               # Get external tool links
```

#### HubSpot Integration (per client)
```
POST   /api/clients/[clientId]/hubspot                  # Sync leads to HubSpot
POST   /api/clients/[clientId]/test-hubspot             # Test HubSpot connection
```

### Lead Workflow APIs

```
PATCH  /api/leads/[leadId]/workflow    # Update lead workflow status
```

**Actions:**
| Action | Description |
|--------|-------------|
| `mark_responded` | Mark lead as responded |
| `schedule_meeting` | Set meeting date/time |
| `close_won` | Mark deal as won |
| `close_lost` | Mark deal as lost |
| `update_notes` | Update workflow notes |
| `revert_status` | Revert to previous status |

### Campaign APIs

```
GET    /api/campaigns/[id]/details            # Campaign details with stats
GET    /api/campaigns/[id]/leads              # Campaign leads
GET    /api/campaigns/[id]/variant-analytics  # A/B/C variant performance
GET    /api/campaigns/[id]/export-leads       # Export campaign leads
GET    /api/campaigns/[id]/diagnose           # Campaign diagnostics
POST   /api/campaigns/[id]/sync-leads         # Sync leads from provider
POST   /api/campaigns/[id]/sync-emails        # Sync email threads
POST   /api/campaigns/[id]/recalculate        # Recalculate campaign stats
POST   /api/campaigns/[id]/generate-skill     # Generate campaign skill report
DELETE /api/campaigns/[id]                    # Delete campaign
```

### Provider APIs

```
GET    /api/providers/[provider]/campaigns     # List campaigns from provider
POST   /api/providers/[provider]/validate      # Validate provider API key
```

Supported providers: `instantly`, `smartlead`

### Instantly APIs

```
GET    /api/instantly/status                   # Check API connection
GET    /api/instantly/campaigns                # List Instantly campaigns
POST   /api/instantly/campaigns                # Sync campaigns to DB
GET    /api/instantly/campaigns/[id]           # Get campaign details
POST   /api/instantly/campaigns/[id]           # Activate/pause campaign
GET    /api/instantly/campaigns/analytics      # Get campaign analytics
GET    /api/instantly/leads                    # List leads from Instantly
POST   /api/instantly/leads                    # Sync leads to DB
GET    /api/instantly/accounts                 # List email accounts
POST   /api/instantly/sync                     # Full sync (campaigns + leads)
POST   /api/instantly/validate-key             # Validate API key
POST   /api/instantly/refresh-status           # Refresh campaign statuses
```

### Smartlead APIs

```
GET    /api/smartlead/campaigns                # List Smartlead campaigns
GET    /api/smartlead/status                   # Check Smartlead API connection
POST   /api/smartlead/validate-key             # Validate API key
```

### Infrastructure APIs

```
GET    /api/admin/infrastructure/stats         # Dashboard statistics
GET    /api/admin/infrastructure/accounts      # List accounts (with filters)
PATCH  /api/admin/infrastructure/accounts/[id] # Assign client to account
POST   /api/admin/infrastructure/sync          # Sync from Instantly/Smartlead
GET    /api/admin/infrastructure/dns           # Get cached domain health
POST   /api/admin/infrastructure/dns           # Check specific domains
PATCH  /api/admin/infrastructure/dns           # Refresh all domain checks
GET    /api/admin/infrastructure/history       # Historical health snapshots
POST   /api/admin/infrastructure/history       # Create daily snapshot
```

---

## Provider Integrations

### Instantly.ai

**Setup:**
1. Get your API key from Instantly Settings → Integrations → API
2. Add to `INSTANTLY_API_KEY` in `.env.local` or configure via Admin Settings UI
3. Configure webhook in Instantly to point to `/api/webhooks/instantly/[campaignId]`

**API Client** (`src/lib/instantly/`):
| File | Purpose |
|------|---------|
| `client.ts` | Base HTTP client with Bearer token auth |
| `campaigns.ts` | List, activate, pause campaigns |
| `leads.ts` | List, create, update leads |
| `emails.ts` | Fetch email threads |
| `analytics.ts` | Campaign and account analytics |
| `accounts.ts` | Email account management |
| `types.ts` | TypeScript type definitions |

**Sync Process:**
1. Fetch campaigns from Instantly API
2. Create/update local campaign records in Supabase
3. Sync leads for each campaign
4. Sync email threads for leads
5. Sync analytics (sent, opened, replied counts)
6. Webhooks handle real-time updates going forward

### Smartlead

**Setup:**
1. Get your API key from Smartlead Settings
2. Add to `SMARTLEAD_API_KEY` in `.env.local` or configure via Admin Settings UI

**API Client** (`src/lib/smartlead/`):
| File | Purpose |
|------|---------|
| `client.ts` | Base HTTP client with query parameter auth (`?api_key=...`) |
| `campaigns.ts` | List and manage campaigns |
| `accounts.ts` | Fetch email accounts and warmup analytics |
| `analytics.ts` | Campaign performance data |
| `types.ts` | SmartleadAccount, SmartleadWarmupStats interfaces |

### HubSpot

**Setup:** Configure HubSpot API key per client via the client settings.

**Client** (`src/lib/hubspot/`):
| File | Purpose |
|------|---------|
| `client.ts` | HubSpot API HTTP client |
| `sync.ts` | Lead → HubSpot contact sync logic |
| `types.ts` | HubSpot type definitions |

### Multi-Provider Architecture

The `src/lib/providers/` directory provides a unified interface across providers:

```
src/lib/providers/
├── types.ts              # Shared provider interface
├── index.ts              # Provider factory/registry
├── instantly/
│   ├── client.ts         # Instantly adapter
│   └── index.ts
└── smartlead/
    ├── client.ts         # Smartlead adapter
    └── index.ts
```

---

## Webhooks

### Instantly Webhooks

**Endpoint:** `POST /api/webhooks/instantly/[campaignId]`

Configure in Instantly to send events to this URL for each campaign.

**Events Handled:**

| Event | Action |
|-------|--------|
| `lead_interested` | Set `is_positive_reply = true` |
| `lead_not_interested` | Set `is_positive_reply = false` |
| `email_sent` | Increment `emails_sent` counter |
| `email_opened` | Increment open count |
| `email_replied` | Update `has_replied`, `replied_at` |
| `lead_created` | Create new lead record |
| `link_clicked` | Increment click count |
| `meeting_booked` | Update lead status to `booked` |
| `lead_won` | Update lead status to `won` |
| `lead_lost` | Update lead status to `lost` |

**Payload Example:**
```json
{
  "event_type": "reply_received",
  "campaign_id": "abc123",
  "lead_email": "lead@example.com",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Security:** Webhook payloads are validated using `INSTANTLY_WEBHOOK_SECRET`.

### Smartlead Webhooks

**Endpoint:** `POST /api/webhooks/smartlead/[campaignId]`

Handles similar events from Smartlead campaigns.

---

## Cron Jobs

Scheduled endpoints for automated data syncing:

| Endpoint | Purpose | Recommended Schedule |
|----------|---------|---------------------|
| `POST /api/cron/analytics-snapshot` | Create daily analytics snapshot | `0 6 * * *` (daily 6 AM UTC) |
| `POST /api/cron/smartlead-weekly` | Weekly Smartlead data sync | `0 6 * * 1` (Monday 6 AM UTC) |
| `POST /api/cron/stats-report` | Send weekly stats report emails | `0 9 * * 1` (Monday 9 AM UTC) |
| `POST /api/admin/analytics/sync` | Sync analytics from all providers | `0 6 * * *` (daily 6 AM UTC) |

### Setup Options

**Vercel Cron** (recommended for Vercel deployments):
```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/analytics-snapshot", "schedule": "0 6 * * *" },
    { "path": "/api/cron/stats-report", "schedule": "0 9 * * 1" }
  ]
}
```

**External Cron Services:** Use cron-job.org, EasyCron, or Upstash QStash to call the endpoints on schedule.

**GitHub Actions:** See `CRON_SETUP.md` for a full GitHub Actions workflow example.

**Supabase pg_cron:** Available on Supabase Pro plan. See `CRON_SETUP.md` for SQL setup.

---

## Infrastructure Health Monitoring

### Overview

Monitor email account health across all providers with DNS validation. Accessible at `/admin/infrastructure`.

### Features

- **Account Dashboard**: Total accounts, active count, average reputation, domain count
- **Account Table**: Filterable by provider, status, client assignment
- **Client Assignment**: Map email accounts to specific clients
- **DNS Health**: SPF, DKIM, DMARC validation for all sending domains
- **Health History**: Daily snapshots for tracking reputation trends
- **Auto-refresh**: Dashboard updates every 30 seconds

### DNS Health Checker (`src/lib/dns/`)

Uses DNS-over-HTTPS (Google DoH API) for server-side DNS lookups:

- **SPF**: Validates `v=spf1` records for sending authorization
- **DKIM**: Probes common selectors (google, default, selector1, selector2, k1, etc.)
- **DMARC**: Checks `_dmarc` TXT records and parses policy (`none`, `quarantine`, `reject`)
- **Health Score**: Generated 0–100 score based on DNS record completeness and validity

---

## Email Notifications

Built with [React Email](https://react.email) and sent via [Resend](https://resend.com).

### Templates (`src/lib/email/templates/`)

| Template | Trigger | Description |
|----------|---------|-------------|
| `Invitation.tsx` | Admin invites client user | Welcome email with login link |
| `PositiveReplyNotification.tsx` | Webhook: positive reply | Alert admin/client about interested lead |
| `StatsReport.tsx` | Weekly cron job | Summary of campaign performance |

---

## SEO

Blue Reach includes comprehensive SEO out of the box for all marketing pages.

### Metadata

Every marketing page exports its own `metadata` object with:
- Unique, keyword-targeted `title` and `description`
- OpenGraph tags (title, description, image, URL)
- Twitter card tags (summary_large_image)
- Canonical URLs via `alternates.canonical`

The root layout (`layout.tsx`) defines:
- `metadataBase` for resolving relative URLs
- `title.template` (`%s | Blue Reach`) for consistent page titles
- 12 long-tail keywords targeting outbound agency search terms
- Robots directives allowing Google to index with max image/snippet previews

### Sitemap & Robots

| File | Route | Purpose |
|------|-------|---------|
| `src/app/sitemap.ts` | `/sitemap.xml` | Lists all public pages with priorities and change frequencies |
| `src/app/robots.ts` | `/robots.txt` | Allows `/`, blocks `/admin/`, `/dashboard/`, `/api/`, `/auth/` |

### JSON-LD Structured Data

**Homepage** includes a `@graph` with three schemas:
- `Organization` — name, logo, description
- `SoftwareApplication` — category, feature list, aggregate pricing ($49–$249), aggregate rating
- `WebSite` — enables sitelinks search box eligibility

**Pricing page** includes:
- `FAQPage` schema generated from the FAQ section — eligible for Google rich snippet FAQ accordion

### Target Keywords

Primary terms the pages are optimized for:
- "client reporting dashboard"
- "outbound agency software"
- "instantly dashboard" / "smartlead dashboard"
- "white-label client portal"
- "agency reporting tool"
- "cold email reporting"
- "campaign analytics dashboard"
- "lead generation agency software"

---

## Deployment

### Docker Deployment

```bash
# Build the image
docker build -t bluereach-dashboard .

# Run with Docker Compose
docker-compose up -d
```

**docker-compose.yml** includes:
- `app` service: Next.js application on port 3000
- `caddy` service: Reverse proxy with automatic HTTPS on ports 80/443

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - INSTANTLY_API_KEY=${INSTANTLY_API_KEY}
      - INSTANTLY_WEBHOOK_SECRET=${INSTANTLY_WEBHOOK_SECRET}
      - SMARTLEAD_API_KEY=${SMARTLEAD_API_KEY}
      - RESEND_API_KEY=${RESEND_API_KEY}
      - NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
    restart: unless-stopped

  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    restart: unless-stopped

volumes:
  caddy_data:
```

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Add all environment variables in the Vercel dashboard
3. Deploy
4. Configure cron jobs in `vercel.json` (see [Cron Jobs](#cron-jobs))

### Environment-Specific Configuration

| Environment | Database | Providers | Email |
|-------------|----------|-----------|-------|
| Development | Supabase Dev Project | Instantly/Smartlead Sandbox | Resend Test |
| Staging | Supabase Staging Project | Instantly/Smartlead Sandbox | Resend Test |
| Production | Supabase Production Project | Instantly/Smartlead Production | Resend Production |

---

## Project Structure

```
src/
├── app/
│   ├── (marketing)/                    # Marketing pages (grouped route)
│   │   ├── features/page.tsx           # Features page
│   │   ├── pricing/page.tsx            # Pricing page
│   │   └── layout.tsx                  # Marketing layout
│   │
│   ├── admin/                          # Admin portal
│   │   ├── page.tsx                    # Command center dashboard
│   │   ├── layout.tsx                  # Admin layout (sidebar, header)
│   │   ├── clients/                    # Client management
│   │   │   ├── page.tsx                # Client list
│   │   │   ├── add-client-dialog.tsx   # New client dialog
│   │   │   └── [clientId]/             # Individual client
│   │   │       ├── page.tsx            # Client dashboard + lead workflow
│   │   │       ├── settings/page.tsx   # Client settings
│   │   │       └── campaigns/          # Campaign management
│   │   │           ├── page.tsx        # Campaign list
│   │   │           ├── add-campaign-dialog.tsx
│   │   │           ├── sync-button.tsx
│   │   │           └── [campaignId]/page.tsx  # Campaign details
│   │   ├── leads/                      # Lead management
│   │   │   ├── page.tsx
│   │   │   └── admin-leads-view.tsx
│   │   ├── lead-database/page.tsx      # Centralized lead database
│   │   ├── instantly/                  # Instantly integration UI
│   │   │   ├── page.tsx                # Overview
│   │   │   ├── accounts/page.tsx       # Email accounts
│   │   │   ├── campaigns/page.tsx      # Campaign management
│   │   │   └── analytics/page.tsx      # Provider analytics
│   │   ├── infrastructure/             # Infrastructure health
│   │   │   ├── page.tsx
│   │   │   └── infrastructure-view.tsx
│   │   ├── ai-campaigns/page.tsx       # AI campaign tools
│   │   ├── scraping/page.tsx           # Lead scraping
│   │   ├── notes/page.tsx              # Internal notes
│   │   ├── subscriptions/page.tsx      # Subscription tracking
│   │   └── settings/page.tsx           # Agency settings
│   │
│   ├── api/                            # API routes
│   │   ├── admin/                      # Admin-only endpoints
│   │   │   ├── analytics/              # Analytics + sync
│   │   │   ├── customers/              # Client CRUD
│   │   │   ├── infrastructure/         # Infrastructure health
│   │   │   ├── invitations/            # Client invitations
│   │   │   ├── lead-database/          # Lead database queries
│   │   │   ├── leads/                  # Lead export
│   │   │   ├── notes/                  # Notes CRUD
│   │   │   ├── notification-preferences/
│   │   │   ├── settings/               # App settings + logo
│   │   │   └── subscriptions/          # Subscription info
│   │   ├── campaigns/[campaignId]/     # Campaign operations
│   │   │   ├── details/                # Stats + details
│   │   │   ├── leads/                  # Campaign leads
│   │   │   ├── variant-analytics/      # A/B test results
│   │   │   ├── sync-leads/             # Sync from provider
│   │   │   ├── sync-emails/            # Sync email threads
│   │   │   ├── export-leads/           # CSV export
│   │   │   ├── diagnose/               # Campaign diagnostics
│   │   │   ├── recalculate/            # Recalculate stats
│   │   │   └── generate-skill/         # Skill report
│   │   ├── clients/[clientId]/         # Client-specific endpoints
│   │   │   ├── campaigns/              # Client campaigns
│   │   │   ├── leads/                  # Client leads
│   │   │   ├── invitations/            # Manage invitations
│   │   │   ├── hubspot/                # HubSpot sync
│   │   │   ├── logo/                   # Logo upload
│   │   │   ├── stats-settings/         # Stats display config
│   │   │   ├── notification-preferences/
│   │   │   ├── sync-positive/          # Sync positive replies
│   │   │   └── tool-links/             # External tool links
│   │   ├── providers/[provider]/       # Multi-provider endpoints
│   │   │   ├── campaigns/
│   │   │   └── validate/
│   │   ├── instantly/                  # Instantly-specific endpoints
│   │   ├── smartlead/                  # Smartlead-specific endpoints
│   │   ├── leads/[leadId]/             # Lead operations
│   │   │   └── workflow/               # Workflow updates
│   │   ├── webhooks/                   # Webhook handlers
│   │   │   ├── instantly/[campaignId]/ # Instantly webhooks
│   │   │   └── smartlead/[campaignId]/ # Smartlead webhooks
│   │   ├── cron/                       # Scheduled jobs
│   │   │   ├── analytics-snapshot/
│   │   │   ├── smartlead-weekly/
│   │   │   └── stats-report/
│   │   └── demo/                       # Demo utilities
│   │
│   ├── auth/                           # Auth routes
│   │   ├── callback/                   # OAuth callback handler
│   │   ├── signout/                    # Sign out
│   │   └── accept-invite/              # Accept client invitation
│   │
│   ├── dashboard/                      # Client portal
│   │   ├── page.tsx                    # Dashboard landing
│   │   ├── layout.tsx                  # Dashboard layout
│   │   └── [clientId]/                 # Client-specific views
│   │       ├── page.tsx
│   │       ├── client-leads-view.tsx
│   │       └── client-info-tooltip.tsx
│   │
│   ├── login/                          # Login page
│   │   ├── page.tsx
│   │   └── login-client.tsx
│   ├── access-denied/page.tsx          # Access denied page
│   ├── page.tsx                        # Landing page (CSS dashboard mockups, stats, testimonials)
│   ├── layout.tsx                      # Root layout (SEO metadata, OG tags, Twitter cards)
│   ├── sitemap.ts                      # Auto-generated /sitemap.xml
│   ├── robots.ts                       # Auto-generated /robots.txt
│   └── globals.css                     # Global styles
│
├── components/
│   ├── admin/                          # Admin-specific components
│   │   ├── add-customer-dialog.tsx
│   │   └── delete-customer-dialog.tsx
│   ├── campaigns/
│   │   └── variant-analytics.tsx       # A/B variant display
│   ├── layout/
│   │   ├── header.tsx                  # Top navigation
│   │   ├── sidebar.tsx                 # Admin sidebar
│   │   └── stats-cards.tsx             # Statistics display cards
│   ├── leads/
│   │   ├── EmailThread.tsx             # Email thread viewer
│   │   ├── lead-detail-panel.tsx       # Slide-out lead detail panel
│   │   └── lead-table.tsx              # Lead listing table
│   ├── marketing/
│   │   ├── header.tsx                  # Marketing page header
│   │   └── footer.tsx                  # Marketing page footer
│   ├── ui/                             # shadcn/ui components
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── checkbox.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── info-tooltip.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── select.tsx
│   │   ├── sheet.tsx
│   │   ├── switch.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   └── textarea.tsx
│   └── theme-toggle.tsx                # Dark/light theme toggle
│
├── lib/
│   ├── auth.ts                         # Auth helper utilities
│   ├── utils.ts                        # General utilities (cn, etc.)
│   ├── supabase/                       # Supabase clients
│   │   ├── client.ts                   # Browser client
│   │   ├── server.ts                   # Server client
│   │   └── middleware.ts               # Auth middleware
│   ├── queries/                        # Database query functions
│   │   ├── analytics.ts
│   │   ├── campaigns.ts
│   │   ├── clients.ts
│   │   ├── leads.ts
│   │   └── stats.ts
│   ├── instantly/                      # Instantly API client
│   │   ├── client.ts                   # Base HTTP client (Bearer auth)
│   │   ├── campaigns.ts               # Campaign operations
│   │   ├── leads.ts                    # Lead operations
│   │   ├── emails.ts                   # Email thread fetching
│   │   ├── analytics.ts               # Analytics queries
│   │   ├── accounts.ts                # Email account management
│   │   ├── types.ts                    # Type definitions
│   │   └── index.ts                    # Module exports
│   ├── smartlead/                      # Smartlead API client
│   │   ├── client.ts                   # Base HTTP client (query param auth)
│   │   ├── campaigns.ts               # Campaign operations
│   │   ├── accounts.ts                # Account + warmup data
│   │   ├── analytics.ts               # Analytics queries
│   │   ├── types.ts                    # Type definitions
│   │   └── index.ts                    # Module exports
│   ├── providers/                      # Multi-provider abstraction
│   │   ├── types.ts                    # Shared provider interface
│   │   ├── index.ts                    # Provider factory
│   │   ├── instantly/                  # Instantly adapter
│   │   └── smartlead/                  # Smartlead adapter
│   ├── hubspot/                        # HubSpot CRM integration
│   │   ├── client.ts                   # HubSpot API client
│   │   ├── sync.ts                     # Lead → contact sync
│   │   ├── types.ts                    # Type definitions
│   │   └── index.ts                    # Module exports
│   ├── dns/                            # DNS health checker
│   │   ├── checker.ts                  # SPF/DKIM/DMARC validation via Google DoH
│   │   └── index.ts                    # Module exports
│   └── email/                          # Email notification service
│       ├── index.ts                    # Module exports
│       ├── send.ts                     # Resend send wrapper
│       └── templates/                  # React Email templates
│           ├── Invitation.tsx          # Client invitation email
│           ├── PositiveReplyNotification.tsx  # Positive reply alert
│           └── StatsReport.tsx         # Weekly stats summary
│
├── types/
│   └── database.ts                     # TypeScript types for all tables
│
└── middleware.ts                       # Next.js middleware (auth + role checks)
```

### Root Files

```
├── .env.example                # Environment variable template
├── .gitignore                  # Git exclusions
├── .dockerignore               # Docker exclusions
├── Caddyfile                   # Caddy reverse proxy config
├── CLAUDE.md                   # Claude AI project context
├── CRON_SETUP.md               # Cron job setup guide
├── README.md                   # This file
├── check-positive.mjs          # Utility: check positive replies
├── check_db.mjs                # Utility: database health check
├── components.json             # shadcn/ui config
├── docker-compose.yml          # Docker multi-service config
├── Dockerfile                  # Container build config
├── eslint.config.mjs           # ESLint configuration
├── next.config.ts              # Next.js configuration
├── package.json                # Dependencies and scripts
├── supabase-schema.sql         # Migration 1: Core schema
├── supabase-schema-v2.sql      # Migration 2: Multi-provider + denormalization
├── supabase-settings.sql       # Migration 3: Settings table
├── supabase-preserve-leads.sql # Migration 4: Lead preservation triggers
├── supabase-analytics.sql      # Migration 5: Analytics views + functions
├── supabase-add-icp.sql        # Migration 6: ICP fields
└── tsconfig.json               # TypeScript configuration
```

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is proprietary software. All rights reserved.

---

## Support

For support, please contact the development team or open an issue on GitHub.
