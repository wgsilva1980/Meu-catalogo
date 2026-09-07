export function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
      />
    </svg>
  )
}

export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  )
}

// Ícones do menu do painel (components/AdminSidebar.tsx) — antes disso o
// sistema de ícones inteiro do produto tinha só lápis e lixeira, e a sidebar
// era puro texto. Ver "Raio-X do Catálogo", achado P2.
export function HomeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </svg>
  )
}

export function CubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7l8 4 8-4M12 11v10" />
    </svg>
  )
}

export function LayersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 3 8l9 5 9-5-9-5Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9 5 9-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16l9 5 9-5" />
    </svg>
  )
}

export function TagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.05 3H5a2 2 0 0 0-2 2v6.05a2 2 0 0 0 .586 1.414l8.95 8.95a2 2 0 0 0 2.828 0l6.05-6.05a2 2 0 0 0 0-2.828l-8.95-8.95A2 2 0 0 0 11.05 3Z"
      />
      <circle cx="7.5" cy="8.5" r="1.25" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function UsersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.75 20a6.25 6.25 0 0 1 12.5 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 11a3 3 0 1 0 0-6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.25 14.1a6.25 6.25 0 0 1 4.997 5.9" />
    </svg>
  )
}

export function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 4.5h6a1 1 0 0 1 1 1V6h1.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1H8v-.5a1 1 0 0 1 1-1Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h6M9 12.5h6M9 16h4" />
    </svg>
  )
}

export function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 6.75h16.5a1 1 0 0 1 1 1v8.5a1 1 0 0 1-1 1H3.75a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.75 10.5h18.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 14.25h4" />
    </svg>
  )
}

export function DocumentDownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 3.5h6l4 4v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3.5V8h4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11v6m0 0-2.25-2.25M12 17l2.25-2.25" />
    </svg>
  )
}

export function SlidersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} aria-hidden="true">
      <path strokeLinecap="round" d="M3 6h18M3 12h18M3 18h18" />
      <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
      <circle cx="7" cy="18" r="2" fill="currentColor" stroke="none" />
    </svg>
  )
}
