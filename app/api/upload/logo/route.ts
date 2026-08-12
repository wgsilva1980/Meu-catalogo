import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveCompany } from '@/lib/company'

export async function POST(request: NextRequest) {
  const active = await resolveActiveCompany()
  if (!active.ok) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'png'
  const path = `${active.companyId}/logo.${ext}`

  const admin = createAdminClient()
  const { error } = await admin.storage.from('assets').upload(path, file, {
    upsert: true,
    contentType: file.type,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data } = admin.storage.from('assets').getPublicUrl(path)
  return NextResponse.json({ url: `${data.publicUrl}?t=${Date.now()}` })
}
