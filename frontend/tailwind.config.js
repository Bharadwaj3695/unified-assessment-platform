/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#FFF9F2',
          light: '#FFFCF8',
          dark: '#F7EFE4',
        },
        'soft-blue': {
          DEFAULT: '#F3F7FB',
          light: '#F8FAFC',
          dark: '#E2ECF5',
        },
        brand: {
          primary: '#E05D38',
          'primary-hover': '#C94A26',
          'primary-light': '#FDF1EC',
          'primary-dark': '#341C16',
          terracotta: '#E05D38',
          'terracotta-hover': '#C94A26',
          'terracotta-light': '#FDF1EC',
          'terracotta-dark': '#341C16',
          peach: '#F4A261',
          'peach-hover': '#E7924F',
          'peach-light': '#FEF5ED',
          'peach-dark': '#3C2413',
          sage: '#3D8A78',
          'sage-hover': '#2E6C5E',
          'sage-light': '#EEF6F4',
          'sage-dark': '#132B25',
          secondary: '#3B82F6',
          'secondary-hover': '#2563EB',
          'secondary-light': '#EFF6FF',
          'secondary-dark': '#14253D',
        },
        surface: {
          light: '#FFFFFF',
          'light-muted': '#F3F7FB',
          'light-cream': '#FFF9F2',
          'light-border': '#EBE3D8',
          dark: '#1B2433',
          'dark-elevated': '#243042',
          'dark-muted': '#141B26',
          'dark-border': '#283547',
        },
        bg: {
          light: '#FFF9F2',
          dark: '#12161F',
        },
        content: {
          primary: '#1F2937',
          muted: '#64748B',
        },
      },
      fontFamily: {
        sans: [
          'Plus Jakarta Sans',
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        display: [
          'Fraunces',
          'Georgia',
          'serif',
        ],
        serif: [
          'Fraunces',
          'Georgia',
          'serif',
        ],
      },
      boxShadow: {
        'warm-xs': '0 1px 2px rgba(224, 93, 56, 0.04)',
        'warm-sm': '0 2px 8px rgba(224, 93, 56, 0.06), 0 1px 2px rgba(0,0,0,0.03)',
        'warm-md': '0 6px 18px rgba(224, 93, 56, 0.08), 0 2px 6px rgba(0,0,0,0.03)',
        'warm-lg': '0 12px 30px rgba(224, 93, 56, 0.1), 0 4px 10px rgba(0,0,0,0.04)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
    },
  },
  plugins: [],
};
