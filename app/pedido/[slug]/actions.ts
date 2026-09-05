'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotificationEmail } from '@/lib/email'
import { buildOrderNotificationEmail } from '@/lib/emailTemplates'
import { isBot, readField } from '@/lib/publicForm'
import { resolveMotoQuote } from '@/lib/lalamove'
import {
  calculateShipping,
  pickShippingBox,
  resolveShippingBoxes,
  type PackableItem,
  type ShippingQuoteItem,
} from '@/lib/melhorEnvio'
import type { DeliveryMethod, ShippingBox } from '@/lib/types'

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

type CompanyForShipping = {
  id: string
  shipping_origin_zip_code?: string | null
  shipping_origin_carrier_id?: number | null
  shipping_packages?: ShippingBox[] | null
  shipping_package_length_cm?: number | null
  shipping_package_width_cm?: number | null
  shipping_package_height_cm?: number | null
}

// Recota, no servidor, a opção de frete que o cliente escolheu na tela de
// entrega — nunca confiamos no preço vindo do client. Se o produto perdeu
// peso/dimensões ou a opção não existe mais, devolve null e o pedido cai
// para "a combinar".
async function resolveMelhorEnvioQuote({
  company,
  destinationZip,
  items,
  serviceId,
}: {
  company: CompanyForShipping
  destinationZip: string
  items: { product_id: string; quantity: number; unit_price: number }[]
  serviceId: number
}) {
  if (!company.shipping_origin_zip_code) return null
  const boxes = resolveShippingBoxes(company)
  if (boxes.length === 0) return null

  const supabase = createAdminClient()
  const productIds = items.map((i) => i.product_id)
  const { data: products } = await supabase
    .from('products')
    .select('id, weight_kg, length_cm, width_cm, height_cm')
    .eq('company_id', company.id)
    .in('id', productIds)

  const quoteItems: ShippingQuoteItem[] = []
  const packItems: PackableItem[] = []
  for (const item of items) {
    const product = (products ?? []).find((p) => p.id === item.product_id)
    if (!product?.weight_kg || !product.length_cm || !product.width_cm || !product.height_cm) return null
    quoteItems.push({
      weight_kg: Number(product.weight_kg),
      quantity: item.quantity,
      insurance_value: item.unit_price * item.quantity,
    })
    packItems.push({
      weight_kg: Number(product.weight_kg),
      length_cm: Number(product.length_cm),
      width_cm: Number(product.width_cm),
      height_cm: Number(product.height_cm),
      quantity: item.quantity,
    })
  }

  const picked = pickShippingBox(boxes, packItems)
  if (!picked) return null

  try {
    const options = await calculateShipping({
      companyId: company.id,
      fromPostalCode: company.shipping_origin_zip_code,
      toPostalCode: destinationZip,
      items: quoteItems,
      packageBox: { length_cm: picked.box.length_cm, width_cm: picked.box.width_cm, height_cm: picked.box.height_cm },
      preferredCarrierCompanyId: company.shipping_origin_carrier_id ?? null,
    })
    return options.find((o) => o.id === serviceId) ?? null
  } catch (err) {
    console.error('Falha ao recotar Melhor Envio no envio do pedido:', err)
    return null
  }
}

// Cadastro obrigatório antes do pedido quando o CPF informado não bate com
// nenhum cliente já cadastrado (ou o cliente não informou CPF nenhum). Cria
// o cadastro completo (com endereço) e já entra no pedido identificado por
// ele — evita pedir o endereço de novo na etapa de entrega.
export async function registerCustomerAndContinue(formData: FormData) {
  const slug = formData.get('slug') as string
  if (!slug) return
  if (isBot(formData)) return

  const name = readField(formData, 'name')
  const phone = readField(formData, 'phone')
  if (!name || !phone) return

  const supabase = createAdminClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('slug', slug)
    .eq('active', true)
    .single()
  if (!company) return

  const fields = {
    email: readField(formData, 'email'),
    document: readField(formData, 'document'),
    zip_code: readField(formData, 'zip_code'),
    street: readField(formData, 'street'),
    number: readField(formData, 'number'),
    complement: readField(formData, 'complement'),
    neighborhood: readField(formData, 'neighborhood'),
    city: readField(formData, 'city'),
    state: readField(formData, 'state'),
  }

  // Mesmo telefone já cadastrado: reaproveita o registro em vez de duplicar
  // (ex.: pessoa tentou antes sem CPF). Só preenche o que ainda estava
  // vazio — nunca sobrescreve dado que a loja já tinha.
  const { data: existingByPhone } = await supabase
    .from('customers')
    .select('*')
    .eq('company_id', company.id)
    .eq('phone', phone)
    .maybeSingle()

  let customerId: string
  if (existingByPhone) {
    customerId = existingByPhone.id
    await supabase
      .from('customers')
      .update({
        email: existingByPhone.email ?? fields.email,
        document: existingByPhone.document ?? fields.document,
        zip_code: existingByPhone.zip_code ?? fields.zip_code,
        street: existingByPhone.street ?? fields.street,
        number: existingByPhone.number ?? fields.number,
        complement: existingByPhone.complement ?? fields.complement,
        neighborhood: existingByPhone.neighborhood ?? fields.neighborhood,
        city: existingByPhone.city ?? fields.city,
        state: existingByPhone.state ?? fields.state,
      })
      .eq('id', customerId)
  } else {
    const { data: created } = await supabase
      .from('customers')
      .insert({ company_id: company.id, name, phone, ...fields })
      .select('id')
      .single()
    if (!created) return
    customerId = created.id
  }

  redirect(`/pedido/${slug}?cliente=${customerId}`)
}

export async function submitPublicOrder(formData: FormData) {
  const slug = formData.get('slug') as string
  if (!slug) return
  if (isBot(formData)) return

  const supabase = createAdminClient()
  const { data: company } = await supabase
    .from('companies')
    .select('*')
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

  // Entrega. Só 'motoboy' e 'melhor_envio' mexem em valor — e o valor NUNCA
  // vem do client: é recotado aqui no servidor. Se a recotação falhar, o
  // pedido segue como 'a_combinar' sem taxa (a loja acerta a entrega por
  // fora).
  const rawMethod = (formData.get('delivery_method') as string) || 'a_combinar'
  let deliveryMethod: DeliveryMethod = (['retirada', 'motoboy', 'melhor_envio', 'a_combinar'] as const).includes(
    rawMethod as never
  )
    ? (rawMethod as DeliveryMethod)
    : 'a_combinar'
  let deliveryFee = 0
  let deliveryAddress: Record<string, unknown> | null = null
  let deliveryQuote: Record<string, unknown> | null = null
  let deliveryNote: string | null = null

  const dest = {
    zip_code: readField(formData, 'zip_code'),
    street: readField(formData, 'street'),
    number: readField(formData, 'number'),
    complement: readField(formData, 'complement'),
    neighborhood: readField(formData, 'neighborhood'),
    city: readField(formData, 'city'),
    state: readField(formData, 'state'),
  }

  if (deliveryMethod === 'motoboy') {
    const result = company.lalamove_enabled ? await resolveMotoQuote({ company, destination: dest }) : null
    if (result && result.ok) {
      deliveryFee = result.quote.total
      deliveryAddress = { ...dest, lat: result.destGeo.lat, lng: result.destGeo.lng }
      deliveryQuote = {
        provider: 'lalamove',
        quotationId: result.quote.quotationId,
        serviceType: result.quote.serviceType,
        distance_m: result.quote.distanceMeters,
        currency: result.quote.currency,
        total: result.quote.total,
        expiresAt: result.quote.expiresAt,
        quotedAt: new Date().toISOString(),
      }
      if (!result.originGeoWasCached) {
        await supabase
          .from('companies')
          .update({ shipping_origin_lat: result.originGeo.lat, shipping_origin_lng: result.originGeo.lng })
          .eq('id', company.id)
      }
    } else {
      // não deu para cotar: não trava o pedido, cai para "a combinar"
      deliveryMethod = 'a_combinar'
      deliveryAddress = dest.zip_code ? { ...dest, lat: null, lng: null } : null
      deliveryNote = 'Cliente pediu entrega por motoboy — cotação automática indisponível, combinar valor.'
    }
  }

  if (deliveryMethod === 'melhor_envio') {
    const chosenServiceId = Number(formData.get('melhor_envio_service_id'))
    const meResult = Number.isFinite(chosenServiceId) && chosenServiceId > 0 && dest.zip_code
      ? await resolveMelhorEnvioQuote({ company, destinationZip: dest.zip_code, items, serviceId: chosenServiceId })
      : null

    if (meResult) {
      deliveryFee = Number(meResult.price)
      deliveryAddress = { ...dest, lat: null, lng: null }
      deliveryQuote = {
        provider: 'melhor_envio',
        service_id: meResult.id,
        service_name: meResult.name,
        carrier_company_id: meResult.company.id,
        carrier_company_name: meResult.company.name,
        delivery_time: meResult.delivery_time,
        price: deliveryFee,
        quotedAt: new Date().toISOString(),
      }
    } else {
      // não deu para recotar a opção escolhida: não trava o pedido, cai para
      // "a combinar" e a loja acerta o frete manualmente pelo painel.
      deliveryMethod = 'a_combinar'
      deliveryAddress = dest.zip_code ? { ...dest, lat: null, lng: null } : null
      deliveryNote = 'Cliente pediu envio via Melhor Envio — cotação automática indisponível, combinar valor.'
    }
  }

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

  // Forma de pagamento escolhida pelo cliente — precisa ser uma forma ativa
  // da própria loja.
  const rawPaymentId = (formData.get('payment_method_id') as string) || ''
  let paymentMethodId: string | null = null
  if (rawPaymentId) {
    const { data: pm } = await supabase
      .from('payment_methods')
      .select('id')
      .eq('id', rawPaymentId)
      .eq('company_id', company.id)
      .eq('active', true)
      .maybeSingle()
    paymentMethodId = pm?.id ?? null
  }

  const itemsTotal = items.reduce((sum, item) => sum + item.subtotal, 0)
  const total = itemsTotal + deliveryFee
  const notes = [readField(formData, 'notes'), deliveryNote].filter(Boolean).join('\n') || null

  const baseOrder = { company_id: company.id, customer_id: customerId, status: 'rascunho', notes, total }
  const withDelivery = {
    ...baseOrder,
    delivery_method: deliveryMethod,
    delivery_fee: deliveryFee,
    delivery_address: deliveryAddress,
    delivery_quote: deliveryQuote,
  }
  const withPayment = { ...withDelivery, payment_method_id: paymentMethodId }

  // Colunas de entrega/pagamento dependem de migrations que podem não ter
  // rodado. Tenta o insert mais completo e vai afunilando para não perder o
  // pedido.
  let order: { id: string; number: number; status: string; created_at: string } | null = null
  for (const payload of [withPayment, withDelivery, baseOrder]) {
    const created = await supabase
      .from('sales_orders')
      .insert(payload)
      .select('id, number, status, created_at')
      .single()
    if (!created.error) {
      order = created.data
      break
    }
    console.error('Falha ao criar pedido, tentando com menos campos:', created.error)
  }
  if (!order) return

  await supabase.from('sales_order_items').insert(items.map((item) => ({ ...item, order_id: order.id })))

  // Guarda a cotação escolhida pelo cliente já como "cotado" — o admin só
  // precisa conferir e comprar a etiqueta, sem recalcular do zero. Melhor
  // esforço: se a tabela/migration não existir, não trava o pedido.
  if (deliveryMethod === 'melhor_envio' && deliveryQuote) {
    await supabase.from('shipments').upsert(
      {
        company_id: company.id,
        order_id: order.id,
        service_id: deliveryQuote.service_id,
        service_name: deliveryQuote.service_name,
        price: deliveryQuote.price,
        status: 'cotado',
      },
      { onConflict: 'order_id' }
    )
  }

  // Melhor esforço: se o cliente informou endereço de entrega e o cadastro
  // dele ainda não tem CEP, guarda o endereço no cadastro.
  if (deliveryAddress?.zip_code && customerId) {
    const { data: existing } = await supabase.from('customers').select('zip_code').eq('id', customerId).maybeSingle()
    if (!existing?.zip_code) {
      await supabase
        .from('customers')
        .update({
          zip_code: deliveryAddress.zip_code,
          street: deliveryAddress.street ?? null,
          number: deliveryAddress.number ?? null,
          complement: deliveryAddress.complement ?? null,
          neighborhood: deliveryAddress.neighborhood ?? null,
          city: deliveryAddress.city ?? null,
          state: deliveryAddress.state ?? null,
        })
        .eq('id', customerId)
    }
  }

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

    let paymentMethodName: string | null = null
    if (paymentMethodId) {
      const { data: pm } = await supabase.from('payment_methods').select('name').eq('id', paymentMethodId).maybeSingle()
      paymentMethodName = pm?.name ?? null
    }

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
      delivery:
        deliveryMethod === 'retirada'
          ? { method: 'retirada', fee: 0 }
          : deliveryAddress || deliveryFee > 0 || deliveryMethod === 'a_combinar'
          ? {
              method: deliveryMethod,
              fee: deliveryFee,
              address: deliveryAddress
                ? [
                    [deliveryAddress.street, deliveryAddress.number].filter(Boolean).join(', '),
                    deliveryAddress.neighborhood,
                    [deliveryAddress.city, deliveryAddress.state].filter(Boolean).join(' - '),
                    deliveryAddress.zip_code ? `CEP ${deliveryAddress.zip_code}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : null,
            }
          : null,
      paymentMethod: paymentMethodName,
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

  // Token do link público de acompanhamento — consulta à parte para não
  // quebrar a criação do pedido se a migration ainda não rodou.
  let publicToken: string | null = null
  {
    const { data } = await supabase.from('sales_orders').select('public_token').eq('id', order.id).maybeSingle()
    publicToken = (data as { public_token?: string } | null)?.public_token ?? null
  }

  redirect(
    `/pedido/${slug}?sucesso=1&numero=${order.number}${publicToken ? `&token=${publicToken}` : ''}`
  )
}
