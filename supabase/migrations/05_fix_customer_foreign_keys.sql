-- ════════════════════════════════════════════════════════════════════
-- Distrito Pipa — Migración 012: Configurar ON DELETE en Foreign Keys
-- Soluciona el error: "Unable to delete row as it is currently referenced
-- by a foreign key constraint orders_customer_id_fkey"
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New Query → Run
-- ════════════════════════════════════════════════════════════════════

-- 1. Tabla orders: Al borrar un cliente de prueba/deseado, sus pedidos se eliminan automáticamente
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_customer_id_fkey
    FOREIGN KEY (customer_id)
    REFERENCES public.customers(id)
    ON DELETE CASCADE;

-- 2. Tabla points_ledger (si existe en tu base de datos)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'points_ledger') THEN
    ALTER TABLE public.points_ledger
      DROP CONSTRAINT IF EXISTS points_ledger_customer_id_fkey;
      
    ALTER TABLE public.points_ledger
      ADD CONSTRAINT points_ledger_customer_id_fkey
        FOREIGN KEY (customer_id)
        REFERENCES public.customers(id)
        ON DELETE CASCADE;

    ALTER TABLE public.points_ledger
      DROP CONSTRAINT IF EXISTS points_ledger_order_id_fkey;

    ALTER TABLE public.points_ledger
      ADD CONSTRAINT points_ledger_order_id_fkey
        FOREIGN KEY (order_id)
        REFERENCES public.orders(id)
        ON DELETE CASCADE;
  END IF;
END $$;

-- 3. Tablas de comunidad (si existen): Conservar las preguntas/respuestas pero desvincular el autor
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'community_questions') THEN
    ALTER TABLE public.community_questions
      DROP CONSTRAINT IF EXISTS community_questions_author_id_fkey;

    ALTER TABLE public.community_questions
      ADD CONSTRAINT community_questions_author_id_fkey
        FOREIGN KEY (author_id)
        REFERENCES public.customers(id)
        ON DELETE SET NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'community_answers') THEN
    ALTER TABLE public.community_answers
      DROP CONSTRAINT IF EXISTS community_answers_author_id_fkey;

    ALTER TABLE public.community_answers
      ADD CONSTRAINT community_answers_author_id_fkey
        FOREIGN KEY (author_id)
        REFERENCES public.customers(id)
        ON DELETE SET NULL;
  END IF;
END $$;
