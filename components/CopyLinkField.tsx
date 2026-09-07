'use client'

import { useState } from 'react'
import Button from '@/components/Button'

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
      <Button type="button" onClick={handleCopy} variant="secondary" className="whitespace-nowrap">
        {copied ? 'Copiado!' : 'Copiar link'}
      </Button>
    </div>
  )
}
