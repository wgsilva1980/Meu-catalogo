'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

export async function submitPublicOrder(formData: FormData) {
  const slug = formData.get('slug') as string
  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim()
  if (!slug || !name || !phone) return

  const supabase = createAdminClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .eq('active', true)
    .single()
  if (!company) return

  const productIds = formData.getAll('product_id') as string[]
  const quantities = formData.getAll('quantity').map((q) => Number(q))

  const { data: products } = productIds.length
    ? await supabase
        .from('products')
        .select('id, name, price')
        .eq('company_id', company.id)
        .eq('available', true)
        .in('id', productIds)
    : { data: [] }

  const items = productIds
    .map((product_id, i) => {
      const product = (products ?? []).find((p) => p.id === product_id)
      const quantity = quantities[i]
      if (!product || !quantity || quantity <= 0) return null
      const unit_price = Number(product.price)
      return {
        company_id: company.id,
        product_id,
        product_name: product.name,
        unit_price,
        quantity,
        subtotal: unit_price * quantity,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)

  if (items.length === 0) return

  let customerId: string
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('company_id', company.id)
    .eq('phone', phone)
    .maybeSingle()

  if (existingCustomer) {
    customerId = existingCustomer.id
  } else {
    const { data: createdCustomer } = await supabase
      .from('customers')
      .insert({
        company_id: company.id,
        name,
        phone,
        email: (formData.get('email') as string) || null,
      })
      .select('id')
      .single()
    if (!createdCustomer) return
    customerId = createdCustomer.id
  }

  const total = items.reduce((sum, item) => sum + item.subtotal, 0)
  const notes = (formData.get('notes') as string) || null

  const { data: order } = await supabase
    .from('sales_orders')
    .insert({ company_id: company.id, customer_id: customerId, status: 'rascunho', notes, total })
    .select('id, number')
    .single()
  if (!order) return

  await supabase.from('sales_order_items').insert(items.map((item) => ({ ...item, order_id: order.id })))

  redirect(`/pedido/${slug}?sucesso=1&numero=${order.number}`)
}
