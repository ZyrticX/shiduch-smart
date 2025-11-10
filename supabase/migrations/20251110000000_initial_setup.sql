-- Initial setup for new database
-- Creating all tables: students, users, matches, audit_log

-- Create students table (החיילים)
CREATE TABLE IF NOT EXISTS public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT UNIQUE,
  city TEXT NOT NULL,
  native_language TEXT NOT NULL,
  gender TEXT,
  special_requests TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_matched BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create users table (המתנדבים/סטודנטים)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT UNIQUE,
  city TEXT NOT NULL,
  native_language TEXT NOT NULL,
  gender TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_active BOOLEAN DEFAULT true,
  scholarship_active BOOLEAN DEFAULT true,
  current_students INTEGER DEFAULT 0,
  capacity_max INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create matches table
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  match_reason TEXT,
  status TEXT DEFAULT 'Suggested' CHECK (status IN ('Suggested', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, user_id)
);

-- Create audit_log table for tracking notifications
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_type TEXT DEFAULT 'system',
  recipient_email TEXT,
  recipient_phone TEXT,
  notification_channel TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow all operations (public access for admin panel)
CREATE POLICY "Allow all operations" ON public.students FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.users FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.matches FOR ALL USING (true);
CREATE POLICY "Allow all operations" ON public.audit_log FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_students_city ON public.students(city);
CREATE INDEX IF NOT EXISTS idx_students_phone ON public.students(phone);
CREATE INDEX IF NOT EXISTS idx_students_matched ON public.students(is_matched);
CREATE INDEX IF NOT EXISTS idx_students_native_language ON public.students(native_language);

CREATE INDEX IF NOT EXISTS idx_users_city ON public.users(city);
CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users(phone);
CREATE INDEX IF NOT EXISTS idx_users_active ON public.users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_scholarship ON public.users(scholarship_active);
CREATE INDEX IF NOT EXISTS idx_users_native_language ON public.users(native_language);

CREATE INDEX IF NOT EXISTS idx_matches_student ON public.matches(student_id);
CREATE INDEX IF NOT EXISTS idx_matches_user ON public.matches(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON public.matches(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_log_match_id ON public.audit_log(match_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_status ON public.audit_log(status);

-- Function to update user capacity when match is approved
CREATE OR REPLACE FUNCTION update_user_capacity()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Increment current_students
    UPDATE public.users 
    SET current_students = current_students + 1 
    WHERE id = NEW.user_id;
    
    -- Mark student as matched
    UPDATE public.students 
    SET is_matched = true 
    WHERE id = NEW.student_id;
    
  ELSIF NEW.status != 'approved' AND OLD.status = 'approved' THEN
    -- Decrement current_students
    UPDATE public.users 
    SET current_students = GREATEST(current_students - 1, 0)
    WHERE id = NEW.user_id;
    
    -- Check if student has other approved matches
    IF NOT EXISTS (
      SELECT 1 FROM public.matches 
      WHERE student_id = NEW.student_id 
      AND status = 'approved' 
      AND id != NEW.id
    ) THEN
      UPDATE public.students 
      SET is_matched = false 
      WHERE id = NEW.student_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger for auto-updating capacity
DROP TRIGGER IF EXISTS on_match_status_change ON public.matches;
CREATE TRIGGER on_match_status_change
  AFTER INSERT OR UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION update_user_capacity();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

