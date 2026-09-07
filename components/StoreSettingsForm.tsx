'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { saveStoreSettings } from '@/app/admin/configuracoes/actions'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Alert from '@/components/Alert'
import type { Company } from '@/lib/types'

type ViaCepResponse = {
  erro?: boolean
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
}

// Fallback usado enquanto a lista de transportadoras do Melhor Envio não
// carrega (ex.: conta ainda não conectada).
const CARRIER_FALLBACK = [
  { id: 1, name: 'Correios' },
  { id: 2, name: 'Jadlog' },
  { id: 3, name: 'Azul Cargo' },
]

// Linha editável de caixa: números como string enquanto o usuário digita.
type BoxRow = { name: string; length_cm: string; width_cm: string; height_cm: string; max_weight_kg: string }

function initialBoxes(settings: Company): BoxRow[] {
  const list = settings.shipping_packages ?? []
  if (list.length > 0) {
    return list.map((b) => ({
      name: b.name ?? '',
      length_cm: b.length_cm != null ? String(b.length_cm) : '',
      width_cm: b.width_cm != null ? String(b.width_cm) : '',
      height_cm: b.height_cm != null ? String(b.height_cm) : '',
      max_weight_kg: b.max_weight_kg != null ? String(b.max_weight_kg) : '',
    }))
  }
  // Migração: se só existe a caixa padrão antiga, começa a lista com ela.
  if (settings.shipping_package_length_cm && settings.shipping_package_width_cm && settings.shipping_package_height_cm) {
    return [
      {
        name: 'Caixa padrão',
        length_cm: String(settings.shipping_package_length_cm),
        width_cm: String(settings.shipping_package_width_cm),
        height_cm: String(settings.shipping_package_height_cm),
        max_weight_kg: '',
      },
    ]
  }
  return []
}

export default function StoreSettingsForm({ settings }: { settings: Company }) {
  const [logoUrl, setLogoUrl] = useState(settings.logo_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)

  // Controlados + ressincronizados quando `settings` muda (após salvar +
  // revalidação), para o combo refletir o que está de fato no banco em vez de
  // "grudar" na escolha anterior. Se a migration_lalamove.sql ainda não rodou,
  // a coluna vem como undefined e mostramos um aviso.
  const lalamoveColumnMissing = (settings as { lalamove_enabled?: boolean }).lalamove_enabled === undefined
  const [lalamoveEnabled, setLalamoveEnabled] = useState(settings.lalamove_enabled ? 'on' : 'off')
  const [lalamoveServiceType, setLalamoveServiceType] = useState(settings.lalamove_service_type || 'MOTORCYCLE')
  useEffect(() => {
    setLalamoveEnabled(settings.lalamove_enabled ? 'on' : 'off')
    setLalamoveServiceType(settings.lalamove_service_type || 'MOTORCYCLE')
  }, [settings.lalamove_enabled, settings.lalamove_service_type])

  const [originZip, setOriginZip] = useState(settings.shipping_origin_zip_code ?? '')
  const [originStreet, setOriginStreet] = useState(settings.shipping_origin_street ?? '')
  const [originNeighborhood, setOriginNeighborhood] = useState(settings.shipping_origin_neighborhood ?? '')
  const [originCity, setOriginCity] = useState(settings.shipping_origin_city ?? '')
  const [originState, setOriginState] = useState(settings.shipping_origin_state ?? '')
  const [originCepStatus, setOriginCepStatus] = useState<'idle' | 'loading' | 'not-found' | 'error'>('idle')

  const [carriers, setCarriers] = useState<{ id: number; name: string }[]>(CARRIER_FALLBACK)
  const [agencyCarrier, setAgencyCarrier] = useState(
    settings.shipping_origin_carrier_id != null ? String(settings.shipping_origin_carrier_id) : '2'
  )
  const [agencyId, setAgencyId] = useState(
    settings.shipping_origin_agency_id != null ? String(settings.shipping_origin_agency_id) : ''
  )
  const [agencies, setAgencies] = useState<{ id: number; name: string; city: string }[]>([])
  const [agencyStatus, setAgencyStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  useEffect(() => {
    const ac = new AbortController()
    fetch('/api/melhor-envio/agencias', { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.carriers) && d.carriers.length > 0) {
          setCarriers(d.carriers)
          // Só troca automaticamente se não houver transportadora salva e a
          // atual não estiver na lista — nunca sobrescreve a escolha salva.
          if (settings.shipping_origin_carrier_id == null) {
            setAgencyCarrier((cur) =>
              d.carriers.some((c: { id: number }) => String(c.id) === cur) ? cur : String(d.carriers[0].id)
            )
          }
        }
      })
      .catch(() => {})
    return () => ac.abort()
  }, [])

  useEffect(() => {
    const cep = originZip.replace(/\D/g, '')
    const uf = originState.trim().toUpperCase()
    if (cep.length !== 8 && uf.length !== 2) {
      setAgencies([])
      setAgencyStatus('idle')
      return
    }
    const params = new URLSearchParams({ company: agencyCarrier })
    if (cep.length === 8) params.set('postal_code', cep)
    if (uf.length === 2) params.set('state', uf)
    const ac = new AbortController()
    setAgencyStatus('loading')
    fetch(`/api/melhor-envio/agencias?${params.toString()}`, { signal: ac.signal })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.agencies)) {
          setAgencies(d.agencies)
          setAgencyStatus('idle')
        } else {
          setAgencies([])
          setAgencyStatus('error')
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          setAgencies([])
          setAgencyStatus('error')
        }
      })
    return () => ac.abort()
  }, [agencyCarrier, originZip, originState])

  const [boxes, setBoxes] = useState<BoxRow[]>(() => initialBoxes(settings))

  function updateBox(index: number, patch: Partial<BoxRow>) {
    setBoxes((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }
  function addBox() {
    setBoxes((rows) => [...rows, { name: '', length_cm: '', width_cm: '', height_cm: '', max_weight_kg: '' }])
  }
  function removeBox(index: number) {
    setBoxes((rows) => rows.filter((_, i) => i !== index))
  }

  async function handleOriginZipChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setOriginZip(raw)

    const digits = raw.replace(/\D/g, '')
    if (digits.length !== 8) {
      setOriginCepStatus('idle')
      return
    }

    setOriginCepStatus('loading')
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data: ViaCepResponse = await res.json()
      if (data.erro) {
        setOriginCepStatus('not-found')
        return
      }
      setOriginStreet(data.logradouro ?? '')
      setOriginNeighborhood(data.bairro ?? '')
      setOriginCity(data.localidade ?? '')
      setOriginState(data.uf ?? '')
      setOriginCepStatus('idle')
    } catch {
      setOriginCepStatus('error')
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)

    const res = await fetch('/api/upload/logo', { method: 'POST', body: fd })
    const data = await res.json()
    if (data.url) setLogoUrl(data.url)
    setUploading(false)
  }

  async function handleSubmit(formData: FormData) {
    await saveStoreSettings(formData)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-5">
      <input type="hidden" name="logo_url" value={logoUrl} />

      {/* Logo */}
      <Card as="section" tight className="flex flex-col gap-3">
        <h2 className="text-sm font-bold">Logo da loja</h2>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-24 h-24 border border-dashed border-line rounded-lg overflow-hidden bg-paper flex items-center justify-center text-muted text-xs text-center p-2 shrink-0">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              'Sem logo'
            )}
          </div>
          <div className="flex flex-col gap-1">
            <input
              type="file"
              accept="image/*"
              className="text-xs"
              onChange={handleLogoChange}
              disabled={uploading}
            />
            {uploading && <span className="text-xs text-muted">Enviando...</span>}
            <span className="text-xs text-muted">JPG ou PNG. Recomendado: fundo transparente (PNG).</span>
          </div>
        </div>
      </Card>

      {/* Dados da loja */}
      <Card as="section" tight className="flex flex-col gap-3">
        <h2 className="text-sm font-bold">Dados da loja</h2>

        <Field label="Nome da loja">
          <input name="name" defaultValue={settings.name} required className="input" />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Telefone / WhatsApp">
            <input name="phone" defaultValue={settings.phone ?? ''} placeholder="(00) 00000-0000" className="input" />
          </Field>
          <Field label="E-mail da loja">
            <input name="email" type="email" defaultValue={settings.email ?? ''} placeholder="voce@exemplo.com" className="input" />
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted">
          Recebe os avisos de novos cadastros e pedidos, e é o remetente das etiquetas do Melhor Envio.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Instagram">
            <input name="instagram" defaultValue={settings.instagram ?? ''} placeholder="@loja" className="input" />
          </Field>
          <Field label="Website">
            <input name="website" defaultValue={settings.website ?? ''} placeholder="https://..." className="input" />
          </Field>
        </div>
      </Card>

      {/* Endereço da loja */}
      <Card as="section" tight className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-bold">Endereço da loja</h2>
          <p className="text-xs text-muted">
            Endereço de origem usado para calcular frete e gerar etiquetas no Melhor Envio.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nome/Razão social do remetente">
            <input name="shipping_origin_name" defaultValue={settings.shipping_origin_name ?? ''} className="input" />
          </Field>
          <Field label="CPF/CNPJ do remetente">
            <input name="shipping_origin_document" defaultValue={settings.shipping_origin_document ?? ''} className="input" />
          </Field>
        </div>

        <div className="flex items-end gap-3">
          <Field label="CEP">
            <input
              name="shipping_origin_zip_code"
              value={originZip}
              onChange={handleOriginZipChange}
              placeholder="00000-000"
              inputMode="numeric"
              maxLength={9}
              className="input max-w-[10rem]"
            />
          </Field>
          <span role="status" aria-live="polite">
            {originCepStatus === 'loading' && <span className="text-xs text-muted pb-2">Buscando endereço...</span>}
            {originCepStatus === 'not-found' && <span className="text-xs text-red-600 pb-2">CEP não encontrado.</span>}
            {originCepStatus === 'error' && <span className="text-xs text-red-600 pb-2">Falha ao buscar o CEP.</span>}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem] gap-3">
          <Field label="Rua">
            <input name="shipping_origin_street" value={originStreet} onChange={(e) => setOriginStreet(e.target.value)} className="input" />
          </Field>
          <Field label="Número">
            <input name="shipping_origin_number" defaultValue={settings.shipping_origin_number ?? ''} className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Complemento">
            <input name="shipping_origin_complement" defaultValue={settings.shipping_origin_complement ?? ''} className="input" />
          </Field>
          <Field label="Bairro">
            <input
              name="shipping_origin_neighborhood"
              value={originNeighborhood}
              onChange={(e) => setOriginNeighborhood(e.target.value)}
              className="input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Field label="Cidade">
            <input name="shipping_origin_city" value={originCity} onChange={(e) => setOriginCity(e.target.value)} className="input" />
          </Field>
          <Field label="UF">
            <input
              name="shipping_origin_state"
              value={originState}
              onChange={(e) => setOriginState(e.target.value.toUpperCase())}
              maxLength={2}
              className="input"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-3">
          <Field label="Transportadora">
            <select
              name="shipping_origin_carrier_id"
              value={agencyCarrier}
              onChange={(e) => {
                setAgencyCarrier(e.target.value)
                // A agência pertence a uma transportadora específica; ao trocar
                // a transportadora, a agência anterior deixa de valer.
                setAgencyId('')
              }}
              className="input"
            >
              {carriers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Agência de postagem">
            <select
              name="shipping_origin_agency_id"
              value={agencyId}
              onChange={(e) => setAgencyId(e.target.value)}
              className="input"
            >
              <option value="">— Nenhuma —</option>
              {agencyId && !agencies.some((a) => String(a.id) === agencyId) && (
                <option value={agencyId}>Agência {agencyId} (salva)</option>
              )}
              {agencies.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.city ? ` — ${a.city}` : ''} (#{a.id})
                </option>
              ))}
            </select>
          </Field>
        </div>
        <p className="-mt-2 text-xs text-muted">
          {agencyStatus === 'loading' && 'Carregando agências do Melhor Envio…'}
          {agencyStatus === 'error' &&
            'Não foi possível carregar as agências. Conecte o Melhor Envio e confira o CEP/UF acima.'}
          {agencyStatus === 'idle' &&
            'Obrigatório para Jadlog e Azul. A lista vem do Melhor Envio pelo CEP do endereço acima (as mais próximas primeiro). Correios não usa agência — deixe em “Nenhuma”.'}
        </p>

        <div className="flex flex-col gap-3 border-t border-line pt-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-muted">Caixas de envio</h3>
            <button type="button" onClick={addBox} className="text-xs font-semibold text-accent">
              + Adicionar caixa
            </button>
          </div>
          <input type="hidden" name="shipping_packages" value={JSON.stringify(boxes)} />

          {boxes.length === 0 && (
            <p className="text-xs text-muted">Nenhuma caixa cadastrada. Adicione ao menos uma para calcular frete e gerar etiquetas.</p>
          )}

          {boxes.map((box, i) => (
            <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_4rem_4rem_4rem_5rem_2rem] gap-2 items-end">
              <Field label={i === 0 ? 'Nome' : ''}>
                <input
                  value={box.name}
                  onChange={(e) => updateBox(i, { name: e.target.value })}
                  placeholder={`Caixa ${i + 1}`}
                  className="input"
                />
              </Field>
              <Field label={i === 0 ? 'C (cm)' : ''}>
                <input
                  value={box.length_cm}
                  onChange={(e) => updateBox(i, { length_cm: e.target.value })}
                  inputMode="decimal"
                  className="input"
                />
              </Field>
              <Field label={i === 0 ? 'L (cm)' : ''}>
                <input
                  value={box.width_cm}
                  onChange={(e) => updateBox(i, { width_cm: e.target.value })}
                  inputMode="decimal"
                  className="input"
                />
              </Field>
              <Field label={i === 0 ? 'A (cm)' : ''}>
                <input
                  value={box.height_cm}
                  onChange={(e) => updateBox(i, { height_cm: e.target.value })}
                  inputMode="decimal"
                  className="input"
                />
              </Field>
              <Field label={i === 0 ? 'Peso máx (kg)' : ''}>
                <input
                  value={box.max_weight_kg}
                  onChange={(e) => updateBox(i, { max_weight_kg: e.target.value })}
                  placeholder="—"
                  inputMode="decimal"
                  className="input"
                />
              </Field>
              <button
                type="button"
                onClick={() => removeBox(i)}
                aria-label="Remover caixa"
                className="input flex items-center justify-center text-red-600 font-bold"
              >
                ×
              </button>
            </div>
          ))}
          <p className="text-xs text-muted">
            O sistema escolhe a menor caixa em que o pedido caiba e gera uma única etiqueta, com o peso
            somado de todos os produtos. Peso máximo é opcional. Os produtos precisam ter peso e dimensões
            cadastrados.
          </p>
        </div>
      </Card>

      {/* Motoboy (Lalamove) */}
      <Card as="section" tight className="flex flex-col gap-3">
        <div>
          <h2 className="text-sm font-bold">Entrega por motoboy (Lalamove)</h2>
          <p className="text-xs text-muted">
            Quando ligado, o link público de pedido oferece "Motoboy" como forma de entrega e cota o
            valor pela API da Lalamove usando o endereço da loja acima. As credenciais são
            configuradas pela plataforma (variáveis de ambiente <code>LALAMOVE_*</code>).
          </p>
        </div>
        {lalamoveColumnMissing && (
          <Alert variant="warning" size="sm">
            Esta opção ainda não pode ser salva neste ambiente: rode a migration
            <code> supabase/migration_lalamove.sql</code> no Supabase.
          </Alert>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Oferecer motoboy no link de pedido">
            <select
              name="lalamove_enabled"
              value={lalamoveEnabled}
              onChange={(e) => setLalamoveEnabled(e.target.value)}
              className="input"
            >
              <option value="off">Não</option>
              <option value="on">Sim</option>
            </select>
          </Field>
          <Field label="Tipo de veículo">
            <select
              name="lalamove_service_type"
              value={lalamoveServiceType}
              onChange={(e) => setLalamoveServiceType(e.target.value)}
              className="input"
            >
              <option value="MOTORCYCLE">Moto (motoboy)</option>
              <option value="CAR">Carro</option>
              <option value="SEDAN">Sedã</option>
              <option value="VAN">Van</option>
            </select>
          </Field>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3 justify-end">
        {saved && <span className="text-xs text-green-600 font-semibold">Salvo com sucesso!</span>}
        <Button type="submit" className="px-5">
          Salvar configurações
        </Button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
      {label}
      {children}
    </label>
  )
}
