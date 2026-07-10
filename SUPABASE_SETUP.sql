-- MercadoFlow PDV - estrutura inicial do Supabase
-- Execute este arquivo no SQL Editor de um projeto Supabase vazio.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  role text not null default 'vendedor' check (role in ('admin', 'gerente', 'vendedor')),
  photo_url text not null default '',
  status text not null default 'pendente' check (status in ('ativo', 'inativo', 'pendente')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_records (
  id text primary key,
  collection text not null check (collection in (
    'Category', 'FiadoRecord', 'GeneralAudit', 'Product',
    'ProductAudit', 'Sale', 'SystemConfig'
  )),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_records_collection_idx
  on public.app_records(collection);
create index if not exists app_records_collection_created_idx
  on public.app_records(collection, created_at desc);
create index if not exists app_records_data_gin_idx
  on public.app_records using gin(data);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists app_records_set_updated_at on public.app_records;
create trigger app_records_set_updated_at
before update on public.app_records
for each row execute function public.set_updated_at();

create or replace function public.bootstrap_available()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.profiles);
$$;

revoke all on function public.bootstrap_available() from public;
grant execute on function public.bootstrap_available() to anon, authenticated;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and status = 'ativo'
  );
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and status = 'ativo'
      and role in ('admin', 'gerente')
  );
$$;

revoke all on function public.is_active_user() from public;
revoke all on function public.is_manager() from public;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_manager() to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_user boolean;
begin
  select not exists (select 1 from public.profiles) into is_first_user;

  insert into public.profiles (
    id,
    email,
    full_name,
    role,
    status
  ) values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when is_first_user then 'admin' else 'vendedor' end,
    case when is_first_user then 'ativo' else 'pendente' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.app_records enable row level security;

drop policy if exists profiles_select_active on public.profiles;
create policy profiles_select_active
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or public.is_active_user());

drop policy if exists profiles_update_manager on public.profiles;
create policy profiles_update_manager
on public.profiles for update
to authenticated
using (public.is_manager())
with check (public.is_manager());

drop policy if exists records_select_active on public.app_records;
create policy records_select_active
on public.app_records for select
to authenticated
using (public.is_active_user());

drop policy if exists records_insert_active on public.app_records;
create policy records_insert_active
on public.app_records for insert
to authenticated
with check (
  public.is_active_user()
  and (collection <> 'SystemConfig' or public.is_manager())
);

drop policy if exists records_update_active on public.app_records;
create policy records_update_active
on public.app_records for update
to authenticated
using (
  public.is_active_user()
  and (collection <> 'SystemConfig' or public.is_manager())
)
with check (
  public.is_active_user()
  and (collection <> 'SystemConfig' or public.is_manager())
);

drop policy if exists records_delete_active on public.app_records;
create policy records_delete_active
on public.app_records for delete
to authenticated
using (
  public.is_active_user()
  and (collection <> 'SystemConfig' or public.is_manager())
);

insert into public.app_records (id, collection, data)
values
  ('config_logo', 'SystemConfig', jsonb_build_object(
    'key', 'logo_url',
    'value', '/mercadoflow-logo.svg',
    'label', 'Logo do sistema'
  )),
  ('config_minimized', 'SystemConfig', jsonb_build_object(
    'key', 'limite_vendas_minimizadas',
    'value', '5',
    'label', 'Limite de vendas minimizadas'
  ))
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mercadoflow-assets',
  'mercadoflow-assets',
  true,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists mercadoflow_assets_insert on storage.objects;
create policy mercadoflow_assets_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'mercadoflow-assets'
  and public.is_active_user()
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists mercadoflow_assets_update on storage.objects;
create policy mercadoflow_assets_update
on storage.objects for update
to authenticated
using (
  bucket_id = 'mercadoflow-assets'
  and public.is_active_user()
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'mercadoflow-assets'
  and public.is_active_user()
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists mercadoflow_assets_delete on storage.objects;
create policy mercadoflow_assets_delete
on storage.objects for delete
to authenticated
using (
  bucket_id = 'mercadoflow-assets'
  and public.is_active_user()
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
