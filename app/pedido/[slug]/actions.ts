'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotificationEmail } from '@/lib/email'
import { buildOrderNotificationEmail } from '@/lib/emailTemplates'
import { isBot, readField } from '@/lib/publicForm'

// Cópia opcional enviada em todo pedido (monitoramento do envio de e-mail).
// Configurável por ambiente — não expor um endereço pessoal fixo no código.
const ORDER_NOTIFICATION_BCC = process.env.ORDER_NOTIFICATION_BCC?.trim() || null

const MAX_QUANTITY = 100_000
const MAX_LINE_ITEMS = 200

function parseQuantity(raw: unknown): number {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(n, MAX_QUANTITY)
}

export async function submitPublicOrder(formData: FormData) {
  const slug = formData.get('slug') as string
  if (!slug) return
  if (isBot(formData)) return

  const supabase = createAdminClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .eq('slug', slug)
    .eq('active', true)
    .single()
  if (!company) return

  const productIds = (formData.getAll('product_id') as string[]).slice(0, MAX_LINE_ITEMS)
  const quantities = formData.getAll('quantity').map(parseQuantity)

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
    const name = readField(formData, 'name')
    const phone = readField(formData, 'phone')
    if (!name || !phone) return
    const document = readField(formData, 'document')

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
          email: readField(formData, 'email'),
          document,
        })
        .select('id')
        .single()
      if (!createdCustomer) return
      customerId = createdCustomer.id
    }
  }

  const total = items.reduce((sum, item) => sum + item.subtotal, 0)
  const notes = readField(formData, 'notes')

  const { data: order } = await supabase
    .from('sales_orders')
    .insert({ company_id: company.id, customer_id: customerId, status: 'rascunho', notes, total })
    .select('id, number, status, created_at')
    .single()
  if (!order) return

  await supabase.from('sales_order_items').insert(items.map((item) => ({ ...item, order_id: order.id })))

  // Notificação por e-mail: melhor esforço, isolada em try/catch própria
  // para nunca impedir a confirmação do pedido (mesmo que a coluna
  // email ainda não exista, por falta de migration).
  try {
    const { data: companySettings } = await supabase
      .from('companies')
      .select('email')
      .eq('id', company.id)
      .single()

    const recipients = new Set<string>()
    if (companySettings?.email) recipients.add(companySettings.email)
    if (ORDER_NOTIFICATION_BCC) recipients.add(ORDER_NOTIFICATION_BCC)
    if (recipients.size === 0) throw new Error('nenhum destinatário de notificação configurado')

    const { data: customer } = await supabase
      .from('customers')
      .select('name, phone, email, document')
      .eq('id', customerId)
      .single()

    const host = (await headers()).get('host')
    const protocol = host?.startsWith('localhost') ? 'http' : 'https'
    const panelUrl = host ? `${protocol}://${host}/admin/pedidos/${order.id}` : null

    const html = buildOrderNotificationEmail({
      companyName: company.name,
      order: { number: order.number, status: order.status, total, notes, createdAt: order.created_at },
      customer: {
        name: customer?.name ?? '—',
        phone: customer?.phone ?? null,
        email: customer?.email ?? null,
        document: customer?.document ?? null,
      },
      items,
      panelUrl,
    })

    await sendNotificationEmail({
      to: Array.from(recipients).join(', '),
      subject: `Novo pedido #${order.number} — ${company.name}`,
      html,
    })
  } catch (err) {
    console.error('Notificação de pedido falhou (pedido já foi criado normalmente):', err)
  }

  redirect(`/pedido/${slug}?sucesso=1&numero=${order.number}`)
}
