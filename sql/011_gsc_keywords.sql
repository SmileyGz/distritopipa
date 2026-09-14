CREATE TABLE IF NOT EXISTS public.gsc_keyword_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    query TEXT NOT NULL,
    page TEXT NOT NULL,
    device TEXT,
    country TEXT,
    clicks INT NOT NULL DEFAULT 0,
    impressions INT NOT NULL DEFAULT 0,
    ctr NUMERIC(5,4) NOT NULL DEFAULT 0,
    position NUMERIC(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (date, query, page, device)
);

CREATE INDEX IF NOT EXISTS idx_gsc_date ON public.gsc_keyword_metrics (date DESC);
CREATE INDEX IF NOT EXISTS idx_gsc_query ON public.gsc_keyword_metrics (query);
CREATE INDEX IF NOT EXISTS idx_gsc_impressions ON public.gsc_keyword_metrics (impressions DESC);

ALTER TABLE public.gsc_keyword_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service_role to access all" 
ON public.gsc_keyword_metrics FOR ALL 
TO service_role 
USING (true)
WITH CHECK (true);
