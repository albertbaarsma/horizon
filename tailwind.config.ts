import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0d1117',
        bg2: '#161b22',
        bg3: '#1c2128',
        bg4: '#21262d',
        border: '#30363d',
        border2: '#3d444d',
        muted: '#7d8590',
        dim: '#484f58',
        green: '#3fb950',
        red: '#f85149',
        yellow: '#d29922',
        blue: '#58a6ff',
        purple: '#bc8cff',
        orange: '#fb8f44',
        pink: '#f778ba',
        accent: '#6366f1',
      },
    },
  },
  plugins: [],
}
export default config
