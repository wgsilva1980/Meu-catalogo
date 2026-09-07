'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'
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
  SunIcon,
  MoonIcon,
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
  const pathname = usePathname()

  return (
    <aside className="w-full md:w-52 shrink-0 border-b md:border-b-0 md:border-r border-line bg-paper flex flex-col gap-2 p-3 md:p-4">
      <div className="flex items-center justify-between gap-2 md:block">
        <span className="font-display text-base md:text-lg px-2 md:pb-3 truncate">{companyName}</span>
        <div className="flex items-center gap-1 md:hidden shrink-0">
          <ThemeToggleButton dark={dark} onToggle={onToggleDark} />
          <SignOutButton className="text-xs font-semibold text-accent px-2" />
        </div>
      </div>

      <nav className="flex md:flex-col gap-1 flex-1 overflow-x-auto">
        {items.map((item) => {
          const active = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors ${
                active ? 'bg-accent/10 text-accent' : 'text-muted hover:bg-ink/5'
              }`}
            >
              <item.Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="hidden md:flex md:flex-col mt-auto pt-3 border-t border-line text-xs text-muted gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate">{email}</p>
          <ThemeToggleButton dark={dark} onToggle={onToggleDark} />
        </div>
        <SignOutButton className="font-semibold text-accent w-fit" />
      </div>
    </aside>
  )
}

function ThemeToggleButton({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={dark ? 'Usar tema claro' : 'Usar tema escuro'}
      aria-label={dark ? 'Usar tema claro' : 'Usar tema escuro'}
      className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-muted hover:bg-ink/5 hover:text-accent transition-colors"
    >
      {dark ? <SunIcon className="w-4 h-4" /> : <MoonIcon className="w-4 h-4" />}
    </button>
  )
}
