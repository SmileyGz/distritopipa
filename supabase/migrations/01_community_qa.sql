-- ==========================================
-- DISTRITO PIPA: EL BARRIO Q&A SCHEMA
-- ==========================================

-- 1. FIX TIER THRESHOLDS & ADD 'NUEVO' TIER
-- Since Bronce starts at 2500, we need a 0 tier for new users.
INSERT INTO public.loyalty_tiers (name, min_lifetime_spend, points_multiplier, perks) 
VALUES ('Nuevo', 0, 1.0, '{}') 
ON CONFLICT DO NOTHING;

-- 2. UPDATE CUSTOMERS TABLE (Auth Link & Username)
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS auth_id UUID UNIQUE; -- Links to auth.users.id
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Update the default tier function to use 'Nuevo' instead of the lowest one (just to be safe)
CREATE OR REPLACE FUNCTION set_default_tier()
RETURNS TRIGGER AS $$
BEGIN
  SELECT id INTO NEW.current_tier_id FROM public.loyalty_tiers WHERE name = 'Nuevo' LIMIT 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 3. Q&A TABLES
CREATE TABLE public.questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    author_id UUID REFERENCES public.customers(id) NOT NULL,
    content TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
    author_id UUID REFERENCES public.customers(id) NOT NULL,
    content TEXT NOT NULL,
    upvotes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- 4. PRIVACY VIEW (Exposes tiers without exposing lifetime spend to the public)
CREATE OR REPLACE VIEW public.community_profiles AS
SELECT 
    c.id AS customer_id,
    c.username,
    t.name AS tier_name
FROM public.customers c
LEFT JOIN public.loyalty_tiers t ON c.current_tier_id = t.id;


-- 5. STRICT MODERATION (DATABASE TRIGGERS)
-- These triggers prevent numbers or bad words from ever hitting the database.

CREATE OR REPLACE FUNCTION block_prohibited_content()
RETURNS TRIGGER AS $$
BEGIN
    -- Block 3 or more digits anywhere in the text (Anti-Phone-Number spam)
    -- Matches any digit, followed by anything, followed by a digit, followed by anything, followed by a digit.
    IF NEW.content ~ '[0-9].*[0-9].*[0-9]' THEN 
        RAISE EXCEPTION '¡Ups! Por tu seguridad y la de todos, no permitimos compartir teléfonos ni contactos aquí. Borra los números para poder publicar.';
    END IF;

    -- Block Bad Words (Example list)
    IF NEW.content ~* '\m(puto|pendejo|mierda|verga|droga|dealer)\M' THEN 
        RAISE EXCEPTION 'Tu mensaje contiene lenguaje no permitido en El Barrio.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach to Questions
CREATE TRIGGER enforce_question_moderation
  BEFORE INSERT OR UPDATE ON public.questions
  FOR EACH ROW EXECUTE PROCEDURE block_prohibited_content();

-- Attach to Answers
CREATE TRIGGER enforce_answer_moderation
  BEFORE INSERT OR UPDATE ON public.answers
  FOR EACH ROW EXECUTE PROCEDURE block_prohibited_content();
