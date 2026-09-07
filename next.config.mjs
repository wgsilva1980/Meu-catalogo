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
  // Fotos de produto e logo vêm do Storage do Supabase (buckets "produtos"
  // e "assets"), hospedado em <project-ref>.supabase.co — o wildcard cobre
  // tanto o projeto de sandbox quanto o de produção sem precisar fixar os
  // dois refs aqui.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/public/**' },
    ],
  },
  outputFileTracingIncludes: {
    '/api/pedidos/*/pdf/route': ['./node_modules/@sparticuz/chromium/bin/**'],
    '/api/catalogo/gerar/route': ['./node_modules/@sparticuz/chromium/bin/**'],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
