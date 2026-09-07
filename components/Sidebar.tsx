'use client'

import { useEffect, useState, type ComponentType } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import SignOutButton from '@/components/SignOutButton'
import { SunIcon, MoonIcon, MenuIcon, XIcon } from '@/components/icons'

export type SidebarItem = {
  href: string
  label: string
  Icon: ComponentType<{ className?: string }>
}

// Base compartilhada por AdminSidebar (painel do lojista) e MasterSidebar
// (super-admin) — até a "Raio-X do Catálogo II" (achado P1), as duas eram
// cópias que foram divergindo: MasterSidebar tinha ficado sem ícone, sem
// transição e sem dark mode porque nunca recebia as melhorias feitas na
// outra. Só a lista de itens (e o dark mode, opcional) varia por painel.
export default function Sidebar({
  title,
  email,
  items,
  dark,
  onToggleDark,
}: {
  title: string
  email: string
  items: SidebarItem[]
  // Omitido em /master de propósito — dark mode é escopo só do painel do
  // lojista (ver components/AdminThemeShell.tsx). Quando ausente, o botão
  // de tema simplesmente não aparece nesta sidebar.
  dark?: boolean
  onToggleDark?: () => void
}) {
  const pathname = usePathname()
  const showThemeToggle = onToggleDark !== undefined

  // No mobile, a lista de itens virava uma linha horizontal com scroll —
  // dava pra escanear, mas não era um menu de verdade (achado P2 da
  // segunda auditoria). Agora fica escondida atrás de um botão de
  // hambúrguer, como um menu de verdade, e fecha sozinha ao navegar.
  const [mobileOpen, setMobileOpen] = useState(false)
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <aside className="w-full md:w-52 shrink-0 border-b md:border-b-0 md:border-r border-line bg-paper flex flex-col p-3 md:p-4 md:gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-base md:text-lg md:px-2 md:pb-3 truncate">{title}</span>
        <div className="flex items-center gap-1 md:hidden shrink-0">
          {showThemeToggle && <ThemeToggleButton dark={Boolean(dark)} onToggle={onToggleDark} />}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label={mobileOpen ? 'Fechar menu' : 'Abrir menu'}
            className="w-8 h-8 flex items-center justify-center rounded-md text-muted hover:bg-ink/5 hover:text-accent transition-colors"
          >
            {mobileOpen ? <XIcon className="w-4.5 h-4.5" /> : <MenuIcon className="w-4.5 h-4.5" />}
          </button>
        </div>
      </div>

      <nav
        className={`${mobileOpen ? 'flex' : 'hidden'} md:flex flex-col gap-1 flex-1 mt-2 md:mt-0`}
      >
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

      <div
        className={`${mobileOpen ? 'flex' : 'hidden'} md:flex md:flex-col mt-2 md:mt-auto pt-3 border-t border-line text-xs text-muted gap-2`}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="truncate">{email}</p>
          <div className="hidden md:block">{showThemeToggle && <ThemeToggleButton dark={Boolean(dark)} onToggle={onToggleDark} />}</div>
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
