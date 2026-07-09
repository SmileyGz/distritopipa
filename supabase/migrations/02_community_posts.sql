-- ==========================================
-- DISTRITO PIPA: COMMUNITY POSTS TABLE
-- ==========================================

-- 1. Create the community_posts table
CREATE TABLE IF NOT EXISTS public.community_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    parent_id UUID REFERENCES public.community_posts(id) ON DELETE CASCADE,
    customer_id TEXT, -- Store phone number or auth ID
    status TEXT DEFAULT 'approved',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Inject default seeds for the frontend
DO $$
DECLARE
    q1_id UUID := gen_random_uuid();
    q2_id UUID := gen_random_uuid();
    q3_id UUID := gen_random_uuid();
BEGIN
    -- Insert Question 1
    INSERT INTO public.community_posts (id, author_name, content, upvotes, customer_id, status)
    VALUES (q1_id, 'Pedro_Cancun', '¿Cuánto tarda el envío?', 8, '1234567890', 'approved');

    -- Insert Answer to Question 1
    INSERT INTO public.community_posts (author_name, content, upvotes, parent_id, customer_id, status)
    VALUES ('DistritoPipa', 'El envío suele tardar entre 1 a 6 km toma alrededor de 45 mins - 1 hora en llegar a tu puerta.', 12, q1_id, '9999999999', 'approved');

    -- Insert Question 2
    INSERT INTO public.community_posts (id, author_name, content, upvotes, customer_id, status)
    VALUES (q2_id, 'SmokeKing', '¿El empaque es discreto?', 5, '8888888888', 'approved');

    -- Insert Question 3
    INSERT INTO public.community_posts (id, author_name, content, upvotes, customer_id, status)
    VALUES (q3_id, 'MariaG', '¿Cómo pago el anticipo?', 2, '5555555555', 'approved');

END $$;
