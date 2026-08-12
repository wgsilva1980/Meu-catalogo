import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente com a service role key: só deve ser usado em código de servidor
 * (route handlers, server actions) para operações que precisam ignorar RLS,
 * como upload de arquivos. Nunca importar em componentes client.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
