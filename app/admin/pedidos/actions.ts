'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import { orderTotal } from '@/lib/orderTotals'
import type { OrderStatus } from '@/lib/types'

type ServerClient = Awaited<ReturnType<typeof createClient>>

const ORDER_STATUSES: OrderStatus[] = ['rascunho', 'confirmado', 'cancelado']
const MAX_QUANTITY = 100_000

function parseStatus(raw: unknown): OrderStatus {
  return ORDER_STATUSES.includes(raw as OrderStatus) ? (raw as OrderStatus) : 'rascunho'
}

function parseQuantity(raw: unknown): number {
  const n = Math.floor(Number(raw))
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.min(n, MAX_QUANTITY)
}

type Demand = { product_id: string; product_name: string; quantity: number }

// Nomes dos produtos cuja demanda passa do saldo disponível. Para um pedido
// que já baixou estoque (edição de pedido confirmado), o que ele mesmo já
// tirou volta a contar como disponível, senão a edição travaria sozinha.
async function stockShortfalls(
  supabase: ServerClient,
  companyId: string,
  orderId: string | null,
  demand: Demand[]
): Promise<string[]> {
  const byProduct = new Map<string, { qty: number; name: string }>()
  for (const d of demand) {
    const cur = byProduct.get(d.product_id)
    if (cur) cur.qty += d.quantity
    else byProduct.set(d.product_id, { qty: d.quantity, name: d.product_name })
  }
  const ids = [...byProduct.keys()]
  if (ids.length === 0) return []

  const { data: products } = await supabase
    .from('products')
    .select('id, stock_quantity')
    .eq('company_id', companyId)
    .in('id', ids)

  const alreadyRemoved = new Map<string, number>()
  if (orderId) {
    const { data: moves } = await supabase
      .from('stock_movements')
      .select('product_id, delta')
      .eq('company_id', companyId)
      .eq('order_id', orderId)
    for (const m of moves ?? []) {
      alreadyRemoved.set(m.product_id, (alreadyRemoved.get(m.product_id) ?? 0) - m.delta)
    }
  }

  const short: string[] = []
  for (const [pid, { qty, name }] of byProduct) {
    const stock = products?.find((p) => p.id === pid)?.stock_quantity ?? 0
    const available = stock + (alreadyRemoved.get(pid) ?? 0)
    if (qty > available) short.push(name)
  }
  return short
}

export async function saveOrder(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const supabase = await createClient()
  const id = formData.get('id') as string | null

  const customer_id = formData.get('customer_id') as string
  const status = parseStatus(formData.get('status'))
  const notes = (formData.get('notes') as string) || null

  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .eq('id', customer_id)
    .eq('company_id', active.companyId)
    .maybeSingle()
  if (!customer) return

  const productIds = formData.getAll('product_id') as string[]
  const quantities = formData.getAll('quantity').map(parseQuantity)

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

  // Entrega: método + taxa (manual ou vinda da cotação de motoboy). A taxa
  // entra no total do pedido.
  const rawMethod = (formData.get('delivery_method') as string) || 'a_combinar'
  const delivery_method = (['retirada', 'motoboy', 'a_combinar', 'melhor_envio'] as const).includes(rawMethod as never)
    ? rawMethod
    : 'a_combinar'
  const rawFee = Number(String(formData.get('delivery_fee') ?? '').replace(',', '.'))
  const delivery_fee = Number.isFinite(rawFee) && rawFee > 0 ? Math.round(rawFee * 100) / 100 : 0

  // Forma de pagamento: precisa ser uma da própria empresa (ou nenhuma).
  const rawPaymentId = (formData.get('payment_method_id') as string) || ''
  let payment_method_id: string | null = null
  if (rawPaymentId) {
    const { data: pm } = await supabase
      .from('payment_methods')
      .select('id')
      .eq('id', rawPaymentId)
      .eq('company_id', active.companyId)
      .maybeSingle()
    payment_method_id = pm?.id ?? null
  }

  // Desconto: percentual ou valor fixo sobre o subtotal dos itens.
  const rawDiscountType = (formData.get('discount_type') as string) || ''
  const discount_type: 'percent' | 'amount' | null =
    rawDiscountType === 'percent' || rawDiscountType === 'amount' ? rawDiscountType : null
  const rawDiscountValue = Number(String(formData.get('discount_value') ?? '').replace(',', '.'))
  const discount_value =
    discount_type && Number.isFinite(rawDiscountValue) && rawDiscountValue > 0
      ? Math.round(rawDiscountValue * 100) / 100
      : 0

  const itemsSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  const { total } = orderTotal({
    itemsSubtotal,
    discountType: discount_type,
    discountValue: discount_value,
    deliveryFee: delivery_fee,
  })

  // Pedido confirmado só passa se houver saldo — checagem antes de gravar
  // qualquer coisa.
  if (status === 'confirmado') {
    const short = await stockShortfalls(supabase, active.companyId, id, items)
    if (short.length > 0) {
      const faltam = encodeURIComponent(short.join(', '))
      redirect(id ? `/admin/pedidos/${id}?erro=estoque&faltam=${faltam}` : `/admin/pedidos/novo?erro=estoque&faltam=${faltam}`)
    }
  }

  const orderPayload = { customer_id, status, notes, total }
  // Campos que dependem de migrations que podem não ter rodado: entrega
  // (migration_lalamove) e pagamento/desconto (migration_payment_and_discount).
  // Tenta o payload mais completo e vai afunilando se o banco recusar.
  const withDelivery = { ...orderPayload, delivery_method, delivery_fee }
  const withPayment = { ...withDelivery, payment_method_id, discount_type, discount_value }

  async function persist(
    run: (payload: Record<string, unknown>) => PromiseLike<{ error: unknown }>
  ): Promise<void> {
    for (const payload of [withPayment, withDelivery, orderPayload]) {
      const { error } = await run(payload)
      if (!error) return
      console.error('Falha ao salvar pedido, tentando com menos campos:', error)
    }
  }

  let orderId = id
  let wasCommitted = false
  if (id) {
    const { data: existing } = await supabase
      .from('sales_orders')
      .select('stock_committed')
      .eq('id', id)
      .eq('company_id', active.companyId)
      .maybeSingle()
    wasCommitted = existing?.stock_committed ?? false

    await persist((payload) =>
      supabase.from('sales_orders').update(payload).eq('id', id).eq('company_id', active.companyId)
    )
    await supabase.from('sales_order_items').delete().eq('order_id', id).eq('company_id', active.companyId)
  } else {
    for (const payload of [withPayment, withDelivery, orderPayload]) {
      const created = await supabase
        .from('sales_orders')
        .insert({ ...payload, company_id: active.companyId })
        .select('id')
        .single()
      if (!created.error) {
        orderId = created.data?.id ?? null
        break
      }
      console.error('Falha ao criar pedido, tentando com menos campos:', created.error)
    }
  }

  if (orderId && items.length > 0) {
    await supabase.from('sales_order_items').insert(items.map((item) => ({ ...item, order_id: orderId })))
  }

  if (orderId) {
    // Reconcilia o estoque: desfaz a baixa antiga (se havia) e, se o pedido
    // está confirmado, baixa de novo a partir dos itens atuais.
    if (wasCommitted) {
      await supabase.rpc('release_order_stock', { p_company_id: active.companyId, p_order_id: orderId })
    }
    if (status === 'confirmado') {
      const { error } = await supabase.rpc('commit_order_stock', {
        p_company_id: active.companyId,
        p_order_id: orderId,
      })
      if (error) {
        console.error('Falha ao baixar estoque do pedido:', error)
        redirect(`/admin/pedidos/${orderId}?erro=estoque`)
      }
    }
  }

  revalidatePath('/admin/pedidos')
  revalidatePath('/admin/estoque')
  // Fica na tela do próprio pedido depois de salvar (antes voltava para a
  // lista). Sem id — insert falhou — cai para a lista.
  redirect(orderId ? `/admin/pedidos/${orderId}?salvo=1` : '/admin/pedidos')
}

export async function updateOrderStatus(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const supabase = await createClient()
  const id = formData.get('id') as string
  const status = parseStatus(formData.get('status'))

  const { data: order } = await supabase
    .from('sales_orders')
    .select('number, status, stock_committed')
    .eq('id', id)
    .eq('company_id', active.companyId)
    .maybeSingle()
  if (!order) return

  if (status === 'confirmado' && !order.stock_committed) {
    const { data: items } = await supabase
      .from('sales_order_items')
      .select('product_id, product_name, quantity')
      .eq('order_id', id)
      .eq('company_id', active.companyId)

    const short = await stockShortfalls(supabase, active.companyId, id, items ?? [])
    if (short.length > 0) {
      redirect(`/admin/pedidos?erro=estoque&pedido=${order.number}&faltam=${encodeURIComponent(short.join(', '))}`)
    }

    await supabase.from('sales_orders').update({ status }).eq('id', id).eq('company_id', active.companyId)
    const { error } = await supabase.rpc('commit_order_stock', { p_company_id: active.companyId, p_order_id: id })
    if (error) {
      console.error('Falha ao baixar estoque do pedido:', error)
      redirect(`/admin/pedidos?erro=estoque&pedido=${order.number}`)
    }
  } else {
    await supabase.from('sales_orders').update({ status }).eq('id', id).eq('company_id', active.companyId)
    if (status !== 'confirmado' && order.stock_committed) {
      await supabase.rpc('release_order_stock', { p_company_id: active.companyId, p_order_id: id })
    }
  }

  revalidatePath('/admin/pedidos')
  revalidatePath('/admin/estoque')
}

export type DeleteOrderResult = { ok: true } | { ok: false; error: string }

// Pedido confirmado só sai daqui virando cancelado (que libera estoque
// normalmente pelo fluxo de status) — excluir de vez apagaria o histórico
// de uma venda que já aconteceu de verdade. A checagem é sempre feita aqui,
// não só escondendo o botão no client: quem chama essa action direto (fora
// do form) não pode contornar a regra.
export async function deleteOrder(formData: FormData): Promise<DeleteOrderResult> {
  const active = await resolveActiveCompany()
  if (!active.ok) return { ok: false, error: 'Não autorizado.' }

  const supabase = await createClient()
  const id = formData.get('id') as string

  const { data: order } = await supabase
    .from('sales_orders')
    .select('status, stock_committed')
    .eq('id', id)
    .eq('company_id', active.companyId)
    .maybeSingle()

  if (!order) return { ok: false, error: 'Pedido não encontrado.' }
  if (order.status === 'confirmado') {
    return { ok: false, error: 'Pedidos confirmados não podem ser excluídos. Cancele o pedido antes, se precisar.' }
  }

  if (order.stock_committed) {
    await supabase.rpc('release_order_stock', { p_company_id: active.companyId, p_order_id: id })
  }

  await supabase.from('sales_orders').delete().eq('id', id).eq('company_id', active.companyId)
  revalidatePath('/admin/pedidos')
  revalidatePath('/admin/estoque')
  return { ok: true }
}
