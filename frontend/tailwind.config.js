/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{ts,tsx}',
    './index.html'
  ],
  theme: {
    extend: {
      screens: {
        'xs': '480px',
      },
      colors: {
        surface: {
          DEFAULT: '#f4f2e9',
          elevated: '#fffef9',
          dark: '#e8e6d8',
        },
        accent: {
          300: '#6ee7a0',
          400: '#76a67d',
          500: '#5b8d66',
          600: '#477652',
          700: '#365f40',
          800: '#284a31',
          900: '#19321f',
        },
        gain: '#34d399',
        loss: '#fb7185',
      },
    },
  },
  plugins: [],
}
