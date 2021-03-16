const meta =
  '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">'
const url =
  process.env.ADDTAILWINDCSS_URL ||
  'https://tailwindui.com/css/components-v2.css'

module.exports = function($) {
  // add stylesheets to <head/>
  $('head')
    .append(meta)
    .append(`<link rel="stylesheet" href="${url}">`)
}
