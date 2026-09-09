-- =====================================================================
-- bootstrap_preview.sql — cria o schema completo em um projeto Supabase
-- NOVO E VAZIO (ambiente de preview, ou uma nova produção).
--
-- É a concatenação, NA ORDEM DE DEPENDÊNCIA, de todas as migrations que
-- construíram a produção. Rodar isto num projeto novo deixa o banco
-- IDÊNTICO ao de produção — sem risco de divergência.
--
-- COMO USAR
--   1. Crie o projeto novo no Supabase.
--   2. Abra o SQL Editor do projeto novo.
--   3. Na seção "2) migration_multitenant.sql", o UPDATE de super-admin
--      procura por 'TROQUE_PELO_SEU_EMAIL@exemplo.com'. Em projeto novo o
--      auth.users está vazio, então esse UPDATE não afeta nada agora —
--      deixe como está e use a seção "PÓS-INSTALAÇÃO" no fim do arquivo
--      depois de criar seu login.
--   4. Cole este arquivo inteiro e execute.
--   5. No Vercel, defina NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
--      / SUPABASE_SERVICE_ROLE_KEY do projeto novo com escopo **Preview**.
--   6. Redeploy do branch de preview.
--
-- Daqui pra frente, toda migration nova: rode no preview primeiro,
-- depois na produção.
-- =====================================================================


-- #####################################################################
-- 1) schema.sql  (schema single-tenant original)
-- #####################################################################

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


-- ###################################################################
-- 2) migration_multitenant.sql  (multi-empresa + super-admin)
-- ###################################################################

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


-- ###################################################################
-- 3) migration_customers.sql
-- ###################################################################

-- Cadastro de clientes por empresa. Rode depois de `migration_multitenant.sql`
-- (precisa das tabelas `companies`/`profiles` e das funções auth_company_id()/
-- auth_is_super_admin() já criadas por aquele script).

begin;

create table customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  document text,
  zip_code text,
  street text,
  number text,
  complement text,
  neighborhood text,
  city text,
  state text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger customers_set_updated_at
  before update on customers
  for each row execute function set_updated_at();

alter table customers enable row level security;

create policy "tenant access" on customers
  for all using (company_id = auth_company_id() or auth_is_super_admin())
  with check (company_id = auth_company_id() or auth_is_super_admin());

commit;


-- ###################################################################
-- 4) migration_sales_orders.sql
-- ###################################################################

-- Pedidos de venda: liga cadastro de clientes com cadastro de produtos.
-- Rode depois de `migration_customers.sql` (precisa das tabelas `companies`/
-- `customers` e das funções auth_company_id()/auth_is_super_admin() já
-- criadas por `migration_multitenant.sql`).

begin;

create table sales_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  number bigserial,
  customer_id uuid not null references customers(id) on delete restrict,
  status text not null default 'rascunho' check (status in ('rascunho', 'confirmado', 'cancelado')),
  notes text,
  total numeric(10,2) not null default 0,
  pdf_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table sales_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references sales_orders(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  product_name text not null,
  unit_price numeric(10,2) not null,
  quantity int not null check (quantity > 0),
  subtotal numeric(10,2) not null
);

create trigger sales_orders_set_updated_at
  before update on sales_orders
  for each row execute function set_updated_at();

alter table sales_orders enable row level security;
alter table sales_order_items enable row level security;

create policy "tenant access" on sales_orders
  for all using (company_id = auth_company_id() or auth_is_super_admin())
  with check (company_id = auth_company_id() or auth_is_super_admin());
create policy "tenant access" on sales_order_items
  for all using (company_id = auth_company_id() or auth_is_super_admin())
  with check (company_id = auth_company_id() or auth_is_super_admin());

-- bucket privado para os PDFs de recibo dos pedidos (mesmo padrão de
-- `catalogos`/`assets` em migration_multitenant.sql: pasta por empresa)
insert into storage.buckets (id, name, public)
  values ('pedidos', 'pedidos', false) on conflict (id) do nothing;

create policy "acesso empresa pedidos" on storage.objects
  for all using (
    bucket_id = 'pedidos' and auth.role() = 'authenticated'
    and ((storage.foldername(name))[1] = auth_company_id()::text or auth_is_super_admin())
  )
  with check (
    bucket_id = 'pedidos' and auth.role() = 'authenticated'
    and ((storage.foldername(name))[1] = auth_company_id()::text or auth_is_super_admin())
  );

commit;


-- ###################################################################
-- 5) migration_product_shipping.sql
-- ###################################################################

-- Dados de peso e dimensões por produto, para viabilizar cálculo de frete
-- (peso real x peso cúbico, como usado por Correios/Melhor Envio).
-- Colunas opcionais: produtos existentes ficam com null até serem
-- preenchidos manualmente no cadastro.

begin;

alter table products add column if not exists weight_kg numeric(10,3);
alter table products add column if not exists length_cm numeric(10,2);
alter table products add column if not exists width_cm numeric(10,2);
alter table products add column if not exists height_cm numeric(10,2);

commit;


-- ###################################################################
-- 6) migration_email_notifications.sql
-- ###################################################################

-- Notificações por e-mail: cada empresa guarda o e-mail para onde vai o
-- aviso de novo cadastro/pedido feito pelas páginas públicas. O envio em si
-- usa uma conta Gmail compartilhada pelo app (env vars GMAIL_USER/
-- GMAIL_APP_PASSWORD), então nenhuma configuração de domínio é necessária
-- por empresa.
-- Rode depois de `migration_multitenant.sql`.

begin;

alter table companies add column if not exists notification_email text;

commit;


-- ###################################################################
-- 7) migration_melhor_envio.sql
-- ###################################################################

-- Integração com o Melhor Envio: cada empresa conecta sua própria conta via
-- OAuth2 (mesmo app/client_id compartilhado pela plataforma, token por
-- empresa) para calcular frete e comprar/gerar etiquetas.
-- Rode depois de `migration_sales_orders.sql`.

begin;

-- Endereço de origem (remetente) usado em toda cotação/etiqueta. A empresa
-- já tem um `address` livre para exibição no catálogo; frete precisa de
-- campos estruturados, então ficam à parte.
alter table companies add column if not exists shipping_origin_name text;
alter table companies add column if not exists shipping_origin_document text;
alter table companies add column if not exists shipping_origin_phone text;
alter table companies add column if not exists shipping_origin_email text;
alter table companies add column if not exists shipping_origin_zip_code text;
alter table companies add column if not exists shipping_origin_street text;
alter table companies add column if not exists shipping_origin_number text;
alter table companies add column if not exists shipping_origin_complement text;
alter table companies add column if not exists shipping_origin_neighborhood text;
alter table companies add column if not exists shipping_origin_city text;
alter table companies add column if not exists shipping_origin_state text;

create table melhor_envio_accounts (
  company_id uuid primary key references companies(id) on delete cascade,
  environment text not null default 'sandbox' check (environment in ('sandbox', 'production')),
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger melhor_envio_accounts_set_updated_at
  before update on melhor_envio_accounts
  for each row execute function set_updated_at();

alter table melhor_envio_accounts enable row level security;

create policy "tenant access" on melhor_envio_accounts
  for all using (company_id = auth_company_id() or auth_is_super_admin())
  with check (company_id = auth_company_id() or auth_is_super_admin());

-- Uma cotação/etiqueta por pedido. "status" acompanha o funil do próprio
-- Melhor Envio: cotado -> no_carrinho -> pago -> gerado (ou cancelado).
create table shipments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  order_id uuid not null references sales_orders(id) on delete cascade,
  melhor_envio_id text,
  service_id int,
  service_name text,
  price numeric(10,2),
  status text not null default 'cotado' check (status in ('cotado', 'no_carrinho', 'pago', 'gerado', 'cancelado')),
  tracking_code text,
  print_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);

create trigger shipments_set_updated_at
  before update on shipments
  for each row execute function set_updated_at();

alter table shipments enable row level security;

create policy "tenant access" on shipments
  for all using (company_id = auth_company_id() or auth_is_super_admin())
  with check (company_id = auth_company_id() or auth_is_super_admin());

commit;


-- ###################################################################
-- 8) migration_melhor_envio_package.sql
-- ###################################################################

-- Caixa padrão para gerar UMA etiqueta por pedido no Melhor Envio.
-- Em vez de um volume por item, o envio passa a usar uma única caixa com
-- estas dimensões (cm) e o peso somado de todos os produtos do pedido.
-- Rode depois de migration_melhor_envio.sql.

begin;

alter table companies add column if not exists shipping_package_length_cm numeric;
alter table companies add column if not exists shipping_package_width_cm numeric;
alter table companies add column if not exists shipping_package_height_cm numeric;

commit;


-- ###################################################################
-- 9) migration_melhor_envio_agency.sql
-- ###################################################################

-- Agência de postagem Jadlog/Azul para o Melhor Envio.
-- Jadlog e Azul Cargo exigem uma agência (ponto de coleta/postagem) ao
-- adicionar o envio ao carrinho (`/api/v2/me/cart`). Sem ela a API responde
-- 500 genérico ("Houve um erro ao salvar o pedido no carrinho."). Correios
-- não usa agência, então o campo é opcional.
-- Rode depois de `migration_melhor_envio.sql`.

begin;

alter table companies add column if not exists shipping_origin_agency_id integer;

commit;


-- ###################################################################
-- 10) migration_melhor_envio_boxes.sql
-- ###################################################################

-- Lista de caixas cadastradas pela loja para envios no Melhor Envio.
-- O sistema escolhe a menor caixa (por volume) em que o pedido caiba antes
-- de cotar o frete e gerar a etiqueta. Cada item do array:
--   { "name": "P", "length_cm": 20, "width_cm": 15, "height_cm": 10, "max_weight_kg": 5 }
-- (max_weight_kg é opcional / pode ser null).
-- Substitui shipping_package_{length,width,height}_cm, que continuam servindo
-- de fallback enquanto a lista estiver vazia.
-- Rode depois de migration_melhor_envio_package.sql.

begin;

alter table companies add column if not exists shipping_packages jsonb not null default '[]'::jsonb;

commit;


-- ###################################################################
-- 11) migration_melhor_envio_carrier.sql
-- ###################################################################

-- Transportadora padrão do endereço de origem (Melhor Envio).
-- Guarda o `company` id da transportadora escolhida nas Configurações
-- (Correios=1, Jadlog=2, Azul Cargo=3, ...). Usado para pré-selecionar a
-- transportadora e carregar a lista de agências de postagem certa ao reabrir
-- a tela. Sem essa coluna a seleção não persistia entre visitas.
-- Rode depois de migration_melhor_envio_agency.sql.

begin;

alter table companies add column if not exists shipping_origin_carrier_id integer;

commit;


-- ###################################################################
-- 12) migration_company_fields_cleanup.sql
-- ###################################################################

-- Unifica campos duplicados no cadastro da empresa.
--   - E-mail: uma coluna `email` só, que recebe as notificações de pedido/
--     cadastro E vai como remetente nas etiquetas do Melhor Envio (antes
--     eram notification_email + shipping_origin_email).
--   - Telefone: `phone` passa a servir também de remetente da etiqueta
--     (antes havia shipping_origin_phone só para isso).
--   - Endereço: o texto livre `address` sai; o endereço estruturado
--     (shipping_origin_*) é o endereço único da loja.
--   - WhatsApp: coluna removida; o telefone é o número de WhatsApp.
-- Rode depois de migration_melhor_envio_boxes.sql.

begin;

alter table companies add column if not exists email text;
update companies set email = coalesce(email, notification_email, shipping_origin_email);
update companies set phone = coalesce(phone, shipping_origin_phone);

alter table companies drop column if exists address;
alter table companies drop column if exists whatsapp;
alter table companies drop column if exists notification_email;
alter table companies drop column if exists shipping_origin_phone;
alter table companies drop column if exists shipping_origin_email;

commit;


-- ###################################################################
-- 13) migration_stock.sql
-- ###################################################################

-- Controle de estoque por produto. Rode depois de migration_sales_orders.sql.
--   * products.stock_quantity / products.low_stock_threshold
--   * sales_orders.stock_committed  (o pedido já baixou estoque?)
--   * tabela stock_movements  (livro-razão append-only)
--   * funções apply_stock_movement / commit_order_stock / release_order_stock

begin;

alter table products add column if not exists stock_quantity     int not null default 0;
alter table products add column if not exists low_stock_threshold int not null default 0;

alter table sales_orders add column if not exists stock_committed boolean not null default false;

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  type text not null check (type in ('entrada', 'saida', 'ajuste')),
  quantity int not null check (quantity >= 0),
  delta int not null,
  balance_after int not null,
  note text,
  order_id uuid references sales_orders(id) on delete set null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists stock_movements_product_idx on stock_movements(product_id, created_at desc);
create index if not exists stock_movements_company_idx on stock_movements(company_id, created_at desc);
create index if not exists stock_movements_order_idx   on stock_movements(order_id);

alter table stock_movements enable row level security;

drop policy if exists "tenant access" on stock_movements;
create policy "tenant access" on stock_movements
  for all using (company_id = auth_company_id() or auth_is_super_admin())
  with check (company_id = auth_company_id() or auth_is_super_admin());

create or replace function apply_stock_movement(
  p_company_id uuid,
  p_product_id uuid,
  p_type text,
  p_delta int,
  p_note text default null,
  p_order_id uuid default null,
  p_allow_negative boolean default false
) returns int
language plpgsql
as $$
declare
  v_balance int;
begin
  update products
     set stock_quantity = stock_quantity + p_delta
   where id = p_product_id and company_id = p_company_id
  returning stock_quantity into v_balance;

  if v_balance is null then
    raise exception 'PRODUTO_NAO_ENCONTRADO';
  end if;

  if v_balance < 0 and not p_allow_negative then
    raise exception 'ESTOQUE_INSUFICIENTE';
  end if;

  insert into stock_movements
    (company_id, product_id, type, quantity, delta, balance_after, note, order_id, created_by)
  values
    (p_company_id, p_product_id, p_type, abs(p_delta), p_delta, v_balance, p_note, p_order_id, auth.uid());

  return v_balance;
end;
$$;

create or replace function commit_order_stock(p_company_id uuid, p_order_id uuid)
returns void
language plpgsql
as $$
declare
  r record;
  v_balance int;
begin
  if coalesce((select stock_committed from sales_orders
                where id = p_order_id and company_id = p_company_id), true) then
    return;
  end if;

  for r in
    select product_id, sum(quantity)::int as qty
      from sales_order_items
     where order_id = p_order_id and company_id = p_company_id
     group by product_id
  loop
    update products
       set stock_quantity = stock_quantity - r.qty
     where id = r.product_id and company_id = p_company_id
    returning stock_quantity into v_balance;

    if v_balance is null then
      raise exception 'PRODUTO_NAO_ENCONTRADO';
    end if;
    if v_balance < 0 then
      raise exception 'ESTOQUE_INSUFICIENTE:%', r.product_id;
    end if;

    insert into stock_movements
      (company_id, product_id, type, quantity, delta, balance_after, note, order_id, created_by)
    values
      (p_company_id, r.product_id, 'saida', r.qty, -r.qty, v_balance, 'Pedido confirmado', p_order_id, auth.uid());
  end loop;

  update sales_orders set stock_committed = true
   where id = p_order_id and company_id = p_company_id;
end;
$$;

create or replace function release_order_stock(p_company_id uuid, p_order_id uuid)
returns void
language plpgsql
as $$
declare
  r record;
  v_balance int;
begin
  if not coalesce((select stock_committed from sales_orders
                    where id = p_order_id and company_id = p_company_id), false) then
    return;
  end if;

  for r in
    select product_id, sum(delta)::int as net
      from stock_movements
     where order_id = p_order_id and company_id = p_company_id
     group by product_id
     having sum(delta) <> 0
  loop
    update products
       set stock_quantity = stock_quantity - r.net
     where id = r.product_id and company_id = p_company_id
    returning stock_quantity into v_balance;

    if v_balance is null then
      continue;
    end if;

    insert into stock_movements
      (company_id, product_id, type, quantity, delta, balance_after, note, order_id, created_by)
    values
      (p_company_id, r.product_id, 'entrada', abs(r.net), -r.net, v_balance, 'Estorno de pedido', p_order_id, auth.uid());
  end loop;

  update sales_orders set stock_committed = false
   where id = p_order_id and company_id = p_company_id;
end;
$$;

commit;


-- ###################################################################
-- 14) migration_lalamove.sql
-- ###################################################################

-- Cotação de entrega por motoboy (Lalamove) no link público de pedido.
-- Credenciais são da plataforma (env LALAMOVE_*); cada empresa só liga a
-- opção e escolhe o veículo. sales_orders.total passa a incluir delivery_fee.

begin;

alter table companies add column if not exists lalamove_enabled      boolean not null default false;
alter table companies add column if not exists lalamove_service_type text    not null default 'MOTORCYCLE';
alter table companies add column if not exists shipping_origin_lat    numeric(10,7);
alter table companies add column if not exists shipping_origin_lng    numeric(10,7);

alter table sales_orders add column if not exists delivery_method text not null default 'a_combinar'
  check (delivery_method in ('retirada', 'motoboy', 'a_combinar', 'melhor_envio'));
alter table sales_orders add column if not exists delivery_fee numeric(10,2) not null default 0;
alter table sales_orders add column if not exists delivery_address jsonb;
alter table sales_orders add column if not exists delivery_quote jsonb;

commit;


-- ###################################################################
-- 15) migration_delivery_melhor_envio.sql
-- ###################################################################

-- "Melhor Envio" vira um método de entrega (escolha única no pedido).

begin;

do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'sales_orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%delivery_method%'
  loop
    execute format('alter table sales_orders drop constraint %I', c);
  end loop;
end $$;

alter table sales_orders
  add constraint sales_orders_delivery_method_check
  check (delivery_method in ('retirada', 'motoboy', 'a_combinar', 'melhor_envio'));

commit;


-- ###################################################################
-- 16) migration_payment_and_discount.sql
-- ###################################################################

-- Formas de pagamento por empresa + forma de pagamento / desconto no pedido.

begin;

create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table payment_methods enable row level security;

drop policy if exists "tenant access" on payment_methods;
create policy "tenant access" on payment_methods
  for all using (company_id = auth_company_id() or auth_is_super_admin())
  with check (company_id = auth_company_id() or auth_is_super_admin());

insert into payment_methods (company_id, name, sort_order)
select c.id, m.name, m.ord
from companies c
cross join (values
  ('Pix', 1),
  ('Dinheiro', 2),
  ('Cartão de crédito', 3),
  ('Cartão de débito', 4),
  ('Transferência', 5)
) as m(name, ord)
where not exists (select 1 from payment_methods pm where pm.company_id = c.id);

alter table sales_orders add column if not exists payment_method_id uuid references payment_methods(id) on delete set null;
alter table sales_orders add column if not exists discount_type text check (discount_type in ('percent', 'amount'));
alter table sales_orders add column if not exists discount_value numeric(10,2) not null default 0;

commit;


-- ###################################################################
-- 17) migration_order_public_token.sql
-- ###################################################################

-- Token público por pedido: /acompanhar/<token> (cliente acompanha sem login).

begin;

alter table sales_orders add column if not exists public_token uuid not null default gen_random_uuid();
create unique index if not exists sales_orders_public_token_key on sales_orders (public_token);

commit;


-- ###################################################################
-- 18) migration_mercado_pago.sql
-- ###################################################################

-- Mercado Pago (Checkout Pro, OAuth marketplace): conta por empresa + tabela
-- de pagamentos por pedido.

begin;

create table if not exists mercado_pago_accounts (
  company_id uuid primary key references companies(id) on delete cascade,
  mp_user_id text not null,
  access_token text not null,
  refresh_token text not null,
  public_key text,
  live_mode boolean not null default false,
  expires_at timestamptz not null,
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mercado_pago_accounts_mp_user_id_idx on mercado_pago_accounts (mp_user_id);
create trigger mercado_pago_accounts_set_updated_at
  before update on mercado_pago_accounts
  for each row execute function set_updated_at();
alter table mercado_pago_accounts enable row level security;
drop policy if exists "tenant access" on mercado_pago_accounts;
create policy "tenant access" on mercado_pago_accounts
  for all using (company_id = auth_company_id() or auth_is_super_admin())
  with check (company_id = auth_company_id() or auth_is_super_admin());

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  order_id uuid not null references sales_orders(id) on delete cascade,
  provider text not null default 'mercado_pago',
  mp_preference_id text,
  mp_payment_id text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled', 'refunded')),
  amount numeric(10,2),
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id)
);
create index if not exists payments_mp_payment_id_idx on payments (mp_payment_id);
create trigger payments_set_updated_at
  before update on payments
  for each row execute function set_updated_at();
alter table payments enable row level security;
drop policy if exists "tenant access" on payments;
create policy "tenant access" on payments
  for all using (company_id = auth_company_id() or auth_is_super_admin())
  with check (company_id = auth_company_id() or auth_is_super_admin());

alter table sales_orders add column if not exists paid_at timestamptz;

commit;


-- ###################################################################
-- 19) migration_mercado_pago_transparente.sql
-- ###################################################################

-- Checkout Transparente (Payment Brick): centraliza a "primeira aprovação"
-- (avançar status + baixar estoque) numa transação atômica, já que agora
-- tanto a resposta síncrona da criação do pagamento quanto o webhook podem
-- disparar esse efeito para o mesmo pedido. `payment_lock_at` é um lock
-- leve usado antes de cobrar no Mercado Pago, pra duplo-clique/retry não
-- gerar duas cobranças reais pro mesmo pedido.

begin;

alter table sales_orders add column if not exists payment_lock_at timestamptz;

-- number é bigint (bigserial) em sales_orders, não int — ver nota em
-- migration_mercado_pago_transparente.sql. drop + create (não `or replace`)
-- pelo mesmo motivo: Postgres não troca o tipo de retorno com `or replace`.
drop function if exists claim_order_payment(uuid, uuid, timestamptz);

create function claim_order_payment(p_company_id uuid, p_order_id uuid, p_paid_at timestamptz)
returns table (id uuid, number bigint, status text, customer_id uuid, public_token uuid, stock_ok boolean)
language plpgsql
as $$
declare
  r record;
  v_stock_ok boolean := true;
begin
  update sales_orders
     set paid_at = p_paid_at,
         status = case when sales_orders.status = 'rascunho' then 'confirmado' else sales_orders.status end
   where sales_orders.id = p_order_id
     and sales_orders.company_id = p_company_id
     and sales_orders.paid_at is null
     and sales_orders.status <> 'cancelado'
  returning sales_orders.id, sales_orders.number, sales_orders.status,
            sales_orders.customer_id, sales_orders.public_token
    into r;

  if r.id is null then
    return;
  end if;

  if r.status = 'confirmado' then
    begin
      perform commit_order_stock(p_company_id, p_order_id);
    exception when others then
      v_stock_ok := false;
      raise warning 'claim_order_payment: falha ao baixar estoque do pedido % (empresa %): %', p_order_id, p_company_id, sqlerrm;
    end;
  end if;

  return query select r.id, r.number, r.status, r.customer_id, r.public_token, v_stock_ok;
end;
$$;

commit;


-- 20) migration_mercado_pago_min_installment.sql
-- ###################################################################

-- A loja configura um valor mínimo de parcela pro cartão de crédito no
-- Checkout Transparente; o número de parcelas oferecido ao cliente é
-- calculado a partir disso (total do pedido / valor mínimo).

begin;

alter table mercado_pago_accounts
  add column if not exists min_installment_amount numeric(10,2) not null default 50;

commit;


-- #####################################################################
-- PÓS-INSTALAÇÃO  (rode depois de criar seu usuário no ambiente novo)
-- #####################################################################
-- 1. Suba a app de preview apontando pra este projeto e crie seu usuário
--    pela tela de login/signup normal.
-- 2. Volte no SQL Editor e rode com o SEU e-mail:
--
--    insert into profiles (id, company_id, role, is_super_admin)
--    select id, '11111111-1111-1111-1111-111111111111', 'owner', true
--    from auth.users where email = 'SEU_EMAIL@exemplo.com'
--    on conflict (id) do update set is_super_admin = true;
--
-- 3. Confira:
--    select p.is_super_admin, u.email
--      from profiles p join auth.users u on u.id = p.id;
-- #####################################################################
