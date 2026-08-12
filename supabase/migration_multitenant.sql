-- Migração multi-tenant: transforma o sistema single-tenant (uma loja) em
-- multi-empresa (várias empresas, cada uma com login, produtos e catálogo
-- próprios), mais um papel de super-admin.
--
-- IMPORTANTE — rode nesta ordem:
--   1) Rode a seção "DIAGNÓSTICO" abaixo primeiro (só leitura) e confira:
--      - se os nomes de constraints batem com os assumidos neste script
--      - qual é o e-mail (auth.users) que deve virar super-admin
--   2) Edite o placeholder 'TROQUE_PELO_SEU_EMAIL@exemplo.com' mais abaixo
--      com o e-mail exato retornado pela consulta de diagnóstico.
--   3) Cole o restante do script no SQL Editor do Supabase e rode de uma vez.
--
-- Este script pressupõe que `supabase/schema.sql` já foi executado
-- anteriormente neste projeto (é o schema single-tenant original).

-- ============================================================
-- DIAGNÓSTICO (rode antes, isoladamente — apenas leitura)
-- ============================================================
-- select conname, contype, conrelid::regclass
-- from pg_constraint
-- where conrelid in ('categories'::regclass, 'products'::regclass);
--
-- select id, email from auth.users;
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1. Tabelas novas
-- ------------------------------------------------------------

create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  phone text,
  whatsapp text,
  instagram text,
  website text,
  address text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 2. Empresa "BN Suplementos" a partir dos dados atuais de store_settings
-- ------------------------------------------------------------

insert into companies (id, name, slug, logo_url, phone, whatsapp, instagram, website, address, active)
select
  '11111111-1111-1111-1111-111111111111'::uuid,
  store_name, 'bn-suplementos', logo_url, phone, whatsapp, instagram, website, address, true
from store_settings
where id = 1;

-- ------------------------------------------------------------
-- 3. company_id em categories, products, generated_catalogs
-- ------------------------------------------------------------

-- categories
alter table categories add column company_id uuid references companies(id) on delete cascade;
update categories set company_id = '11111111-1111-1111-1111-111111111111';
alter table categories alter column company_id set not null;

alter table categories drop constraint if exists categories_name_key;
alter table categories drop constraint if exists categories_slug_key;
alter table categories add constraint categories_company_name_key unique (company_id, name);
alter table categories add constraint categories_company_slug_key unique (company_id, slug);
-- necessário para a FK composta de products abaixo
alter table categories add constraint categories_id_company_key unique (id, company_id);

-- products
alter table products add column company_id uuid references companies(id) on delete cascade;
update products set company_id = '11111111-1111-1111-1111-111111111111';
alter table products alter column company_id set not null;

-- reforça no banco que a categoria de um produto pertence à mesma empresa do produto
alter table products drop constraint if exists products_category_id_fkey;
alter table products add constraint products_category_company_fkey
  foreign key (category_id, company_id) references categories(id, company_id) on delete restrict;

-- generated_catalogs
alter table generated_catalogs add column company_id uuid references companies(id) on delete cascade;
update generated_catalogs set company_id = '11111111-1111-1111-1111-111111111111';
alter table generated_catalogs alter column company_id set not null;

-- ------------------------------------------------------------
-- 4. Funções helper de RLS
-- ------------------------------------------------------------
-- security definer: necessário para evitar recursão infinita quando a
-- policy de `profiles` chamaria a própria função que lê `profiles`.
-- Funciona porque o dono da função (quem roda este script) é o mesmo dono
-- da tabela `profiles`. Se ao testar você receber o erro "infinite
-- recursion detected in policy for relation profiles", rode:
--   alter function auth_company_id() owner to postgres;
--   alter function auth_is_super_admin() owner to postgres;

create or replace function auth_company_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select company_id from profiles where id = auth.uid()
$$;

create or replace function auth_is_super_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select is_super_admin from profiles where id = auth.uid()), false)
$$;

-- ------------------------------------------------------------
-- 5. Perfis para os usuários já existentes
-- ------------------------------------------------------------
-- Todo usuário hoje existente vira "owner" da BN Suplementos automaticamente
-- (garante que ninguém fica sem acesso mesmo que o passo seguinte seja
-- esquecido ou o e-mail não seja editado corretamente).

insert into profiles (id, company_id, role, is_super_admin)
select u.id, '11111111-1111-1111-1111-111111111111', 'owner', false
from auth.users u
on conflict (id) do nothing;

-- Marque explicitamente qual conta é o super-admin (você).
-- TROQUE o e-mail abaixo pelo e-mail exato retornado no diagnóstico
-- (select email from auth.users) antes de rodar este script.
update profiles set is_super_admin = true
where id = (select id from auth.users where email = 'TROQUE_PELO_SEU_EMAIL@exemplo.com');

-- ------------------------------------------------------------
-- 6. RLS: companies e profiles
-- ------------------------------------------------------------

alter table companies enable row level security;
alter table profiles enable row level security;

create policy "companies read" on companies
  for select using (id = auth_company_id() or auth_is_super_admin());
create policy "companies update" on companies
  for update using (id = auth_company_id() or auth_is_super_admin())
  with check (id = auth_company_id() or auth_is_super_admin());
create policy "companies insert admin" on companies
  for insert with check (auth_is_super_admin());
create policy "companies delete admin" on companies
  for delete using (auth_is_super_admin());

create policy "profiles self read" on profiles
  for select using (id = auth.uid() or auth_is_super_admin());
create policy "profiles admin insert" on profiles
  for insert with check (auth_is_super_admin());
create policy "profiles admin update" on profiles
  for update using (auth_is_super_admin()) with check (auth_is_super_admin());
create policy "profiles admin delete" on profiles
  for delete using (auth_is_super_admin());

-- ------------------------------------------------------------
-- 7. RLS: categories, products, generated_catalogs (escopo por empresa)
-- ------------------------------------------------------------

drop policy "authenticated full access" on categories;
drop policy "authenticated full access" on products;
drop policy "authenticated full access" on generated_catalogs;
drop policy "authenticated full access" on store_settings;

create policy "tenant access" on categories
  for all using (company_id = auth_company_id() or auth_is_super_admin())
  with check (company_id = auth_company_id() or auth_is_super_admin());
create policy "tenant access" on products
  for all using (company_id = auth_company_id() or auth_is_super_admin())
  with check (company_id = auth_company_id() or auth_is_super_admin());
create policy "tenant access" on generated_catalogs
  for all using (company_id = auth_company_id() or auth_is_super_admin())
  with check (company_id = auth_company_id() or auth_is_super_admin());

-- store_settings deixa de ser usada pelo código (substituída por
-- companies), mas a tabela não é apagada — fica como histórico/rollback.

-- ------------------------------------------------------------
-- 8. Storage: bucket "assets" (faltava no schema.sql original) + policies
--    escopadas por pasta (defesa em profundidade — a correção real de
--    segurança está nas rotas de API, que passam a checar autenticação e
--    empresa ativa antes de gravar)
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
  values ('assets', 'assets', true) on conflict (id) do nothing;

drop policy "escrita autenticada produtos" on storage.objects;
drop policy "atualizacao autenticada produtos" on storage.objects;
drop policy "acesso autenticado catalogos" on storage.objects;

create policy "escrita empresa produtos" on storage.objects
  for insert with check (
    bucket_id = 'produtos' and auth.role() = 'authenticated'
    and ((storage.foldername(name))[1] = auth_company_id()::text or auth_is_super_admin())
  );
create policy "atualizacao empresa produtos" on storage.objects
  for update using (
    bucket_id = 'produtos' and auth.role() = 'authenticated'
    and ((storage.foldername(name))[1] = auth_company_id()::text or auth_is_super_admin())
  );

create policy "leitura publica assets" on storage.objects
  for select using (bucket_id = 'assets');
create policy "escrita empresa assets" on storage.objects
  for insert with check (
    bucket_id = 'assets' and auth.role() = 'authenticated'
    and ((storage.foldername(name))[1] = auth_company_id()::text or auth_is_super_admin())
  );
create policy "atualizacao empresa assets" on storage.objects
  for update using (
    bucket_id = 'assets' and auth.role() = 'authenticated'
    and ((storage.foldername(name))[1] = auth_company_id()::text or auth_is_super_admin())
  );

create policy "acesso empresa catalogos" on storage.objects
  for all using (
    bucket_id = 'catalogos' and auth.role() = 'authenticated'
    and ((storage.foldername(name))[1] = auth_company_id()::text or auth_is_super_admin())
  )
  with check (
    bucket_id = 'catalogos' and auth.role() = 'authenticated'
    and ((storage.foldername(name))[1] = auth_company_id()::text or auth_is_super_admin())
  );

commit;

-- ============================================================
-- VERIFICAÇÃO (rode depois do commit, ainda no SQL Editor)
-- ============================================================
-- select count(*) from products where company_id is null;         -- espera 0
-- select count(*) from categories where company_id is null;       -- espera 0
-- select count(*) from generated_catalogs where company_id is null; -- espera 0
-- select id, name, slug from companies;                           -- 1 linha: BN Suplementos
-- select id, company_id, role, is_super_admin from profiles;      -- sua conta com is_super_admin = true
-- ============================================================
