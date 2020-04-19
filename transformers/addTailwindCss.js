const meta =
  '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">'
const url =
  process.env.ADDTAILWINDCSS_URL ||
  'https://cdn.jsdelivr.net/npm/@tailwindcss/ui@latest/dist/tailwind-ui.min.css'

module.exports = function($) {
  // add stylesheets to <head/>
  $('head')
    .append(meta)
    .append(`<link rel="stylesheet" href="${url}">`)
}
