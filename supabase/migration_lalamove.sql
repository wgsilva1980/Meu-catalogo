-- Cotação de entrega por motoboy via API da Lalamove, oferecida no link
-- público de pedido. Rode depois de `migration_sales_orders.sql`.
--
-- Credenciais da Lalamove são da PLATAFORMA (env vars LALAMOVE_*), não por
-- empresa — igual ao app único do Melhor Envio. Cada empresa só liga/desliga
-- a opção e escolhe o tipo de veículo.
--
-- O que este script cria:
--   * companies.lalamove_enabled / lalamove_service_type
--   * companies.shipping_origin_lat / shipping_origin_lng  (cache da
--     geocodificação do CEP de origem, para não bater na API de geo toda hora)
--   * sales_orders.delivery_method / delivery_fee / delivery_address / delivery_quote
--
-- A partir daqui, sales_orders.total = subtotal dos itens + delivery_fee.

begin;

alter table companies add column if not exists lalamove_enabled      boolean not null default false;
alter table companies add column if not exists lalamove_service_type text    not null default 'MOTORCYCLE';
alter table companies add column if not exists shipping_origin_lat    numeric(10,7);
alter table companies add column if not exists shipping_origin_lng    numeric(10,7);

alter table sales_orders add column if not exists delivery_method text not null default 'a_combinar'
  check (delivery_method in ('retirada', 'motoboy', 'a_combinar'));
alter table sales_orders add column if not exists delivery_fee numeric(10,2) not null default 0;
-- {zip_code, street, number, complement, neighborhood, city, state, lat, lng}
alter table sales_orders add column if not exists delivery_address jsonb;
-- {provider:'lalamove', quotationId, serviceType, distance_m, currency, total, expiresAt, quotedAt}
alter table sales_orders add column if not exists delivery_quote jsonb;

commit;
