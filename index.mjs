#!/usr/bin/env node
import * as cheerio from 'cheerio'
import * as dotenv from 'dotenv'
import { expand } from 'dotenv-expand'
import * as fs from 'fs'
import https from 'https'
import * as _path from 'path'
import { exit } from 'process'
// polyfill matchAll for node versions < 12
import matchAll from 'string.prototype.matchall'

expand(dotenv.config())
matchAll.shim()

const { dirname, basename } = _path

export const kebab = (s) => s.toLowerCase().replace(/[^\w.]/g, '-')
export const camelCase = (s) => {
  const matches = Array.from(s.matchAll(/[a-zA-Z0-9]+/g))
  return (
    matches[0][0].toLowerCase() +
    matches
      .slice(1)
      .map(([item]) => item[0].toUpperCase() + item.substr(1).toLowerCase())
      .join('')
  )
}

// Convert kebab-case or snake_case to PascalCase
export const toPascalCase = (str) => {
  return str
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
}

// Generate component name from path parts
export const generateComponentName = (path) => {
  // Extract folder and file name information
  const pathParts = path.split('/')
  const fileName = pathParts[pathParts.length - 1]

  // Generate a component name based on meaningful parts of the path
  // Skip 'ui-blocks' and use more descriptive parts
  const meaningfulParts = pathParts.filter(
    (part) => !['ui-blocks', 'index'].includes(part) && part !== fileName,
  )

  // Take the last category and subcategory (if available)
  const relevantParts = meaningfulParts.slice(
    Math.max(0, meaningfulParts.length - 2),
  )

  // Add the filename to the parts we'll use for the component name
  relevantParts.push(fileName)

  // Create the component name
  return relevantParts.map((part) => toPascalCase(part)).join('')
}

export const cleanFilename = (filename) =>
  filename
    .toLowerCase()
    .replace(/[^\w.]/g, '_')
    .replace(/^_+|_+$/g, '')

export const ensureDirExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function mergeDeep(target, source) {
  const isObject = (obj) => obj && typeof obj === 'object'

  if (!isObject(target) || !isObject(source)) {
    return source
  }

  Object.keys(source).forEach((key) => {
    const targetValue = target[key]
    const sourceValue = source[key]

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      target[key] = targetValue.concat(sourceValue)
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      target[key] = mergeDeep(Object.assign({}, targetValue), sourceValue)
    } else {
      target[key] = sourceValue
    }
  })

  return target
}

const rootUrl = 'https://tailwindcss.com/plus'
const output = process.env.OUTPUT || './output'
// list of languages to save (defaults to html)
const languages = (process.env.LANGUAGES || 'html').split(',')
// list of components to save (defaults to all)
const components = (process.env.COMPONENTS || 'all').split(',')
// force update even if component already exists
const forceUpdate = process.env.FORCE_UPDATE === '1'
const retries = 3
let oldAssets = {}
let newAssets = {}
const regexEmail = new RegExp(process.env.EMAIL.replace(/[.@]/g, '\\$&'), 'g')
let cookies = {}
// Component tracking
let processedCategories = new Set()
let processedComponents = 0
// Template tracking
let processedTemplates = 0
// Skip tracking
let skippedComponents = 0

async function fetchHttps(url, options = {}, body = undefined) {
  return new Promise((resolve, reject) => {
    const uri = new URL(url)
    options = {
      hostname: uri.hostname,
      port: uri.port || 443,
      path: uri.pathname + uri.search,
      method: 'GET',
      ...options,
    }
    let response
    const req = https.request(options, (res) => {
      response = res
      response.body = Buffer.alloc(0)
      response.status = res.statusCode
      response.text = async () => response.body.toString()
      response.json = async () => JSON.parse(await response.text())
      response.arrayBuffer = async () => response.body.buffer

      const setCookieHeaders = response.headers['set-cookie']
      if (setCookieHeaders) {
        const newCookies = parseSetCookieHeaders(setCookieHeaders)
        cookies = { ...cookies, ...newCookies }
      }

      res.on('data', (d) => {
        response.body = Buffer.concat([response.body, d])
      })
      res.on('end', () => {
        resolve(response)
      })
    })

    req.on('error', (error) => {
      reject(error)
    })
    if (body) {
      req.write(body)
    }
    req.end()
  })
}

async function fetchWithRetry(url, retries, options = {}) {
  let tries = 0
  while (true) {
    const start = new Date().getTime()
    let response
    let cookieHeader = getCookieHeader(cookies)
    console.log(`🔍  Fetching ${url}`)
    try {
      response = await fetchHttps(url, {
        ...options,
        headers: {
          ...options?.headers,
          cookie: cookieHeader,
        },
      })
      const elapsed = new Date().getTime() - start
      console.log(`⏱   ${elapsed}ms (${response.status})`)
      if (response.status === 302) {
        return fetchWithRetry(response.headers.location, retries, options)
      }
      return response
    } catch (err) {
      console.error(err)
      const elapsed = new Date().getTime() - start
      tries++
      const status = response ? response.status : 500
      console.log(`🔄  ${elapsed}ms (${status}) Try #${tries} ${url}`)
      if (tries === retries) {
        console.log(`‼️   Error downloading ${url}.\n${err.message}`)
        exit(1)
      }
    }
  }
}

function parseSetCookieHeaders(setCookieHeaders) {
  let cookies = {}
  setCookieHeaders.forEach((header) => {
    const [cookie] = header.split(';')
    const [name, value] = cookie.split('=')
    cookies[name] = decodeURIComponent(value)
  })
  return cookies
}

async function downloadPage(url) {
  if (!url.startsWith(rootUrl)) url = rootUrl + url
  url = url.replace('/plus/plus/', '/plus/')

  const response = await fetchWithRetry(url, retries)
  const html = await response.text()
  return html.trim()
}

async function postData(url, data) {
  if (!url.startsWith(rootUrl)) url = rootUrl + url

  const body = JSON.stringify(data)

  return fetchHttps(
    url,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(body),
        cookie: getCookieHeader(cookies),
        'x-inertia': 'true',
        'x-xsrf-token': cookies['XSRF-TOKEN'],
      },
    },
    body,
  )
}

function getCookieHeader(cookies) {
  return (
    Object.entries(cookies)
      //.map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
  )
}

async function processComponentPage(url) {
  const html = await downloadPage(url)

  if (!html.includes('id="app"') || !html.includes('data-page')) {
    console.log(`🚫   Not logged in`)
    process.exit()
  }

  // Track this category
  processedCategories.add(url)

  const $ = cheerio.load(html)
  // component data stored in #app data-page attribute
  const json = $('#app').attr('data-page')
  console.log(`Debug: url = ${url}`)
  console.log(`Debug: json data = ${json ? 'found' : 'not found'}`)

  if (!json) {
    console.log('🚫   No component data found')
    console.log('Debug: HTML structure:')
    console.log($('body').html().slice(0, 500)) // Get a sample of the HTML
    return {}
  }

  const data = JSON.parse(json)
  console.log(`Debug: data structure:`, Object.keys(data))
  console.log(`Debug: props structure:`, Object.keys(data.props || {}))

  if (
    !data.props ||
    !data.props.subcategory ||
    !data.props.subcategory.components
  ) {
    console.log('🚫   No components found in data structure')
    return {}
  }

  const components = data.props.subcategory.components
  console.log(
    `🔍  Found ${components.length} component${
      components.length === 1 ? '' : 's'
    }`,
  )

  // Debug the structure of the first component
  if (components.length > 0) {
    console.log(`Debug: first component structure:`, Object.keys(components[0]))
  }

  for (let i = 0; i < components.length; i++) {
    await processComponent(url, components[i])
  }

  if (process.env.BUILDINDEX === '1') {
    const preview = replaceTokens(html)
    await savePageAndResources(url, preview, $)
  }
}

function replaceTokens(html) {
  // replace tokens in page with constant so it won't generate superfluous diffs
  // also replace links to css/js assets to remove id querystring
  const regexTokens = /name="(csrf-token|_token)"\s+(content|value)="(.+?)"/gm
  const regexAssets = /(css|js)(\?id=[a-f0-9]+)/gm
  return html
    .replace(regexTokens, `name="$1" $2="CONSTANT_TOKEN"`)
    .replace(regexAssets, '$1')
}

async function processComponent(url, component) {
  const title = component.name
  const filename = cleanFilename(title)
  const path = `${url}/${filename}`

  // Track this component
  processedComponents++

  // Log component structure in debug mode
  if (process.env.DEBUG === '1') {
    console.log(`Debug: Processing component: ${title}`)
    console.log(
      `Debug: Component snippet:`,
      component.snippet ? 'present' : 'missing',
    )
    if (component.snippet) {
      console.log(`Debug: Snippet keys:`, Object.keys(component.snippet))
      // Log available languages in the snippet
      console.log(`Debug: Snippet language:`, component.snippet.language)
      console.log(`Debug: All available snippet properties:`, component.snippet)
    }
  }

  // Check if component has a snippet property
  if (component.snippet) {
    const snippet = component.snippet

    // Get the language from the snippet
    const snippetLanguage = snippet.language?.toLowerCase()

    // Save the code if the language is in our requested languages list
    if (snippetLanguage && languages.includes(snippetLanguage)) {
      console.log(`Debug: Saving ${snippetLanguage} code for ${title}`)
      saveLanguageContent(path, snippetLanguage, snippet.code)
    }

    // Also save as react/jsx if available and react is in our languages list
    if (snippetLanguage === 'jsx' && languages.includes('react')) {
      console.log(`Debug: Saving react code for ${title}`)
      saveLanguageContent(path, 'react', snippet.code)
    }
  }

  // save resources required by snippet preview
  const html = component.iframeHtml
  // if languages contains alpine, then save the preview as alpine
  if (languages.includes('alpine') && html) {
    const $body = cheerio.load(html)('body')
    // default code to body
    let code = $body.html().trim()
    // strip empty wrapper divs if present
    let $container = findFirstElementWithClass($body.children().first())

    if ($container) {
      code = $container.parent().html().trim()
    }

    const disclaimer = `<!--
  This example requires Tailwind CSS v2.0+

  The alpine.js code is *NOT* production ready and is included to preview
  possible interactivity
-->
`
    saveLanguageContent(path, 'alpine', `${disclaimer}${code}`)
  }

  await savePageAndResources(url, null, cheerio.load(html || ''))
}

function findFirstElementWithClass($elem) {
  // ignore empty class and elements with _style attribute
  if (
    $elem.attr('class') &&
    $elem.attr('class').length > 0 &&
    !$elem.attr('_style')
  ) {
    return $elem
  }
  if ($elem.children().length === 0) return null
  return findFirstElementWithClass($elem.children().first())
}

async function saveLanguageContent(path, language, code) {
  const ext =
    language === 'react' ? 'jsx' : language === 'alpine' ? 'html' : language
  const dir = `${output}/${language}${dirname(path)}`

  if (process.env.DEBUG === '1') {
    console.log(`Debug: Saving language content for ${language}`)
    console.log(`Debug: Directory: ${dir}`)
    console.log(`Debug: Path: ${path}`)
    console.log(`Debug: Has code: ${code ? 'yes' : 'no'}`)
    if (code) {
      console.log(`Debug: Code length: ${code.length}`)
    }
  }

  ensureDirExists(dir)

  const filename = basename(path)
  const filePath = `${dir}/${filename}.${ext}`

  // Check if file already exists and skip if not forced to update
  if (!forceUpdate && fs.existsSync(filePath)) {
    console.log(`🔄 Skipping ${language} ${filename}.${ext} (already exists)`)
    skippedComponents++
    return
  }

  // For React components, replace Example() with a proper component name
  if (language === 'react' && code) {
    const componentName = generateComponentName(path)

    // Handle both function declaration patterns
    if (code.includes('export default function Example()')) {
      code = code.replace(
        'export default function Example()',
        `export default function ${componentName}()`,
      )

      if (process.env.DEBUG === '1') {
        console.log(`Debug: Renamed component to ${componentName}`)
      }
    } else if (code.includes('function Example()')) {
      code = code.replace('function Example()', `function ${componentName}()`)

      if (process.env.DEBUG === '1') {
        console.log(`Debug: Renamed component to ${componentName}`)
      }
    }
  }

  // Only write if we have valid code content
  if (code && code.trim()) {
    console.log(`📝  Writing ${language} ${filename}.${ext}`)
    fs.writeFileSync(filePath, code)
  } else {
    console.log(`⚠️  Skipping ${language} ${filename}.${ext} - no content`)
  }
}

async function savePageAndResources(url, html, $) {
  // download referenced css and js inside <head>
  const items = $('head>link,script,img')
  for (let i = 0; i < items.length; i++) {
    const $item = $(items[i])
    const url = $item.attr('src') || $item.attr('href')
    if (!url || !url.startsWith('/')) continue

    // strip off querystring
    const path = new URL(rootUrl + url).pathname
    const dir = `${output}/preview${dirname(path)}`
    const filePath = `${dir}/${basename(path)}`
    // check assets to see if we've already downloaded this file
    if (newAssets[filePath]) continue

    ensureDirExists(dir)

    let options = {}
    if (oldAssets[filePath]) {
      options = {
        method: 'GET',
        headers: {
          'If-None-Match': oldAssets[filePath], // etag from previous GET
        },
      }
    }

    const response = await fetchWithRetry(rootUrl + url, retries, options)
    // check etag
    if (response.status === 304) {
      continue
    }
    newAssets[filePath] = response.headers['etag']

    const content = await response.arrayBuffer()
    fs.writeFileSync(filePath, Buffer.from(content))
  }
  if (html) {
    // write preview index page
    const dir = `${output}/preview${url}`
    ensureDirExists(dir)
    html = html.replace(regexEmail, 'Licensed User')
    fs.writeFileSync(`${dir}/index.html`, html)
    console.log(`📝  Writing ${url}/index.html`)
  }
}

async function login() {
  await downloadPage('/login')

  const response = await postData('/login', {
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    remember: false,
  })

  return (
    response.status === 409 ||
    response.status === 302 ||
    response.status === 200
  )
}

async function saveTemplates() {
  const html = await downloadPage('/templates')
  const $ = cheerio.load(html)
  const $templates = $('section[id^="product"]')
  console.log(
    `🔍  Found ${$templates.length} template${
      $templates.length === 1 ? '' : 's'
    }`,
  )
  for (let i = 0; i < $templates.length; i++) {
    const $template = $($templates[i])
    const $link = $template.find('h2>a')
    const title = $link.text()
    const url = $link.attr('href')
    console.log(`🔍  Downloading template ${title}`)

    // Track this template
    processedTemplates++

    const path = new URL(url).pathname
    const dir = `${output}${dirname(path)}`
    const filePath = `${dir}/${basename(path)}.zip`

    // Skip if the template already exists and force update is disabled
    if (!forceUpdate && fs.existsSync(filePath)) {
      console.log(`🔄  Skipping template ${title} (already exists)`)
      skippedComponents++
      continue
    }

    ensureDirExists(dir)

    let options = {}
    if (oldAssets[filePath]) {
      options = {
        method: 'GET',
        headers: {
          'If-None-Match': oldAssets[filePath], // etag from previous GET
        },
      }
    }
    const response = await fetchWithRetry(url + '/download', retries, options)
    // check etag
    if (response.status === 304) {
      continue
    }
    newAssets[filePath] = response.headers['etag']

    const content = await response.arrayBuffer()
    fs.writeFileSync(filePath, Buffer.from(content))
  }
}

function debugLog(...args) {
  if (process.env.DEBUG === '1') {
    console.log(...args)
  }
}

function countFilesRecursively(dirPath) {
  let count = 0
  const files = fs.readdirSync(dirPath)

  for (const file of files) {
    const fullPath = _path.join(dirPath, file)
    if (fs.statSync(fullPath).isDirectory()) {
      count += countFilesRecursively(fullPath)
    } else {
      count++
    }
  }

  return count
}

;(async function () {
  const start = new Date().getTime()
  try {
    ensureDirExists(output)
    // load old assets
    if (fs.existsSync(`${output}/assets.json`)) {
      oldAssets = JSON.parse(fs.readFileSync(`${output}/assets.json`))
      newAssets = JSON.parse(JSON.stringify(oldAssets))
    }
    console.log('🔐  Logging into tailwindui.com...')
    const success = await login()
    if (!success) {
      console.log('🚫  Invalid credentials')
      return 1
    }
    console.log('✅  Success!\n')

    console.log(`🗂   Output is ${output}`)
    if (forceUpdate) {
      console.log(`🔄  Force update enabled - will overwrite existing files`)
    } else {
      console.log(`🔄  Force update disabled - will skip existing files`)
    }
    const html = await downloadPage('/ui-blocks')
    const $ = cheerio.load(html)

    const library = {}
    const links = $('.grid a')
    let urls = []

    debugLog(`📣  Found ${links.length} links`)

    for (let i = 0; i < links.length; i++) {
      const link = links[i]
      const url = $(link).attr('href')
      debugLog(`📣   ${i + 1}: ${url}`)
      if (!url || !url.match(/\/ui-blocks\//)) continue

      // check if component is in list of components to save
      const urlParts = url.split('/')
      const componentIndex = urlParts.indexOf('ui-blocks') + 1
      const component = urlParts[componentIndex]
      if (
        component &&
        components[0] !== 'all' &&
        !components.includes(component)
      )
        continue

      // Normalize URL to remove any leading /plus if present
      if (url.startsWith('/plus/')) {
        urls.push(url.replace('/plus', ''))
      } else if (url.startsWith('/')) {
        urls.push(url)
      } else if (url.includes('/ui-blocks/')) {
        urls.push(url.replace('https://tailwindcss.com/plus', ''))
      }
    }

    // Add missing marketing URL if not already in the list
    const marketingUrl = '/ui-blocks/marketing'
    if (!urls.includes(marketingUrl)) {
      console.log(`📌  Adding missing URL: ${marketingUrl}`)
      urls.push(marketingUrl)
    }

    const count = process.env.COUNT || urls.length
    for (let i = 0; i < count; i++) {
      const url = urls[i]
      console.log(`⏳  Processing #${i + 1}: ${url}...`)
      const components = await processComponentPage(url)
      mergeDeep(library, components)
      console.log()
    }
    if (process.env.BUILDINDEX === '1') {
      const preview = replaceTokens(html)
      console.log('⏳  Saving preview page... this may take awhile')
      await savePageAndResources('/ui-blocks', preview, $)
      fs.copyFileSync(
        _path.join(process.cwd(), 'previewindex.html'),
        `${output}/preview/index.html`,
      )
      console.log()
    }
    if (process.env.TEMPLATES === '1') {
      console.log('⏳  Saving templates...')
      ensureDirExists(`${output}/preview`)
      await saveTemplates()
      console.log()
    }
    // save assets file
    fs.writeFileSync(
      `${output}/assets.json`,
      JSON.stringify(newAssets, null, 2),
    )

    // Print summary report of downloaded files
    console.log('\n📊 Download Summary:')
    let totalComponents = 0

    // Count components by language
    for (const language of languages) {
      const langPath = `${output}/${language}`
      if (fs.existsSync(langPath)) {
        const componentCount = countFilesRecursively(langPath)
        console.log(`- ${language.toUpperCase()}: ${componentCount} components`)
        totalComponents += componentCount
      }
    }

    // Count templates if enabled
    let templateCount = 0
    if (process.env.TEMPLATES === '1') {
      const templatesPath = `${output}/templates`
      if (fs.existsSync(templatesPath)) {
        templateCount = fs
          .readdirSync(templatesPath)
          .filter((file) => file.endsWith('.zip')).length
      }
      console.log(`- Templates: ${templateCount}`)
    }

    console.log(
      `📑 Total: ${totalComponents} components and ${templateCount} templates`,
    )
    console.log(
      `🔍 Processed ${processedCategories.size} categories and ${processedComponents} components`,
    )

    if (!forceUpdate) {
      console.log(`🔄 Skipped ${skippedComponents} existing components`)
    }

    if (process.env.TEMPLATES === '1') {
      console.log(`🔍 Processed ${processedTemplates} templates`)
      if (templateCount !== processedTemplates) {
        console.log(
          `⚠️ Warning: Number of saved templates (${templateCount}) doesn't match processed templates (${processedTemplates})`,
        )
      }
    }

    // Verification check
    if (components[0] === 'all') {
      console.log(`✅ All categories were processed successfully`)
    } else {
      const missedCategories = components.filter(
        (comp) =>
          !Array.from(processedCategories).some((cat) =>
            cat.includes(`/${comp}`),
          ),
      )
      if (missedCategories.length > 0) {
        console.log(
          `⚠️ Warning: These categories might not have been processed: ${missedCategories.join(', ')}`,
        )
      } else {
        console.log(`✅ All requested categories were processed successfully`)
      }
    }
  } catch (err) {
    console.error('‼️  ', err)
    return 1
  }
  const elapsed = new Date().getTime() - start
  console.log(`🏁  Done! ${elapsed / 1000} seconds`)
  return 0
})()
