-- Complete SplitIt Database Setup
-- Run this single file in your Supabase SQL Editor to set up everything

-- ============================================
-- MAIN TABLES
-- ============================================

-- Groups table
CREATE TABLE IF NOT EXISTS public.groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Group members table  
CREATE TABLE IF NOT EXISTS public.group_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(group_id, user_id)
);

-- Receipts table
CREATE TABLE IF NOT EXISTS public.receipts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
    uploader_user_id UUID,
    filename TEXT,
    parsed_json JSONB,
    subtotal DECIMAL(10,2),
    tax_total DECIMAL(10,2) DEFAULT 0,
    tip_total DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'finalized')),
    finalized_shares JSONB,
    finalized_at TIMESTAMP WITH TIME ZONE,
    tip_editable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Items table with availability features
CREATE TABLE IF NOT EXISTS public.items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_id UUID REFERENCES public.receipts(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2) NOT NULL,
    claimed_by UUID,
    available BOOLEAN DEFAULT true,
    status TEXT DEFAULT 'Available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Item claims table for quantity claiming and splitting
CREATE TABLE IF NOT EXISTS public.item_claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    claimed_quantity INTEGER NOT NULL DEFAULT 1,
    claimed_amount DECIMAL(10,2),
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT positive_quantity CHECK (claimed_quantity > 0)
);

-- User profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_id UUID PRIMARY KEY,
    display_name TEXT,
    email TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Logs table for audit trail
CREATE TABLE IF NOT EXISTS public.logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    receipt_id UUID REFERENCES public.receipts(id) ON DELETE CASCADE,
    user_id UUID,
    action TEXT NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_receipts_group_id ON public.receipts(group_id);
CREATE INDEX IF NOT EXISTS idx_receipts_uploader ON public.receipts(uploader_user_id);
CREATE INDEX IF NOT EXISTS idx_items_receipt_id ON public.items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_items_available ON public.items(available);
CREATE INDEX IF NOT EXISTS idx_item_claims_item_id ON public.item_claims(item_id);
CREATE INDEX IF NOT EXISTS idx_item_claims_user_id ON public.item_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_receipt_id ON public.logs(receipt_id);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON public.logs(user_id);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for user_profiles updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- DISABLE RLS (FOR MVP - ENABLE IN PRODUCTION)
-- ============================================

ALTER TABLE public.groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_claims DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs DISABLE ROW LEVEL SECURITY;

-- ============================================
-- UPDATE EXISTING DATA
-- ============================================

-- Update existing items to be available by default
UPDATE public.items SET available = true WHERE available IS NULL;
UPDATE public.items SET status = 'Available' WHERE status IS NULL;

-- Update existing receipts to be tip editable
UPDATE public.receipts SET tip_editable = true WHERE tip_editable IS NULL;

-- ============================================
-- VERIFICATION QUERIES (OPTIONAL)
-- ============================================

-- Uncomment these to verify your setup:
-- SELECT 'Tables created successfully!' as status;
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('groups', 'group_members', 'receipts', 'items', 'item_claims', 'user_profiles', 'logs');
-- SELECT 'Setup complete!' as message;