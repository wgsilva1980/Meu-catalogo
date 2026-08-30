-- Unifica campos duplicados no cadastro da empresa.
--   - E-mail: uma coluna `email` só, que recebe as notificações de pedido/
--     cadastro E vai como remetente nas etiquetas do Melhor Envio (antes
--     eram notification_email + shipping_origin_email).
--   - Telefone: `phone` passa a servir também de remetente da etiqueta
--     (antes havia shipping_origin_phone só para isso).
--   - Endereço: o texto livre `address` sai; o endereço estruturado
--     (shipping_origin_*) é o endereço único da loja.
--   - WhatsApp: coluna removida; o telefone é o número de WhatsApp.
-- Rode depois de migration_melhor_envio_boxes.sql.

begin;

alter table companies add column if not exists email text;
update companies set email = coalesce(email, notification_email, shipping_origin_email);
update companies set phone = coalesce(phone, shipping_origin_phone);

alter table companies drop column if exists address;
alter table companies drop column if exists whatsapp;
alter table companies drop column if exists notification_email;
alter table companies drop column if exists shipping_origin_phone;
alter table companies drop column if exists shipping_origin_email;

commit;
