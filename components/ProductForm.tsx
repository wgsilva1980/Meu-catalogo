'use client'

import { useRef, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'
import { saveProduct } from '@/app/admin/produtos/actions'
import type { Category, Product } from '@/lib/types'

async function resizeIfNeeded(blob: Blob, maxDimension = 2000): Promise<Blob> {
  const img = await createImageBitmap(blob)
  if (img.width <= maxDimension && img.height <= maxDimension) return blob
  const scale = maxDimension / Math.max(img.width, img.height)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(img.width * scale)
  canvas.height = Math.round(img.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível preparar a imagem')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Não foi possível redimensionar a imagem'))),
      'image/jpeg',
      0.92
    )
  })
}

// Quando a foto original traz o produto ao lado de outros elementos (ex: tabela
// nutricional), a remoção de fundo preserva ambos, pois nenhum dos dois é "fundo".
// Aqui isolamos apenas o maior objeto encontrado (o produto) e recortamos a imagem
// exatamente no contorno dele, descartando qualquer margem/objeto secundário.
async function isolateAndCropToProduct(blob: Blob): Promise<Blob> {
  const img = await createImageBitmap(blob)
  const { width, height } = img
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível preparar a imagem')
  ctx.drawImage(img, 0, 0)

  const imageData = ctx.getImageData(0, 0, width, height)
  const { data } = imageData
  const ALPHA_THRESHOLD = 20
  const pixelCount = width * height
  const labels = new Int32Array(pixelCount).fill(-1)
  const sizes: number[] = []
  const stack = new Int32Array(pixelCount)

  for (let start = 0; start < pixelCount; start++) {
    if (labels[start] !== -1 || data[start * 4 + 3] <= ALPHA_THRESHOLD) continue

    const label = sizes.length
    let size = 0
    let stackLen = 0
    stack[stackLen++] = start
    labels[start] = label

    while (stackLen > 0) {
      const idx = stack[--stackLen]
      size++
      const x = idx % width
      const y = (idx / width) | 0

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue
          const nIdx = ny * width + nx
          if (labels[nIdx] !== -1 || data[nIdx * 4 + 3] <= ALPHA_THRESHOLD) continue
          labels[nIdx] = label
          stack[stackLen++] = nIdx
        }
      }
    }
    sizes.push(size)
  }

  if (sizes.length === 0) return blob

  let largestLabel = 0
  for (let i = 1; i < sizes.length; i++) {
    if (sizes[i] > sizes[largestLabel]) largestLabel = i
  }

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let i = 0; i < pixelCount; i++) {
    if (labels[i] === largestLabel) {
      const x = i % width
      const y = (i / width) | 0
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    } else {
      data[i * 4 + 3] = 0
    }
  }

  ctx.putImageData(imageData, 0, 0)

  const boxWidth = maxX - minX + 1
  const boxHeight = maxY - minY + 1
  const cropCanvas = document.createElement('canvas')
  cropCanvas.width = boxWidth
  cropCanvas.height = boxHeight
  const cropCtx = cropCanvas.getContext('2d')
  if (!cropCtx) throw new Error('Não foi possível recortar a imagem')
  cropCtx.drawImage(canvas, minX, minY, boxWidth, boxHeight, 0, 0, boxWidth, boxHeight)

  return new Promise((resolve, reject) => {
    cropCanvas.toBlob((result) => (result ? resolve(result) : reject(new Error('Não foi possível isolar o produto'))), 'image/png')
  })
}

async function squareOnWhite(blob: Blob, targetSize = 1400, marginRatio = 0.04): Promise<Blob> {
  const img = await createImageBitmap(blob)
  const canvas = document.createElement('canvas')
  canvas.width = targetSize
  canvas.height = targetSize
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível preparar a imagem')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetSize, targetSize)

  const maxContentSize = targetSize * (1 - marginRatio * 2)
  const scale = Math.min(maxContentSize / img.width, maxContentSize / img.height)
  const drawWidth = img.width * scale
  const drawHeight = img.height * scale
  ctx.drawImage(img, (targetSize - drawWidth) / 2, (targetSize - drawHeight) / 2, drawWidth, drawHeight)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => (result ? resolve(result) : reject(new Error('Não foi possível gerar a imagem final'))),
      'image/jpeg',
      0.95
    )
  })
}

export default function ProductForm({ categories, product }: { categories: Category[]; product?: Product }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [imageUrl, setImageUrl] = useState(product?.image_url ?? '')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const [name, setName] = useState(product?.name ?? '')
  const [brand, setBrand] = useState(product?.brand ?? '')
  const [categoryId, setCategoryId] = useState(product?.category_id ?? categories[0]?.id ?? '')
  const [shortDescription, setShortDescription] = useState(product?.short_description ?? '')

  const busy = status !== null

  async function processImage(file: File) {
    setError(null)
    try {
      setStatus('Removendo fundo da imagem...')
      const resized = await resizeIfNeeded(file)
      const { removeBackground } = await import('@imgly/background-removal')
      const noBgBlob = await removeBackground(resized)

      setStatus('Isolando o produto...')
      const isolatedBlob = await isolateAndCropToProduct(noBgBlob)

      setStatus('Ajustando para formato quadrado...')
      const squaredBlob = await squareOnWhite(isolatedBlob)
      const squaredFile = new File([squaredBlob], 'produto.jpg', { type: 'image/jpeg' })

      setStatus('Enviando imagem...')
      const uploadFd = new FormData()
      uploadFd.append('file', squaredFile)
      const uploadRes = await fetch('/api/upload/produto', { method: 'POST', body: uploadFd })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok || !uploadData.url) {
        throw new Error(uploadData.error || 'Falha ao enviar imagem')
      }
      setImageUrl(uploadData.url)

      setStatus('Identificando produto...')
      const aiFd = new FormData()
      aiFd.append('file', squaredFile)
      aiFd.append('categories', JSON.stringify(categories.map((c) => ({ id: c.id, name: c.name }))))
      const aiRes = await fetch('/api/produtos/reconhecer', { method: 'POST', body: aiFd })
      const aiData = await aiRes.json()
      if (aiRes.ok) {
        if (aiData.name) setName(aiData.name)
        if (aiData.brand) setBrand(aiData.brand)
        if (aiData.category_id) setCategoryId(aiData.category_id)
        if (aiData.short_description) setShortDescription(aiData.short_description)
      } else {
        console.error('Falha ao identificar produto', aiRes.status, aiData)
        const reason = aiData.error ? ` (${aiData.error})` : ''
        setError(`Imagem processada, mas não foi possível identificar o produto automaticamente${reason}. Preencha os campos abaixo.`)
      }
    } catch (err) {
      console.error(err)
      setError('Não foi possível processar a imagem automaticamente. Tente outra foto ou preencha os campos manualmente.')
    } finally {
      setStatus(null)
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processImage(file)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (busy) return
    const file = e.dataTransfer.files?.[0]
    if (file) processImage(file)
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (!busy) setDragOver(true)
  }

  function handleDragLeave() {
    setDragOver(false)
  }

  return (
    <form action={saveProduct} className="grid md:grid-cols-[220px_1fr] gap-6 max-w-3xl">
      {product && <input type="hidden" name="id" value={product.id} />}
      <input type="hidden" name="image_url" value={imageUrl} />

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-muted">Imagem do produto</label>
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !busy && fileInputRef.current?.click()}
          className={`aspect-square border border-dashed rounded-lg overflow-hidden bg-paper flex items-center justify-center text-muted text-xs text-center p-3 transition-colors ${
            busy ? 'cursor-wait' : 'cursor-pointer'
          } ${dragOver ? 'border-accent bg-accent/5' : 'border-line'}`}
        >
          {busy ? (
            <span>{status}</span>
          ) : imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="" className="w-full h-full object-contain" />
          ) : (
            <span>Toque para escolher uma foto, ou arraste um arquivo aqui (JPG ou PNG).<br />O fundo é removido e a imagem é ajustada automaticamente.</span>
          )}
        </div>

        {/* input "geral": no desktop abre o seletor de arquivos; no celular o próprio
            sistema já costuma oferecer "Câmera" como opção nesse seletor */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileInput}
          disabled={busy}
        />
        {/* input dedicado com `capture`: força a abertura direta da câmera no
            celular, sem passar pela galeria — garante o atalho mesmo em
            navegadores/aparelhos onde o input geral não oferece essa opção */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileInput}
          disabled={busy}
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={busy}
            className="border border-line rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            📷 Tirar foto
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="border border-line rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            Escolher arquivo
          </button>
        </div>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>

      <div className="flex flex-col gap-3">
        <Field label="Nome do produto">
          <input name="name" value={name} onChange={(e) => setName(e.target.value)} required className="input" />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Marca">
            <input name="brand" value={brand} onChange={(e) => setBrand(e.target.value)} required className="input" />
          </Field>
          <Field label="Categoria">
            <select name="category_id" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required className="input">
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Descrição curta">
          <textarea
            name="short_description"
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            required
            className="input h-20"
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Preço (R$)">
            <input name="price" type="number" step="0.01" min="0" defaultValue={product?.price} required className="input" />
          </Field>
          <Field label="Promoção">
            <input name="promo_note" defaultValue={product?.promo_note ?? ''} placeholder="opcional" className="input" />
          </Field>
          <Field label="Disponibilidade">
            <select name="available" defaultValue={product?.available === false ? 'off' : 'on'} className="input">
              <option value="on">Disponível</option>
              <option value="off">Indisponível</option>
            </select>
          </Field>
        </div>

        <section className="flex flex-col gap-3 border border-line rounded-xl p-4">
          <div>
            <h2 className="text-sm font-bold">Envio</h2>
            <p className="text-xs text-muted">Usado no futuro para calcular o frete. Deixe em branco se ainda não souber.</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Field label="Peso (kg)">
              <input name="weight_kg" type="number" step="0.001" min="0" defaultValue={product?.weight_kg ?? ''} placeholder="0,300" className="input" />
            </Field>
            <Field label="Comprimento (cm)">
              <input name="length_cm" type="number" step="0.1" min="0" defaultValue={product?.length_cm ?? ''} className="input" />
            </Field>
            <Field label="Largura (cm)">
              <input name="width_cm" type="number" step="0.1" min="0" defaultValue={product?.width_cm ?? ''} className="input" />
            </Field>
            <Field label="Altura (cm)">
              <input name="height_cm" type="number" step="0.1" min="0" defaultValue={product?.height_cm ?? ''} className="input" />
            </Field>
          </div>
        </section>

        <div className="flex flex-wrap gap-2 justify-end mt-2">
          <a href="/admin/produtos" className="border border-line rounded-lg px-4 py-2 text-sm font-semibold">Cancelar</a>
          <button type="submit" className="bg-accent text-white rounded-lg px-4 py-2 text-sm font-bold">Salvar produto</button>
        </div>
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
