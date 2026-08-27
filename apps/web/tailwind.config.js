/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        gc: {
          primary: 'var(--gc-primary)',
          secondary: 'var(--gc-secondary)',
        },
      },
    },
  },
  plugins: [],
}
