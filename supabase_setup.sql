-- =====================================================================
-- MOTIS LEADFLOW - SUPABASE DATABASE SETUP SCRIPT
-- =====================================================================
--
-- Instructions:
-- 1. Go to your Supabase Project Dashboard (supabase.com).
-- 2. Click on the "SQL Editor" tab on the left sidebar.
-- 3. Click "New Query".
-- 4. Copy and paste this entire script into the editor.
-- 5. Click the "Run" button at the top right of the editor.
--
-- =====================================================================

-- 1. Enable UUID Extension (normally enabled by default)
create extension if not exists "uuid-ossp";

-- 2. Drop the table if it already exists (safety reset)
-- drop table if exists leads;

-- 3. Create the leads table with enterprise multi-role columns
create table leads (
    id uuid primary key default gen_random_uuid(),
    created_at timestamptz not null default now(),
    name text not null,
    phone text not null,
    email text,
    location text not null,
    product_line text not null,
    quantity text,
    message text not null,
    status text not null default 'new'
        constraint leads_status_canonical_check
        check (status in ('new', 'contacted', 'qualified', 'won', 'lost')),
    admin_notes text,
    brand text not null default 'motis_industrial',
    referrer_id text,
    ai_estimation jsonb
);

-- 4. Set up helper indexes for fast searching and filtering
-- As your leads grow, this ensures your parents' CRM dashboard loads instantly!
create index if not exists idx_leads_created_at on leads (created_at desc);
create index if not exists idx_leads_brand on leads (brand);
create index if not exists idx_leads_status on leads (status);
create index if not exists idx_leads_referrer on leads (referrer_id);

-- 5. Enable Row Level Security (RLS)
-- This is an enterprise security protocol to lock down access.
alter table leads enable row level security;

-- 6. Do not create public RLS policies.
-- The serverless functions use the Supabase service-role key, which bypasses RLS.
-- With RLS enabled and no public policy, browser clients cannot read or write leads.

-- =====================================================================
-- Verification Query
-- Run this query to ensure the table was created successfully:
-- select * from leads;
-- =====================================================================
