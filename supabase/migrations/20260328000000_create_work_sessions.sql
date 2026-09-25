-- Create work_sessions table
create table if not exists public.work_sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null default auth.uid(),
  date date not null default current_date,
  start_time timestamptz not null,
  end_time timestamptz not null,
  category text not null check (category in ('Antigravity', 'Padel lessons', 'Other')),
  paid boolean not null default false,
  location text not null default 'Dubai',
  notes text,
  status text not null default 'completed' check (status in ('completed', 'in_progress')),
  amount numeric(10, 2),
  created_at timestamptz default now()
);

-- Set up Row Level Security (RLS)
alter table public.work_sessions enable row level security;

-- Policy: Users can only see their own work sessions
create policy "Users can view their own work sessions"
on public.work_sessions for select
using (auth.uid() = user_id);

-- Policy: Users can only insert their own work sessions
create policy "Users can insert their own work sessions"
on public.work_sessions for insert
with check (auth.uid() = user_id);

-- Policy: Users can only update their own work sessions
create policy "Users can update their own work sessions"
on public.work_sessions for update
using (auth.uid() = user_id);

-- Policy: Users can only delete their own work sessions
create policy "Users can delete their own work sessions"
on public.work_sessions for delete
using (auth.uid() = user_id);
