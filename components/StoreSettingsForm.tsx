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
          <Field label="Telefone">
            <input name="phone" defaultValue={settings.phone ?? ''} placeholder="(00) 00000-0000" className="input" />
          </Field>
          <Field label="WhatsApp">
            <input name="whatsapp" defaultValue={settings.whatsapp ?? ''} placeholder="(00) 00000-0000" className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Instagram">
            <input name="instagram" defaultValue={settings.instagram ?? ''} placeholder="@loja" className="input" />
          </Field>
          <Field label="Website">
            <input name="website" defaultValue={settings.website ?? ''} placeholder="https://..." className="input" />
          </Field>
        </div>

        <Field label="Endereço">
          <textarea name="address" defaultValue={settings.address ?? ''} placeholder="Rua, número, bairro, cidade" className="input h-16" />
        </Field>
      </section>

      {/* Endereço de origem para frete */}
      <section className="flex flex-col gap-3 border border-line rounded-xl p-4">
        <div>
          <h2 className="text-sm font-bold">Endereço de origem para envios</h2>
          <p className="text-xs text-muted">Usado para calcular frete e gerar etiquetas no Melhor Envio.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nome/Razão social do remetente">
            <input name="shipping_origin_name" defaultValue={settings.shipping_origin_name ?? ''} className="input" />
          </Field>
          <Field label="CPF/CNPJ do remetente">
            <input name="shipping_origin_document" defaultValue={settings.shipping_origin_document ?? ''} className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Telefone">
            <input name="shipping_origin_phone" defaultValue={settings.shipping_origin_phone ?? ''} placeholder="(00) 00000-0000" className="input" />
          </Field>
          <Field label="E-mail">
            <input name="shipping_origin_email" type="email" defaultValue={settings.shipping_origin_email ?? ''} className="input" />
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
      </section>

      {/* Notificações */}
      <section className="flex flex-col gap-3 border border-line rounded-xl p-4">
        <h2 className="text-sm font-bold">Notificações por e-mail</h2>
        <p className="text-xs text-muted">
          Receba um e-mail sempre que um cliente se cadastrar ou enviar um pedido pelo link público.
        </p>
        <Field label="E-mail para receber notificações">
          <input
            name="notification_email"
            type="email"
            defaultValue={settings.notification_email ?? ''}
            placeholder="voce@exemplo.com"
            className="input max-w-xs"
          />
        </Field>
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
