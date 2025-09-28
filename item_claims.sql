-- Add item claims table for partial quantity claiming and item splitting
CREATE TABLE IF NOT EXISTS public.item_claims (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    item_id UUID REFERENCES public.items(id) ON DELETE CASCADE NOT NULL,
    user_id UUID NOT NULL,
    claimed_quantity INTEGER NOT NULL DEFAULT 1,
    claimed_amount DECIMAL(10,2), -- For split items, store the actual dollar amount
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT positive_quantity CHECK (claimed_quantity > 0)
);

-- Disable RLS for item claims (same as other tables for MVP)
ALTER TABLE public.item_claims DISABLE ROW LEVEL SECURITY;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_item_claims_item_id ON public.item_claims(item_id);
CREATE INDEX IF NOT EXISTS idx_item_claims_user_id ON public.item_claims(user_id);