'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'

export async function saveProduct(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const supabase = await createClient()
  const id = formData.get('id') as string | null
  const image_url = (formData.get('image_url') as string) || undefined

  const payload: Record<string, unknown> = {
    name: formData.get('name'),
    brand: formData.get('brand'),
    category_id: formData.get('category_id'),
    short_description: formData.get('short_description'),
    price: Number(formData.get('price')),
    promo_note: (formData.get('promo_note') as string) || null,
    available: formData.get('available') === 'on',
  }
  if (image_url) payload.image_url = image_url

  if (id) {
    await supabase.from('products').update(payload).eq('id', id).eq('company_id', active.companyId)
  } else {
    await supabase.from('products').insert({ ...payload, company_id: active.companyId })
  }

  revalidatePath('/admin/produtos')
  redirect('/admin/produtos')
}

export async function deleteProduct(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const supabase = await createClient()
  const id = formData.get('id') as string
  await supabase.from('products').delete().eq('id', id).eq('company_id', active.companyId)
  revalidatePath('/admin/produtos')
}
