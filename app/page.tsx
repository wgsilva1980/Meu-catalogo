import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
      <span className="text-xs uppercase tracking-widest text-accent font-bold">Sistema interno</span>
      <h1 className="font-display text-4xl">Meu Catalogo</h1>
      <p className="text-muted max-w-sm text-sm leading-relaxed">
        Gerador de catálogos em PDF para a equipe comercial enviar aos clientes.
      </p>
      <Link href="/login" className="bg-accent text-white rounded-lg px-5 py-3 text-sm font-bold">
        Acessar painel
      </Link>
      <p className="text-xs text-muted mt-4">© {new Date().getFullYear()} Meu Catalogo</p>
    </main>
  )
}
