import { stopImpersonating } from '@/app/master/actions'

export default function ImpersonationBanner({ companyName }: { companyName: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <span>
        Modo suporte — gerenciando <strong>{companyName}</strong> como super-admin.
      </span>
      <form action={stopImpersonating}>
        <button type="submit" className="font-semibold underline shrink-0 whitespace-nowrap">
          Voltar ao painel master
        </button>
      </form>
    </div>
  )
}
