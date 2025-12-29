# Claude Code Project Configuration

This file provides context for Claude Code when working on this project.

## Project Overview

**BlueReach Agency Management Dashboard** - A Next.js 15 SaaS application for lead generation agencies to manage clients, campaigns, and leads with Instantly.ai integration.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.x | App Router, Server Components, API Routes |
| TypeScript | 5.x | Type-safe development |
| React | 19.x | UI framework |
| Supabase | Latest | PostgreSQL database, Auth, Real-time |
| Tailwind CSS | 3.x | Utility-first styling |
| shadcn/ui | Latest | UI component library |
| Lucide React | Latest | Icons |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── admin/              # Admin portal (protected)
│   ├── api/                # API routes
│   ├── auth/               # Auth callbacks
│   ├── dashboard/          # Client portal
│   └── login/              # Public login page
├── components/
│   ├── layout/             # Layout components (header, sidebar)
│   ├── leads/              # Lead-specific components
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── instantly/          # Instantly API client
│   ├── queries/            # Database query functions
│   └── supabase/           # Supabase client setup
└── types/                  # TypeScript type definitions
```

## Coding Conventions

### TypeScript
- Use strict TypeScript with explicit types
- Define interfaces in `src/types/database.ts` for database entities
- Use `type` for unions/intersections, `interface` for objects

### React/Next.js
- Use Server Components by default
- Add `"use client"` only when needed (useState, useEffect, event handlers)
- Use App Router conventions (page.tsx, layout.tsx, route.ts)
- Prefer server-side data fetching in page components

### API Routes
- Use Route Handlers in `app/api/` directory
- Export named functions: `GET`, `POST`, `PUT`, `DELETE`
- Return `NextResponse.json()` for JSON responses
- Handle errors with try/catch and appropriate status codes

### Styling
- Use Tailwind CSS classes exclusively
- Follow shadcn/ui patterns for components
- Use CSS variables for theming (defined in globals.css)
- No inline styles or CSS modules

### Component Patterns
```tsx
// Server Component (default)
export default async function Page() {
  const data = await fetchData();
  return <Component data={data} />;
}

// Client Component
"use client";
export function InteractiveComponent({ initialData }) {
  const [state, setState] = useState(initialData);
  return <div onClick={() => setState(...)}>...</div>;
}
```

## Database

### Supabase Client Usage
```tsx
// Server-side (API routes, Server Components)
import { createClient } from "@/lib/supabase/server";
const supabase = await createClient();

// Client-side (Client Components)
import { createClient } from "@/lib/supabase/client";
const supabase = createClient();
```

### Key Tables
- `clients` - Agency clients with access codes
- `campaigns` - Linked Instantly campaigns
- `leads` - All leads with denormalized client/campaign data
- `settings` - Application settings (singleton)

### Data Preservation
- Leads have denormalized `client_id`, `client_name`, `campaign_name` fields
- These are preserved when clients/campaigns are deleted
- Always include these fields when creating/updating leads

## Instantly API Integration

### Client Location
All Instantly API functions are in `src/lib/instantly/`:
- `client.ts` - Base HTTP client with auth
- `campaigns.ts` - Campaign operations
- `leads.ts` - Lead operations
- `analytics.ts` - Analytics fetching
- `accounts.ts` - Email account management

### API Key
- Stored in `INSTANTLY_API_KEY` environment variable
- Uses Bearer token authentication
- Base URL: `https://api.instantly.ai`

## Common Tasks

### Adding a New API Route
1. Create file in `src/app/api/[path]/route.ts`
2. Export async function for HTTP method
3. Use `NextRequest` and `NextResponse`

### Adding a New Admin Page
1. Create folder in `src/app/admin/[page-name]/`
2. Add `page.tsx` (Server Component by default)
3. Use existing layout from `src/app/admin/layout.tsx`

### Adding a UI Component
1. Check if shadcn/ui has the component
2. If yes, add to `src/components/ui/` following shadcn patterns
3. If custom, create in appropriate `src/components/` subfolder

### Database Queries
1. Add query function to `src/lib/queries/[entity].ts`
2. Use typed Supabase client
3. Handle errors appropriately

## Environment Variables

Required:
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `INSTANTLY_API_KEY` - Instantly API key
- `INSTANTLY_WEBHOOK_SECRET` - Webhook validation secret

## Important Notes

1. **No emojis** in code unless explicitly requested
2. **Server-side filtering** for large datasets (leads table has 48K+ rows)
3. **Denormalized data** - leads store client/campaign names for data preservation
4. **Time-filtered vs Cumulative** - Analytics have both types, clearly labeled
5. **Access codes** - Clients use simple codes, not email/password auth

## Testing

Currently no automated tests. When adding tests:
- Use Vitest for unit tests
- Use Playwright for E2E tests
- Place tests adjacent to source files or in `__tests__` folders

## Deployment

- Docker support via `Dockerfile` and `docker-compose.yml`
- Caddy for reverse proxy with auto HTTPS
- Vercel-compatible (just connect repo)
