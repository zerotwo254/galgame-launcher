/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#171717',
        surface: '#1e1e1e',
        accent: '#e6194d',
        'accent-light': '#ff396b',
        'accent-blue': '#7e80fe',
      },
      fontFamily: {
        sans: ['"Noto Sans SC"', '"Microsoft YaHei UI"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
