// Validação compartilhada de uploads de imagem. O bucket é público e servido
// inline pelo Supabase, então um arquivo HTML/SVG com Content-Type controlado
// pelo cliente viraria XSS/phishing na origem do storage — daí a checagem de
// tipo real (magic bytes), a extensão vinda de uma allowlist e o Content-Type
// forçado pelo servidor.
const MAX_BYTES = 5 * 1024 * 1024

const SIGNATURES: { ext: string; mime: string; test: (b: Uint8Array) => boolean }[] = [
  { ext: 'jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: 'png',
    mime: 'image/png',
    test: (b) =>
      b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a,
  },
  {
    ext: 'gif',
    mime: 'image/gif',
    test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  },
  {
    ext: 'webp',
    mime: 'image/webp',
    test: (b) =>
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
]

export type ValidatedImage = {
  buffer: Buffer
  ext: string
  contentType: string
}

export async function validateImageUpload(file: File): Promise<
  { ok: true; value: ValidatedImage } | { ok: false; error: string; status: number }
> {
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'Arquivo muito grande (máx. 5 MB).', status: 413 }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const head = new Uint8Array(buffer.subarray(0, 16))
  const match = SIGNATURES.find((s) => s.test(head))
  if (!match) {
    return { ok: false, error: 'Envie uma imagem JPG, PNG, GIF ou WebP.', status: 415 }
  }

  return { ok: true, value: { buffer, ext: match.ext, contentType: match.mime } }
}
