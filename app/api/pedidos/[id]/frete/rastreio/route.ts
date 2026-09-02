import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveCompany } from '@/lib/company'
import { getShipmentTracking } from '@/lib/melhorEnvio'

export const runtime = 'nodejs'
export const maxDuration = 30

// Consulta o rastreio atual do envio já gerado no Melhor Envio e guarda o
// código em `shipments.tracking_code` quando ele passa a existir.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const active = await resolveActiveCompany()
  if (!active.ok) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { id } = await params
  const supabase = await createClient()

  const { data: shipment } = await supabase
    .from('shipments')
    .select('melhor_envio_id, tracking_code')
    .eq('order_id', id)
    .eq('company_id', active.companyId)
    .maybeSingle()

  if (!shipment?.melhor_envio_id) {
    return NextResponse.json({ error: 'Este pedido ainda não tem etiqueta gerada.' }, { status: 422 })
  }

  try {
    const tracking = await getShipmentTracking({
      companyId: active.companyId,
      melhorEnvioId: shipment.melhor_envio_id,
    })

    if (tracking.code && tracking.code !== shipment.tracking_code) {
      const admin = createAdminClient()
      await admin
        .from('shipments')
        .update({ tracking_code: tracking.code })
        .eq('order_id', id)
        .eq('company_id', active.companyId)
    }

    return NextResponse.json(tracking)
  } catch (err) {
    console.error('Falha ao consultar o rastreio:', err)
    return NextResponse.json({ error: 'Falha ao consultar o rastreio no Melhor Envio.' }, { status: 502 })
  }
}
