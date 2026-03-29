# BlueReach Agency Management Dashboard

A white-label, multi-tenant SaaS platform for lead generation agencies to manage clients, campaigns, leads, and email infrastructure. Integrates with [Instantly.ai](https://instantly.ai), [Smartlead](https://smartlead.ai), and [HubSpot](https://hubspot.com). Billing powered by [Stripe](https://stripe.com). Built with Next.js, Supabase, and TypeScript.

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
- [Billing & Subscriptions](#billing--subscriptions)
- [Multi-Tenancy & Impersonation](#multi-tenancy--impersonation)
- [SEO](#seo-1)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Contributing](#contributing)

---

## Overview

BlueReach is a multi-tenant agency management platform designed for cold email outreach agencies. Each agency owner signs up, selects a plan, and gets their own fully isolated workspace. A platform admin can oversee all agencies via impersonation.

- **Admin Portal**: Full control over clients, campaigns, leads, analytics, infrastructure, and settings
- **Client Portal**: Role-restricted dashboard for clients to view campaigns, manage lead workflows, and track results
- **Multi-Provider Integration**: Bidirectional sync with Instantly.ai and Smartlead for campaigns and leads, plus HubSpot CRM sync
- **Infrastructure Monitoring**: Email account health tracking, DNS validation (SPF/DKIM/DMARC), and warmup monitoring
- **Real-time Updates**: Webhook-driven data sync from email providers with auto-refreshing dashboards
- **Email Notifications**: Automated alerts for positive replies and weekly stats reports via Resend
- **Multi-Tenancy**: Full data isolation between agency owners via `owner_id` scoping on all tables
- **Stripe Billing**: 3-tier subscription plans with 14-day free trial, billing portal, and webhook-driven sync
- **Platform Admin**: Impersonation system to view any agency's workspace as they see it

---

## Features

### Admin Dashboard (`/admin`)

#### Command Center
- Real-time analytics filtered by time period (this week, this month, this quarter, all time)
  - Leads contacted, emails sent, replies received, positive replies (opportunities)
  - Reply rate calculation
- Clickable stats that drill down into the detailed leads view
- Auto-refresh every 30 seconds
- All data scoped to the current agency owner

#### Client Management (`/admin` — customer cards)
- Create and delete clients (enforced by subscription plan limits)
- View details, settings per client
- Search and filter customers (active, archived, demo)
- Customer cards showing campaign count and key metrics

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
- A/B test performance breakdown per step and variant (sent, replies, positive replies, rates)
- Variant reply attribution: inferred from outbound email data when webhooks don't provide it
- List of positive replies with contact info
- Paginated leads table (50 per page with previous/next navigation)
- Email thread viewer per lead
- Campaign sequence viewer (multi-step, A/B/C+ variants with copy review workflow)
- Campaign progress visualization (leads contacted / total)
- AI Skill Generator: exports campaign data, performance stats, and filled-in email examples as a markdown prompt for AI-assisted A/B test copy optimization
- Campaign diagnostics
- Export leads to CSV

#### Lead Management (`/admin/leads`)
- View all leads across all clients (132,000+ supported)
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
- **Clickable status filter toggles**: Click any status badge (Responded, Meetings, Won, Lost) to filter the workflow view; click again to clear
- Collapsible UI with summary stats in header
- Quick one-click status updates with date/time selection for meetings
- Notes per workflow stage
- Reply date tracking: `responded_at` populated from Smartlead `reply_time` during sync

#### Lead Database (`/admin/lead-database`)
- Centralized lead database across all clients and campaigns

#### Notes (`/admin/notes`)
- Internal note-taking system for agency operations

#### Subscriptions (`/admin/subscriptions`)
- Track API credits and subscription status across providers
- Live sync of remaining credits

#### AI Campaigns (`/admin/ai-campaigns`)
- Interactive 5-step campaign builder mockup (coming soon):
  1. **Knowledge Base** — Upload/toggle MD files with best practices
  2. **Reference Campaigns** — Select top-performing campaigns with positive reply stats
  3. **Campaign Builder** — Chat-style Q&A with Fireflies call recording integration
  4. **Copy Generation** — Iterative V1→V2→V3 with feedback loop and follow-up sequences
  5. **A/B Testing Matrix** — 5 categories (Offer, Subject, CTA, First Line, Follow-up) × 3 variants

#### Scraping (`/admin/scraping`)
- Coming soon placeholder cards for:
  - **Google Maps** — Local business scraping by category and location
  - **LinkedIn Sales Navigator** — B2B decision-maker extraction
  - **Blitz API** — Bulk lead enrichment from domain/CSV uploads

#### Infrastructure Health (`/admin/infrastructure`)
- Monitor email account health across Instantly and Smartlead
- DNS validation: SPF, DKIM, and DMARC record checking
- Warmup tracking: reputation scores, emails sent/received
- Daily health snapshots for trend analysis
- Client-to-account assignment
- Filter by provider, status, or client
- Auto-refresh every 30 seconds

#### Agency Settings (`/admin/settings`)
- **Agency Owners** (platform admin only): List all agency owners with client counts, "View Dashboard" button for impersonation
- Agency logo upload
- Agency branding (name, primary color, sender name/email)
- API key management (Instantly, Smartlead)
- Email service configuration (Resend)

#### Billing (`/admin/billing`)
- Current subscription plan display
- Trial days remaining indicator
- "Manage Billing" button → Stripe customer portal
- Trial and past-due banners in admin layout

#### Client Settings (`/admin/clients/[clientId]/settings`)
- Client logo upload and branding
- Client Intelligence: product/service description, ICP, ACV/TCV, verticals, TAM, daily send volume
- Team Access: invite client users by email with role assignment, manage pending invitations
- Positive Reply Notifications: scoped to workspace admin + client team members only (not all platform users)
- Stats Reports: automated periodic performance reports to notification recipients
- Slack Notifications: webhook integration for positive replies and stats reports
- CRM Integration: provider selector (HubSpot active; Salesforce, Close, Pipedrive coming soon)
  - HubSpot: private app token, sync contacts/deals, pipeline/stage selection, contact property mapping, backfill, test sync
- Automated Positive Reply Management (Coming Soon): AI auto-responder with custom knowledge base, meeting booking link, and contextual follow-up

### Client Portal (`/admin/clients/[clientId]` with client role)

- OAuth login via Google or Microsoft
- Context-aware login page (recognizes invitation tokens, shows tailored messaging)
- View all campaigns assigned to their account
- Lead statistics: contacted, replied, positive replies, meetings, deals
- Lead workflow management (respond, schedule meetings, close deals)
- Add notes to leads
- Cannot link/delete campaigns or access other admin routes

### Authentication

- **OAuth**: Google and Microsoft sign-in via Supabase Auth
- **Role-Based Access**: Platform Admin → Admin → Client (Owner/Manager/Member/Viewer)
- **Client Invitations**: Admin invites client users by email with invite token in URL; auto-linked on first login via `/auth/accept-invite`
- **Middleware Protection**: All `/admin/*` routes protected; client users restricted to their linked client pages
- **Context-Aware Login**: Agency owners see social proof + free trial CTA; invited clients see a tailored "Your dashboard is ready" view

### Marketing Pages

- **Landing Page** (`/`): Hero with CSS dashboard mockup, stats bar, problem/solution cards, "See it in Action" showcase, 7-feature grid, testimonials with gradient initial avatars, and CTA
- **Features Page** (`/features`): Detailed breakdown of client portals, analytics, and lead management with mock UI visuals
- **Pricing Page** (`/pricing`): 3-tier plan comparison (Starter $49, Growth $99, Agency $249), feature comparison table, FAQ section
- **Plan Selection** (`/choose-plan`): Post-signup plan selection with 14-day free trial on all plans

### SEO

- **Root metadata** (`layout.tsx`): OpenGraph tags, Twitter cards, keyword targeting, robots directives
- **Page-specific metadata**: Unique title/description for homepage, features, and pricing pages
- **Sitemap** (`/sitemap.xml`): Auto-generated from `sitemap.ts` with all public routes
- **Robots** (`/robots.txt`): Auto-generated from `robots.ts` — allows marketing pages, blocks `/admin`, `/dashboard`, `/api`, `/auth`
- **JSON-LD structured data**:
  - Homepage: `Organization`, `SoftwareApplication` (with pricing and rating), `WebSite` schemas
  - Pricing: `FAQPage` schema for Google rich snippet FAQ accordion

---

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 16.x | App Router, Server Components, API Routes |
| **React** | 19.x | UI framework |
| **TypeScript** | 5.x | Type-safe development |
| **Supabase** | Latest | PostgreSQL database, Auth (OAuth), Row Level Security |
| **Stripe** | Latest | Subscription billing, checkout, customer portal |
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
│    Supabase      │  │  Email / Pay   │  │   External Providers     │
│  ┌────────────┐  │  │  ┌──────────┐  │  │  ┌────────────────────┐  │
│  │ PostgreSQL │  │  │  │  Resend  │  │  │  │   Instantly API    │  │
│  │ + RLS      │  │  │  ├──────────┤  │  │  │   Smartlead API   │  │
│  ├────────────┤  │  │  │  Stripe  │  │  │  │   HubSpot API     │  │
│  │ Auth       │  │  │  └──────────┘  │  │  └────────────────────┘  │
│  │ (OAuth)    │  │  └────────────────┘  │  ┌────────────────────┐  │
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
Check profiles table for role + pending invitations
    ↓
├── New user with invitation → Link to client, redirect to client dashboard
├── New admin (no subscription) → Redirect to /choose-plan
├── role = 'admin'  → Redirect to /admin (Command Center)
└── role = 'client' → Redirect to /admin/clients/[clientId] (restricted view)
```

### Client Invitation Flow

```
Admin creates invitation (email)
    ↓
Invitation stored in client_invitations table
    ↓
Invited user clicks login link (/login?inviteToken=...)
    ↓
Context-aware login page shows client-specific messaging
    ↓
/auth/callback checks for pending invitation matching email
    ↓
Auto-links user to client via client_users table
    ↓
Invitation marked as accepted
```

### Multi-Tenancy Data Flow

```
API Request → requireAdmin() → getEffectiveOwnerId()
    ↓
├── Platform admin + impersonation cookie → returns impersonated owner UUID
├── Platform admin (no impersonation) → returns admin's own UUID
└── Regular admin → returns their own UUID
    ↓
All queries filter by .eq("owner_id", effectiveOwnerId)
    ↓
Complete data isolation between agency owners
```

### Role-Based Access Control

| Feature | Platform Admin | Admin (Agency Owner) | Client (Owner/Manager) | Client (Member/Viewer) |
|---------|---------------|---------------------|----------------------|----------------------|
| View own dashboard | Yes | Yes | N/A | N/A |
| Impersonate other agencies | Yes | No | No | No |
| Manage clients | Own + impersonated | Own only | No | No |
| View client dashboard | All (via impersonation) | Own clients | Linked clients only | Linked clients only |
| Manage lead workflow | Yes | Yes | Yes | View only |
| Link/delete campaigns | Yes | Yes | No | No |
| Infrastructure monitoring | Yes | Yes | No | No |
| Manage settings | Yes | Yes | No | No |
| Agency Owners list | Yes | No | No | No |
| Billing management | Exempt (free) | Yes | No | No |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account (with Google and/or Microsoft OAuth configured)
- Stripe account (for billing — optional in development)
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
# 1. supabase-schema.sql             — Core tables: clients, campaigns, leads
# 2. supabase-schema-v2.sql          — Denormalized fields, multi-provider support
# 3. supabase-settings.sql           — Settings table
# 4. supabase-preserve-leads.sql     — Triggers to preserve lead data on deletion
# 5. supabase-analytics.sql          — Analytics views, snapshots, and functions
# 6. supabase-add-icp.sql            — ICP (Ideal Customer Profile) fields
#
# Then run the numbered migrations in supabase/migrations/:
# 7. 20260303_add_reply_tokens.sql   — Reply token table for smart email redirects
# 8. 20260304_add_stripe_billing.sql — Stripe subscriptions table + profile fields
# 9. 20260304_add_multi_tenancy.sql  — owner_id on clients/settings, is_platform_admin
# 10. 20260305_add_owner_scoping.sql — owner_id on subscriptions, lead_sources, email_accounts

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

# Stripe Billing (Required for subscriptions)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_GROWTH=price_...
STRIPE_PRICE_AGENCY=price_...

# Email Notifications (Required for notifications)
RESEND_API_KEY=re_your-resend-api-key

# Instantly API (Optional — can be configured via Admin Settings UI)
INSTANTLY_API_KEY=your-instantly-api-key
INSTANTLY_WEBHOOK_SECRET=your-webhook-secret

# Smartlead API (Optional — can be configured via Admin Settings UI)
SMARTLEAD_API_KEY=your-smartlead-api-key

# Cron Jobs (Required for automated stats sync and reports)
CRON_SECRET=your-random-secret-string
```

### Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key (client-side) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server-side only, bypasses RLS) |
| `NEXT_PUBLIC_APP_URL` | Yes | Your app's public URL (used for links in emails, webhooks) |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key for server-side API calls |
| `STRIPE_WEBHOOK_SECRET` | Yes | Secret for validating Stripe webhook payloads |
| `STRIPE_PRICE_STARTER` | Yes | Stripe Price ID for Starter plan ($49/mo) |
| `STRIPE_PRICE_GROWTH` | Yes | Stripe Price ID for Growth plan ($99/mo) |
| `STRIPE_PRICE_AGENCY` | Yes | Stripe Price ID for Agency plan ($249/mo) |
| `RESEND_API_KEY` | No | Resend API key for sending email notifications |
| `INSTANTLY_API_KEY` | No | Instantly API key (Settings → Integrations → API) |
| `INSTANTLY_WEBHOOK_SECRET` | No | Secret for validating Instantly webhook payloads |
| `SMARTLEAD_API_KEY` | No | Smartlead API key for campaign and account sync |
| `CRON_SECRET` | No | Shared secret for authenticating cron job endpoints (`?secret=...`) |

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
| `is_platform_admin` | boolean | Whether user is the platform super-admin (default `false`) |
| `stripe_customer_id` | text | Stripe customer ID (unique) |

#### `clients`
Agency clients (companies being served). Scoped by `owner_id`.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `owner_id` | uuid | FK → `auth.users` — the agency owner who created this client |
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
| `cached_emails_sent` | integer | Cached total emails sent |
| `cached_reply_count` | integer | Cached total replies |
| `cached_emails_bounced` | integer | Cached bounced count |
| `cached_leads_count` | integer | Cached total leads |
| `sync_in_progress` | boolean | Whether a sync is currently running |
| `sync_started_at` | timestamptz | When the current sync started (5-min timeout) |

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
| `responded_at` | timestamptz | When the lead replied (auto-populated from provider `reply_time` during sync, or set manually) |
| `meeting_at` | timestamptz | Scheduled meeting date/time |
| `closed_at` | timestamptz | When deal was closed |
| `deal_value` | numeric | Value of the deal |
| `notes` | text | Admin/workflow notes |
| `instantly_lead_id` | text | Instantly lead ID |
| `email_open_count` | integer | Number of email opens |
| `email_click_count` | integer | Number of link clicks |
| `email_reply_count` | integer | Number of replies |
| `reply_from_step` | integer | Which sequence step triggered the reply |
| `reply_from_variant` | integer | Provider variant ID that triggered the reply |
| `reply_from_variant_label` | text | Variant label (A, B, C, etc.) that triggered the reply |
| `metadata` | jsonb | Additional provider-specific data (rawData, customFields) |
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
| `sequence_variant` | integer | Provider variant ID |
| `sequence_variant_label` | text | Variant label (A, B, C, etc.) |
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

### Billing Tables

#### `stripe_subscriptions`
Subscription records synced from Stripe.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `user_id` | uuid | FK → `auth.users(id)` |
| `stripe_subscription_id` | text | Stripe subscription ID (unique) |
| `stripe_customer_id` | text | Stripe customer ID |
| `plan` | text | `'starter'`, `'growth'`, or `'agency'` |
| `status` | text | `'active'`, `'trialing'`, `'past_due'`, `'canceled'`, `'incomplete'` |
| `current_period_start` | timestamptz | Current billing period start |
| `current_period_end` | timestamptz | Current billing period end |
| `trial_start` | timestamptz | Trial start date |
| `trial_end` | timestamptz | Trial end date |
| `cancel_at_period_end` | boolean | Whether subscription cancels at period end |
| `created_at` | timestamptz | Record creation timestamp |
| `updated_at` | timestamptz | Last update timestamp |

### Reply Token Tables

#### `reply_tokens`
Short-lived tokens for smart email reply redirects.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key (used as the token) |
| `lead_email` | text | The lead's email address |
| `subject` | text | Email subject for reply |
| `body` | text | Quoted thread body |
| `lead_id` | uuid | FK → `leads(id)` |
| `created_at` | timestamptz | Creation timestamp (72-hour TTL) |
| `used_at` | timestamptz | First access timestamp |

### Infrastructure Health Tables

#### `email_accounts`
Central registry of email accounts from Instantly and Smartlead.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `owner_id` | uuid | FK → `auth.users` — the agency owner |
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
Per-owner application settings (keyed by `owner_id` + `key`).

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Auto-increment primary key |
| `owner_id` | uuid | FK → `auth.users` — the agency owner |
| `key` | text | Setting key (e.g., `instantly_api_key`, `agency_logo_url`) |
| `value` | text | Setting value |
| `updated_at` | timestamptz | Last update timestamp |

Unique constraint: `(key, owner_id)`

### Row Level Security (RLS)

All tables have RLS enabled with owner-scoped policies:
- **Platform admin users** can access all data across all owners
- **Admin users** can only access data where `owner_id` matches their user ID
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
| `supabase/migrations/20260303_add_reply_tokens.sql` | Reply tokens table for smart email redirects |
| `supabase/migrations/20260304_add_stripe_billing.sql` | Stripe subscriptions table, stripe_customer_id on profiles |
| `supabase/migrations/20260304_add_multi_tenancy.sql` | owner_id on clients/settings, is_platform_admin on profiles |
| `supabase/migrations/20260305_add_owner_scoping.sql` | owner_id on subscriptions, lead_sources, email_accounts |
| `supabase/migrations/20260305_fix_rls_recursion.sql` | Fix RLS policy recursion issues |
| `supabase/migrations/20260306_fix_clients_rls_leak.sql` | Fix clients table RLS data leak |
| `supabase/migrations/20260307_copy_reviews.sql` | Copy review workflow tables |
| `supabase/migrations/20260328_add_atomic_lead_counter.sql` | `increment_lead_counter` RPC for atomic open/click/reply counting |

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
- `period`: `all_time` | `this_week` | `this_month` | `this_quarter`

**Response:**
```json
{
  "period": "all_time",
  "leads_contacted": 132589,
  "emails_sent": 132189,
  "replies": 4218,
  "opportunities": 322,
  "reply_rate": 3.19,
  "data_source": "campaigns_cached"
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
GET    /api/admin/customers             # List all clients (scoped by owner)
POST   /api/admin/customers             # Create client (enforces plan limit)
GET    /api/admin/customers/[id]        # Get client details
PUT    /api/admin/customers/[id]        # Update client
DELETE /api/admin/customers/[id]        # Delete client
```

#### Agencies (Platform Admin Only)
```
GET    /api/admin/agencies              # List all agency owners with client counts
```

#### Impersonation (Platform Admin Only)
```
POST   /api/admin/impersonate           # Start impersonating an agency owner
DELETE /api/admin/impersonate           # Stop impersonating
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

### Stripe APIs

```
POST   /api/stripe/checkout             # Create Stripe checkout session (14-day trial)
POST   /api/stripe/portal               # Create Stripe billing portal session
GET    /api/stripe/subscription          # Get current subscription status + client limit
```

### Reply Token APIs

```
POST   /api/reply-tokens                # Create a reply token (stores compose data)
GET    /api/reply-tokens/[token]        # Fetch token data (72-hour TTL)
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
GET    /api/clients/[clientId]/hubspot-settings          # Get HubSpot settings (token, pipelines, sync options)
POST   /api/clients/[clientId]/hubspot-settings          # Update HubSpot settings, connect/disconnect, send setup email
POST   /api/clients/[clientId]/hubspot-backfill          # Backfill historical positive replies to HubSpot
POST   /api/clients/[clientId]/test-hubspot              # Test HubSpot connection with sample contact
```

#### Slack Integration (per client)
```
GET    /api/clients/[clientId]/slack-settings             # Get Slack webhook URL
POST   /api/clients/[clientId]/slack-settings             # Update Slack webhook URL
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
GET    /api/campaigns/[id]/leads?page=1&limit=50  # Campaign leads (paginated)
GET    /api/campaigns/[id]/variant-analytics  # A/B/C variant performance
GET    /api/campaigns/[id]/export-leads       # Export campaign leads
GET    /api/campaigns/[id]/diagnose           # Campaign diagnostics
POST   /api/campaigns/[id]/sync-leads         # Sync leads from provider
POST   /api/campaigns/[id]/sync-emails        # Sync email threads
POST   /api/campaigns/[id]/recalculate        # Recalculate campaign stats
GET    /api/campaigns/[id]/generate-skill     # Download AI skill file (.md) with campaign data, A/B performance, and filled-in email examples
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
3. Sync leads for each campaign (bulk-fetched into memory maps for O(1) matching)
4. Sync email threads for leads with replies
5. Backfill variant info on outbound emails by matching subjects against campaign sequence templates
6. Sync positive leads from provider statistics with variant tracking
7. Backfill `reply_from_step` on replied leads from their outbound email data
8. Update cached analytics counts from local DB state
9. Webhooks handle real-time updates going forward

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

**Key Smartlead API Endpoints Used:**
- `GET /campaigns/{id}/analytics` — Lightweight aggregate stats (sent, opened, replied, bounced)
- `GET /campaigns/{id}/statistics?limit=100&offset=0` — Per-lead engagement data with `reply_time`, `sent_time`, `open_time`, `lead_category`
- `GET /campaigns/{id}/leads?limit=100&offset=0` — Lead list with status and category
- `GET /campaigns/{id}/leads/{id}/message-history` — Email thread for a specific lead

**Lead Sync with Statistics Enrichment:**
During sync, `fetchAllLeadsWithStats()` merges the `/leads` and `/statistics` endpoints to:
1. Set `is_positive_reply` from `lead_category` (Interested, Meeting Request)
2. Track `emailReplyCount` from `reply_time` presence
3. Populate `responded_at` from the Smartlead `reply_time` timestamp

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
├── types.ts              # Shared interfaces: ProviderLead, ProviderCampaignAnalytics, etc.
├── index.ts              # Provider factory (createProvider, getProviderForCampaign)
├── instantly/
│   ├── client.ts         # Instantly HTTP client (Bearer auth)
│   └── index.ts          # Instantly provider implementation
└── smartlead/
    ├── client.ts         # Smartlead HTTP client (query param auth)
    └── index.ts          # Smartlead provider implementation
```

**`ProviderLead` Interface:**
Normalized lead data shared across providers. Key fields:
- `id`, `email`, `firstName`, `lastName`, `companyName`, `companyDomain`
- `status`, `interestStatus` (interested, not_interested, meeting_booked, etc.)
- `emailOpenCount`, `emailClickCount`, `emailReplyCount`
- `repliedAt` — Reply timestamp from provider (e.g., Smartlead `reply_time`)
- `rawData` — Full provider-specific data for export

---

## Webhooks

### Instantly Webhooks

**Endpoint:** `POST /api/webhooks/instantly/[campaignId]`

Configure in Instantly to send events to this URL for each campaign.

**Events Handled:**

| Event | Action |
|-------|--------|
| `lead_interested` | Set `is_positive_reply = true`, send notification email |
| `lead_not_interested` | Set `is_positive_reply = false` |
| `email_sent` | Increment `emails_sent` counter |
| `email_opened` | Atomic increment of lead open count via `increment_lead_counter` RPC |
| `email_replied` | Update `has_replied`, `replied_at` |
| `lead_created` | Create new lead record |
| `link_clicked` | Atomic increment of lead click count via `increment_lead_counter` RPC |
| `meeting_booked` | Update lead status to `booked` |
| `lead_won` | Update lead status to `won` |
| `lead_lost` | Update lead status to `lost` |

**Security:** Webhook payloads are validated using `INSTANTLY_WEBHOOK_SECRET`.

### Smartlead Webhooks

**Endpoint:** `POST /api/webhooks/smartlead/[campaignId]`

Handles similar events from Smartlead campaigns (EMAIL_SENT, EMAIL_REPLY, LEAD_CATEGORY_UPDATED, etc.).

### Unified Provider Webhooks

**Endpoint:** `POST /api/webhooks/[provider]/[campaignId]`

Generic webhook handler that routes to the correct provider implementation based on the `[provider]` path parameter (`instantly` or `smartlead`).

### Stripe Webhooks

**Endpoint:** `POST /api/webhooks/stripe`

**Events Handled:**

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create subscription record in database |
| `customer.subscription.updated` | Sync plan/status changes |
| `customer.subscription.deleted` | Mark subscription as canceled |
| `invoice.payment_failed` | Update status to `past_due` |
| `invoice.payment_succeeded` | Update status to `active` |

---

## Cron Jobs

Scheduled endpoints for automated data syncing. All cron endpoints require `?secret=CRON_SECRET` for authentication.

| Endpoint | Purpose | Recommended Schedule |
|----------|---------|---------------------|
| `GET /api/cron/smartlead-stats?secret=...` | Sync Smartlead campaign stats (lightweight: 2 API calls per campaign) | Every 4 hours |
| `GET /api/cron/analytics-snapshot?secret=...` | Create daily analytics snapshot for Instantly campaigns | `0 6 * * *` (daily 6 AM UTC) |
| `GET /api/cron/smartlead-weekly?secret=...` | Weekly Smartlead daily analytics backfill | `0 6 * * 1` (Monday 6 AM UTC) |
| `GET /api/cron/stats-report?secret=...` | Send weekly/monthly stats report emails to configured recipients | `0 9 * * 1` (Monday 9 AM UTC) |
| `GET /api/cron/backfill-reply-dates?secret=...` | One-time backfill of `responded_at` from Smartlead `reply_time` | Run manually as needed |

### Smartlead Stats Cron (`/api/cron/smartlead-stats`)

Lightweight cron that syncs cached dashboard stats for all Smartlead campaigns:
- Fetches campaign analytics (2 API calls per campaign: `/analytics` + `/campaigns/{id}`)
- Updates `cached_emails_sent`, `cached_reply_count`, `cached_emails_bounced`, `cached_leads_count`, `cached_contacted_count`
- Compares provider reply count vs local DB reply count, uses the higher value
- Supports `?campaign_id=UUID` param to sync a single campaign
- 200ms delay between campaigns for rate limiting

### Backfill Reply Dates (`/api/cron/backfill-reply-dates`)

One-time utility to backfill `responded_at` timestamps for Smartlead leads:
- Paginates through Smartlead `/statistics` endpoint for each campaign
- Extracts `reply_time` per lead and updates `responded_at` in Supabase
- Only updates leads where `responded_at` is currently NULL
- Supports `?campaign_id=UUID` param for single-campaign backfill

### Stats Report (`/api/cron/stats-report`)

Sends HTML email reports to configured notification recipients:
- Uses `campaign_analytics_daily` for date-filtered data (weekly/monthly periods)
- Falls back to cached campaign stats when daily analytics data is unavailable or all zeros (common for Smartlead campaigns)
- Recipients configured per client in notification settings

### Setup Options

**cron-job.org** (recommended for Railway/Docker deployments):
1. Create a free account at [cron-job.org](https://cron-job.org)
2. Add jobs pointing to `https://your-domain.com/api/cron/{endpoint}?secret=YOUR_CRON_SECRET`
3. Set schedule (e.g., every 4 hours for smartlead-stats, weekly for stats-report)

**Vercel Cron** (for Vercel deployments):
```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/smartlead-stats?secret=...", "schedule": "0 */4 * * *" },
    { "path": "/api/cron/analytics-snapshot?secret=...", "schedule": "0 6 * * *" },
    { "path": "/api/cron/stats-report?secret=...", "schedule": "0 9 * * 1" }
  ]
}
```

**GitHub Actions / Supabase pg_cron:** See `CRON_SETUP.md` for additional setup options.

---

## Infrastructure Health Monitoring

### Overview

Monitor email account health across all providers with DNS validation. Accessible at `/admin/infrastructure`. All data scoped to the agency owner's email accounts.

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
| `PositiveReplyNotification.tsx` | Webhook: positive reply | Alert with "Reply to Lead" and "View in Dashboard" buttons |
| `StatsReport.tsx` | Weekly cron job | Summary of campaign performance |

### Smart Reply System

When a positive reply notification is sent, the "Reply to Lead" button uses a **reply token** system:
1. Server creates a short-lived token storing the lead's email, subject, and quoted thread
2. Notification email links to `/reply?token=...`
3. First visit: user chooses Gmail or Outlook
4. Preference saved to localStorage for auto-redirect on future clicks
5. Tokens expire after 72 hours

---

## Billing & Subscriptions

### Plans

| Plan | Price | Client Limit | Features |
|------|-------|-------------|----------|
| **Starter** | $49/mo | 3 clients | All features |
| **Growth** | $99/mo | 10 clients | All features |
| **Agency** | $249/mo | Unlimited | All features |

All plans include a **14-day free trial** with no credit card required upfront.

### How It Works

1. New agency owner signs up → redirected to `/choose-plan`
2. Selects a plan → Stripe Checkout with 14-day trial
3. Subscription synced to `stripe_subscriptions` table via webhook
4. Client creation enforced against plan limits
5. Trial/past-due banners shown in admin layout
6. "Manage Billing" in `/admin/billing` opens Stripe customer portal

### Super Admin

Platform super admins (configured in `src/lib/stripe/helpers.ts`) get free unlimited access without needing a subscription.

---

## Multi-Tenancy & Impersonation

### Owner Scoping

Every agency owner's data is fully isolated:

- `clients.owner_id` — each client belongs to exactly one agency
- `settings.owner_id` — API keys, branding per agency
- `email_accounts.owner_id` — infrastructure per agency
- `subscriptions.owner_id` — credit tracking per agency
- `lead_sources.owner_id` — lead database per agency
- Campaigns, leads, analytics all chain through `client_id → clients.owner_id`

The `getEffectiveOwnerId()` helper ensures every API route and server component filters by the correct owner, with no unscoped code paths.

### Impersonation (Platform Admin)

Platform admins can view any agency's workspace exactly as the agency owner sees it:

1. Go to **Settings → Agency Owners**
2. Click **"View Dashboard"** on any agency
3. An amber banner appears: "Viewing as: Agency Name (email) · Stop Viewing"
4. All data (clients, campaigns, leads, infrastructure, settings) is scoped to that agency
5. Click **"Stop Viewing"** to return to the platform admin's own dashboard

Implementation uses an httpOnly cookie (`x-view-as-owner`) with 8-hour expiry, read by `getEffectiveOwnerId()` in every API route.

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
- `app` service: Next.js application (internal, not port-exposed)
- `caddy` service: Reverse proxy with automatic HTTPS on ports 80/443
- Shared `web` bridge network between services

```yaml
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
      - SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
      - INSTANTLY_WEBHOOK_SECRET=${INSTANTLY_WEBHOOK_SECRET}
      - CRON_SECRET=${CRON_SECRET}
    networks:
      - web

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - web
    depends_on:
      - app

networks:
  web:
    driver: bridge

volumes:
  caddy_data:
  caddy_config:
```

### Railway Deployment (Production)

1. Connect your GitHub repository to Railway
2. Add all environment variables in the Railway dashboard (including `CRON_SECRET`)
3. Railway auto-deploys on push to `main`
4. Set up external cron jobs via [cron-job.org](https://cron-job.org) (see [Cron Jobs](#cron-jobs))
5. Set up Stripe webhook endpoint pointing to your Railway URL

### Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Add all environment variables in the Vercel dashboard
3. Deploy
4. Configure cron jobs in `vercel.json` (see [Cron Jobs](#cron-jobs))
5. Set up Stripe webhook endpoint pointing to your Vercel URL

### Environment-Specific Configuration

| Environment | Database | Providers | Billing | Email |
|-------------|----------|-----------|---------|-------|
| Development | Supabase Dev Project | Instantly/Smartlead Sandbox | Stripe Test Mode | Resend Test |
| Staging | Supabase Staging Project | Instantly/Smartlead Sandbox | Stripe Test Mode | Resend Test |
| Production | Supabase Production Project | Instantly/Smartlead Production | Stripe Live Mode | Resend Production |

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
│   │   ├── layout.tsx                  # Admin layout (header, banners)
│   │   ├── billing/                    # Subscription billing
│   │   │   ├── page.tsx                # Billing overview
│   │   │   └── billing-actions.tsx     # Manage billing button
│   │   ├── clients/                    # Client management
│   │   │   └── [clientId]/             # Individual client
│   │   │       ├── page.tsx            # Client dashboard + lead workflow
│   │   │       ├── settings/page.tsx   # Client settings
│   │   │       └── campaigns/          # Campaign management
│   │   │           ├── page.tsx        # Campaign list
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
│   │   ├── ai-campaigns/page.tsx       # AI campaign builder (5-step wizard)
│   │   ├── scraping/page.tsx           # Lead scraping (coming soon)
│   │   ├── notes/page.tsx              # Internal notes
│   │   ├── subscriptions/page.tsx      # Subscription tracking
│   │   └── settings/page.tsx           # Agency settings + agency owners list
│   │
│   ├── api/                            # API routes
│   │   ├── admin/                      # Admin-only endpoints
│   │   │   ├── agencies/route.ts       # List agency owners (platform admin)
│   │   │   ├── analytics/              # Analytics + sync
│   │   │   ├── customers/              # Client CRUD
│   │   │   ├── impersonate/route.ts    # Impersonation start/stop
│   │   │   ├── infrastructure/         # Infrastructure health
│   │   │   ├── invitations/            # Client invitations
│   │   │   ├── lead-database/          # Lead database queries
│   │   │   ├── leads/                  # Lead export
│   │   │   ├── notes/                  # Notes CRUD
│   │   │   ├── notification-preferences/
│   │   │   ├── settings/               # App settings + logo
│   │   │   └── subscriptions/          # Subscription info
│   │   ├── stripe/                     # Stripe billing endpoints
│   │   │   ├── checkout/route.ts       # Create checkout session
│   │   │   ├── portal/route.ts         # Create billing portal session
│   │   │   └── subscription/route.ts   # Get subscription status
│   │   ├── reply-tokens/               # Smart reply token system
│   │   │   ├── route.ts                # Create token
│   │   │   └── [token]/route.ts        # Fetch token data
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
│   │   │   ├── [provider]/[campaignId]/ # Unified provider webhooks
│   │   │   ├── instantly/[campaignId]/ # Instantly webhooks
│   │   │   ├── smartlead/[campaignId]/ # Smartlead webhooks
│   │   │   └── stripe/route.ts         # Stripe webhooks
│   │   ├── cron/                       # Scheduled jobs
│   │   │   ├── analytics-snapshot/     # Daily Instantly analytics snapshot
│   │   │   ├── smartlead-stats/        # Smartlead cached stats sync (every 4h)
│   │   │   ├── smartlead-weekly/       # Weekly Smartlead daily analytics backfill
│   │   │   ├── stats-report/           # Weekly/monthly stats email reports
│   │   │   └── backfill-reply-dates/   # One-time reply date backfill from Smartlead
│   │   └── demo/                       # Demo utilities
│   │
│   ├── auth/                           # Auth routes
│   │   ├── callback/                   # OAuth callback handler
│   │   ├── signout/                    # Sign out
│   │   └── accept-invite/              # Accept client invitation
│   │
│   ├── choose-plan/page.tsx            # Post-signup plan selection
│   ├── reply/page.tsx                  # Smart email reply redirect (Gmail/Outlook)
│   │
│   ├── login/                          # Login page
│   │   ├── page.tsx
│   │   └── login-client.tsx            # Context-aware login (agency vs client)
│   ├── access-denied/page.tsx          # Access denied page
│   ├── page.tsx                        # Landing page (testimonials with photos)
│   ├── layout.tsx                      # Root layout (SEO metadata)
│   ├── sitemap.ts                      # Auto-generated /sitemap.xml
│   ├── robots.ts                       # Auto-generated /robots.txt
│   └── globals.css                     # Global styles
│
├── components/
│   ├── admin/                          # Admin-specific components
│   │   ├── add-customer-dialog.tsx
│   │   ├── delete-customer-dialog.tsx
│   │   └── impersonation-banner.tsx    # Amber "Viewing as" banner
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
├── hooks/
│   └── useVisibilityPolling.ts         # Auto-refresh hook (30s polling)
│
├── lib/
│   ├── auth.ts                         # Auth helpers (requireAdmin, getEffectiveOwnerId, etc.)
│   ├── impersonation.ts                # Impersonation cookie helpers (set/clear/get)
│   ├── utils.ts                        # General utilities (cn, etc.)
│   ├── supabase/                       # Supabase clients
│   │   ├── client.ts                   # Browser client
│   │   ├── server.ts                   # Server client
│   │   └── middleware.ts               # Auth middleware
│   ├── stripe/                         # Stripe billing
│   │   ├── client.ts                   # Stripe instance singleton
│   │   ├── config.ts                   # Plan definitions (Starter/Growth/Agency)
│   │   └── helpers.ts                  # isSuperAdmin(), getUserSubscription()
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
│       ├── send.ts                     # Resend send wrapper + reply URL builders
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
├── components.json             # shadcn/ui config
├── docker-compose.yml          # Docker multi-service config
├── Dockerfile                  # Container build config
├── eslint.config.mjs           # ESLint configuration
├── next.config.ts              # Next.js configuration
├── package.json                # Dependencies and scripts
├── tsconfig.json               # TypeScript configuration
├── supabase-schema.sql         # Migration 1: Core schema
├── supabase-schema-v2.sql      # Migration 2: Multi-provider + denormalization
├── supabase-settings.sql       # Migration 3: Settings table
├── supabase-preserve-leads.sql # Migration 4: Lead preservation triggers
├── supabase-analytics.sql      # Migration 5: Analytics views + functions
├── supabase-add-icp.sql        # Migration 6: ICP fields
└── supabase/migrations/        # Numbered migrations
    ├── 20260221_add_webhook_idempotency_and_sync_lock.sql
    ├── 20260303_add_reply_tokens.sql
    ├── 20260304_add_stripe_billing.sql
    ├── 20260304_add_multi_tenancy.sql
    ├── 20260305_add_owner_scoping.sql
    ├── 20260305_fix_rls_recursion.sql
    ├── 20260306_fix_clients_rls_leak.sql
    ├── 20260307_copy_reviews.sql
    └── 20260328_add_atomic_lead_counter.sql
```

---

## Performance Optimizations

### Database Query Efficiency
- **Bulk lead matching**: Sync operations load all campaign leads into in-memory Maps for O(1) lookups, eliminating N+1 query patterns
- **Parallel analytics**: Client analytics are fetched in parallel batches of 10 using `Promise.allSettled`, reducing admin dashboard load time by 3-5x
- **Atomic counters**: Lead open/click/reply counts use PostgreSQL `increment_lead_counter` RPC function to prevent lost events under concurrent webhooks
- **Campaign counter capping**: `emails_sent` is capped to `leads_count` per campaign to prevent multi-step sequence inflation

### Data Accuracy
- **Variant tracking backfill**: During sync, outbound emails are matched to sequence variants by subject/body, and replied leads without variant data are inferred from their outbound email history
- **Idempotent webhooks**: Webhook handlers use `webhook_logs` with idempotency keys and unique constraint handling to prevent duplicate processing
- **Email thread cleanup**: VML/CSS artifacts from Outlook emails are stripped from both HTML and plain text bodies before building reply compose URLs

### Caching Strategy
- **Campaign analytics**: Cached in `cached_emails_sent`, `cached_reply_count`, etc. on the campaigns table, refreshed on sync and webhook events
- **Variant analytics**: Cached for 24 hours in `cached_variant_stats` column, with force-refresh option
- **DNS health**: Cached in `domain_health` table with `last_checked_at` timestamps

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
