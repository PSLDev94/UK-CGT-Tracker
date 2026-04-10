-- Users table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  stripe_customer_id TEXT,
  subscription_status TEXT DEFAULT 'trialing',
  -- 'trialing' | 'active' | 'canceled' | 'past_due'
  subscription_end_date TIMESTAMPTZ,
  trial_end_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '14 days'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Raw transactions (one row per buy/sell/dividend)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  upload_id UUID, -- NULL references allowed if we want to run tests without uploads? But the instructions have cascade delete. Let's make it nullable or handle uploads schema first.
  date DATE NOT NULL,
  type TEXT NOT NULL, -- 'BUY' | 'SELL' | 'DIVIDEND' | 'CORPORATE_ACTION'
  ticker TEXT NOT NULL,
  security_name TEXT,
  quantity NUMERIC(20, 8) NOT NULL,
  price_gbp NUMERIC(20, 8) NOT NULL,
  total_gbp NUMERIC(20, 8) NOT NULL,
  fees_gbp NUMERIC(20, 8) DEFAULT 0,
  original_currency TEXT DEFAULT 'GBP',
  fx_rate NUMERIC(20, 8) DEFAULT 1,
  broker TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CSV upload records
CREATE TABLE uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  broker_detected TEXT,
  row_count INTEGER,
  transactions_imported INTEGER,
  status TEXT DEFAULT 'processing',
  error_message TEXT,
  schema_mapping JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add the missing upload_id fk on transactions
ALTER TABLE transactions 
ADD CONSTRAINT fk_upload 
FOREIGN KEY (upload_id) REFERENCES uploads(id) ON DELETE CASCADE;

-- CGT computations
CREATE TABLE cgt_computations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tax_year TEXT NOT NULL,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  total_proceeds_gbp NUMERIC(20, 8) DEFAULT 0,
  total_allowable_cost_gbp NUMERIC(20, 8) DEFAULT 0,
  total_gain_gbp NUMERIC(20, 8) DEFAULT 0,
  total_loss_gbp NUMERIC(20, 8) DEFAULT 0,
  net_gain_gbp NUMERIC(20, 8) DEFAULT 0,
  annual_exempt_amount_gbp NUMERIC(20, 8) DEFAULT 3000,
  taxable_gain_gbp NUMERIC(20, 8) DEFAULT 0,
  UNIQUE(user_id, tax_year)
);

-- Individual disposal records
CREATE TABLE disposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tax_year TEXT NOT NULL,
  date DATE NOT NULL,
  ticker TEXT NOT NULL,
  security_name TEXT,
  quantity NUMERIC(20, 8) NOT NULL,
  proceeds_gbp NUMERIC(20, 8) NOT NULL,
  allowable_cost_gbp NUMERIC(20, 8) NOT NULL,
  gain_gbp NUMERIC(20, 8) NOT NULL,
  matching_rule TEXT NOT NULL, -- 'SAME_DAY' | 'BED_AND_BREAKFAST' | 'SECTION_104'
  notes TEXT
);

-- Section 104 pools
CREATE TABLE section_104_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  total_shares NUMERIC(20, 8) DEFAULT 0,
  total_allowable_cost_gbp NUMERIC(20, 8) DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, ticker)
);

-- Email alerts log
CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  payload JSONB
);

-- RLS Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgt_computations ENABLE ROW LEVEL SECURITY;
ALTER TABLE disposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_104_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only access their own profiles" ON profiles FOR ALL USING (id = auth.uid());
CREATE POLICY "Users can only access their own transactions" ON transactions FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can only access their own uploads" ON uploads FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can only access their own computations" ON cgt_computations FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can only access their own disposals" ON disposals FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can only access their own pools" ON section_104_pools FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users can only access their own alerts" ON alerts FOR ALL USING (user_id = auth.uid());

-- Trigger to create profile on user creation
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
