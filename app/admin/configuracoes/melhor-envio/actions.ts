'use server'

import { revalidatePath } from 'next/cache'
import { resolveActiveCompany } from '@/lib/company'
import { disconnectAccount } from '@/lib/melhorEnvio'

export async function disconnectMelhorEnvio() {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  await disconnectAccount(active.companyId)
  revalidatePath('/admin/configuracoes')
}
