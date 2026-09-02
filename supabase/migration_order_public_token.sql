-- Token público por pedido, para o cliente acompanhar o pedido e o rastreio
-- da entrega sem login: /acompanhar/<token>. É um UUID aleatório (não dá
-- para adivinhar a partir do número do pedido) e pode ser regenerado no
-- futuro para invalidar um link.
-- Rode depois de migration_sales_orders.sql.

begin;

alter table sales_orders add column if not exists public_token uuid not null default gen_random_uuid();
create unique index if not exists sales_orders_public_token_key on sales_orders (public_token);

commit;
