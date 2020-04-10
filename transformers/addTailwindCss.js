const tui =
  '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tailwindcss/ui@latest/dist/tailwind-ui.min.css">'

module.exports = function($) {
  // add stylesheets to <head/>
  $('head').append(tui)
}
