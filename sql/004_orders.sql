-- ═══════════════════════════════════════════════════════════════
-- Distrito Pipa — Migration 004: Orders with payment modes
-- Run in: Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Drop and recreate if you ran the earlier version
-- Otherwise just run the ALTER TABLE blocks below

create table if not exists orders (
  id              uuid primary key default gen_random_uuid(),

  -- Short human-readable ID for WhatsApp / receipts (e.g. DP-0042)
  order_number    text unique,

  -- Customer
  customer_name   text not null,
  customer_phone  text not null,   -- WhatsApp number (52XXXXXXXXXX)
  customer_email  text,

  -- Products ordered
  -- [{"product_id":"uuid","name":"Burbuja Reforzada","qty":2,"unit_price":99,"color":"Verde","bundle_qty":2,"bundle_price":179}]
  items           jsonb not null default '[]',

  subtotal_mxn    numeric(10,2) not null,

  -- ── Delivery mode ────────────────────────────────────────────
  -- 'pickup'      → customer comes to Región 96, pays cash
  -- 'delivery'    → home delivery, deposit required
  -- 'punto_medio' → meet at a plaza, deposit required
  delivery_mode   text not null default 'pickup'
                  check (delivery_mode in ('pickup','delivery','punto_medio')),

  delivery_zone   text,   -- 'zone1' (1-6km) | 'zone2' (6-10km) | null for pickup
  delivery_fee    numeric(10,2) not null default 0,
  is_night        boolean default false,  -- after 8pm surcharge

  delivery_address text,
  delivery_notes   text,
  scheduled_at     timestamptz,          -- pickup or delivery time agreed

  total_mxn       numeric(10,2) not null,

  -- ── Payment mode ─────────────────────────────────────────────
  -- 'deposit'     → anticipo via CLABE transfer, rest on delivery
  -- 'pickup_cash' → pays full in cash at pickup
  -- 'full_prepay' → pays 100% upfront via CLABE transfer
  payment_mode    text not null default 'deposit'
                  check (payment_mode in ('deposit','pickup_cash','full_prepay')),

  anticipo_mxn    numeric(10,2),         -- deposit amount (25% for delivery, 0 for pickup_cash)
  anticipo_paid   boolean default false,
  anticipo_ref    text,                  -- bank transfer reference customer sends
  full_paid       boolean default false,

  -- ── Status pipeline ─────────────────────────────────────────
  -- pending       → just submitted, waiting for deposit/confirmation
  -- confirmed     → you confirmed it (WhatsApp sent)
  -- preparing     → you're packing it
  -- ready         → ready for pickup / out for delivery
  -- delivered     → done
  -- cancelled     → cancelled
  status          text not null default 'pending'
                  check (status in ('pending','confirmed','preparing','ready','delivered','cancelled')),

  -- Your internal notes
  admin_notes     text,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Auto-generate human readable order number: DP-0001, DP-0002, ...
create sequence if not exists order_number_seq start 1;

create or replace function set_order_number()
returns trigger as $$
begin
  if new.order_number is null then
    new.order_number := 'DP-' || lpad(nextval('order_number_seq')::text, 4, '0');
  end if;
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger orders_number_trigger
before insert on orders
for each row execute function set_order_number();

-- Auto-calculate anticipo based on payment mode and total
create or replace function set_anticipo()
returns trigger as $$
begin
  new.anticipo_mxn := case new.payment_mode
    when 'pickup_cash' then 0
    when 'full_prepay' then new.total_mxn
    when 'deposit'     then ceil(new.total_mxn * 0.25)  -- 25% deposit
    else 0
  end;
  return new;
end;
$$ language plpgsql;

create trigger orders_anticipo_trigger
before insert on orders
for each row execute function set_anticipo();

-- Update timestamp on every change
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger orders_updated_at
before update on orders
for each row execute function touch_updated_at();

-- Award loyalty points when delivered
create or replace function award_order_points()
returns trigger as $$
begin
  if new.status = 'delivered' and old.status <> 'delivered' then
    -- Find or create customer by phone
    insert into customers (phone, name)
    values (new.customer_phone, new.customer_name)
    on conflict (phone) do update set name = excluded.name;

    insert into points_ledger (customer_id, delta, reason, reference_id)
    select id, floor(new.total_mxn)::int, 'order', new.id
    from customers where phone = new.customer_phone;

    update customers set last_order_at = now()
    where phone = new.customer_phone;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger orders_points_trigger
after update of status on orders
for each row execute function award_order_points();

-- ── RLS ──────────────────────────────────────────────────────
alter table orders enable row level security;

-- Anon can INSERT (customers submit orders from the shelf)
create policy "Anon can create orders"
  on orders for insert to anon
  with check (true);

-- Only service role reads/updates (admin panel)
create policy "Admin full access on orders"
  on orders for all to service_role
  using (true);

-- ── Admin views ───────────────────────────────────────────────

-- Active orders needing attention (sorted by urgency)
create or replace view admin_orders_active as
select
  id, order_number, status,
  customer_name, customer_phone,
  delivery_mode, payment_mode,
  subtotal_mxn, delivery_fee, total_mxn,
  anticipo_mxn, anticipo_paid, full_paid,
  items, scheduled_at, delivery_address,
  admin_notes, created_at
from orders
where status not in ('delivered','cancelled')
order by
  case status
    when 'pending'    then 1
    when 'confirmed'  then 2
    when 'preparing'  then 3
    when 'ready'      then 4
  end,
  created_at asc;

-- Today's revenue summary
create or replace view admin_revenue_today as
select
  count(*) filter (where status = 'delivered')                  as orders_delivered,
  coalesce(sum(total_mxn) filter (where status = 'delivered'),0) as revenue_delivered,
  count(*) filter (where status not in ('delivered','cancelled')) as orders_active,
  count(*) filter (where status = 'pending')                     as orders_pending,
  count(*) filter (where anticipo_paid = true)                   as deposits_received
from orders
where created_at >= date_trunc('day', now());
