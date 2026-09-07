'use client'

import Sidebar from '@/components/Sidebar'
import {
  HomeIcon,
  CubeIcon,
  LayersIcon,
  TagIcon,
  UsersIcon,
  ClipboardIcon,
  CreditCardIcon,
  DocumentDownloadIcon,
  SlidersIcon,
} from '@/components/icons'

const items = [
  { href: '/admin', label: 'Painel', Icon: HomeIcon },
  { href: '/admin/produtos', label: 'Produtos', Icon: CubeIcon },
  { href: '/admin/estoque', label: 'Estoque', Icon: LayersIcon },
  { href: '/admin/categorias', label: 'Categorias', Icon: TagIcon },
  { href: '/admin/clientes', label: 'Clientes', Icon: UsersIcon },
  { href: '/admin/pedidos', label: 'Pedidos', Icon: ClipboardIcon },
  { href: '/admin/formas-pagamento', label: 'Formas de pagamento', Icon: CreditCardIcon },
  { href: '/admin/catalogo', label: 'Gerar catálogo', Icon: DocumentDownloadIcon },
  { href: '/admin/configuracoes', label: 'Configurações', Icon: SlidersIcon },
]

export default function AdminSidebar({
  email,
  companyName,
  dark,
  onToggleDark,
}: {
  email: string
  companyName: string
  dark: boolean
  onToggleDark: () => void
}) {
  return (
    <Sidebar title={companyName} email={email} items={items} dark={dark} onToggleDark={onToggleDark} />
  )
}
