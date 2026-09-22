export async function launchBrowser() {
  if (process.env.NODE_ENV === 'development') {
    const puppeteer = (await import('puppeteer')).default
    return puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] })
  }
  const chromium = (await import('@sparticuz/chromium')).default
  const puppeteer = (await import('puppeteer-core')).default
  return puppeteer.launch({
    args: chromium.args,
    executablePath: await chromium.executablePath(),
    headless: true,
  })
}

// Renderiza HTML para PDF em um navegador headless endurecido: JavaScript
// desligado e apenas imagens http(s) podem ser carregadas — qualquer outra
// requisição de sub-recurso (scripts, fetch, iframes) é abortada. Isso limita
// o estrago caso texto não escapado escape para dentro do markup.
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  let browser: Awaited<ReturnType<typeof launchBrowser>> | undefined
  try {
    browser = await launchBrowser()
    const page = await browser.newPage()
    await page.setJavaScriptEnabled(false)
    // O conteúdo entra via setContent (sem navegação de rede). A única coisa
    // que deixamos a página buscar são imagens http(s); scripts, fontes,
    // iframes, fetch/XHR e qualquer navegação (ex.: <meta refresh>) são
    // abortados.
    await page.setRequestInterception(true)
    page.on('request', (req) => {
      const allowed =
        req.resourceType() === 'image' &&
        !req.isNavigationRequest() &&
        /^https?:\/\//i.test(req.url())
      if (allowed) req.continue().catch(() => {})
      else req.abort().catch(() => {})
    })
    await page.setContent(html, { waitUntil: 'load' })
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true })
    return Buffer.from(pdfBuffer)
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
