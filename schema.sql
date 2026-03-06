-- ============================================================
-- KALKULACE STAVBY – Supabase schéma
-- ============================================================

-- Rozšíření
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILY UŽIVATELŮ (rozšíření auth.users)
-- ============================================================
create table public.profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  email       text not null,
  full_name   text,
  role        text not null default 'user' check (role in ('admin','user')),
  oblast      text check (oblast in ('Jihlava','Třebíč','Znojmo')),
  created_at  timestamptz default now()
);

-- Automaticky vytvořit profil při registraci uživatele
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- STAVBY (kalkulace)
-- ============================================================
create table public.stavby (
  id            uuid default uuid_generate_v4() primary key,
  user_id       uuid references public.profiles(id) on delete cascade not null,
  oblast        text not null check (oblast in ('Jihlava','Třebíč','Znojmo')),
  nazev         text not null,
  cislo         text,
  datum         text,
  stav          text default 'rozpracovana' check (stav in ('rozpracovana','dokoncena','archivovana')),
  -- Parametry kalkulace
  prirazka      numeric default 0.082,
  hzs_mont      numeric default 720,
  hzs_zem       numeric default 566,
  zmes_mont     numeric default 317,
  zmes_zem      numeric default 278,
  -- Ostatní pole
  gzs           numeric default 0,
  mat_zhotovitele numeric default 0,
  prispevek_sklad numeric default 0,
  -- Vyplaceno
  vypl_mzdy     numeric default 0,
  vypl_mech     numeric default 0,
  vypl_zemni    numeric default 0,
  vypl_gn       numeric default 0,
  -- Data sekcí jako JSON
  mzdy          jsonb default '{}',
  mech          jsonb default '{}',
  zemni         jsonb default '{}',
  gn            jsonb default '{}',
  dof           jsonb default '{}',
  -- Metadata
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Auto-update updated_at
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger stavby_updated_at
  before update on public.stavby
  for each row execute procedure public.update_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

alter table public.profiles enable row level security;
alter table public.stavby enable row level security;

-- Profily: každý vidí jen svůj, admin vidí vše
create policy "Vlastní profil" on public.profiles
  for all using (auth.uid() = id);

create policy "Admin vidí vše" on public.profiles
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Stavby: user vidí jen své, admin vidí vše
create policy "User vidí své stavby" on public.stavby
  for all using (auth.uid() = user_id);

create policy "Admin vidí všechny stavby" on public.stavby
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- INDEXY
-- ============================================================
create index idx_stavby_user_id  on public.stavby(user_id);
create index idx_stavby_oblast   on public.stavby(oblast);
create index idx_stavby_stav     on public.stavby(stav);
create index idx_profiles_oblast on public.profiles(oblast);
