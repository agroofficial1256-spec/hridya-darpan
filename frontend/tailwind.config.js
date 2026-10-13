export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#05070d',
          900: '#0a0e17',
          800: '#111827',
          700: '#1b2333',
        },
        risk: {
          low: '#22c55e',
          mid: '#eab308',
          high: '#ef4444',
        },
        accent: {
          400: '#5ee6c7',
          500: '#2dd4bf',
          600: '#0f9488',
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
