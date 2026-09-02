-- Formas de pagamento por empresa + forma de pagamento e desconto no pedido.
--   * payment_methods: cadastro de formas de pagamento (tela em
--     /admin/formas-pagamento). O cliente escolhe uma no link público; a
--     loja pode trocar na edição do pedido.
--   * sales_orders.payment_method_id: forma escolhida no pedido.
--   * sales_orders.discount_type / discount_value: desconto do pedido, em
--     porcentagem ('percent') ou valor fixo ('amount'). Incide sobre o
--     subtotal dos produtos, antes do frete:
--       total = (subtotal_itens - desconto) + delivery_fee
-- Rode depois de migration_lalamove.sql.

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

-- Sugestões iniciais para cada empresa que ainda não tem nenhuma forma.
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
