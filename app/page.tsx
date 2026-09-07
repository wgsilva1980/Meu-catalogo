import Button from '@/components/Button'

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-6">
      <span className="text-xs uppercase tracking-widest text-accent font-bold">Catálogo & Pedidos</span>
      <h1 className="font-display text-display">Meu Catalogo</h1>
      <p className="text-muted max-w-sm text-sm leading-relaxed">
        Monte seu catálogo, receba pedidos e acompanhe pagamento e entrega — sem planilha.
      </p>
      <Button href="/login" className="px-5 py-3">
        Acessar painel
      </Button>
      <p className="text-xs text-muted mt-4">© {new Date().getFullYear()} Meu Catalogo</p>
    </main>
  )
}
