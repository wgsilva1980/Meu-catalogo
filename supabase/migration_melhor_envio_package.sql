-- Caixa padrão para gerar UMA etiqueta por pedido no Melhor Envio.
-- Em vez de um volume por item, o envio passa a usar uma única caixa com
-- estas dimensões (cm) e o peso somado de todos os produtos do pedido.
-- Rode depois de migration_melhor_envio.sql.

begin;

alter table companies add column if not exists shipping_package_length_cm numeric;
alter table companies add column if not exists shipping_package_width_cm numeric;
alter table companies add column if not exists shipping_package_height_cm numeric;

commit;
