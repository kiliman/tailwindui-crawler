const { ensureDirExists, kebab } = require('../utils')
const dataRegex = / x-data="{(.*?)}"/g

module.exports = function($, { output, title, path, fs }) {
	let code = $('body')
	
	code.find('[x-transition\\:enter],[x-transition\\:enter-start],[x-transition\\:enter-end],[x-transition\\:leave],[x-transition\\:leave-start],[x-transition\\:leave-end]').map((_, element) => {
		const attributes = element.attribs
		element.attribs = Object.fromEntries(Object.entries(attributes).filter(([name]) => !name.startsWith('x-transition')))

		return $(element).wrap($('transition', `<transition enter-active-class="${attributes['x-transition:enter']}" enter-class="${attributes['x-transition:enter-start']}" enter-to-class="${attributes['x-transition:enter-end']}" leave-active-class="${attributes['x-transition:leave']}" leave-class="${attributes['x-transition:leave-start']}" leave-to-class="${attributes['x-transition:leave-end']}"></transition>`))
  	})

  code = code.html()

  let data = [...code.matchAll(dataRegex)].map(match => match[1].trim())

  code = code
    // `x-show` -> `v-if`
    .replace(
		/ x-show/g,
      () => ' v-if',
	)
	// `x-data` -> data()
    .replace(
	  dataRegex,
      () => '',
    )

    // Replace relative src paths with absolute src paths.
    .replace(/src="\//g, 'src="https://tailwindui.com/')

    // Drop scripts ¯\_(ツ)_/¯
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

    // Trim the whitespace!
    .trim()

  code = wrapCode(code, data)

  const dir = `${process.env.VUE_OUTPUT || output}${path}`
  ensureDirExists(dir.substring(0, dir.lastIndexOf('/')))
  const filePath = `${dir}.vue`
  console.log(`📝  Writing ${kebab(title)}.vue`)
  fs.writeFileSync(filePath, code)
}

function wrapCode(code, data) {
  return `<template>
  ${code.replace(/^(?!\s*$)/gm, ' '.repeat(2))}
</template>

<script>
export default {
  data: () => ({
	${data.join(',\n' + ' '.repeat(4))}${data.length == 0 ? '':','}
  })
}
</script>
`
}