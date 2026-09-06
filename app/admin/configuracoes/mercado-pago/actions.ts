'use server'

import { revalidatePath } from 'next/cache'
import { resolveActiveCompany } from '@/lib/company'
import { disconnectAccount } from '@/lib/mercadoPago'
import { createClient } from '@/lib/supabase/server'

export async function disconnectMercadoPago() {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  await disconnectAccount(active.companyId)
  revalidatePath('/admin/configuracoes')
}

// Valor mínimo de parcela pro cartão de crédito no Checkout Transparente —
// o número de parcelas oferecido ao cliente é total do pedido ÷ este valor,
// calculado na hora de montar o Payment Brick (não aqui).
export async function updateMinInstallmentAmount(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const raw = Number(String(formData.get('min_installment_amount') ?? '').replace(',', '.'))
  if (!Number.isFinite(raw) || raw <= 0) {
    revalidatePath('/admin/configuracoes')
    return
  }

  const supabase = await createClient()
  await supabase
    .from('mercado_pago_accounts')
    .update({ min_installment_amount: raw })
    .eq('company_id', active.companyId)
  revalidatePath('/admin/configuracoes')
}
