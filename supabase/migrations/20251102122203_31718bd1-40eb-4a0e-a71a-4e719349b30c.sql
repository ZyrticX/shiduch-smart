-- Create students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  city TEXT NOT NULL,
  native_language TEXT NOT NULL,
  gender TEXT,
  special_requests TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_matched BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create volunteers table
CREATE TABLE public.volunteers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  city TEXT NOT NULL,
  native_language TEXT NOT NULL,
  gender TEXT,
  capacity INTEGER DEFAULT 1,
  current_matches INTEGER DEFAULT 0,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create matches table
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  volunteer_id UUID REFERENCES public.volunteers(id) ON DELETE CASCADE,
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  match_reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  approved_at TIMESTAMPTZ,
  UNIQUE(student_id, volunteer_id)
);

-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow all operations for authenticated users (admin panel)
CREATE POLICY "Allow all operations for authenticated users" ON public.students
  FOR ALL USING (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.volunteers
  FOR ALL USING (true);

CREATE POLICY "Allow all operations for authenticated users" ON public.matches
  FOR ALL USING (true);

-- Create indexes for better performance
CREATE INDEX idx_students_city ON public.students(city);
CREATE INDEX idx_volunteers_city ON public.volunteers(city);
CREATE INDEX idx_students_matched ON public.students(is_matched);
CREATE INDEX idx_volunteers_active ON public.volunteers(is_active);
CREATE INDEX idx_matches_status ON public.matches(status);

-- Function to update volunteer capacity when match is approved
CREATE OR REPLACE FUNCTION update_volunteer_capacity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    -- Increment current_matches
    UPDATE public.volunteers 
    SET current_matches = current_matches + 1 
    WHERE id = NEW.volunteer_id;
    
    -- Mark student as matched
    UPDATE public.students 
    SET is_matched = true 
    WHERE id = NEW.student_id;
  ELSIF NEW.status != 'approved' AND OLD.status = 'approved' THEN
    -- Decrement current_matches
    UPDATE public.volunteers 
    SET current_matches = GREATEST(current_matches - 1, 0)
    WHERE id = NEW.volunteer_id;
    
    -- Mark student as not matched
    UPDATE public.students 
    SET is_matched = false 
    WHERE id = NEW.student_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for auto-updating capacity
CREATE TRIGGER on_match_status_change
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION update_volunteer_capacity();