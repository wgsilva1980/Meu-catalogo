-- Integração com o Mercado Pago (Checkout Pro, modelo marketplace/OAuth):
-- a plataforma tem 1 aplicação (env MERCADO_PAGO_*); cada empresa conecta a
-- própria conta via OAuth e o token dela fica em `mercado_pago_accounts`.
-- O pagamento de um pedido é criado como "preferência" e acompanhado em
-- `payments`, atualizado pelo webhook do Mercado Pago.
-- Rode depois de migration_sales_orders.sql.

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

-- Um pagamento por pedido. `status` segue o Mercado Pago, normalizado:
--   pending -> pago aguardando; approved -> pago; rejected/cancelled;
--   refunded (estorno/chargeback).
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
