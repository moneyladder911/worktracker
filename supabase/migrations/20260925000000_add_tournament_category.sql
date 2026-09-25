-- Add 'Tournament' to the category CHECK constraint
-- First drop the existing constraint, then recreate with Tournament included
ALTER TABLE public.work_sessions DROP CONSTRAINT IF EXISTS work_sessions_category_check;

ALTER TABLE public.work_sessions 
ADD CONSTRAINT work_sessions_category_check 
CHECK (category IN ('Antigravity', 'Padel lessons', 'Tournament', 'Other'));
