-- Phase 2: standardize existing lead statuses before deploying the application.
-- Run this migration once in the Supabase SQL Editor, before deploying the
-- application code that only accepts canonical statuses. Do not run it from
-- the browser or Netlify functions.
--
-- The transaction rejects unknown or null statuses before making any change so
-- operators can inspect and resolve those records without data loss.

begin;

lock table public.leads in share row exclusive mode;

-- Fail before changing lead data or schema if a policy outside the known
-- historical policy grants broad access to browser-facing Supabase roles.
-- Policies are not deleted automatically because their intent must be reviewed.
do $$
declare
  unexpected_policy text;
begin
  select policyname
  into unexpected_policy
  from pg_policies
  where schemaname = 'public'
    and tablename = 'leads'
    and policyname <> 'Allow Netlify service role full access'
    and roles && array['public', 'anon', 'authenticated']::name[]
    and (
      cmd = 'ALL'
      or coalesce(qual, '') in ('true', '(true)')
      or coalesce(with_check, '') in ('true', '(true)')
    )
  limit 1;

  if unexpected_policy is not null then
    raise exception
      'Lead status migration stopped: unexpected permissive policy "%" on public.leads must be reviewed and removed manually before retrying.',
      unexpected_policy;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.leads
    where status is null
       or lower(trim(status)) not in (
         'new', 'pending', 'contacted', 'qualified', 'in progress',
         'in-progress', 'in_progress', 'won', 'closed won', 'closed-won',
         'closed_won', 'lost', 'closed lost', 'closed-lost', 'closed_lost'
       )
  ) then
    raise exception
      'Lead status migration stopped: unknown or null status values exist. Review them before retrying.';
  end if;
end $$;

update public.leads
set status = case lower(trim(status))
  when 'new' then 'new'
  when 'pending' then 'new'
  when 'contacted' then 'contacted'
  when 'qualified' then 'qualified'
  when 'in progress' then 'qualified'
  when 'in-progress' then 'qualified'
  when 'in_progress' then 'qualified'
  when 'won' then 'won'
  when 'closed won' then 'won'
  when 'closed-won' then 'won'
  when 'closed_won' then 'won'
  when 'lost' then 'lost'
  when 'closed lost' then 'lost'
  when 'closed-lost' then 'lost'
  when 'closed_lost' then 'lost'
end;

alter table public.leads
  alter column status set default 'new',
  alter column status set not null;

alter table public.leads
  drop constraint if exists leads_status_canonical_check,
  add constraint leads_status_canonical_check
    check (status in ('new', 'contacted', 'qualified', 'won', 'lost'));

-- Remove the legacy permissive policy. Service-role server access remains
-- available because it bypasses RLS; no public replacement policy is created.
alter table public.leads enable row level security;
drop policy if exists "Allow Netlify service role full access" on public.leads;

commit;
