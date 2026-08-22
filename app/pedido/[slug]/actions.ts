'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTelegramMessage } from '@/lib/telegram'

export async function submitPublicOrder(formData: FormData) {
  const slug = formData.get('slug') as string
  if (!slug) return

  const supabase = createAdminClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id, name, telegram_chat_id')
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

  let customerId: string | null = null

  // Cliente já identificado por CPF na etapa anterior: revalida que o
  // registro pertence a esta empresa antes de confiar no id vindo do form.
  const matchedCustomerId = (formData.get('customer_id') as string) || null
  if (matchedCustomerId) {
    const { data: verified } = await supabase
      .from('customers')
      .select('id')
      .eq('id', matchedCustomerId)
      .eq('company_id', company.id)
      .maybeSingle()
    if (verified) customerId = verified.id
  }

  if (!customerId) {
    const name = (formData.get('name') as string)?.trim()
    const phone = (formData.get('phone') as string)?.trim()
    if (!name || !phone) return
    const document = (formData.get('document') as string)?.trim() || null

    const { data: existingByPhone } = await supabase
      .from('customers')
      .select('id')
      .eq('company_id', company.id)
      .eq('phone', phone)
      .maybeSingle()

    if (existingByPhone) {
      customerId = existingByPhone.id
    } else {
      const { data: createdCustomer } = await supabase
        .from('customers')
        .insert({
          company_id: company.id,
          name,
          phone,
          email: (formData.get('email') as string) || null,
          document,
        })
        .select('id')
        .single()
      if (!createdCustomer) return
      customerId = createdCustomer.id
    }
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

  if (company.telegram_chat_id) {
    const { data: customer } = await supabase.from('customers').select('name, phone').eq('id', customerId).single()
    const itemsList = items.map((item) => `• ${item.quantity}x ${item.product_name}`).join('\n')
    const totalLabel = `R$ ${total.toFixed(2).replace('.', ',')}`
    await sendTelegramMessage(
      company.telegram_chat_id,
      `🛒 <b>Novo pedido #${order.number}</b>\n${company.name}\n\n` +
        `Cliente: ${customer?.name ?? '—'}\nTelefone: ${customer?.phone ?? '—'}\n\n${itemsList}\n\nTotal: ${totalLabel}`
    )
  }

  redirect(`/pedido/${slug}?sucesso=1&numero=${order.number}`)
}
