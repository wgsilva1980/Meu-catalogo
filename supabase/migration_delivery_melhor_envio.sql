-- "Melhor Envio" passa a ser um método de entrega do pedido, ao lado de
-- retirada / motoboy / a combinar. O modo de entrega é ESCOLHA ÚNICA: quando
-- é "melhor_envio", a cotação/etiqueta do Melhor Envio aparece no pedido; nos
-- outros métodos, não.
-- Rode depois de migration_lalamove.sql.

begin;

-- Remove qualquer CHECK atual sobre delivery_method (o nome pode variar
-- conforme como a coluna foi criada) e recria com o novo valor.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'sales_orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%delivery_method%'
  loop
    execute format('alter table sales_orders drop constraint %I', c);
  end loop;
end $$;

alter table sales_orders
  add constraint sales_orders_delivery_method_check
  check (delivery_method in ('retirada', 'motoboy', 'a_combinar', 'melhor_envio'));

commit;
