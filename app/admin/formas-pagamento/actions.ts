'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'

export async function addPaymentMethod(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const name = ((formData.get('name') as string) || '').trim().slice(0, 60)
  if (!name) return

  const supabase = await createClient()
  const { data: max } = await supabase
    .from('payment_methods')
    .select('sort_order')
    .eq('company_id', active.companyId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  await supabase.from('payment_methods').insert({
    company_id: active.companyId,
    name,
    sort_order: (max?.sort_order ?? 0) + 1,
  })

  revalidatePath('/admin/formas-pagamento')
}

export async function togglePaymentMethod(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const id = formData.get('id') as string
  const activeNext = formData.get('active') === 'true'
  const supabase = await createClient()
  await supabase
    .from('payment_methods')
    .update({ active: activeNext })
    .eq('id', id)
    .eq('company_id', active.companyId)

  revalidatePath('/admin/formas-pagamento')
}

export async function deletePaymentMethod(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const id = formData.get('id') as string
  const supabase = await createClient()
  // pedidos que usavam esta forma ficam com payment_method_id nulo
  // (FK on delete set null).
  await supabase.from('payment_methods').delete().eq('id', id).eq('company_id', active.companyId)

  revalidatePath('/admin/formas-pagamento')
}
