const { ensureDirExists, camelCase } = require('../utils')
const { dirname, basename } = require('path')

module.exports = function($, { output, path, fs }) {
  let code = $('body')
    .html()
    // Remove alpine atttributes (@, x-, :)
    .replace(/ (@|x-|:)[\w.:-]+="[^"]+"/g, '')
    // Drop scripts ¯\_(ツ)_/¯
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Trim the whitespace!
    .trim()

  // make sure STRIPALPINE_OUTPUT set so it doesn't overwrite raw HTML file
  if (!process.env.STRIPALPINE_OUTPUT) {
    throw new Error('Missing STRIPALPINE_OUTPUT')
  }
  const dir = `${process.env.STRIPALPINE_OUTPUT}${dirname(path)}`
  ensureDirExists(dir)
  const filePath = `${dir}/${basename(path)}.html`
  console.log(`⛰   Writing Alpine-stripped ${basename(path)}.html`)
  fs.writeFileSync(filePath, code)
}
