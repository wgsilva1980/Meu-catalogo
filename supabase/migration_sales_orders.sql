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
