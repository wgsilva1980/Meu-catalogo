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

  const admin = createAdminClient()
  const path = `${active.companyId}/${crypto.randomUUID()}-${file.name}`
  const { error } = await admin.storage.from('produtos').upload(path, file, { upsert: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data } = admin.storage.from('produtos').getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl })
}
