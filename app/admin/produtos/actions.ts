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

  const numberOrNull = (field: string) => {
    const raw = formData.get(field) as string
    return raw ? Number(raw) : null
  }

  const corePayload: Record<string, unknown> = {
    name: formData.get('name'),
    brand: formData.get('brand'),
    category_id: formData.get('category_id'),
    short_description: formData.get('short_description'),
    price: Number(formData.get('price')),
    promo_note: (formData.get('promo_note') as string) || null,
    available: formData.get('available') === 'on',
  }
  if (image_url) corePayload.image_url = image_url

  // Campos de frete: colunas novas, adicionadas por uma migration que pode
  // ainda não ter sido rodada. Se o insert/update com elas falhar por isso,
  // tenta de novo só com os campos "core" — salvar o produto não pode
  // depender da migration já ter rodado.
  const payloadWithShipping = {
    ...corePayload,
    weight_kg: numberOrNull('weight_kg'),
    length_cm: numberOrNull('length_cm'),
    width_cm: numberOrNull('width_cm'),
    height_cm: numberOrNull('height_cm'),
  }

  if (id) {
    const { error } = await supabase.from('products').update(payloadWithShipping).eq('id', id).eq('company_id', active.companyId)
    if (error) {
      console.error('Falha ao salvar produto com campos de frete, tentando sem eles:', error)
      await supabase.from('products').update(corePayload).eq('id', id).eq('company_id', active.companyId)
    }
  } else {
    const { error } = await supabase.from('products').insert({ ...payloadWithShipping, company_id: active.companyId })
    if (error) {
      console.error('Falha ao criar produto com campos de frete, tentando sem eles:', error)
      await supabase.from('products').insert({ ...corePayload, company_id: active.companyId })
    }
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
