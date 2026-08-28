/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'Cambria', '"Times New Roman"', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#FAF5FF',
          100: '#F3E8FF',
          200: '#E9D5FF',
          300: '#D8B4FE',
          400: '#C084FC',
          500: '#A855F7',
          600: 'var(--gc-primary)',
          700: 'var(--gc-primary)',
          800: 'var(--gc-primary)',
          900: '#4C1D95',
          950: '#2E1065',
        },
        card: {
          amberBg: '#FEF3C7',
          amberBar: '#F59E0B',
          amberText: '#78350F',
          mintBg: '#CCFBF1',
          mintBar: '#14B8A6',
          mintText: '#134E4A',
          skyBg: '#E0F2FE',
          skyBar: '#38BDF8',
          skyText: '#0C4A6E',
          lavenderBg: '#EDE9FE',
          lavenderBar: '#8B5CF6',
          lavenderText: '#4C1D95',
          roseBg: '#FFE4E6',
          roseBar: '#F43F5E',
          roseText: '#881337',
        },
      },
      boxShadow: {
        phone: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 12px #0f172a, 0 0 0 14px #334155',
        'phone-sm': '0 20px 40px -10px rgba(0, 0, 0, 0.2), 0 0 0 8px #0f172a',
        fab: '0 8px 24px -4px rgba(109, 40, 217, 0.5)',
      },
    },
  },
  plugins: [],
}