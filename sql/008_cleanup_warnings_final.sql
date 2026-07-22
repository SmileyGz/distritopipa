-- Resolve remaining Supabase Security Advisor Warnings
-- Run in: Supabase Dashboard → SQL Editor

-- It looks like the policies on customers and orders might have different names in your live database
-- than what we tried to drop. Since both tables are ONLY accessed via your secure backend API 
-- (using the service_role key), they don't need ANY public policies at all.
-- This script will dynamically find and drop all policies on these two tables.

DO $$
DECLARE
    pol record;
BEGIN
    -- Drop all policies on public.orders
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'orders'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.orders', pol.policyname);
    END LOOP;
    
    -- Drop all policies on public.customers
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE schemaname = 'public' AND tablename = 'customers'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.customers', pol.policyname);
    END LOOP;
END
$$;
