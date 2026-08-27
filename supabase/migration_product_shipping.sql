-- Dados de peso e dimensões por produto, para viabilizar cálculo de frete
-- (peso real x peso cúbico, como usado por Correios/Melhor Envio).
-- Colunas opcionais: produtos existentes ficam com null até serem
-- preenchidos manualmente no cadastro.

begin;

alter table products add column if not exists weight_kg numeric(10,3);
alter table products add column if not exists length_cm numeric(10,2);
alter table products add column if not exists width_cm numeric(10,2);
alter table products add column if not exists height_cm numeric(10,2);

commit;
