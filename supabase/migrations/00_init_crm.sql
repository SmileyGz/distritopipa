-- ==========================================
-- DISTRITO PIPA: ALL-IN-ONE CRM SCHEMA
-- ==========================================

-- 1. LOYALTY TIERS (Configurable from the dashboard)
CREATE TABLE public.loyalty_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- e.g., 'Bronce', 'Plata', 'Oro'
    min_lifetime_spend NUMERIC NOT NULL DEFAULT 0, -- Threshold to unlock
    points_multiplier NUMERIC NOT NULL DEFAULT 1.0, -- e.g., 1.5x points for Oro
    perks JSONB -- Flexible JSON to store specific perks (e.g., {"free_delivery": true})
);

-- Insert the default tiers requested by the user
INSERT INTO public.loyalty_tiers (name, min_lifetime_spend, points_multiplier, perks) VALUES
('Bronce', 2500, 1.0, '{"discount_second_order": true}'),
('Plata', 5000, 1.25, '{"free_punto_medio": true, "free_lighter_over_200": true}'),
('Oro', 10000, 1.5, '{"free_delivery": true, "no_deposit": true, "early_access": true}');

-- 2. CUSTOMERS (The Core CRM Profile)
CREATE TABLE public.customers (
    id UUID PRIMARY KEY, -- Should map to auth.users.id if using Supabase Auth
    email TEXT,
    phone TEXT,
    first_name TEXT,
    last_name TEXT,
    lifetime_spend NUMERIC NOT NULL DEFAULT 0,
    points_balance INTEGER NOT NULL DEFAULT 0,
    current_tier_id UUID REFERENCES public.loyalty_tiers(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Set default tier for new customers
CREATE OR REPLACE FUNCTION set_default_tier()
RETURNS TRIGGER AS $$
BEGIN
  SELECT id INTO NEW.current_tier_id FROM public.loyalty_tiers WHERE min_lifetime_spend = 0 LIMIT 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_customer_created
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE PROCEDURE set_default_tier();


-- 3. ORDERS (Checkout Data)
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id),
    
    -- Fulfillment
    fulfillment_type TEXT NOT NULL, -- 'pickup', 'delivery'
    delivery_zone TEXT,             -- '1-6km', '6-10km'
    scheduled_time TIMESTAMPTZ,
    
    -- Pricing breakdown
    subtotal NUMERIC NOT NULL,
    delivery_fee NUMERIC NOT NULL DEFAULT 0,
    discount_amount NUMERIC NOT NULL DEFAULT 0, -- Used for the 5% Cash/Wire discount
    total_amount NUMERIC NOT NULL,
    
    -- Payment
    payment_method TEXT NOT NULL,   -- 'card', 'wire', 'cash'
    payment_status TEXT NOT NULL,   -- 'pending', 'partial', 'paid'
    amount_paid NUMERIC NOT NULL DEFAULT 0, -- e.g. 50 (deposit) or full
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. POINTS LEDGER (Audit Trail)
CREATE TABLE public.points_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID REFERENCES public.customers(id),
    order_id UUID REFERENCES public.orders(id),
    points_change INTEGER NOT NULL, -- Positive for earned, negative for spent
    reason TEXT NOT NULL, -- e.g., 'earned_from_purchase'
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ==========================================
-- 5. AUTOMATION: TIER UPGRADES & POINTS
-- ==========================================
-- This trigger automatically calculates points and upgrades the user's tier
-- whenever an order is marked as 'paid' or 'partial' (if we consider deposits as qualifying).

CREATE OR REPLACE FUNCTION process_order_loyalty()
RETURNS TRIGGER AS $$
DECLARE
    v_multiplier NUMERIC;
    v_points_earned INTEGER;
    v_new_spend NUMERIC;
    v_new_tier_id UUID;
BEGIN
    -- Only process when status changes to 'paid' (or partial if you want deposits to count immediately)
    IF NEW.payment_status IN ('paid', 'partial') AND OLD.payment_status = 'pending' THEN
        
        -- 1. Update Lifetime Spend
        v_new_spend := (SELECT lifetime_spend + NEW.total_amount FROM public.customers WHERE id = NEW.customer_id);
        
        -- 2. Calculate New Tier (Find highest tier they qualify for)
        SELECT id INTO v_new_tier_id 
        FROM public.loyalty_tiers 
        WHERE min_lifetime_spend <= v_new_spend 
        ORDER BY min_lifetime_spend DESC LIMIT 1;
        
        -- 3. Calculate Points Earned (based on multiplier of their NEW tier)
        SELECT points_multiplier INTO v_multiplier FROM public.loyalty_tiers WHERE id = v_new_tier_id;
        v_points_earned := FLOOR(NEW.total_amount * v_multiplier);

        -- 4. Update Customer Profile
        UPDATE public.customers 
        SET lifetime_spend = v_new_spend,
            current_tier_id = v_new_tier_id,
            points_balance = points_balance + v_points_earned
        WHERE id = NEW.customer_id;

        -- 5. Write to Ledger
        INSERT INTO public.points_ledger (customer_id, order_id, points_change, reason)
        VALUES (NEW.customer_id, NEW.id, v_points_earned, 'earned_from_purchase');

    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_order_paid
  AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE PROCEDURE process_order_loyalty();
