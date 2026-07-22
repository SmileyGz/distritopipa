-- Resolve Supabase Security Advisor Warnings
-- Run in: Supabase Dashboard → SQL Editor

-- 1. Fix community_posts warnings
-- The frontend inserts posts via the /api/community/posts route which uses the secure service_role.
-- Therefore, we do not need to allow public INSERT or UPDATE access.
DROP POLICY IF EXISTS "Public can insert community_posts" ON public.community_posts;
DROP POLICY IF EXISTS "Public can update community_posts" ON public.community_posts;

-- Tighten the read policy so it doesn't use "USING (true)". Only approved posts should be readable.
DROP POLICY IF EXISTS "Public can read community_posts" ON public.community_posts;
CREATE POLICY "Public can read community_posts" ON public.community_posts 
  FOR SELECT TO anon, authenticated USING (status = 'approved');

-- 2. Fix orders warnings
-- Orders are created via the /api/orders route using service_role, so anon insert is a security risk.
DROP POLICY IF EXISTS "Anon can create orders" ON public.orders;

-- 3. Remove redundant service_role policies
-- The service_role automatically bypasses RLS, so explicitly creating "USING (true)" policies for it
-- triggers unnecessary warnings. We can safely remove them.
DROP POLICY IF EXISTS "Admin full access on community_posts" ON public.community_posts;
DROP POLICY IF EXISTS "Admin full access on customers" ON public.customers;
DROP POLICY IF EXISTS "Admin full access on orders" ON public.orders;
DROP POLICY IF EXISTS "Admin full access on loyalty_tiers" ON public.loyalty_tiers;
DROP POLICY IF EXISTS "Admin full access on points_ledger" ON public.points_ledger;
DROP POLICY IF EXISTS "Admin full access on questions" ON public.questions;
DROP POLICY IF EXISTS "Admin full access on answers" ON public.answers;
