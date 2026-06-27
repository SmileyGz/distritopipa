-- ─────────────────────────────────────────────────────────────
-- Distrito Pipa — Supabase Migration
-- File: 001_age_gate_logs.sql
-- Run in: Supabase Dashboard → SQL Editor
-- ─────────────────────────────────────────────────────────────

-- Age gate consent log
-- Stores anonymous yes/no events. No PII. Used for:
--   • Legal paper trail of age verification
--   • Funnel analytics (how many deny vs confirm)
--   • LFPDPPP compliance documentation

create table if not exists age_gate_logs (
  id          uuid primary key default gen_random_uuid(),
  granted     boolean not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- Index for fast date-range queries in the admin dashboard
create index age_gate_logs_created_at_idx on age_gate_logs (created_at desc);

-- Row Level Security: anon users can INSERT (log consent) but never SELECT
alter table age_gate_logs enable row level security;

create policy "Anon can log consent"
  on age_gate_logs for insert
  to anon
  with check (true);

create policy "Only service role can read logs"
  on age_gate_logs for select
  to service_role
  using (true);

-- ─────────────────────────────────────────────────────────────
-- Convenience view for the admin dashboard
-- Shows today's gate stats at a glance
-- ─────────────────────────────────────────────────────────────

create or replace view age_gate_summary as
select
  count(*) filter (where granted = true)  as verified_today,
  count(*) filter (where granted = false) as denied_today,
  round(
    count(*) filter (where granted = true)::numeric
    / nullif(count(*), 0) * 100, 1
  )                                        as pass_rate_pct,
  date_trunc('day', now())                as date
from age_gate_logs
where created_at >= date_trunc('day', now());
