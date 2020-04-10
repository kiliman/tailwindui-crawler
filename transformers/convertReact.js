const { ensureDirExists, camelCase } = require('../utils')

module.exports = function($, { output, title, path, fs }) {
  let code = $('body')
    .html()
    // Replace `class=` with `className=`
    .replace(/class=/g, 'className=')
    // Replace inline styles with style object
    .replace(/style="([^"]*)"/g, (_, styles) => {
      const regex = /(\s*([\w-]*)\s*:\s*([^;]+))/g
      const matches = Array.from(styles.matchAll(regex))
      return `style={{${matches
        .map(m => `${camelCase(m[2])}: "${m[3]}"`)
        .join(',')}}}`
    })
    // Replace all attributes starting with @.
    //
    // E.g.: `@click.stop` -> `data-todo-at-stop`
    .replace(
      / @([^"]*)=/g,
      (_all, group) => ` data-todo-at-${group.replace(/[.:]/g, '-')}=`,
    )

    // Replaces all attributes starting with x-.
    //
    // E.g.: `x-transition:enter` -> `data-todo-x-transition-enter`
    .replace(
      / x-([^ "]*)/g,
      (_all, group) => ` data-todo-x-${group.replace(/[.:]/g, '-')}`,
    )

    // Replace html comments with JSX comments
    .replace(/(<!-- (.*) -->)/g, '{/* $2 */}')

    // Replace `tabindex="0"` with `tabIndex={0}`
    .replace(/tabindex="([^"]*)"/g, 'tabIndex={$1}')

    // Replace `datetime` with `dateTime` for <time />
    .replace(/datetime=/g, 'dateTime=')

    // Replace `clip-rule` with `clipRule` in svg's
    .replace(/clip-rule=/g, 'clipRule=')

    // Replace `fill-rule` with `fillRule` in svg's
    .replace(/fill-rule=/g, 'fillRule=')

    // Replace `stroke-linecap` with `strokeLinecap` in svg's
    .replace(/stroke-linecap=/g, 'strokeLinecap=')

    // Replace `stroke-width` with `strokeWidth` in svg's
    .replace(/stroke-width=/g, 'strokeWidth=')

    // Replace `stroke-linejoin` with `strokeLinejoin` in svg's
    .replace(/stroke-linejoin=/g, 'strokeLinejoin=')

    // Replace `for` with `htmlFor` in forms
    .replace(/for=/g, 'htmlFor=')

    // Replace all attributes starting with :.
    //
    // E.g.`:class="{ 'hidden': open, 'inline-flex': !open` ->
    // `data-todo-colon-class="{ 'hidden': open, 'inline-flex': !open }"`
    .replace(/ :(.*)=/g, ' data-todo-colon-$1=')

    // Replace `href="#"` with `href="/"` (Otherwise Create React App complains)
    .replace(/href="#"/g, 'href="/"')

    // Replace relative src paths with absolute src paths.
    .replace(/src="\//g, 'src="https://tailwindui.com/')

    // Drop scripts ¯\_(ツ)_/¯
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

    // Trim the whitespace!
    .trim()

  code = wrapCode(code)

  const dir = `${process.env.CONVERTREACT_OUTPUT || output}${path}`
  ensureDirExists(dir)
  const filePath = `${dir}/index.js`
  console.log(`⚛️   Writing React component for "${title}"`)
  fs.writeFileSync(filePath, code)

  const indexFilePath = `${dir}/index.html`
  fs.writeFileSync(indexFilePath, createIndex($('head').html()))
}

function wrapCode(code) {
  return `import React from "react";
import ReactDOM from "react-dom";

const Component = (props) => (
<>
${code}
</>
);

ReactDOM.render(<Component/>, document.getElementById('root'));
`
}

function createIndex(head) {
  const html = `<html>
<head>
  ${head}
</head>
<body>
  <div id="root"></div>
  <script src="./index.js"></script>
</body>
</html>
`
  return html
}
