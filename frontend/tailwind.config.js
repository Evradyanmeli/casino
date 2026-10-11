/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0D0D1A',
        'bg-secondary': '#1A1A2E',
        gold: '#dfbf79',
        secondary: '#446957',
        accent: '#91c3b4',
        success: '#86c69a',
        error: '#f38e8e',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Georgia', 'Times New Roman', 'serif'],
      },
    },
  },
  plugins: [],
};
