'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveActiveCompany } from '@/lib/company'
import { slugify } from '@/lib/slugify'

export async function addCategory(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const supabase = await createClient()
  const name = formData.get('name') as string
  const slug = slugify(name)

  const { data: max } = await supabase
    .from('categories')
    .select('sort_order')
    .eq('company_id', active.companyId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  await supabase.from('categories').insert({
    name,
    slug,
    is_fixed: false,
    sort_order: (max?.sort_order ?? 0) + 1,
    company_id: active.companyId,
  })

  revalidatePath('/admin/categorias')
}

export async function deleteCategory(formData: FormData) {
  const active = await resolveActiveCompany()
  if (!active.ok) return

  const supabase = await createClient()
  const id = formData.get('id') as string
  await supabase.from('categories').delete().eq('id', id).eq('is_fixed', false).eq('company_id', active.companyId)
  revalidatePath('/admin/categorias')
}
