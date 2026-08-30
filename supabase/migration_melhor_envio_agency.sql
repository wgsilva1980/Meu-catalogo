-- Agência de postagem Jadlog/Azul para o Melhor Envio.
-- Jadlog e Azul Cargo exigem uma agência (ponto de coleta/postagem) ao
-- adicionar o envio ao carrinho (`/api/v2/me/cart`). Sem ela a API responde
-- 500 genérico ("Houve um erro ao salvar o pedido no carrinho."). Correios
-- não usa agência, então o campo é opcional.
-- Rode depois de `migration_melhor_envio.sql`.

begin;

alter table companies add column if not exists shipping_origin_agency_id integer;

commit;
