export default function DocumentLookupForm({ slug }: { slug: string }) {
  return (
    <div className="flex flex-col gap-3">
      <form className="flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
          CPF
          <input
            name="documento"
            placeholder="000.000.000-00"
            inputMode="numeric"
            className="input"
          />
        </label>
        <p className="text-xs text-muted">
          Informe seu CPF para localizarmos seu cadastro, se já tiver um.
        </p>
        <button type="submit" className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-bold">
          Continuar
        </button>
      </form>
      <a href={`/pedido/${slug}?documento=skip`} className="text-xs text-muted underline text-center">
        Não tenho CPF, continuar sem informar
      </a>
    </div>
  )
}
