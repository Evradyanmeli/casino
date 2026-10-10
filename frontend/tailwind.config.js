/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0D0D1A',
        'bg-secondary': '#1A1A2E',
        gold: '#FFD700',
        secondary: '#E8457A',
        accent: '#00E5FF',
        success: '#00C853',
        error: '#FF1744',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Orbitron', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
