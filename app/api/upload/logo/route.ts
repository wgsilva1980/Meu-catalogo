import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveCompany } from '@/lib/company'
import { validateImageUpload } from '@/lib/upload'

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

  const validated = await validateImageUpload(file)
  if (!validated.ok) {
    return NextResponse.json({ error: validated.error }, { status: validated.status })
  }

  const path = `${active.companyId}/logo.${validated.value.ext}`

  const admin = createAdminClient()
  const { error } = await admin.storage.from('assets').upload(path, validated.value.buffer, {
    upsert: true,
    contentType: validated.value.contentType,
  })

  if (error) {
    return NextResponse.json({ error: 'Falha ao salvar o arquivo.' }, { status: 500 })
  }

  const { data } = admin.storage.from('assets').getPublicUrl(path)
  return NextResponse.json({ url: `${data.publicUrl}?t=${Date.now()}` })
}
