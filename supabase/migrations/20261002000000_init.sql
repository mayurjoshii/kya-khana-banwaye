-- Cook Assistant: initial schema.
-- Run in the Supabase SQL editor (or `supabase db push`), then run seed.sql.

-- Enums -----------------------------------------------------------------------

create type preference_kind as enum ('like', 'dislike', 'craving', 'avoid', 'note');
create type input_source as enum ('text', 'voice');
create type rule_kind as enum ('hard', 'soft');
create type visit_mode as enum ('lunch_dinner', 'lunch_snacks');
create type dish_complexity as enum ('simple', 'complex');
create type plan_status as enum ('planning', 'planned', 'audio_ready', 'sent', 'failed', 'stale');
create type llm_status as enum ('ok', 'invalid', 'error');

-- Tables ----------------------------------------------------------------------

create table people (
  id uuid primary key default gen_random_uuid(),
  role text not null unique check (role in ('me', 'partner')),
  name text not null,
  protein_min_g int not null default 60,
  protein_max_g int not null default 70,
  meal_protein_min_g int not null default 25,
  meal_protein_max_g int not null default 30,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table user_inputs (
  id uuid primary key default gen_random_uuid(),
  text text not null default '',
  source input_source not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  extraction jsonb,
  error text
);

create table preferences (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references people (id) on delete cascade, -- null = both
  kind preference_kind not null,
  item text not null,
  item_key text not null,
  strength smallint not null default 2 check (strength between 1 and 3),
  expires_at timestamptz, -- null = permanent
  source_input_id uuid references user_inputs (id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index preferences_active_idx on preferences (active, kind);

create table cook_profile (
  id int primary key default 1 check (id = 1),
  name text not null,
  visit_time time not null default '12:30',
  visit_minutes int not null default 60,
  max_dishes_simple int not null default 4,
  max_dishes_complex int not null default 3,
  servings int not null default 2,
  language text not null default 'hi-IN',
  default_mode visit_mode not null default 'lunch_dinner',
  updated_at timestamptz not null default now()
);

create table cook_rules (
  id uuid primary key default gen_random_uuid(),
  rule text not null,
  kind rule_kind not null default 'soft',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table cook_skills (
  dish_key text primary key,
  display_name text not null,
  knows boolean not null default false,
  times_cooked_with_steps int not null default 0,
  notes text not null default '',
  updated_at timestamptz not null default now()
);

create table fridge_items (
  id uuid primary key default gen_random_uuid(),
  item_key text not null unique,
  display_name text not null,
  quantity text not null default '',
  is_staple boolean not null default false,
  in_stock boolean not null default true,
  last_confirmed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table recipes (
  dish_key text primary key,
  display_name text not null,
  display_name_hi text not null default '',
  complexity dish_complexity not null default 'simple',
  minutes int not null default 30,
  protein_g_per_serving numeric not null default 0,
  ingredients jsonb not null default '[]',
  steps_hi text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- One-off settings for a single visit (e.g. "snacks instead of dinner tomorrow").
create table visit_overrides (
  plan_date date primary key,
  mode visit_mode,
  note text not null default '',
  created_at timestamptz not null default now()
);

create table meal_plans (
  id uuid primary key default gen_random_uuid(),
  plan_date date not null unique,
  mode visit_mode not null default 'lunch_dinner',
  dishes jsonb not null default '[]',
  missing_items jsonb not null default '[]',
  protein jsonb not null default '{}',
  warnings jsonb not null default '[]',
  status plan_status not null default 'planning',
  error text,
  script_hi text,
  audio_path text,
  version int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create table plan_feedback (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references meal_plans (id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  cook_issue text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table llm_logs (
  id uuid primary key default gen_random_uuid(),
  purpose text not null,
  model text not null,
  prompt text not null,
  response text,
  latency_ms int,
  input_tokens int,
  output_tokens int,
  status llm_status not null,
  error text,
  created_at timestamptz not null default now()
);
create index llm_logs_created_idx on llm_logs (created_at desc);

-- Row level security ----------------------------------------------------------
-- Sign-ups are off, so the only authenticated user is the owner.
-- The cron routes use the service role, which bypasses RLS.

do $$
declare t text;
begin
  foreach t in array array[
    'people', 'user_inputs', 'preferences', 'cook_profile', 'cook_rules', 'cook_skills',
    'fridge_items', 'recipes', 'visit_overrides', 'meal_plans', 'plan_feedback', 'llm_logs'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "owner full access" on %I for all to authenticated using (true) with check (true)', t
    );
  end loop;
end $$;

-- Storage: private bucket for the daily mp3s ----------------------------------

insert into storage.buckets (id, name, public)
values ('plan-audio', 'plan-audio', false)
on conflict (id) do nothing;

create policy "owner reads plan audio" on storage.objects
  for select to authenticated using (bucket_id = 'plan-audio');
create policy "owner writes plan audio" on storage.objects
  for insert to authenticated with check (bucket_id = 'plan-audio');
create policy "owner updates plan audio" on storage.objects
  for update to authenticated using (bucket_id = 'plan-audio');
create policy "owner deletes plan audio" on storage.objects
  for delete to authenticated using (bucket_id = 'plan-audio');
