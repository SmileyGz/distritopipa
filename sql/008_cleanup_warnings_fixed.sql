-- Resolve Supabase Security Advisor Warnings (Updated)
-- Run in: Supabase Dashboard → SQL Editor

-- 1. Fix community_posts warnings
DROP POLICY IF EXISTS "Public can insert community_posts" ON public.community_posts;
DROP POLICY IF EXISTS "Public can update community_posts" ON public.community_posts;

DROP POLICY IF EXISTS "Public can read community_posts" ON public.community_posts;
CREATE POLICY "Public can read community_posts" ON public.community_posts 
  FOR SELECT TO anon, authenticated USING (status = 'approved');

DROP POLICY IF EXISTS "Admin full access on community_posts" ON public.community_posts;

-- 2. Fix customers warnings
DROP POLICY IF EXISTS "Admin full access on customers" ON public.customers;

-- 3. Fix orders warnings
DROP POLICY IF EXISTS "Anon can create orders" ON public.orders;
DROP POLICY IF EXISTS "Admin full access on orders" ON public.orders;
