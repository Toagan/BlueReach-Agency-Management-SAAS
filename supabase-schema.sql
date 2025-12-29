-- Agency Client Portal Database Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- HELPER FUNCTION: Auto-update updated_at
-- ============================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- ============================================
-- 1. Profiles (Internal users/Clients)
-- ============================================
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  role text check (role in ('admin', 'client')) default 'client',
  full_name text,
  avatar_url text,
  phone text,
  timezone text default 'UTC',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure update_updated_at_column();

-- ============================================
-- 2. Clients (The companies you serve)
-- ============================================
create table if not exists clients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  logo_url text,
  website text,
  notes text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create trigger clients_updated_at
  before update on clients
  for each row execute procedure update_updated_at_column();

-- ============================================
-- 3. Campaigns (Linked to Instantly/Smartlead IDs)
-- ============================================
create table if not exists campaigns (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references clients(id) on delete cascade,
  instantly_campaign_id text unique,
  smartlead_campaign_id text unique,
  name text not null,
  copy_body text,
  status text check (status in ('draft', 'active', 'paused', 'completed')) default 'draft',
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create trigger campaigns_updated_at
  before update on campaigns
  for each row execute procedure update_updated_at_column();

-- ============================================
-- 4. Leads (The data your clients interact with)
-- ============================================
create table if not exists leads (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references campaigns(id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  company_name text,
  phone text,
  website text,
  linkedin_url text,
  job_title text,
  -- Pipeline status (internal tracking)
  status text check (status in ('new', 'contacted', 'replied', 'interested', 'meeting_scheduled', 'meeting_completed', 'proposal_sent', 'won', 'lost', 'unqualified')) default 'new',
  -- Instantly interest status (from email tool)
  interest_status text check (interest_status in ('interested', 'not_interested', 'neutral', 'wrong_person', 'out_of_office')),
  -- External IDs
  instantly_lead_id text,
  smartlead_lead_id text,
  -- Additional data
  lead_data jsonb default '{}'::jsonb,
  notes text,
  -- Email engagement tracking
  emails_sent integer default 0,
  emails_opened integer default 0,
  last_contacted_at timestamp with time zone,
  last_replied_at timestamp with time zone,
  -- Timestamps
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create trigger leads_updated_at
  before update on leads
  for each row execute procedure update_updated_at_column();

-- ============================================
-- 5. Client-User junction table (for multi-tenant access)
-- ============================================
create table if not exists client_users (
  client_id uuid references clients(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  role text check (role in ('viewer', 'editor', 'owner')) default 'viewer',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (client_id, user_id)
);

-- Create unique constraint for lead upsert (email + campaign_id)
create unique index if not exists leads_campaign_email_unique on leads(campaign_id, email);

-- ============================================
-- 6. Campaign Analytics (Historical metrics from Instantly/Smartlead)
-- ============================================
create table if not exists campaign_analytics (
  id uuid default gen_random_uuid() primary key,
  campaign_id uuid references campaigns(id) on delete cascade not null,
  date date not null,
  -- Email metrics
  emails_sent integer default 0,
  emails_delivered integer default 0,
  emails_opened integer default 0,
  unique_opens integer default 0,
  emails_replied integer default 0,
  emails_bounced integer default 0,
  -- Lead metrics
  new_leads integer default 0,
  leads_contacted integer default 0,
  -- Calculated rates (stored for quick access)
  open_rate numeric(5,2) default 0,
  reply_rate numeric(5,2) default 0,
  bounce_rate numeric(5,2) default 0,
  -- Metadata
  source text check (source in ('instantly', 'smartlead', 'manual')) default 'instantly',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  -- One record per campaign per day
  unique (campaign_id, date)
);

create trigger campaign_analytics_updated_at
  before update on campaign_analytics
  for each row execute procedure update_updated_at_column();

-- ============================================
-- 7. Activity Log (Audit trail)
-- ============================================
create table if not exists activity_log (
  id uuid default gen_random_uuid() primary key,
  -- Who performed the action
  user_id uuid references profiles(id) on delete set null,
  -- What was affected
  entity_type text not null, -- 'lead', 'campaign', 'client', etc.
  entity_id uuid not null,
  -- What happened
  action text not null, -- 'created', 'updated', 'deleted', 'status_changed', etc.
  -- Details of the change
  old_values jsonb,
  new_values jsonb,
  metadata jsonb default '{}'::jsonb,
  -- When it happened
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Index for quick lookups by entity
create index idx_activity_log_entity on activity_log(entity_type, entity_id);
create index idx_activity_log_user on activity_log(user_id);
create index idx_activity_log_created on activity_log(created_at desc);

-- ============================================
-- 8. Email Threads (Optional: Store email history)
-- ============================================
create table if not exists email_threads (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid references leads(id) on delete cascade not null,
  campaign_id uuid references campaigns(id) on delete cascade,
  instantly_thread_id text,
  subject text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create trigger email_threads_updated_at
  before update on email_threads
  for each row execute procedure update_updated_at_column();

create table if not exists emails (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid references email_threads(id) on delete cascade not null,
  instantly_email_id text,
  from_email text not null,
  to_email text not null,
  subject text,
  body_preview text, -- First 500 chars
  is_reply boolean default false,
  is_inbound boolean default false, -- true = from lead, false = from us
  sent_at timestamp with time zone,
  opened_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ============================================
-- PERFORMANCE INDEXES
-- ============================================
create index if not exists idx_leads_campaign_id on leads(campaign_id);
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_interest_status on leads(interest_status);
create index if not exists idx_leads_created_at on leads(created_at desc);
create index if not exists idx_campaigns_client_id on campaigns(client_id);
create index if not exists idx_campaigns_status on campaigns(status);
create index if not exists idx_client_users_user_id on client_users(user_id);
create index if not exists idx_campaign_analytics_date on campaign_analytics(date desc);
create index if not exists idx_emails_thread_id on emails(thread_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable Row Level Security
alter table profiles enable row level security;
alter table clients enable row level security;
alter table campaigns enable row level security;
alter table leads enable row level security;
alter table client_users enable row level security;
alter table campaign_analytics enable row level security;
alter table activity_log enable row level security;
alter table email_threads enable row level security;
alter table emails enable row level security;

-- RLS Policies

-- Profiles: Users can only read their own profile
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id);

-- Admins can do anything with profiles
create policy "Admins can manage all profiles"
  on profiles for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Clients: Admins see all, users see only linked clients
create policy "Admins can manage all clients"
  on clients for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can view linked clients"
  on clients for select
  using (
    exists (
      select 1 from client_users
      where client_id = clients.id and user_id = auth.uid()
    )
  );

-- Campaigns: Access through client permissions
create policy "Admins can manage all campaigns"
  on campaigns for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can view campaigns of linked clients"
  on campaigns for select
  using (
    exists (
      select 1 from client_users
      where client_id = campaigns.client_id and user_id = auth.uid()
    )
  );

-- Leads: Access through campaign -> client permissions
create policy "Admins can manage all leads"
  on leads for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can view leads of linked clients"
  on leads for select
  using (
    exists (
      select 1 from campaigns c
      join client_users cu on cu.client_id = c.client_id
      where c.id = leads.campaign_id and cu.user_id = auth.uid()
    )
  );

create policy "Users can update leads of linked clients"
  on leads for update
  using (
    exists (
      select 1 from campaigns c
      join client_users cu on cu.client_id = c.client_id
      where c.id = leads.campaign_id and cu.user_id = auth.uid()
    )
  );

-- Client Users: Admins can manage, users can view their own links
create policy "Admins can manage client_users"
  on client_users for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can view own client links"
  on client_users for select
  using (user_id = auth.uid());

-- Campaign Analytics: Access through campaign -> client permissions
create policy "Admins can manage all campaign_analytics"
  on campaign_analytics for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can view analytics of linked clients"
  on campaign_analytics for select
  using (
    exists (
      select 1 from campaigns c
      join client_users cu on cu.client_id = c.client_id
      where c.id = campaign_analytics.campaign_id and cu.user_id = auth.uid()
    )
  );

-- Activity Log: Admins can see all, users can see activity for their clients
create policy "Admins can manage activity_log"
  on activity_log for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can view own activity"
  on activity_log for select
  using (user_id = auth.uid());

-- Email Threads: Access through lead -> campaign -> client permissions
create policy "Admins can manage all email_threads"
  on email_threads for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can view email_threads of linked clients"
  on email_threads for select
  using (
    exists (
      select 1 from leads l
      join campaigns c on c.id = l.campaign_id
      join client_users cu on cu.client_id = c.client_id
      where l.id = email_threads.lead_id and cu.user_id = auth.uid()
    )
  );

-- Emails: Access through thread -> lead -> campaign -> client permissions
create policy "Admins can manage all emails"
  on emails for all
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Users can view emails of linked clients"
  on emails for select
  using (
    exists (
      select 1 from email_threads et
      join leads l on l.id = et.lead_id
      join campaigns c on c.id = l.campaign_id
      join client_users cu on cu.client_id = c.client_id
      where et.id = emails.thread_id and cu.user_id = auth.uid()
    )
  );

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Function to automatically create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role, full_name)
  values (
    new.id,
    new.email,
    'client',
    new.raw_user_meta_data->>'full_name'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger for new user signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
