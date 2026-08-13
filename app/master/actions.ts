'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { IMPERSONATION_COOKIE } from '@/lib/company'
import { slugify } from '@/lib/slugify'
import { DEFAULT_CATEGORIES } from '@/lib/defaultCategories'

async function requireSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) return null

  return user
}

export async function impersonateCompany(formData: FormData) {
  const user = await requireSuperAdmin()
  if (!user) return

  const companyId = formData.get('company_id') as string
  const supabase = await createClient()
  const { data: company } = await supabase.from('companies').select('id').eq('id', companyId).single()
  if (!company) return

  const cookieStore = await cookies()
  cookieStore.set(IMPERSONATION_COOKIE, companyId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  })

  redirect('/admin')
}

export async function stopImpersonating() {
  const cookieStore = await cookies()
  cookieStore.delete(IMPERSONATION_COOKIE)
  redirect('/master')
}

export async function createCompany(formData: FormData) {
  const admin = await requireSuperAdmin()
  if (!admin) return

  const name = (formData.get('name') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string

  if (!name || !email || !password) {
    redirect(`/master/nova?error=${encodeURIComponent('Preencha todos os campos.')}`)
  }

  const supabase = await createClient()
  const baseSlug = slugify(name)

  let company: { id: string } | null = null
  for (let attempt = 0; attempt < 2 && !company; attempt++) {
    const trySlug = attempt === 0 ? baseSlug : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`
    const result = await supabase.from('companies').insert({ name, slug: trySlug }).select('id').single()
    company = result.data
  }

  if (!company) {
    redirect(`/master/nova?error=${encodeURIComponent('Não foi possível criar a empresa.')}`)
  }

  const adminClient = createAdminClient()
  const { data: createdUser, error: userError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (userError || !createdUser.user) {
    await supabase.from('companies').delete().eq('id', company.id)
    redirect(`/master/nova?error=${encodeURIComponent(userError?.message || 'Não foi possível criar o usuário.')}`)
  }

  await supabase.from('profiles').insert({
    id: createdUser.user.id,
    company_id: company.id,
    role: 'owner',
    is_super_admin: false,
  })

  await supabase
    .from('categories')
    .insert(DEFAULT_CATEGORIES.map((c) => ({ ...c, company_id: company!.id, is_fixed: true })))

  revalidatePath('/master')
  redirect('/master')
}

export async function updateCompany(formData: FormData) {
  const admin = await requireSuperAdmin()
  if (!admin) return

  const companyId = formData.get('company_id') as string
  const payload = {
    name: (formData.get('name') as string) || 'Empresa',
    phone: (formData.get('phone') as string) || null,
    whatsapp: (formData.get('whatsapp') as string) || null,
    instagram: (formData.get('instagram') as string) || null,
    website: (formData.get('website') as string) || null,
    address: (formData.get('address') as string) || null,
  }

  const supabase = await createClient()
  await supabase.from('companies').update(payload).eq('id', companyId)

  revalidatePath('/master')
  revalidatePath(`/master/${companyId}`)
  redirect('/master')
}

export async function toggleCompanyActive(formData: FormData) {
  const admin = await requireSuperAdmin()
  if (!admin) return

  const companyId = formData.get('company_id') as string
  const active = formData.get('active') === 'true'

  const supabase = await createClient()
  await supabase.from('companies').update({ active }).eq('id', companyId)

  revalidatePath('/master')
}

export async function createCompanyUser(formData: FormData) {
  const admin = await requireSuperAdmin()
  if (!admin) return

  const companyId = formData.get('company_id') as string
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const role = (formData.get('role') as string) === 'owner' ? 'owner' : 'staff'

  if (!companyId || !email || !password) return

  const adminClient = createAdminClient()
  const { data: createdUser, error: userError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (userError || !createdUser.user) {
    redirect(`/master/${companyId}?error=${encodeURIComponent(userError?.message || 'Não foi possível criar o usuário.')}`)
  }

  const supabase = await createClient()
  await supabase.from('profiles').insert({
    id: createdUser.user.id,
    company_id: companyId,
    role,
    is_super_admin: false,
  })

  revalidatePath(`/master/${companyId}`)
}

async function requireProfileInCompany(userId: string, companyId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .eq('company_id', companyId)
    .single()
  return !!data
}

export async function updateUserRole(formData: FormData) {
  const admin = await requireSuperAdmin()
  if (!admin) return

  const userId = formData.get('user_id') as string
  const companyId = formData.get('company_id') as string
  const role = (formData.get('role') as string) === 'owner' ? 'owner' : 'staff'

  if (!(await requireProfileInCompany(userId, companyId))) return

  const supabase = await createClient()
  await supabase.from('profiles').update({ role }).eq('id', userId).eq('company_id', companyId)

  revalidatePath(`/master/${companyId}`)
}

export async function setUserActive(formData: FormData) {
  const admin = await requireSuperAdmin()
  if (!admin) return

  const userId = formData.get('user_id') as string
  const companyId = formData.get('company_id') as string
  const active = formData.get('active') === 'true'

  if (userId === admin.id) return
  if (!(await requireProfileInCompany(userId, companyId))) return

  const adminClient = createAdminClient()
  await adminClient.auth.admin.updateUserById(userId, { ban_duration: active ? 'none' : '876000h' })

  revalidatePath(`/master/${companyId}`)
}

export async function resetUserPassword(formData: FormData) {
  const admin = await requireSuperAdmin()
  if (!admin) return

  const userId = formData.get('user_id') as string
  const companyId = formData.get('company_id') as string
  const password = formData.get('password') as string

  if (!password || password.length < 6) return
  if (!(await requireProfileInCompany(userId, companyId))) return

  const adminClient = createAdminClient()
  await adminClient.auth.admin.updateUserById(userId, { password })

  revalidatePath(`/master/${companyId}`)
}

export async function removeUser(formData: FormData) {
  const admin = await requireSuperAdmin()
  if (!admin) return

  const userId = formData.get('user_id') as string
  const companyId = formData.get('company_id') as string

  if (userId === admin.id) return
  if (!(await requireProfileInCompany(userId, companyId))) return

  const adminClient = createAdminClient()
  await adminClient.auth.admin.deleteUser(userId)

  revalidatePath(`/master/${companyId}`)
}
