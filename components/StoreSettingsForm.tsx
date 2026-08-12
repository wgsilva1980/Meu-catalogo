'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { saveStoreSettings } from '@/app/admin/configuracoes/actions'
import type { Company } from '@/lib/types'

export default function StoreSettingsForm({ settings }: { settings: Company }) {
  const [logoUrl, setLogoUrl] = useState(settings.logo_url ?? '')
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)

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
        <div className="flex items-center gap-4">
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

        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefone">
            <input name="phone" defaultValue={settings.phone ?? ''} placeholder="(00) 00000-0000" className="input" />
          </Field>
          <Field label="WhatsApp">
            <input name="whatsapp" defaultValue={settings.whatsapp ?? ''} placeholder="(00) 00000-0000" className="input" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
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

      <div className="flex items-center gap-3 justify-end">
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
