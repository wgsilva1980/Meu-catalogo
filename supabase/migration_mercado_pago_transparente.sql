-- Checkout Transparente (Payment Brick): pagamento passa a poder ser
-- confirmado por dois caminhos (resposta síncrona da criação do pagamento
-- e o webhook assíncrono do Mercado Pago) para o mesmo pedido. Esta função
-- centraliza a "primeira aprovação" (avançar status + baixar estoque) numa
-- única transação atômica, para os dois caminhos não correrem em paralelo.
--
-- `payment_lock_at` é um lock leve por pedido, usado ANTES de cobrar no
-- Mercado Pago (em app/api/acompanhar/[token]/pagar/route.ts) — evita que
-- um duplo-clique/retry do Brick gere duas cobranças reais pro mesmo
-- pedido. `claim_order_payment` continua sendo só sobre os efeitos de uma
-- aprovação (estoque/e-mail), não sobre a cobrança em si.
--
-- Rode depois de migration_mercado_pago.sql e migration_stock.sql.

begin;

alter table sales_orders add column if not exists payment_lock_at timestamptz;

create or replace function claim_order_payment(p_company_id uuid, p_order_id uuid, p_paid_at timestamptz)
returns table (id uuid, number int, status text, customer_id uuid, public_token uuid, stock_ok boolean)
language plpgsql
as $$
declare
  r record;
  v_stock_ok boolean := true;
begin
  update sales_orders
     set paid_at = p_paid_at,
         status = case when sales_orders.status = 'rascunho' then 'confirmado' else sales_orders.status end
   where sales_orders.id = p_order_id
     and sales_orders.company_id = p_company_id
     and sales_orders.paid_at is null
     and sales_orders.status <> 'cancelado'
  returning sales_orders.id, sales_orders.number, sales_orders.status,
            sales_orders.customer_id, sales_orders.public_token
    into r;

  if r.id is null then
    -- outra chamada já aplicou essa aprovação primeiro, o pedido já estava
    -- pago, ou foi cancelado antes do pagamento chegar — nenhum desses
    -- casos deve repetir os efeitos.
    return;
  end if;

  if r.status = 'confirmado' then
    begin
      perform commit_order_stock(p_company_id, p_order_id);
    exception when others then
      -- O pagamento já foi aprovado e `paid_at` já foi gravado acima —
      -- dinheiro real já mudou de mãos, então um problema de estoque não
      -- pode desfazer isso. O bloco BEGIN/EXCEPTION cria uma subtransação
      -- só pra essa chamada, isolando a falha do UPDATE que já rodou.
      v_stock_ok := false;
      raise warning 'claim_order_payment: falha ao baixar estoque do pedido % (empresa %): %', p_order_id, p_company_id, sqlerrm;
    end;
  end if;

  return query select r.id, r.number, r.status, r.customer_id, r.public_token, v_stock_ok;
end;
$$;

commit;
