-- Transportadora padrão do endereço de origem (Melhor Envio).
-- Guarda o `company` id da transportadora escolhida nas Configurações
-- (Correios=1, Jadlog=2, Azul Cargo=3, ...). Usado para pré-selecionar a
-- transportadora e carregar a lista de agências de postagem certa ao reabrir
-- a tela. Sem essa coluna a seleção não persistia entre visitas.
-- Rode depois de migration_melhor_envio_agency.sql.

begin;

alter table companies add column if not exists shipping_origin_carrier_id integer;

commit;
