import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { UUID_RE } from '@/lib/format'

export const runtime = 'nodejs'

// Polling leve enquanto o Pix está pendente: só lê o que o webhook já
// gravou no banco, sem chamar a API do Mercado Pago de novo.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!UUID_RE.test(token)) return NextResponse.json({ error: 'Link inválido.' }, { status: 404 })

  const supabase = createAdminClient()
  const { data: order } = await supabase
    .from('sales_orders')
    .select('paid_at, status')
    .eq('public_token', token)
    .maybeSingle()
  if (!order) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 })

  return NextResponse.json({ paid: Boolean(order.paid_at), orderStatus: order.status })
}
