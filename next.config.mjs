import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '5mb',
    },
  },
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/api/pedidos/*/pdf/route': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/catalogo/gerar/route': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
