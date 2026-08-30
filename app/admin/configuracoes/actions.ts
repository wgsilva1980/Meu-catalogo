'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'

export async function saveStoreSettings(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const supabase = await createClient()

  const corePayload = {
    name: (formData.get('name') as string) || 'Minha loja',
    logo_url: (formData.get('logo_url') as string) || null,
    phone: (formData.get('phone') as string) || null,
    whatsapp: (formData.get('whatsapp') as string) || null,
    instagram: (formData.get('instagram') as string) || null,
    website: (formData.get('website') as string) || null,
    address: (formData.get('address') as string) || null,
    notification_email: (formData.get('notification_email') as string) || null,
  }

  // Endereço de origem para frete: colunas novas (migration_melhor_envio.sql)
  // que podem ainda não existir — mesma proteção usada em produtos, salvar
  // o resto das configurações não pode depender da migration já ter rodado.
  const payloadWithShipping = {
    ...corePayload,
    shipping_origin_name: (formData.get('shipping_origin_name') as string) || null,
    shipping_origin_document: (formData.get('shipping_origin_document') as string) || null,
    shipping_origin_phone: (formData.get('shipping_origin_phone') as string) || null,
    shipping_origin_email: (formData.get('shipping_origin_email') as string) || null,
    shipping_origin_zip_code: (formData.get('shipping_origin_zip_code') as string) || null,
    shipping_origin_street: (formData.get('shipping_origin_street') as string) || null,
    shipping_origin_number: (formData.get('shipping_origin_number') as string) || null,
    shipping_origin_complement: (formData.get('shipping_origin_complement') as string) || null,
    shipping_origin_neighborhood: (formData.get('shipping_origin_neighborhood') as string) || null,
    shipping_origin_city: (formData.get('shipping_origin_city') as string) || null,
    shipping_origin_state: (formData.get('shipping_origin_state') as string) || null,
    shipping_origin_agency_id: parseAgencyId(formData.get('shipping_origin_agency_id') as string | null),
  }

  const { error } = await supabase.from('companies').update(payloadWithShipping).eq('id', active.companyId)
  if (error) {
    console.error('Falha ao salvar configurações com endereço de origem, tentando sem ele:', error)
    await supabase.from('companies').update(corePayload).eq('id', active.companyId)
  }

  revalidatePath('/admin/configuracoes')
}

// A agência do Melhor Envio é sempre um ID numérico. Guarda apenas os
// dígitos; qualquer coisa vazia/inválida vira null (Correios não usa agência).
function parseAgencyId(raw: string | null): number | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits ? Number(digits) : null
}
