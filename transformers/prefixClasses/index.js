// Based on code from https://github.com/vesper8/vue-tailwind-prefix-applicator

const { classes } = require('./tailwind-classes')
const escapeRegExp = s => s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
const prefix = process.env.PREFIXCLASSES_PREFIX

module.exports = function($) {
  let code = $('body').html()
  classes.forEach(cls => {
    code = code.replace(
      new RegExp(
        `(["':\\s])(?!${prefix})(-?${escapeRegExp(cls)})(?![-\/])`,
        'g',
      ),
      `$1${prefix}$2`,
    )
  })
  // update existing html with prefixed version
  $('body').html(code)
}
