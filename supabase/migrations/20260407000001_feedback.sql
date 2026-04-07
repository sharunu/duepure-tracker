create table feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  category text not null,
  message text not null,
  created_at timestamptz default now()
);

-- RLS
alter table feedback enable row level security;

create policy "Users can insert own feedback"
  on feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can read own feedback"
  on feedback for select
  to authenticated
  using (auth.uid() = user_id);
