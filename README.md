# BlueReach Agency Management Dashboard

A comprehensive client portal and lead management system for agencies using [Instantly.ai](https://instantly.ai) for cold email outreach. Built with Next.js 15, Supabase, and TypeScript.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
- [Instantly Integration](#instantly-integration)
- [Deployment](#deployment)
- [Project Structure](#project-structure)

---

## Overview

BlueReach Agency Management Dashboard is a white-label SaaS platform designed for lead generation agencies. It provides:

- **Admin Portal**: Full control over clients, campaigns, leads, and analytics
- **Client Portal**: Read-only dashboard for clients to view their campaign performance
- **Instantly Integration**: Bidirectional sync with Instantly.ai for campaign and lead management
- **Real-time Analytics**: Track emails sent, opens, replies, and positive responses

---

## Features

### Admin Dashboard (`/admin`)

#### Command Center
- **Real-time Analytics**: View key metrics filtered by time period (this week, this month, this quarter)
  - Leads contacted
  - Emails sent
  - Replies received
  - Positive replies (opportunities)
  - Bounced emails (cumulative)
  - Meetings held (cumulative)
  - Deals closed (cumulative)
- **Clickable Stats**: Click any metric to drill down into the detailed leads view

#### Client Management (`/admin/clients`)
- Create, edit, and delete clients
- Generate unique access codes for client portal login
- View all campaigns per client
- Track client-specific metrics

#### Campaign Management (`/admin/clients/[clientId]`)
- Link Instantly campaigns to clients
- View campaign performance:
  - Total leads in campaign
  - Leads contacted vs total (progress bar)
  - Emails sent
  - Replies received
  - Positive replies
- Click campaigns to view detailed analytics
- Delete campaigns (with confirmation)

#### Campaign Details (`/admin/clients/[clientId]/campaigns/[campaignId]`)
- Detailed campaign statistics
- List of positive replies with contact info
- Recent leads table
- Campaign progress visualization

#### Lead Management (`/admin/leads`)
- View all leads across all clients (48,000+ supported)
- **Server-side Filtering**:
  - Filter by client
  - Filter by status (contacted, opened, clicked, replied, booked, won, lost, not_interested)
  - Filter by positive replies only
- **Pagination**: 100 leads per page with navigation
- **CSV Export Options**:
  - Current filter results
  - Positive replies only
  - All replies
  - No response (contacted but didn't reply)
  - All leads
- Click any lead to view/edit details in slide-out panel

#### Lead Detail Panel
- View complete lead information
- Update lead status
- Add/edit notes
- View contact details (email, phone, company)

#### Instantly Integration (`/admin/instantly`)
- **Connection Status**: View API connection health
- **Campaign Sync**: Import campaigns from Instantly
- **Lead Sync**: Sync leads bidirectionally
- **Account Management**: View email accounts and warmup status
- **Analytics**: View Instantly-specific metrics

#### Settings (`/admin/settings`)
- Configure webhook endpoints
- Manage sync settings
- View system configuration

### Client Portal (`/dashboard/[clientId]`)

- **Login via Access Code**: Clients use a unique code to access their dashboard
- **Campaign Overview**: View all campaigns assigned to them
- **Lead Statistics**: See leads, replies, and positive responses
- **Lead Table**: Browse their leads with filtering
- **Read-only Access**: Clients cannot modify data

### Authentication

- **Admin Access**: Full authentication via Supabase Auth
- **Client Access**: Simple access code system (no email/password required)
- **Middleware Protection**: Routes protected based on user role

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Next.js 15** | React framework with App Router |
| **TypeScript** | Type-safe development |
| **Supabase** | PostgreSQL database + Auth + Real-time |
| **Tailwind CSS** | Utility-first styling |
| **shadcn/ui** | UI component library |
| **Instantly API v2** | Cold email platform integration |
| **Docker** | Containerized deployment |
| **Caddy** | Reverse proxy with auto HTTPS |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Browser                          │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js Application                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │   Admin Pages   │  │  Client Pages   │  │   API Routes    │ │
│  │   /admin/*      │  │  /dashboard/*   │  │   /api/*        │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                    │                               │
                    ▼                               ▼
┌───────────────────────────────┐   ┌─────────────────────────────┐
│         Supabase              │   │      Instantly API          │
│  ┌─────────────────────────┐  │   │  ┌───────────────────────┐  │
│  │  PostgreSQL Database    │  │   │  │  Campaigns            │  │
│  │  - clients              │  │   │  │  Leads                │  │
│  │  - campaigns            │  │   │  │  Analytics            │  │
│  │  - leads                │  │   │  │  Accounts             │  │
│  │  - users                │  │   │  └───────────────────────┘  │
│  └─────────────────────────┘  │   └─────────────────────────────┘
│  ┌─────────────────────────┐  │
│  │  Authentication         │  │
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

### Data Flow

1. **Instantly → Supabase**: Campaigns and leads sync via API or webhooks
2. **Supabase → Next.js**: Server components fetch data directly
3. **Next.js → Browser**: React renders the UI
4. **Browser → API Routes**: Client-side actions (status updates, exports)

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Supabase account
- Instantly.ai account with API access

### Installation

```bash
# Clone the repository
git clone https://github.com/Toagan/BlueReach-Agency-Management-SAAS.git
cd BlueReach-Agency-Management-SAAS

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# Run database migrations
# Execute the SQL files in Supabase SQL Editor:
# 1. supabase-schema.sql
# 2. supabase-schema-v2.sql
# 3. supabase-settings.sql
# 4. supabase-preserve-leads.sql

# Start development server
npm run dev
```

### Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Type checking
npm run type-check

# Linting
npm run lint
```

---

## Environment Variables

Create a `.env.local` file with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Instantly API
INSTANTLY_API_KEY=your-instantly-api-key

# Webhook Security
INSTANTLY_WEBHOOK_SECRET=your-webhook-secret
```

### Variable Descriptions

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `INSTANTLY_API_KEY` | Instantly API key (found in Instantly settings) |
| `INSTANTLY_WEBHOOK_SECRET` | Secret for validating Instantly webhooks |

---

## Database Schema

### Tables

#### `clients`
Stores agency clients.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `name` | text | Client name |
| `email` | text | Client email |
| `access_code` | text | Unique login code for client portal |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

#### `campaigns`
Links Instantly campaigns to clients.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `client_id` | uuid | Foreign key to clients |
| `instantly_campaign_id` | text | Instantly campaign ID |
| `name` | text | Campaign name |
| `status` | text | Campaign status |
| `created_at` | timestamp | Creation timestamp |
| `last_synced_at` | timestamp | Last sync with Instantly |

#### `leads`
Stores all leads from campaigns.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid | Primary key |
| `campaign_id` | uuid | Foreign key to campaigns |
| `client_id` | uuid | Denormalized client ID |
| `client_name` | text | Denormalized client name |
| `campaign_name` | text | Denormalized campaign name |
| `email` | text | Lead email address |
| `first_name` | text | Lead first name |
| `last_name` | text | Lead last name |
| `company_name` | text | Lead company |
| `phone` | text | Lead phone number |
| `status` | enum | Lead status (see below) |
| `is_positive_reply` | boolean | Whether reply was positive |
| `notes` | text | Admin notes |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last update timestamp |

**Lead Status Values:**
- `contacted` - Initial outreach sent
- `opened` - Email was opened
- `clicked` - Link in email was clicked
- `replied` - Lead replied to email
- `booked` - Meeting was booked
- `won` - Deal was closed (won)
- `lost` - Deal was closed (lost)
- `not_interested` - Lead declined

#### `settings`
Application settings (singleton table).

| Column | Type | Description |
|--------|------|-------------|
| `id` | integer | Always 1 |
| `webhook_url` | text | Instantly webhook URL |
| `sync_interval` | integer | Auto-sync interval (minutes) |
| `updated_at` | timestamp | Last update timestamp |

### SQL Migration Files

1. **`supabase-schema.sql`** - Initial schema with clients, campaigns, leads
2. **`supabase-schema-v2.sql`** - Adds denormalized fields for data preservation
3. **`supabase-settings.sql`** - Settings table
4. **`supabase-preserve-leads.sql`** - Triggers to preserve lead data on client/campaign deletion
5. **`supabase-analytics.sql`** - Analytics views and functions

---

## API Reference

### Admin APIs

#### Analytics
```
GET /api/admin/analytics?period=this_week
```
Returns aggregated analytics from Instantly.

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
GET /api/admin/leads/export?export=positive
```
Returns CSV file of leads.

**Query Parameters:**
- `export`: `current` | `positive` | `replied` | `no_response` | `all`
- `client`: Client ID (for `current` filter)
- `status`: Lead status (for `current` filter)
- `positive`: `true` (for `current` filter)

#### Customers (Clients)
```
GET  /api/admin/customers         # List all clients
POST /api/admin/customers         # Create client
GET  /api/admin/customers/[id]    # Get client
PUT  /api/admin/customers/[id]    # Update client
DELETE /api/admin/customers/[id]  # Delete client
```

### Campaign APIs

```
GET    /api/campaigns/[id]/details  # Get campaign details with stats
GET    /api/campaigns/[id]/leads    # Get leads for campaign
DELETE /api/campaigns/[id]          # Delete campaign
```

### Instantly Integration APIs

```
GET  /api/instantly/status              # Check API connection
GET  /api/instantly/campaigns           # List Instantly campaigns
POST /api/instantly/campaigns           # Sync campaigns to DB
GET  /api/instantly/campaigns/[id]      # Get campaign details
POST /api/instantly/campaigns/[id]      # Activate/pause campaign
GET  /api/instantly/campaigns/analytics # Get campaign analytics
GET  /api/instantly/leads               # List leads from Instantly
POST /api/instantly/leads               # Sync leads to DB
GET  /api/instantly/accounts            # List email accounts
POST /api/instantly/sync                # Full sync (campaigns + leads)
```

### Webhook

```
POST /api/webhooks/instantly
```
Receives real-time updates from Instantly when lead status changes.

**Payload:**
```json
{
  "event_type": "reply_received",
  "campaign_id": "abc123",
  "lead_email": "lead@example.com",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Instantly Integration

### Setup

1. Get your API key from Instantly Settings → Integrations → API
2. Add the key to `INSTANTLY_API_KEY` environment variable
3. Configure webhook in Instantly to point to `/api/webhooks/instantly`

### Sync Process

#### Manual Sync
1. Go to Admin → Instantly → Overview
2. Click "Sync Campaigns" to import campaigns
3. Click "Sync Leads" to import leads from all campaigns

#### Automatic Sync
Set up a cron job to call the sync endpoint:
```bash
# Every 15 minutes
*/15 * * * * curl -X POST https://your-domain.com/api/instantly/sync
```

See `CRON_SETUP.md` for detailed instructions.

### Webhook Events

The webhook handler processes these Instantly events:
- `lead_created` - New lead added to campaign
- `email_sent` - Email sent to lead
- `email_opened` - Lead opened email
- `link_clicked` - Lead clicked link
- `reply_received` - Lead replied
- `lead_interested` - Lead marked as positive
- `lead_not_interested` - Lead marked as not interested
- `meeting_booked` - Meeting was scheduled
- `lead_won` - Deal closed won
- `lead_lost` - Deal closed lost

---

## Deployment

### Docker Deployment

```bash
# Build the image
docker build -t bluereach-dashboard .

# Run with Docker Compose
docker-compose up -d
```

#### docker-compose.yml
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
2. Add environment variables in Vercel dashboard
3. Deploy

### Environment-Specific Configuration

| Environment | Database | API |
|-------------|----------|-----|
| Development | Supabase Dev Project | Instantly Sandbox |
| Staging | Supabase Staging Project | Instantly Sandbox |
| Production | Supabase Production Project | Instantly Production |

---

## Project Structure

```
src/
├── app/
│   ├── admin/                    # Admin portal pages
│   │   ├── clients/              # Client management
│   │   │   └── [clientId]/       # Individual client
│   │   │       └── campaigns/    # Campaign management
│   │   │           └── [campaignId]/ # Campaign details
│   │   ├── instantly/            # Instantly integration UI
│   │   ├── leads/                # Lead management
│   │   ├── settings/             # App settings
│   │   ├── layout.tsx            # Admin layout with sidebar
│   │   └── page.tsx              # Command center dashboard
│   │
│   ├── api/                      # API routes
│   │   ├── admin/                # Admin APIs
│   │   │   ├── analytics/        # Analytics endpoints
│   │   │   ├── customers/        # Client CRUD
│   │   │   ├── leads/            # Lead export
│   │   │   └── settings/         # Settings
│   │   ├── campaigns/            # Campaign APIs
│   │   ├── clients/              # Client-specific APIs
│   │   ├── instantly/            # Instantly integration
│   │   └── webhooks/             # Webhook handlers
│   │
│   ├── auth/                     # Auth callback
│   ├── dashboard/                # Client portal
│   │   └── [clientId]/           # Client-specific dashboard
│   ├── login/                    # Login page
│   ├── globals.css               # Global styles
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing page
│
├── components/
│   ├── layout/                   # Layout components
│   │   ├── header.tsx            # Top navigation
│   │   ├── sidebar.tsx           # Admin sidebar
│   │   └── stats-cards.tsx       # Statistics display
│   ├── leads/                    # Lead components
│   │   ├── lead-detail-panel.tsx # Slide-out detail view
│   │   └── lead-table.tsx        # Lead listing table
│   └── ui/                       # shadcn/ui components
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── select.tsx
│       ├── sheet.tsx
│       ├── table.tsx
│       └── textarea.tsx
│
├── lib/
│   ├── instantly/                # Instantly API client
│   │   ├── accounts.ts           # Account management
│   │   ├── analytics.ts          # Analytics fetching
│   │   ├── campaigns.ts          # Campaign operations
│   │   ├── client.ts             # Base HTTP client
│   │   ├── index.ts              # Exports
│   │   ├── leads.ts              # Lead operations
│   │   └── types.ts              # TypeScript types
│   ├── queries/                  # Database queries
│   │   ├── campaigns.ts
│   │   ├── clients.ts
│   │   ├── leads.ts
│   │   └── stats.ts
│   ├── supabase/                 # Supabase clients
│   │   ├── client.ts             # Browser client
│   │   ├── middleware.ts         # Auth middleware
│   │   └── server.ts             # Server client
│   └── utils.ts                  # Utility functions
│
├── types/
│   └── database.ts               # Database type definitions
│
└── middleware.ts                 # Next.js middleware
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
