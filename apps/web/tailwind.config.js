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
      },
      transitionDuration: {
        campo: '150ms',
      },
      boxShadow: {
        fab: '0 8px 24px -8px color-mix(in srgb, var(--gc-primary) 45%, transparent)',
      },
    },
  },
  plugins: [],
}
