-- Notificações via Telegram: cada empresa guarda o chat_id para onde o bot
-- (um único bot, token compartilhado via env var TELEGRAM_BOT_TOKEN) envia
-- avisos de novo cadastro/pedido feito pelas páginas públicas.
-- Rode depois de `migration_multitenant.sql`.

begin;

alter table companies add column if not exists telegram_chat_id text;

commit;
