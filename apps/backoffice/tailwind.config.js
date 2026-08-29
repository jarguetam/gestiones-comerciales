/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: 'var(--gc-canvas)',
        surface: 'var(--gc-surface)',
        line: 'var(--gc-border)',
        ink: 'var(--gc-ink)',
        muted: 'var(--gc-muted)',
        primary: 'var(--gc-primary)',
        gc: {
          primary: 'var(--gc-primary)',
          secondary: 'var(--gc-secondary)',
        },
      },
    },
  },
  plugins: [],
}
