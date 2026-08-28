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
