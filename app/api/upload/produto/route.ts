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

  const admin = createAdminClient()
  const path = `${active.companyId}/${crypto.randomUUID()}.${validated.value.ext}`
  const { error } = await admin.storage.from('produtos').upload(path, validated.value.buffer, {
    upsert: true,
    contentType: validated.value.contentType,
  })

  if (error) {
    return NextResponse.json({ error: 'Falha ao salvar o arquivo.' }, { status: 500 })
  }

  const { data } = admin.storage.from('produtos').getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
