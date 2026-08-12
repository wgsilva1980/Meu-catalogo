-- Execute este script inteiro no SQL Editor do seu projeto Supabase.

create extension if not exists "pgcrypto";

create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  sort_order int not null default 0,
  is_fixed boolean not null default true,
  created_at timestamptz not null default now()
);

create table products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  brand text not null,
  category_id uuid not null references categories(id) on delete restrict,
  short_description text not null default '',
  price numeric(10,2) not null default 0,
  promo_note text,
  available boolean not null default true,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table store_settings (
  id int primary key default 1 check (id = 1),
  store_name text not null default 'BN Suplementos',
  logo_url text,
  phone text,
  whatsapp text,
  instagram text,
  website text,
  address text
);

create table generated_catalogs (
  id uuid primary key default gen_random_uuid(),
  scope jsonb not null,
  pdf_path text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- mantém updated_at em dia
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger products_set_updated_at
  before update on products
  for each row execute function set_updated_at();

-- categorias fixas do enunciado
insert into categories (name, slug, sort_order, is_fixed) values
  ('Whey', 'whey', 1, true),
  ('Creatina', 'creatina', 2, true),
  ('Pré-treino', 'pre-treino', 3, true),
  ('Vitaminas', 'vitaminas', 4, true),
  ('Barras', 'barras', 5, true),
  ('Acessórios', 'acessorios', 6, true),
  ('Outras', 'outras', 7, true);

insert into store_settings (id, store_name) values (1, 'BN Suplementos');

-- RLS: sistema é 100% interno, só usuários autenticados (equipe) acessam
alter table categories enable row level security;
alter table products enable row level security;
alter table store_settings enable row level security;
alter table generated_catalogs enable row level security;

create policy "authenticated full access" on categories
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on products
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on store_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated full access" on generated_catalogs
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- buckets de armazenamento: imagens de produto públicas (aparecem no PDF),
-- PDFs gerados privados (acesso via link assinado)
insert into storage.buckets (id, name, public)
  values ('produtos', 'produtos', true) on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('catalogos', 'catalogos', false) on conflict (id) do nothing;

create policy "leitura publica produtos" on storage.objects
  for select using (bucket_id = 'produtos');
create policy "escrita autenticada produtos" on storage.objects
  for insert with check (bucket_id = 'produtos' and auth.role() = 'authenticated');
create policy "atualizacao autenticada produtos" on storage.objects
  for update using (bucket_id = 'produtos' and auth.role() = 'authenticated');

create policy "acesso autenticado catalogos" on storage.objects
  for all using (bucket_id = 'catalogos' and auth.role() = 'authenticated')
  with check (bucket_id = 'catalogos' and auth.role() = 'authenticated');
