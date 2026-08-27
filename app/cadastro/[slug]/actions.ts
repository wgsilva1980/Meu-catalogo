'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendNotificationEmail } from '@/lib/email'

export async function submitPublicCustomer(formData: FormData) {
  const slug = formData.get('slug') as string
  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
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
    email: (formData.get('email') as string) || null,
    document: (formData.get('document') as string) || null,
    zip_code: (formData.get('zip_code') as string) || null,
    street: (formData.get('street') as string) || null,
    number: (formData.get('number') as string) || null,
    complement: (formData.get('complement') as string) || null,
    neighborhood: (formData.get('neighborhood') as string) || null,
    city: (formData.get('city') as string) || null,
    state: (formData.get('state') as string) || null,
  })

  // Notificação por e-mail: melhor esforço, nunca deve impedir o cadastro
  // em si (mesmo que a coluna notification_email ainda não exista).
  try {
    const { data: companySettings } = await supabase
      .from('companies')
      .select('notification_email')
      .eq('id', company.id)
      .single()
    if (companySettings?.notification_email) {
      await sendNotificationEmail({
        to: companySettings.notification_email,
        subject: `Novo cliente cadastrado — ${company.name}`,
        html: `<p><strong>Novo cliente cadastrado</strong></p><p>Nome: ${name}<br/>Telefone: ${phone ?? '—'}</p>`,
      })
    }
  } catch (err) {
    console.error('Notificação de cadastro falhou (cliente já foi criado normalmente):', err)
  }

  redirect(`/cadastro/${slug}?sucesso=1`)
}
