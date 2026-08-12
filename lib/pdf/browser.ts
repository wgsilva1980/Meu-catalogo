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
