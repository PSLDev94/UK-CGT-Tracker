-- UK CGT TRACKER - SECURITY HARDENING SCRIPT
-- Execute this entirely in the Supabase SQL Editor to enforce strict RLS

-- 1. Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE cgt_computations ENABLE ROW LEVEL SECURITY;
ALTER TABLE disposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE section_104_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts (Silently ignores if none exist)
DO $$ DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- 3. Create strict policies limiting access exclusively to the authenticated user owning the row
CREATE POLICY "Users can only view/modify their own profiles" 
  ON profiles FOR ALL USING (id = auth.uid());

CREATE POLICY "Users can only view/modify their own transactions" 
  ON transactions FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can only view/modify their own uploads" 
  ON uploads FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can only view/modify their own cgt_computations" 
  ON cgt_computations FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can only view/modify their own disposals" 
  ON disposals FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can only view/modify their own section_104_pools" 
  ON section_104_pools FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can only view/modify their own alerts" 
  ON alerts FOR ALL USING (user_id = auth.uid());

-- Optional check: Verify they are all active
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
