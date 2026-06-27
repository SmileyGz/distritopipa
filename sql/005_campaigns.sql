-- ═══════════════════════════════════════════════════════════════
-- Distrito Pipa — Migration 005: Social Media Campaign Builder
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── CAMPAIGNS ────────────────────────────────────────────────
-- Each campaign is a named 2-month content plan.
-- Examples: "Septiembre Fumador", "Navidad 2025", "Lanzamiento Bongs"

create table if not exists campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  theme         text,                    -- e.g. "Temporada de frío", "Nuevos bongs"
  description   text,
  start_date    date not null,
  end_date      date not null,
  status        text not null default 'active'
                check (status in ('active','completed','paused','archived')),
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ── CAMPAIGN POSTS ────────────────────────────────────────────
-- Each post in a campaign calendar.
-- Linked to a campaign, optionally linked to a product.

create table if not exists campaign_posts (
  id              uuid primary key default gen_random_uuid(),
  campaign_id     uuid not null references campaigns(id) on delete cascade,

  -- Calendar position
  scheduled_date  date not null,
  week_number     integer,             -- 1–8 within the campaign
  day_of_week     text,                -- 'lunes', 'martes', etc.

  -- Content
  post_type       text not null default 'product'
                  check (post_type in ('product','lifestyle','promo','story','reel','community')),
  platform        text not null default 'instagram'
                  check (platform in ('instagram_feed','instagram_story','instagram_reel','facebook','facebook_story')),
  caption         text,
  hashtags        text,                -- space-separated
  cta             text,                -- call to action line
  image_note      text,                -- description of what image/video to use

  -- Product link (optional)
  product_id      uuid references products(id) on delete set null,
  product_name    text,                -- cached for display even if product deleted
  product_price   numeric(10,2),

  -- Legal compliance — always appended to captions on export
  include_disclaimer  boolean default true,

  -- Status pipeline
  status          text not null default 'draft'
                  check (status in ('draft','ready','posted')),

  posted_at       timestamptz,         -- when you marked it posted
  posted_url      text,                -- optional link to the live post

  -- AI generation metadata
  ai_generated    boolean default false,
  ai_prompt       text,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Auto-compute week_number and day_of_week from scheduled_date + campaign start
create or replace function set_post_week_day()
returns trigger as $$
declare
  campaign_start date;
  days_offset    integer;
  day_names      text[] := array['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
begin
  select start_date into campaign_start
  from campaigns where id = new.campaign_id;

  days_offset := new.scheduled_date - campaign_start;
  new.week_number := floor(days_offset / 7) + 1;
  new.day_of_week := day_names[extract(dow from new.scheduled_date)::int + 1];
  new.updated_at  := now();
  return new;
end;
$$ language plpgsql;

create trigger campaign_posts_week_day
before insert or update of scheduled_date on campaign_posts
for each row execute function set_post_week_day();

-- ── INDEXES ───────────────────────────────────────────────────
create index campaign_posts_campaign_idx on campaign_posts (campaign_id, scheduled_date);
create index campaign_posts_status_idx   on campaign_posts (status);
create index campaign_posts_product_idx  on campaign_posts (product_id);

-- ── RLS ──────────────────────────────────────────────────────
alter table campaigns      enable row level security;
alter table campaign_posts enable row level security;

-- Only service role (admin panel) can manage campaigns
create policy "Admin full access on campaigns"
  on campaigns for all to service_role using (true);

create policy "Admin full access on campaign_posts"
  on campaign_posts for all to service_role using (true);

-- ── VIEWS ────────────────────────────────────────────────────

-- Full calendar view with product info joined
create or replace view campaign_calendar as
select
  cp.*,
  c.name        as campaign_name,
  c.start_date  as campaign_start,
  c.theme       as campaign_theme,
  p.name_es     as linked_product_name,
  p.price_mxn   as linked_product_price,
  p.image_paths as linked_product_images
from campaign_posts cp
join campaigns c on c.id = cp.campaign_id
left join products p on p.id = cp.product_id
order by cp.scheduled_date, cp.platform;

-- Campaign progress summary
create or replace view campaign_progress as
select
  c.id,
  c.name,
  c.start_date,
  c.end_date,
  c.status,
  count(cp.id)                                           as total_posts,
  count(cp.id) filter (where cp.status = 'posted')      as posted,
  count(cp.id) filter (where cp.status = 'ready')       as ready,
  count(cp.id) filter (where cp.status = 'draft')       as drafts,
  round(
    count(cp.id) filter (where cp.status = 'posted')::numeric
    / nullif(count(cp.id), 0) * 100, 0
  )                                                       as completion_pct
from campaigns c
left join campaign_posts cp on cp.campaign_id = c.id
group by c.id, c.name, c.start_date, c.end_date, c.status
order by c.start_date desc;

-- ── LEGAL DISCLAIMER ─────────────────────────────────────────
-- Store the standard disclaimer text so it can be updated without code deploys

create table if not exists brand_config (
  key    text primary key,
  value  text not null
);

insert into brand_config (key, value) values
  ('legal_disclaimer',    'Accesorios de uso personal · Producto legal · No incluye sustancias'),
  ('brand_hashtags',      '#DistritoPipa #Cancún #AccesoriosPersonales #PipaDeVidrio'),
  ('whatsapp_cta',        '📲 Pide el tuyo por WhatsApp → distritopipa.com'),
  ('age_disclaimer',      '+18 · Solo adultos')
on conflict (key) do nothing;

alter table brand_config enable row level security;
create policy "Admin reads brand config" on brand_config for all to service_role using (true);
create policy "Public reads brand config" on brand_config for select to anon using (true);
