'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'

export async function saveStoreSettings(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const supabase = await createClient()

  const payload = {
    name: (formData.get('name') as string) || 'Minha loja',
    logo_url: (formData.get('logo_url') as string) || null,
    phone: (formData.get('phone') as string) || null,
    whatsapp: (formData.get('whatsapp') as string) || null,
    instagram: (formData.get('instagram') as string) || null,
    website: (formData.get('website') as string) || null,
    address: (formData.get('address') as string) || null,
    notification_email: (formData.get('notification_email') as string) || null,
  }

  await supabase.from('companies').update(payload).eq('id', active.companyId)

  revalidatePath('/admin/configuracoes')
}
