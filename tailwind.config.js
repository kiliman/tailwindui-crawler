const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
  purge: ['build.js'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
