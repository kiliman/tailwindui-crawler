module.exports = {
  plugins: [
    require('@tailwindcss/jit'),
    require('autoprefixer'),
    process.env.NODE_ENV === 'production' && require('cssnano'),
  ].filter(Boolean),
}
