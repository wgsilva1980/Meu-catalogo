export type Category = {
  id: string
  company_id: string
  name: string
  slug: string
  sort_order: number
  is_fixed: boolean
}

export type Product = {
  id: string
  company_id: string
  name: string
  brand: string
  category_id: string
  short_description: string
  price: number
  promo_note: string | null
  available: boolean
  image_url: string | null
  weight_kg: number | null
  length_cm: number | null
  width_cm: number | null
  height_cm: number | null
  created_at: string
  updated_at: string
}

export type Company = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  phone: string | null
  whatsapp: string | null
  instagram: string | null
  website: string | null
  address: string | null
  notification_email: string | null
  active: boolean
  created_at: string
}

export type Profile = {
  id: string
  company_id: string | null
  role: 'owner' | 'staff'
  is_super_admin: boolean
  created_at: string
}

export type Customer = {
  id: string
  company_id: string
  name: string
  phone: string | null
  email: string | null
  document: string | null
  zip_code: string | null
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type OrderStatus = 'rascunho' | 'confirmado' | 'cancelado'

export type SalesOrderItem = {
  id: string
  order_id: string
  company_id: string
  product_id: string
  product_name: string
  unit_price: number
  quantity: number
  subtotal: number
}

export type SalesOrder = {
  id: string
  company_id: string
  number: number
  customer_id: string
  status: OrderStatus
  notes: string | null
  total: number
  pdf_path: string | null
  created_at: string
  updated_at: string
}

export type CatalogScope =
  | { type: 'all' }
  | { type: 'selection'; categoryIds: string[] }

export type GeneratedCatalog = {
  id: string
  company_id: string
  scope: CatalogScope
  pdf_path: string
  created_at: string
}
