CREATE TABLE IF NOT EXISTS public.site_search_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    normalized_query TEXT NOT NULL,
    results_count INT NOT NULL DEFAULT 0,
    category_filter TEXT,
    clicked_item_id TEXT,
    session_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_logs_query ON public.site_search_logs (normalized_query);
CREATE INDEX IF NOT EXISTS idx_search_logs_zero_results ON public.site_search_logs (results_count) WHERE results_count = 0;
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON public.site_search_logs (created_at DESC);

ALTER TABLE public.site_search_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous inserts" 
ON public.site_search_logs FOR INSERT 
TO anon 
WITH CHECK (true);

CREATE POLICY "Allow service_role to read" 
ON public.site_search_logs FOR SELECT 
TO service_role 
USING (true);
