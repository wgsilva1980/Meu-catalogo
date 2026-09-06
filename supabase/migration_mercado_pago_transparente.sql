-- Checkout Transparente (Payment Brick): pagamento passa a poder ser
-- confirmado por dois caminhos (resposta síncrona da criação do pagamento
-- e o webhook assíncrono do Mercado Pago) para o mesmo pedido. Esta função
-- centraliza a "primeira aprovação" (avançar status + baixar estoque) numa
-- única transação atômica, para os dois caminhos não correrem em paralelo.
-- Rode depois de migration_mercado_pago.sql e migration_stock.sql.

begin;

create or replace function claim_order_payment(p_company_id uuid, p_order_id uuid, p_paid_at timestamptz)
returns table (id uuid, number int, status text, customer_id uuid, public_token uuid)
language plpgsql
as $$
declare
  r record;
begin
  update sales_orders
     set paid_at = p_paid_at,
         status = case when sales_orders.status = 'rascunho' then 'confirmado' else sales_orders.status end
   where sales_orders.id = p_order_id and sales_orders.company_id = p_company_id and sales_orders.paid_at is null
  returning sales_orders.id, sales_orders.number, sales_orders.status,
            sales_orders.customer_id, sales_orders.public_token
    into r;

  if r.id is null then
    -- outra chamada já aplicou essa aprovação primeiro (ou o pedido já
    -- estava pago antes) — quem chega aqui não deve repetir os efeitos.
    return;
  end if;

  if r.status = 'confirmado' then
    perform commit_order_stock(p_company_id, p_order_id);
  end if;

  return query select r.id, r.number, r.status, r.customer_id, r.public_token;
end;
$$;

commit;
