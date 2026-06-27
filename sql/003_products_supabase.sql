-- ═══════════════════════════════════════════════════════════════
-- Distrito Pipa — Migration 003: Products + Image Storage
-- Run in: Supabase Dashboard → SQL Editor
-- Replaces: Sanity CMS entirely
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- PRODUCTS TABLE
-- ───────────────────────────────────────────────────────────────

create table if not exists products (
  id            uuid primary key default gen_random_uuid(),

  -- Names (bilingual)
  name_es       text not null,
  name_en       text,

  -- Categorization
  category      text not null
                check (category in ('pipes','accessories','rolling','torches','bongs','parts')),

  -- Pricing
  price_mxn     numeric(10,2) not null check (price_mxn >= 0),

  -- Bundle pricing stored as JSONB array
  -- [{"qty": 2, "price": 179}, {"qty": 3, "price": 239}]
  bundle_pricing  jsonb default '[]',

  -- Product attributes
  size_cm       numeric(5,1),
  colors        text[] default '{}',

  -- Descriptions
  description_es  text,
  description_en  text,

  -- Images stored as array of Supabase Storage paths
  -- ["products/pipes/burbuja-reforzada-1.png", ...]
  image_paths   text[] default '{}',

  -- Status flags
  in_stock      boolean not null default true,
  featured      boolean not null default false,

  -- Display ordering within category (1 = first)
  sort_order    integer default 999,

  -- SEO
  slug          text unique,

  -- Timestamps
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Auto-generate slug from name_es if not set
create or replace function generate_product_slug()
returns trigger as $$
declare
  base_slug text;
  final_slug text;
  counter int := 0;
begin
  if new.slug is null or new.slug = '' then
    -- Convert name to slug: lowercase, spaces to dashes, remove special chars
    base_slug := lower(
      regexp_replace(
        regexp_replace(new.name_es, '[^a-zA-Z0-9\s-]', '', 'g'),
        '\s+', '-', 'g'
      )
    );
    final_slug := base_slug;

    -- Handle duplicates
    while exists (select 1 from products where slug = final_slug and id != new.id) loop
      counter := counter + 1;
      final_slug := base_slug || '-' || counter;
    end loop;

    new.slug := final_slug;
  end if;

  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

create trigger products_slug_trigger
before insert or update on products
for each row execute function generate_product_slug();

-- Index for fast category + sort queries (used by the shelf)
create index products_category_sort_idx on products (category, sort_order, in_stock);
create index products_featured_idx on products (featured) where featured = true;
create index products_slug_idx on products (slug);

-- ───────────────────────────────────────────────────────────────
-- SUPABASE STORAGE BUCKET FOR PRODUCT IMAGES
-- ───────────────────────────────────────────────────────────────
-- Run this ONCE to create the storage bucket.
-- Bucket is PUBLIC so images can be served on the shelf.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,           -- 5MB limit per image
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Storage policy: anyone can VIEW images (they're on the public shelf)
create policy "Public image read"
  on storage.objects for select
  to public
  using (bucket_id = 'product-images');

-- Storage policy: only you (service role) can UPLOAD/DELETE images
create policy "Admin image upload"
  on storage.objects for insert
  to service_role
  with check (bucket_id = 'product-images');

create policy "Admin image delete"
  on storage.objects for delete
  to service_role
  using (bucket_id = 'product-images');

-- ───────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY ON PRODUCTS
-- ───────────────────────────────────────────────────────────────

alter table products enable row level security;

-- Anyone can read products (they show on the public shelf)
create policy "Public can read products"
  on products for select
  to anon, authenticated
  using (true);

-- Only service role can create/update/delete (your admin panel uses service role)
create policy "Admin full access"
  on products for all
  to service_role
  using (true);

-- ───────────────────────────────────────────────────────────────
-- SEED DATA — your existing menu items
-- ───────────────────────────────────────────────────────────────

insert into products (name_es, name_en, category, price_mxn, bundle_pricing, size_cm, description_es, description_en, in_stock, featured, sort_order) values

-- PIPES
('Burbuja XS',          'Bubble Pipe XS',     'pipes', 49,  '[{"qty":2,"price":89},{"qty":3,"price":119}]',  10, 'Pipa de vidrio pequeña. Ideal para principiantes. Vidrio soplado a mano, resistente y ligero.', 'Small glass bubble pipe. Perfect for beginners. Hand-blown glass, durable and lightweight.', true, false, 1),
('Burbuja Sencilla',    'Simple Bubble M/G',  'pipes', 69,  '[{"qty":2,"price":119},{"qty":3,"price":169}]', 10, 'Burbuja mediana o grande. Mayor capacidad, mismo diseño clásico. Disponible en dos tamaños.', 'Medium or large bubble. More capacity, same classic design. Available in two sizes.', true, false, 2),
('Burbuja Reforzada',   'Reinforced Bubble',  'pipes', 99,  '[{"qty":2,"price":179},{"qty":3,"price":239}]', 10, 'Vidrio extra grueso para mayor durabilidad. La opción más resistente de la línea clásica.', 'Extra-thick glass for durability. The most resilient option in the classic line.', true, true,  3),
('Reforzada Colores',   'Colored Reinforced', 'pipes', 149, '[{"qty":2,"price":199},{"qty":3,"price":259}]', 10, 'Burbuja reforzada en cuatro colores vibrantes. Verde, Amarilla, Negra o Azul.', 'Reinforced bubble in four vibrant colors: Green, Yellow, Black, or Blue.', true, true,  4),
('Calavera Colores',    'Skull Pipe',         'pipes', 199, '[{"qty":2,"price":350}]',                       12, 'Diseño de calavera en vidrio de colores. Disponible en Verde, Amarillo y Negro.', 'Skull-design glass pipe in colors. Available in Green, Yellow, and Black.', true, false, 5),

-- ACCESSORIES
('Llavero Cenicero',    'Keychain Ashtray',   'accessories', 119, '[]', 5,  'Cenicero portátil de acero inoxidable con llavero. Cabe en cualquier bolsillo.', 'Portable stainless steel ashtray with keychain. Fits in any pocket.', true, false, 1),
('Herramienta 3 en 1', '3-in-1 Tool',        'accessories', 119, '[]', 9,  'Herramienta metálica 3 en 1. Incluye pinzas, raspador y aguijón para limpieza y manejo.', '3-in-1 metal tool. Includes tongs, scraper, and poker for cleaning and handling.', true, false, 2),
('Grinder CH',          'CH Grinder',         'accessories', 149, '[]', null,'Grinder de aluminio en 4 partes. Molienda precisa y colecta de polvo en cámara inferior.', '4-part aluminum grinder. Precise grinding with bottom pollen catcher.', true, true,  3),

-- ROLLING
('Canalas Clipper',     'Clipper Rolling Kit','rolling', 99, '[]', null, 'Kit completo Clipper: 50 filtros + 50 hojas de papel de fumar.', 'Complete Clipper kit: 50 filters + 50 rolling papers.', true, false, 1),
('Filtros Silver Screens','Silver Screens',   'rolling', 10, '[{"qty":5,"price":10},{"qty":10,"price":18},{"qty":15,"price":25}]', null, 'Filtros metálicos reutilizables. Se venden en paquetes de 5, 10 o 15 unidades.', 'Reusable metal mesh screens. Available in packs of 5, 10, or 15.', true, false, 2),

-- TORCHES
('Soplete',             'Torch',              'torches', 149, '[]', null, 'Soplete de llama ajustable. Encendido por chispa, ideal para uso diario.', 'Adjustable flame torch. Spark ignition, ideal for daily use.', true, false, 1),
('Mini Soplete',        'Mini Torch',         'torches', 119, '[]', null, 'Soplete compacto de bolsillo. Fácil de transportar, misma potencia.', 'Compact pocket torch. Easy to carry, same power output.', true, false, 2),
('Gas Refill',          'Gas Refill',         'torches', 79,  '[]', null, 'Recarga de gas butano compatible con todos nuestros sopletes.', 'Butane gas refill compatible with all our torches.', true, false, 3),

-- BONGS
('Bong Reforzado',      'Reinforced Bong',    'bongs', 420, '[]', 18, 'Bong de vidrio reforzado de 18 cm. Disponible en cristal claro o vidrio oscuro (Wid).', '18 cm reinforced glass bong. Available in clear crystal or dark glass (Wid).', true, true, 1),
('Bong Premium',        'Premium Bong',       'bongs', 520, '[]', 20, 'Bong premium de 20 cm en vidrio grueso. El más grande de nuestra colección.', '20 cm premium thick-glass bong. The largest in our collection.', true, false, 2),

-- PARTS
('Repuesto Reforzado',  'Replacement Bowl',   'parts', 139, '[{"qty":2,"price":240},{"qty":3,"price":330}]', null, 'Repuesto compatible con cualquier modelo de nuestra tienda. Vidrio reforzado.', 'Replacement bowl compatible with any model in our store. Reinforced glass.', true, false, 1)

on conflict (slug) do nothing;

-- ───────────────────────────────────────────────────────────────
-- ADMIN VIEW: products with public image URLs
-- (Use this in the admin panel for fast queries)
-- ───────────────────────────────────────────────────────────────

create or replace view products_with_urls as
select
  p.*,
  -- Convert storage paths to full public URLs
  -- Replace YOUR_PROJECT_REF with your actual Supabase project ref
  array(
    select 'https://YOUR_PROJECT_REF.supabase.co/storage/v1/object/public/product-images/' || unnest(p.image_paths)
  ) as image_urls
from products p;
