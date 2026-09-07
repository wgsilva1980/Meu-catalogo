import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12182A',
        paper: '#F4F5F1',
        // Escurecido de #FF5A36 pra passar contraste AA (4.5:1) como texto/
        // botão sobre branco e sobre paper — o tom original reprovava a
        // 3.10:1 (branco sobre accent), abaixo do mínimo pra texto normal.
        // Ver "Raio-X do Catálogo", achado P0.
        accent: '#BE4A1B',
        muted: '#5B6472',
        line: '#DEDCD4',
        promo: '#C97A17',
        success: '#4F7A57',
      },
      fontFamily: {
        display: ['Georgia', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
