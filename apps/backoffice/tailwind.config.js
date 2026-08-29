/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        canvas: 'var(--gc-canvas)',
        surface: 'var(--gc-surface)',
        line: 'var(--gc-border)',
        ink: 'var(--gc-ink)',
        muted: 'var(--gc-muted)',
        primary: 'var(--gc-primary)',
        ok: 'var(--gc-ok)',
        warn: 'var(--gc-warn)',
        danger: 'var(--gc-danger)',
        gc: {
          primary: 'var(--gc-primary)',
          secondary: 'var(--gc-secondary)',
        },
      },
      transitionDuration: {
        campo: '150ms',
      },
    },
  },
  plugins: [],
}
