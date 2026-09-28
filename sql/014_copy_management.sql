-- Table: copy_drafts
CREATE TABLE copy_drafts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    
    -- Content Variations
    draft_copy TEXT,
    whatsapp_copy TEXT,
    facebook_marketplace_copy TEXT,
    
    -- Status & Tracking
    status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'needs_review', 'approved', 'posted')),
    posting_date TIMESTAMP WITH TIME ZONE,
    
    -- Compliance Checklist (Booleans)
    img_no_glass BOOLEAN DEFAULT false,
    img_no_smoke BOOLEAN DEFAULT false,
    img_focus_delivery BOOLEAN DEFAULT false,
    
    -- Meta
    internal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: copy_revisions
CREATE TABLE copy_revisions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    draft_id UUID REFERENCES copy_drafts(id) ON DELETE CASCADE,
    facebook_marketplace_copy TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_copy_drafts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_copy_drafts
BEFORE UPDATE ON copy_drafts
FOR EACH ROW
EXECUTE FUNCTION update_copy_drafts_updated_at();

-- RLS Policies
ALTER TABLE copy_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE copy_revisions ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users (admin) to do everything
CREATE POLICY "Enable all access for authenticated users on copy_drafts" ON copy_drafts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable all access for authenticated users on copy_revisions" ON copy_revisions FOR ALL TO authenticated USING (true) WITH CHECK (true);
