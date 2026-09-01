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
    instagram: (formData.get('instagram') as string) || null,
    website: (formData.get('website') as string) || null,
  }

  // Colunas adicionadas por migrations que podem ainda não ter rodado neste
  // ambiente. Em vez de um update só (que falharia inteiro por causa de uma
  // coluna faltando), montamos payloads do mais completo ao mais enxuto e
  // aplicamos o primeiro que o banco aceitar — assim uma coluna nova ausente
  // nunca impede de salvar o resto.
  const addressPayload = {
    ...corePayload,
    email: (formData.get('email') as string) || null,
    shipping_origin_name: (formData.get('shipping_origin_name') as string) || null,
    shipping_origin_document: (formData.get('shipping_origin_document') as string) || null,
    shipping_origin_zip_code: (formData.get('shipping_origin_zip_code') as string) || null,
    shipping_origin_street: (formData.get('shipping_origin_street') as string) || null,
    shipping_origin_number: (formData.get('shipping_origin_number') as string) || null,
    shipping_origin_complement: (formData.get('shipping_origin_complement') as string) || null,
    shipping_origin_neighborhood: (formData.get('shipping_origin_neighborhood') as string) || null,
    shipping_origin_city: (formData.get('shipping_origin_city') as string) || null,
    shipping_origin_state: (formData.get('shipping_origin_state') as string) || null,
    shipping_origin_agency_id: parseNumericId(formData.get('shipping_origin_agency_id') as string | null),
    shipping_packages: parsePackages(formData.get('shipping_packages') as string | null),
  }

  const carrierPayload = {
    ...addressPayload,
    shipping_origin_carrier_id: parseNumericId(formData.get('shipping_origin_carrier_id') as string | null),
  }

  // migration_lalamove.sql — se ainda não rodou, este tier falha e caímos
  // para o carrierPayload (endereço/transportadora ainda salvam).
  const lalamovePayload = {
    ...carrierPayload,
    lalamove_enabled: formData.get('lalamove_enabled') === 'on',
    lalamove_service_type: (formData.get('lalamove_service_type') as string) || 'MOTORCYCLE',
    // Endereço de origem pode ter mudado: zera o cache de coordenadas para a
    // próxima cotação de motoboy geocodificar de novo.
    shipping_origin_lat: null,
    shipping_origin_lng: null,
  }

  let persisted = false
  for (const payload of [lalamovePayload, carrierPayload, addressPayload, corePayload]) {
    const { error } = await supabase.from('companies').update(payload).eq('id', active.companyId)
    if (!error) {
      persisted = true
      break
    }
    console.error('Falha ao salvar configurações; tentando com menos campos:', error)
  }
  if (!persisted) console.error('Não foi possível salvar nenhuma parte das configurações.')

  revalidatePath('/admin/configuracoes')
}

// IDs do Melhor Envio (agência, transportadora) são sempre numéricos. Guarda
// apenas os dígitos; vazio/inválido vira null.
function parseNumericId(raw: string | null): number | null {
  const digits = (raw ?? '').replace(/\D/g, '')
  return digits ? Number(digits) : null
}

// Número em cm/kg vindo do formulário. Aceita decimal com vírgula ("2,5");
// vazio ou não-positivo vira null.
function parsePositiveNumber(raw: unknown): number | null {
  const n = Number(String(raw ?? '').replace(',', '.').trim())
  return Number.isFinite(n) && n > 0 ? n : null
}

// Lista de caixas cadastradas (JSON vindo de um input hidden do formulário).
// Descarta linhas sem as 3 dimensões; nome vazio recebe um rótulo padrão.
function parsePackages(raw: string | null): Array<{
  name: string
  length_cm: number
  width_cm: number
  height_cm: number
  max_weight_kg: number | null
}> {
  let arr: unknown
  try {
    arr = JSON.parse(raw ?? '[]')
  } catch {
    return []
  }
  if (!Array.isArray(arr)) return []
  return arr
    .map((row, i) => {
      const r = (row ?? {}) as Record<string, unknown>
      return {
        name: String(r.name ?? '').trim() || `Caixa ${i + 1}`,
        length_cm: parsePositiveNumber(r.length_cm),
        width_cm: parsePositiveNumber(r.width_cm),
        height_cm: parsePositiveNumber(r.height_cm),
        max_weight_kg: parsePositiveNumber(r.max_weight_kg),
      }
    })
    .filter(
      (r): r is { name: string; length_cm: number; width_cm: number; height_cm: number; max_weight_kg: number | null } =>
        r.length_cm != null && r.width_cm != null && r.height_cm != null
    )
}
