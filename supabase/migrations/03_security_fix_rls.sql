-- Fix for Supabase Security Alert: "Table publicly accessible"
-- This script enables Row-Level Security on all remaining public tables and adds safe policies.
-- Run in: Supabase Dashboard → SQL Editor

-- 1. LOYALTY TIERS
ALTER TABLE public.loyalty_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read loyalty_tiers" ON public.loyalty_tiers;
CREATE POLICY "Public can read loyalty_tiers" ON public.loyalty_tiers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admin full access on loyalty_tiers" ON public.loyalty_tiers;
CREATE POLICY "Admin full access on loyalty_tiers" ON public.loyalty_tiers FOR ALL TO service_role USING (true);

-- 2. CUSTOMERS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access on customers" ON public.customers;
CREATE POLICY "Admin full access on customers" ON public.customers FOR ALL TO service_role USING (true);

-- 3. POINTS LEDGER
ALTER TABLE public.points_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access on points_ledger" ON public.points_ledger;
CREATE POLICY "Admin full access on points_ledger" ON public.points_ledger FOR ALL TO service_role USING (true);

-- 4. QUESTIONS
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read questions" ON public.questions;
CREATE POLICY "Public can read questions" ON public.questions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can insert questions" ON public.questions;
CREATE POLICY "Public can insert questions" ON public.questions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Public can update questions" ON public.questions;
CREATE POLICY "Public can update questions" ON public.questions FOR UPDATE TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admin full access on questions" ON public.questions;
CREATE POLICY "Admin full access on questions" ON public.questions FOR ALL TO service_role USING (true);

-- 5. ANSWERS
ALTER TABLE public.answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read answers" ON public.answers;
CREATE POLICY "Public can read answers" ON public.answers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can insert answers" ON public.answers;
CREATE POLICY "Public can insert answers" ON public.answers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Public can update answers" ON public.answers;
CREATE POLICY "Public can update answers" ON public.answers FOR UPDATE TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admin full access on answers" ON public.answers;
CREATE POLICY "Admin full access on answers" ON public.answers FOR ALL TO service_role USING (true);

-- 6. COMMUNITY POSTS
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can read community_posts" ON public.community_posts;
CREATE POLICY "Public can read community_posts" ON public.community_posts FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Public can insert community_posts" ON public.community_posts;
CREATE POLICY "Public can insert community_posts" ON public.community_posts FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Public can update community_posts" ON public.community_posts;
CREATE POLICY "Public can update community_posts" ON public.community_posts FOR UPDATE TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Admin full access on community_posts" ON public.community_posts;
CREATE POLICY "Admin full access on community_posts" ON public.community_posts FOR ALL TO service_role USING (true);
