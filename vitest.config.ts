import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Só testa lógica pura de lib/ (validação, formatação, cálculo) — nada que
// bata em rede/Supabase/Mercado Pago, então não precisa de nenhum mock de
// serviço externo por enquanto.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**'],
  },
})
