import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12182A',
        paper: '#F4F5F1',
        accent: '#FF5A36',
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
