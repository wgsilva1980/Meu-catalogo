-- Controle de estoque por produto.
-- Rode depois de `migration_sales_orders.sql` (precisa das tabelas
-- `products`, `sales_orders`, `sales_order_items` e das funções
-- auth_company_id() / auth_is_super_admin() de `migration_multitenant.sql`).
--
-- O que este script cria:
--   * products.stock_quantity / products.low_stock_threshold
--   * sales_orders.stock_committed  (o pedido já baixou estoque?)
--   * tabela stock_movements  (livro-razão append-only de entradas/saídas/ajustes)
--   * funções apply_stock_movement / commit_order_stock / release_order_stock
--
-- Produtos existentes ficam com saldo 0 — a entrada inicial é feita
-- manualmente na tela de Estoque.

begin;

alter table products add column if not exists stock_quantity     int not null default 0;
alter table products add column if not exists low_stock_threshold int not null default 0;

alter table sales_orders add column if not exists stock_committed boolean not null default false;

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  -- entrada: recebimento de mercadoria / estorno de pedido
  -- saida:   baixa manual (perda, quebra, consumo) ou pedido confirmado
  -- ajuste:  correção de contagem (inventário)
  type text not null check (type in ('entrada', 'saida', 'ajuste')),
  quantity int not null check (quantity >= 0),   -- módulo do movimento (sempre >= 0)
  delta int not null,                            -- efeito no saldo: +N ou -N
  balance_after int not null,                    -- saldo do produto logo após o movimento
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

-- ------------------------------------------------------------
-- apply_stock_movement: um movimento avulso (entrada / baixa / ajuste).
-- Atualiza o saldo do produto e grava o movimento na MESMA transação,
-- evitando corrida de leitura-modificação-escrita nas server actions.
-- Roda como invoker: a RLS de `products` / `stock_movements` já libera
-- o usuário autenticado da empresa (ou super-admin).
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- commit_order_stock: baixa o estoque de todos os itens de um pedido.
-- Idempotente (não faz nada se o pedido já baixou). Toda a operação é
-- uma transação só: se qualquer item ficar negativo, tudo é revertido
-- e a função levanta ESTOQUE_INSUFICIENTE:<product_id>.
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- release_order_stock: estorna a baixa feita por um pedido, devolvendo
-- ao estoque exatamente o que foi tirado (lê os movimentos gravados
-- para aquele order_id — reconcilia certo mesmo se os itens mudaram
-- depois da baixa). Idempotente.
-- ------------------------------------------------------------
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
       set stock_quantity = stock_quantity - r.net   -- net é negativo (saídas); -net devolve ao saldo
     where id = r.product_id and company_id = p_company_id
    returning stock_quantity into v_balance;

    if v_balance is null then
      continue;   -- produto removido: nada a devolver
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
