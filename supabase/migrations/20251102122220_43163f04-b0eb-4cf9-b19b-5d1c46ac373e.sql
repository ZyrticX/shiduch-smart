-- Fix security warning: Set explicit search_path for the function
CREATE OR REPLACE FUNCTION update_volunteer_capacity()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;