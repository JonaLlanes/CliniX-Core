/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        clinical: {
          teal: '#0d9488',
          'teal-dark': '#0f766e',
          amber: '#f59e0b',
          slate: '#64748b',
        },
      },
    },
  },
  plugins: [],
};
