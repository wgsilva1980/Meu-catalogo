'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { saveStoreSettings } from '@/app/admin/configuracoes/actions'
import type { Company } from '@/lib/types'

type ViaCepResponse = {
  erro?: boolean
  logradouro?: string
  bairro?: string
  localidade?: string
  uf?: string
}

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

  const [originZip, setOriginZip] = useState(settings.shipping_origin_zip_code ?? '')
  const [originStreet, setOriginStreet] = useState(settings.shipping_origin_street ?? '')
  const [originNeighborhood, setOriginNeighborhood] = useState(settings.shipping_origin_neighborhood ?? '')
  const [originCity, setOriginCity] = useState(settings.shipping_origin_city ?? '')
  const [originState, setOriginState] = useState(settings.shipping_origin_state ?? '')
  const [originCepStatus, setOriginCepStatus] = useState<'idle' | 'loading' | 'not-found' | 'error'>('idle')

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
      <section className="flex flex-col gap-3 border border-line rounded-xl p-4">
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
      </section>

      {/* Dados da loja */}
      <section className="flex flex-col gap-3 border border-line rounded-xl p-4">
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
      </section>

      {/* Endereço da loja */}
      <section className="flex flex-col gap-3 border border-line rounded-xl p-4">
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
          {originCepStatus === 'loading' && <span className="text-xs text-muted pb-2">Buscando endereço...</span>}
          {originCepStatus === 'not-found' && <span className="text-xs text-red-600 pb-2">CEP não encontrado.</span>}
          {originCepStatus === 'error' && <span className="text-xs text-red-600 pb-2">Falha ao buscar o CEP.</span>}
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

        <Field label="ID da agência Jadlog/Azul">
          <input
            name="shipping_origin_agency_id"
            defaultValue={settings.shipping_origin_agency_id ?? ''}
            placeholder="Ex.: 25"
            inputMode="numeric"
            className="input max-w-[10rem]"
          />
        </Field>
        <p className="-mt-2 text-xs text-muted">
          Obrigatório para gerar etiquetas Jadlog e Azul (essas transportadoras exigem uma agência de
          postagem). Pegue o ID no painel do Melhor Envio em Configurações → Agências. Correios não usa
          agência — pode deixar em branco.
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
      </section>

      <div className="flex flex-wrap items-center gap-3 justify-end">
        {saved && <span className="text-xs text-green-600 font-semibold">Salvo com sucesso!</span>}
        <button type="submit" className="bg-accent text-white rounded-lg px-5 py-2 text-sm font-bold">
          Salvar configurações
        </button>
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
