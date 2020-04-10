const defaultFontFamily =
  'system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,"Noto Sans",sans-serif,"Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji"'
const interFont =
  '<link rel="stylesheet" href="https://rsms.me/inter/inter.css">'
const fontFamilySans = `
<style type="text/css">
html, .font-sans{font-family:"Inter var",${defaultFontFamily}}
.sm\\:font-sans{font-family:"Inter var",${defaultFontFamily}}
.md\\:font-sans{font-family:"Inter var",${defaultFontFamily}}
.lg\\:font-sans{font-family:"Inter var",${defaultFontFamily}}
.xl\\:font-sans{font-family:"Inter var",${defaultFontFamily}}
</style>
`

module.exports = function($) {
  $('head')
    .append(interFont)
    .append(fontFamilySans)
}
