'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'

export async function saveOrder(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const supabase = await createClient()
  const id = formData.get('id') as string | null

  const customer_id = formData.get('customer_id') as string
  const status = (formData.get('status') as string) || 'rascunho'
  const notes = (formData.get('notes') as string) || null

  const productIds = formData.getAll('product_id') as string[]
  const quantities = formData.getAll('quantity').map((q) => Number(q))

  const { data: products } = productIds.length
    ? await supabase
        .from('products')
        .select('id, name, price')
        .eq('company_id', active.companyId)
        .in('id', productIds)
    : { data: [] }

  const items = productIds
    .map((product_id, i) => {
      const product = (products ?? []).find((p) => p.id === product_id)
      const quantity = quantities[i]
      if (!product || !quantity || quantity <= 0) return null
      const unit_price = Number(product.price)
      return {
        company_id: active.companyId,
        product_id,
        product_name: product.name,
        unit_price,
        quantity,
        subtotal: unit_price * quantity,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  const total = items.reduce((sum, item) => sum + item.subtotal, 0)

  const orderPayload = { customer_id, status, notes, total }

  let orderId = id
  if (id) {
    await supabase.from('sales_orders').update(orderPayload).eq('id', id).eq('company_id', active.companyId)
    await supabase.from('sales_order_items').delete().eq('order_id', id).eq('company_id', active.companyId)
  } else {
    const { data: created } = await supabase
      .from('sales_orders')
      .insert({ ...orderPayload, company_id: active.companyId })
      .select('id')
      .single()
    orderId = created?.id ?? null
  }

  if (orderId && items.length > 0) {
    await supabase.from('sales_order_items').insert(items.map((item) => ({ ...item, order_id: orderId })))
  }

  revalidatePath('/admin/pedidos')
  redirect('/admin/pedidos')
}

export async function updateOrderStatus(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const supabase = await createClient()
  const id = formData.get('id') as string
  const status = formData.get('status') as string
  await supabase.from('sales_orders').update({ status }).eq('id', id).eq('company_id', active.companyId)
  revalidatePath('/admin/pedidos')
}

export async function deleteOrder(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const supabase = await createClient()
  const id = formData.get('id') as string
  await supabase.from('sales_orders').delete().eq('id', id).eq('company_id', active.companyId)
  revalidatePath('/admin/pedidos')
}
