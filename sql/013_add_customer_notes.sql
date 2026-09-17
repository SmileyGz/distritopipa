-- ════════════════════════════════════════════════════════════════════
-- Distrito Pipa — Migración 013: Asegurar soporte de notas del cliente
-- Añade delivery_notes y customer_notes en orders si aún no existen
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_notes text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_notes text;
