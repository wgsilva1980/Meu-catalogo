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
