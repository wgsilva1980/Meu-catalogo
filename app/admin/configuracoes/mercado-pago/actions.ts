'use server'

import { revalidatePath } from 'next/cache'
import { resolveActiveCompany } from '@/lib/company'
import { disconnectAccount } from '@/lib/mercadoPago'

export async function disconnectMercadoPago() {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  await disconnectAccount(active.companyId)
  revalidatePath('/admin/configuracoes')
}
