'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotificationEmail } from '@/lib/email'
import { escapeHtml, isBot, readField } from '@/lib/publicForm'

export async function submitPublicCustomer(formData: FormData) {
  const slug = formData.get('slug') as string
  if (isBot(formData)) {
    if (slug) redirect(`/cadastro/${slug}?sucesso=1`)
    return
  }

  const name = readField(formData, 'name')
  const phone = readField(formData, 'phone')
  if (!slug || !name) return

  const supabase = createAdminClient()
  const { data: company } = await supabase
    .from('companies')
    .select('id, name')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (!company) return

  if (phone) {
    const { data: existing } = await supabase
      .from('customers')
      .select('id')
      .eq('company_id', company.id)
      .eq('phone', phone)
      .maybeSingle()
    if (existing) redirect(`/cadastro/${slug}?sucesso=1`)
  }

  await supabase.from('customers').insert({
    company_id: company.id,
    name,
    phone,
    email: readField(formData, 'email'),
    document: readField(formData, 'document'),
    zip_code: readField(formData, 'zip_code'),
    street: readField(formData, 'street'),
    number: readField(formData, 'number'),
    complement: readField(formData, 'complement'),
    neighborhood: readField(formData, 'neighborhood'),
    city: readField(formData, 'city'),
    state: readField(formData, 'state'),
  })

  // Notificação por e-mail: melhor esforço, nunca deve impedir o cadastro
  // em si (mesmo que a coluna email ainda não exista).
  try {
    const { data: companySettings } = await supabase
      .from('companies')
      .select('email')
      .eq('id', company.id)
      .single()
    if (companySettings?.email) {
      await sendNotificationEmail({
        to: companySettings.email,
        subject: `Novo cliente cadastrado — ${company.name}`,
        html: `<p><strong>Novo cliente cadastrado</strong></p><p>Nome: ${escapeHtml(name)}<br/>Telefone: ${
          phone ? escapeHtml(phone) : '—'
        }</p>`,
      })
    }
  } catch (err) {
    console.error('Notificação de cadastro falhou (cliente já foi criado normalmente):', err)
  }

  redirect(`/cadastro/${slug}?sucesso=1`)
}
