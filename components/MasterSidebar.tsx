'use client'

import Sidebar from '@/components/Sidebar'
import { HomeIcon, CubeIcon } from '@/components/icons'

const items = [
  { href: '/master', label: 'Empresas', Icon: HomeIcon },
  { href: '/master/nova', label: 'Nova empresa', Icon: CubeIcon },
]

export default function MasterSidebar({ email }: { email: string }) {
  // Sem dark/onToggleDark de propósito — dark mode é escopo só do painel do
  // lojista (ver components/AdminThemeShell.tsx), então o botão de tema não
  // aparece aqui.
  return <Sidebar title="Painel master" email={email} items={items} />
}
