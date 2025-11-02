-- Create audit_log table for tracking notifications
CREATE TABLE public.audit_log (
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
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- RLS Policy - Allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users" ON public.audit_log
  FOR ALL USING (true);

-- Create index for better performance
CREATE INDEX idx_audit_log_match_id ON public.audit_log(match_id);
CREATE INDEX idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_status ON public.audit_log(status);