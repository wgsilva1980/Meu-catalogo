import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getShipmentTracking } from '@/lib/melhorEnvio'
import { UUID_RE } from '@/lib/format'

export const runtime = 'nodejs'
export const maxDuration = 30

// Rastreio para o link público de acompanhamento. O próprio token do pedido
// é a credencial — sem login.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!UUID_RE.test(token)) {
    return NextResponse.json({ error: 'Link inválido.' }, { status: 404 })
  }

  const supabase = createAdminClient()
  const { data: order } = await supabase
    .from('sales_orders')
    .select('id, company_id')
    .eq('public_token', token)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

  const { data: shipment } = await supabase
    .from('shipments')
    .select('melhor_envio_id, tracking_code')
    .eq('order_id', order.id)
    .maybeSingle()

  if (!shipment?.melhor_envio_id) {
    return NextResponse.json({ code: shipment?.tracking_code ?? null, status: null, events: [] })
  }

  try {
    const tracking = await getShipmentTracking({
      companyId: order.company_id,
      melhorEnvioId: shipment.melhor_envio_id,
    })
    if (tracking.code && tracking.code !== shipment.tracking_code) {
      await supabase.from('shipments').update({ tracking_code: tracking.code }).eq('order_id', order.id)
    }
    return NextResponse.json({ code: tracking.code, status: tracking.status, events: tracking.events })
  } catch (err) {
    console.error('Falha ao consultar rastreio (acompanhamento público):', err)
    return NextResponse.json({ code: shipment.tracking_code ?? null, status: null, events: [] })
  }
}
