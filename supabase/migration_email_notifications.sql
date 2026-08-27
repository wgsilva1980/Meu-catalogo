-- Notificações por e-mail: cada empresa guarda o e-mail para onde vai o
-- aviso de novo cadastro/pedido feito pelas páginas públicas. O envio em si
-- usa uma conta Gmail compartilhada pelo app (env vars GMAIL_USER/
-- GMAIL_APP_PASSWORD), então nenhuma configuração de domínio é necessária
-- por empresa.
-- Rode depois de `migration_multitenant.sql`.

begin;

alter table companies add column if not exists notification_email text;

commit;
