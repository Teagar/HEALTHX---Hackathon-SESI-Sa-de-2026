/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(16 24 40 / 0.04)',
        sm: '0 1px 3px 0 rgb(16 24 40 / 0.06), 0 1px 2px -1px rgb(16 24 40 / 0.04)',
        md: '0 6px 16px -4px rgb(16 24 40 / 0.08), 0 2px 4px -2px rgb(16 24 40 / 0.04)',
        lg: '0 16px 32px -8px rgb(16 24 40 / 0.12), 0 4px 8px -4px rgb(16 24 40 / 0.05)',
      },
      borderRadius: {
        lg: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.125rem',
      },
      colors: {
        clinical: {
          frame: '#F5F6F8',
          sidebar: '#FFFFFF',
          border: '#E4E7EC',
          paper: '#F9FAFB',
          sage: '#0E7A5F',
          sageHover: '#0B5F4A',
          sageLight: '#ECF8F3',
          risk4: '#C84B31',
          risk4Bg: '#FDF2F0',
          risk3: '#C26D27',
          risk3Bg: '#FDF7EC',
          risk2: '#A16207',
          risk2Bg: '#FEFCE8',
          risk1: '#0E7A5F',
          risk1Bg: '#ECF8F3',
        }
      }
    },
  },
  plugins: [],
}
