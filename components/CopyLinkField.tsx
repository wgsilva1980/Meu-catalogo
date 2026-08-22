'use client'

import { useState } from 'react'

export default function CopyLinkField({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <input readOnly value={url} className="input flex-1 min-w-0" onFocus={(e) => e.target.select()} />
      <button
        type="button"
        onClick={handleCopy}
        className="border border-line rounded-lg px-4 py-2 text-sm font-semibold whitespace-nowrap"
      >
        {copied ? 'Copiado!' : 'Copiar link'}
      </button>
    </div>
  )
}
