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
  // Saldo em estoque (denormalizado — mantido pelas funções de estoque no
  // Postgres) e o piso para o alerta de "estoque baixo".
  stock_quantity: number
  low_stock_threshold: number
  weight_kg: number | null
  length_cm: number | null
  width_cm: number | null
  height_cm: number | null
  created_at: string
  updated_at: string
}

// Caixa cadastrada pela loja para envios. O sistema escolhe a menor caixa
// em que o pedido caiba antes de cotar/gerar a etiqueta.
export type ShippingBox = {
  name: string
  length_cm: number
  width_cm: number
  height_cm: number
  max_weight_kg: number | null
}

export type Company = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  // Telefone / WhatsApp da loja. Exibido no PDF e usado como telefone do
  // remetente nas etiquetas do Melhor Envio.
  phone: string | null
  // E-mail único da loja: recebe notificações de pedido/cadastro e vai como
  // remetente nas etiquetas.
  email: string | null
  instagram: string | null
  website: string | null
  // Endereço estruturado da loja — endereço único, usado para calcular frete
  // e gerar etiquetas.
  shipping_origin_name: string | null
  shipping_origin_document: string | null
  shipping_origin_zip_code: string | null
  shipping_origin_street: string | null
  shipping_origin_number: string | null
  shipping_origin_complement: string | null
  shipping_origin_neighborhood: string | null
  shipping_origin_city: string | null
  shipping_origin_state: string | null
  // `company` id da transportadora do Melhor Envio (Correios=1, Jadlog=2,
  // Azul Cargo=3, ...). Define a transportadora padrão e a lista de agências.
  shipping_origin_carrier_id: number | null
  shipping_origin_agency_id: number | null
  // Coordenadas do CEP de origem (cache da geocodificação), usadas na
  // cotação de motoboy da Lalamove.
  shipping_origin_lat: number | null
  shipping_origin_lng: number | null
  // Cotação de motoboy (Lalamove) no link público de pedido. Credenciais são
  // da plataforma (env LALAMOVE_*); aqui só liga/desliga e escolhe o veículo.
  lalamove_enabled: boolean
  lalamove_service_type: string
  // Legado: caixa padrão única. Superado por shipping_packages; ainda lido
  // como fallback enquanto a loja não cadastra a lista de caixas.
  shipping_package_length_cm: number | null
  shipping_package_width_cm: number | null
  shipping_package_height_cm: number | null
  shipping_packages: ShippingBox[] | null
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

export type StockMovementType = 'entrada' | 'saida' | 'ajuste'

export type StockMovement = {
  id: string
  company_id: string
  product_id: string
  type: StockMovementType
  quantity: number
  delta: number
  balance_after: number
  note: string | null
  order_id: string | null
  created_by: string | null
  created_at: string
}

export type OrderStatus = 'rascunho' | 'confirmado' | 'cancelado'

export type DeliveryMethod = 'retirada' | 'motoboy' | 'a_combinar' | 'melhor_envio'

export type DeliveryAddress = {
  zip_code: string | null
  street: string | null
  number: string | null
  complement: string | null
  neighborhood: string | null
  city: string | null
  state: string | null
  lat: number | null
  lng: number | null
}

export type LalamoveQuote = {
  provider: 'lalamove'
  quotationId: string
  serviceType: string
  distance_m: number | null
  currency: string
  total: number
  expiresAt: string | null
  quotedAt: string
}

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

export type PaymentMethod = {
  id: string
  company_id: string
  name: string
  sort_order: number
  active: boolean
  created_at: string
}

// Desconto do pedido: percentual sobre o subtotal ('percent') ou valor fixo
// em reais ('amount'). Incide sobre o subtotal dos itens, antes do frete.
export type DiscountType = 'percent' | 'amount'

export type SalesOrder = {
  id: string
  company_id: string
  number: number
  customer_id: string
  status: OrderStatus
  notes: string | null
  total: number
  payment_method_id: string | null
  discount_type: DiscountType | null
  discount_value: number
  pdf_path: string | null
  // O pedido já baixou o estoque? Vira true quando confirmado, false ao
  // cancelar/reabrir. Usado para reconciliar entradas/saídas.
  stock_committed: boolean
  // Entrega escolhida no pedido. `total` já inclui `delivery_fee`.
  delivery_method: DeliveryMethod
  delivery_fee: number
  delivery_address: DeliveryAddress | null
  delivery_quote: LalamoveQuote | null
  created_at: string
  updated_at: string
}

export type MelhorEnvioEnvironment = 'sandbox' | 'production'

export type MelhorEnvioAccount = {
  company_id: string
  environment: MelhorEnvioEnvironment
  access_token: string
  refresh_token: string
  expires_at: string
  connected_at: string
  updated_at: string
}

export type ShipmentStatus = 'cotado' | 'no_carrinho' | 'pago' | 'gerado' | 'cancelado'

export type Shipment = {
  id: string
  company_id: string
  order_id: string
  melhor_envio_id: string | null
  service_id: number | null
  service_name: string | null
  price: number | null
  status: ShipmentStatus
  tracking_code: string | null
  print_url: string | null
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
