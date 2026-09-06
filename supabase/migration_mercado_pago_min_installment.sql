-- A loja configura um valor mínimo de parcela pro cartão de crédito no
-- Checkout Transparente; o número de parcelas oferecido ao cliente passa a
-- ser calculado a partir disso (total do pedido / valor mínimo), em vez de
-- um teto fixo igual pra qualquer valor de pedido.
-- Rode depois de migration_mercado_pago.sql.

begin;

alter table mercado_pago_accounts
  add column if not exists min_installment_amount numeric(10,2) not null default 50;

commit;
