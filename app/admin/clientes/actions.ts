'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'

export async function saveCustomer(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const supabase = await createClient()
  const id = formData.get('id') as string | null

  const payload = {
    name: formData.get('name') as string,
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
    document: (formData.get('document') as string) || null,
    zip_code: (formData.get('zip_code') as string) || null,
    street: (formData.get('street') as string) || null,
    number: (formData.get('number') as string) || null,
    complement: (formData.get('complement') as string) || null,
    neighborhood: (formData.get('neighborhood') as string) || null,
    city: (formData.get('city') as string) || null,
    state: (formData.get('state') as string) || null,
    notes: (formData.get('notes') as string) || null,
  }

  if (id) {
    await supabase.from('customers').update(payload).eq('id', id).eq('company_id', active.companyId)
  } else {
    await supabase.from('customers').insert({ ...payload, company_id: active.companyId })
  }

  revalidatePath('/admin/clientes')
  redirect('/admin/clientes')
}

export async function deleteCustomer(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const supabase = await createClient()
  const id = formData.get('id') as string
  await supabase.from('customers').delete().eq('id', id).eq('company_id', active.companyId)
  revalidatePath('/admin/clientes')
}
