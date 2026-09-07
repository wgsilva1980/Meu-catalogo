// Faixa de topo com logo + nome da loja, usada nas três telas públicas.
// Fase 2 ("Layout") do plano de redesign — antes disso não existia navbar
// nenhuma: cada página era uma ilha, um card centralizado sobre fundo
// cinza, com a logo repetida dentro do próprio card. Ver "Raio-X do
// Catálogo", seção 03 (hierarquia) e seção 11 (plano de redesign).
type HeaderCompany = {
  name: string
  logo_url: string | null
}

export default function StoreHeader({ company }: { company: HeaderCompany }) {
  return (
    <header className="bg-white border-b border-line">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-2.5">
        {company.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={company.logo_url} alt="" className="h-8 w-8 object-contain rounded shrink-0" />
        ) : null}
        <span className="font-display text-heading truncate">{company.name}</span>
      </div>
    </header>
  )
}
