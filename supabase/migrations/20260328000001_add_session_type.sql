-- Add session_type column to work_sessions table
alter table public.work_sessions 
add column if not exists session_type text;

-- Update existing sessions to have a default session_type if needed
update public.work_sessions 
set session_type = 'Other' 
where session_type is null;
