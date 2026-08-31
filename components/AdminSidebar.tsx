'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'

const items = [
  { href: '/admin', label: 'Painel' },
  { href: '/admin/produtos', label: 'Produtos' },
  { href: '/admin/estoque', label: 'Estoque' },
  { href: '/admin/categorias', label: 'Categorias' },
  { href: '/admin/clientes', label: 'Clientes' },
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/catalogo', label: 'Gerar catálogo' },
  { href: '/admin/configuracoes', label: 'Configurações' },
]

export default function AdminSidebar({ email, companyName }: { email: string; companyName: string }) {
  const pathname = usePathname()

  return (
    <aside className="w-full md:w-52 shrink-0 border-b md:border-b-0 md:border-r border-line bg-paper flex flex-col gap-2 p-3 md:p-4">
      <div className="flex items-center justify-between gap-2 md:block">
        <span className="font-display text-base md:text-lg px-2 md:pb-3 truncate">{companyName}</span>
        <SignOutButton className="md:hidden shrink-0 text-xs font-semibold text-accent px-2" />
      </div>

      <nav className="flex md:flex-col gap-1 flex-1 overflow-x-auto">
        {items.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ${
                active ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-black/5'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="hidden md:block mt-auto pt-3 border-t border-line text-xs text-muted">
        <p className="truncate">{email}</p>
        <SignOutButton className="mt-2 font-semibold text-accent" />
      </div>
    </aside>
  )
}
