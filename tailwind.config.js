/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        clinical: {
          frame: '#E2DDD3',
          sidebar: '#EAE5DC',
          border: '#D5CFC3',
          paper: '#FAF9F6',
          sage: '#1F564C',
          sageHover: '#163F37',
          sageLight: '#EEF6F3',
          risk4: '#C84B31',
          risk4Bg: '#FDF2F0',
          risk3: '#C26D27',
          risk3Bg: '#FDF7EC',
          risk2: '#A16207',
          risk2Bg: '#FEFCE8',
          risk1: '#1F564C',
          risk1Bg: '#EEF6F3',
        }
      }
    },
  },
  plugins: [],
}
