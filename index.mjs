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
let xInertiaVersion = null
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
        'X-Requested-With': 'XMLHttpRequest',
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

async function putData(url, data) {
  if (!url.startsWith(rootUrl)) url = rootUrl + url

  const body = JSON.stringify(data)

  return fetchHttps(
    url,
    {
      method: 'PUT',
      headers: {
        Accept: 'text/html, application/xhtml+xml',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        Cookie: getCookieHeader(cookies),
        'X-Requested-With': 'XMLHttpRequest',
        'X-Inertia': 'true',
        'X-Inertia-Version': xInertiaVersion,
        'X-XSRF-TOKEN': cookies['XSRF-TOKEN'],
      },
    },
    body,
  )
}

async function setComponentLanguage(uuid, language) {
  const languageMap = {
    html: 'html-v4-system',
    react: 'react-v4-system',
    vue: 'vue-v4-system',
  }

  const snippetLang = languageMap[language]
  if (!snippetLang) {
    console.log(`⚠️  Unknown language: ${language}`)
    return false
  }

  console.log(`🔄  Setting language to ${language} for component ${uuid}`)

  try {
    const response = await putData('/ui-blocks/language', {
      uuid: uuid,
      snippet_lang: snippetLang,
    })

    // Check for various success status codes (including redirects)
    if (
      response.status === 200 ||
      response.status === 204 ||
      response.status === 302 ||
      response.status === 303
    ) {
      return true
    }

    console.error(
      `⚠️  Language API returned status ${response.status} for ${language}`,
    )
    if (process.env.DEBUG === '1') {
      const responseText = await response.text()
      console.log(
        `Debug: Language API response body: ${responseText.slice(0, 200)}`,
      )
    }

    return false
  } catch (error) {
    console.log(`❌ Error setting language ${language}: ${error.message}`)
    return false
  }
}

async function fetchUpdatedComponent(url, uuid) {
  try {
    // Re-fetch the component page to get updated data
    const html = await downloadPage(url)
    const $ = cheerio.load(html)
    const json = $('#app').attr('data-page')

    if (!json) {
      console.log(`⚠️  No component data found when re-fetching ${url}`)
      return null
    }

    const data = JSON.parse(json)
    if (!data.props?.subcategory?.components) {
      console.log(`⚠️  No components found in re-fetched data for ${url}`)
      return null
    }

    // Find the component with matching UUID
    const component = data.props.subcategory.components.find(
      (c) => c.uuid === uuid,
    )
    if (!component) {
      console.log(
        `⚠️  Component with UUID ${uuid} not found in re-fetched data`,
      )
      return null
    }

    return component
  } catch (error) {
    console.log(`❌ Error re-fetching component data: ${error.message}`)
    return null
  }
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
  if (process.env.DEBUG === '1') {
    console.log(`Debug: data structure keys: [${Object.keys(data).join(',')}]`)
    console.log(
      `Debug: props structure keys: [${Object.keys(data.props || {}).join(',')}]`,
    )
  }

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
    if (process.env.DEBUG === '1') {
      console.log(
        `Debug: first component structure keys: [${Object.keys(components[0]).join(',')}]`,
      )
    }
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
    console.log(
      `Debug: Processing "${title}" | snippet: ${component.snippet ? 'present' : 'missing'} | ${component.snippet ? `keys: [${Object.keys(component.snippet).join(',')}] | uuid: ${component.uuid}` : 'no data'}`,
    )
  }

  // Check if component has UUID for language switching
  if (!component.uuid) {
    console.log(
      `⚠️  No UUID found for component ${title}, skipping multi-language support`,
    )
    return
  }

  // Process each requested language
  for (const language of languages) {
    console.log(`🔄 Processing ${title} in ${language}...`)

    // Set the language for this component
    const success = await setComponentLanguage(component.uuid, language)
    if (!success) {
      console.log(`❌ Failed to set language ${language} for ${title}`)
      continue
    }

    // Re-fetch the component page to get updated snippet data
    const updatedComponent = await fetchUpdatedComponent(url, component.uuid)
    if (!updatedComponent || !updatedComponent.snippet) {
      console.log(`❌ Failed to fetch ${language} code for ${title}`)
      continue
    }

    // Save the language-specific code
    const snippet = updatedComponent.snippet
    if (snippet.code && snippet.code.trim()) {
      console.log(`✅ Saving ${language} code for ${title}`)
      await saveLanguageContent(path, language, snippet.code)
    } else {
      console.log(`⚠️  No code content for ${language} version of ${title}`)
    }
  }

  // save resources required by snippet preview
  const html = component.iframeHtml
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
  const ext = language === 'react' ? 'jsx' : language
  const dir = `${output}/${language}${dirname(path)}`

  if (process.env.DEBUG === '1') {
    console.log(
      `Debug: Saving ${language} | ${path} | ${code ? `${code.length} chars` : 'no code'} | ${dir}`,
    )
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
    } else if (code.includes('function Example()')) {
      code = code.replace('function Example()', `function ${componentName}()`)
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
  const loginPageHtml = await downloadPage('/login')

  // Extract Inertia version from the login page data-page attribute
  const $ = cheerio.load(loginPageHtml)
  const json = $('#app').attr('data-page')
  if (json) {
    try {
      const data = JSON.parse(json)
      xInertiaVersion = data.version
    } catch (err) {
      console.log('⚠️  Failed to parse login page data:', err.message)
    }
  }

  if (process.env.DEBUG === '1') {
    console.log(`Debug: Extracted Inertia version: ${xInertiaVersion}`)
  }

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
