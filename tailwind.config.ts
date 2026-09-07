import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Fase 5 do plano de redesign (Polish): os tokens neutros passaram de
      // hex fixo pra variável CSS (definida em app/globals.css, com
      // sobrescrita em `.dark`) — cada classe que já usava `bg-paper`,
      // `text-ink`, `border-line`, `bg-surface`, `text-muted` etc. passa a
      // responder ao tema sozinha, sem precisar de nenhuma variante `dark:`
      // espalhada pelo código. A classe `.dark` só existe dentro do wrapper
      // de app/admin/layout.tsx (ver components/AdminThemeShell.tsx) — as
      // telas públicas nunca ganham essa classe, então continuam sempre
      // claras. `rgb(var(...) / <alpha-value>)` é o formato que o Tailwind
      // exige pra opacidade (bg-accent/10 etc.) continuar funcionando com
      // cor vinda de variável.
      colors: {
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        // Escurecido de #FF5A36 pra passar contraste AA (4.5:1) como texto/
        // botão sobre branco e sobre paper — o tom original reprovava a
        // 3.10:1 (branco sobre accent), abaixo do mínimo pra texto normal.
        // Ver "Raio-X do Catálogo", achado P0. Mantido igual no escuro —
        // ver nota sobre accent/success/warning/danger/promo em globals.css.
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        // Escurecido de #DEDCD4 (1.25:1 contra `paper`, bem abaixo do 3:1 que
        // WCAG 1.4.11 pede pra borda de campo de formulário) pra 3.08:1 —
        // era o único dos 4 pares de contraste reprovados na seção 04 do
        // audit que a correção do accent (P0) não resolvia de tabela.
        line: 'rgb(var(--color-line) / <alpha-value>)',
        promo: 'rgb(var(--color-promo) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        // `warning`/`danger` nunca existiram como token — cada tela escrevia
        // `text-amber-600`/`text-red-600` direto. Os hex abaixo são os
        // mesmos `amber-700`/`red-700` que os badges já usavam (ambos já
        // passavam AA: 5.02:1 e 6.47:1 contra branco), só formalizados em
        // token — mesma cor, sem mudança visual.
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        danger: 'rgb(var(--color-danger) / <alpha-value>)',
      },
      fontFamily: {
        // As variáveis vêm de next/font (lib/fonts.ts), aplicadas em
        // app/layout.tsx — self-hosted, sem <link> pro Google Fonts.
        display: ['var(--font-display)', 'Georgia', 'Times New Roman', 'serif'],
        sans: [
          'var(--font-body)',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
      // Escala declarada (Fase 1 do plano de redesign) — hoje cada tela
      // escolhe entre text-xs/sm/base/lg/xl/2xl ponto a ponto, sem relação
      // combinada entre elas. `extend` só adiciona: text-xs...text-2xl do
      // Tailwind continuam existindo: migrar os usos pra essa escala nova é
      // trabalho de fase 2/3 (layout/componentes), aqui só a régua fica
      // definida.
      fontSize: {
        display: ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        title: ['1.375rem', { lineHeight: '1.3' }],
        heading: ['1.0625rem', { lineHeight: '1.4' }],
        body: ['0.9375rem', { lineHeight: '1.6' }],
        label: ['0.8125rem', { lineHeight: '1.4' }],
        caption: ['0.75rem', { lineHeight: '1.4' }],
      },
    },
  },
  plugins: [],
}

export default config
