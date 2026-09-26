-- Create lesson_packages table for prepaid lesson bundles
CREATE TABLE IF NOT EXISTS public.lesson_packages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL DEFAULT auth.uid(),
  client_name text NOT NULL,
  total_lessons integer NOT NULL CHECK (total_lessons > 0),
  total_amount numeric(10,2) NOT NULL,
  paid_date date NOT NULL DEFAULT current_date,
  location text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Add package_id to work_sessions (nullable — only set for package-linked sessions)
ALTER TABLE public.work_sessions 
ADD COLUMN IF NOT EXISTS package_id uuid REFERENCES public.lesson_packages(id) ON DELETE SET NULL;

-- RLS for lesson_packages
ALTER TABLE public.lesson_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own packages"
ON public.lesson_packages FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own packages"
ON public.lesson_packages FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own packages"
ON public.lesson_packages FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own packages"
ON public.lesson_packages FOR DELETE
USING (auth.uid() = user_id);
