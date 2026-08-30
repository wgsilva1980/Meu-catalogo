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
