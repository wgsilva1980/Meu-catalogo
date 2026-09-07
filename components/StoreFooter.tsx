// Rodapé mínimo pras três telas públicas (cadastro, pedido, acompanhamento).
// Nenhuma delas tinha rodapé — se o cliente tivesse uma dúvida antes de
// comprar, não havia pra onde ir a não ser fechar a aba. Ver "Raio-X do
// Catálogo", achado P3.
type FooterCompany = {
  name: string
  phone: string | null
  email: string | null
  instagram: string | null
  website: string | null
}

function normalizeWebsite(website: string) {
  return /^https?:\/\//.test(website) ? website : `https://${website}`
}

function normalizeInstagramHandle(instagram: string) {
  return instagram
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '')
    .replace(/\/+$/, '')
}

export default function StoreFooter({ company }: { company: FooterCompany }) {
  const instagramHandle = company.instagram ? normalizeInstagramHandle(company.instagram) : null
  const hasContact = company.phone || company.email || instagramHandle || company.website
  if (!hasContact) return null

  return (
    <footer className="mt-8 text-center text-xs text-muted flex flex-col items-center gap-1.5">
      <p className="font-semibold text-ink">{company.name}</p>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {company.phone && <span>{company.phone}</span>}
        {company.email && (
          <a href={`mailto:${company.email}`} className="hover:text-accent">
            {company.email}
          </a>
        )}
        {instagramHandle && (
          <a
            href={`https://instagram.com/${instagramHandle}`}
            target="_blank"
            rel="noreferrer"
            className="hover:text-accent"
          >
            @{instagramHandle}
          </a>
        )}
        {company.website && (
          <a href={normalizeWebsite(company.website)} target="_blank" rel="noreferrer" className="hover:text-accent">
            {company.website}
          </a>
        )}
      </div>
    </footer>
  )
}
