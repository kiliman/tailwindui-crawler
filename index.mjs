#!/usr/bin/env node
import * as cheerio from 'cheerio'
import * as dotenv from 'dotenv'
import dotenvExpand from 'dotenv-expand'
import * as fs from 'fs'
import https from 'https'
import * as _path from 'path'
import { exit } from 'process'
// polyfill matchAll for node versions < 12
import matchAll from 'string.prototype.matchall'

dotenvExpand(dotenv.config())
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

const rootUrl = 'https://tailwindui.com'
const output = process.env.OUTPUT || './output'
// list of languages to save (defaults to html)
const languages = (process.env.LANGUAGES || 'html').split(',')
const retries = 3
let oldAssets = {}
let newAssets = {}
const regexEmail = new RegExp(process.env.EMAIL.replace(/[.@]/g, '\\$&'), 'g')
let cookies = {}

async function fetchHttps(url, options = {}, body = undefined) {
  return new Promise((resolve, reject) => {
    const uri = new URL(url)
    options = {
      hostname: uri.hostname,
      port: uri.port ?? 443,
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
      reject.err(error)
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
  const response = await fetchWithRetry(rootUrl + url, retries)
  const html = await response.text()
  return html.trim()
}

async function postData(url, data) {
  const body = JSON.stringify(data)

  return fetchHttps(
    rootUrl + url,
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
  if (!html.includes(process.env.EMAIL)) {
    console.log(`🚫   Not logged in`)
    process.exit()
  }
  const $ = cheerio.load(html)
  // component data stored in #app data-page attribute
  const json = $('#app').attr('data-page')
  const data = JSON.parse(json)

  const components = data.props.subcategory.components
  console.log(
    `🔍  Found ${components.length} component${
      components.length === 1 ? '' : 's'
    }`,
  )

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

  // output snippets by language
  component.snippets.forEach((snippet) => {
    const language = snippet.language.toLowerCase()
    if (!languages.includes(language)) return
    saveLanguageContent(path, language, snippet.snippet)
  })

  // save resources required by snippet preview
  const html = component.iframeHtml
  // if languages contains alpine, then save the preview as alpine
  if (languages.includes('alpine')) {
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

  await savePageAndResources(url, null, cheerio.load(html))
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
  ensureDirExists(dir)

  const filename = basename(path)
  const filePath = `${dir}/${filename}.${ext}`
  console.log(`📝  Writing ${language} ${filename}.${ext}`)
  fs.writeFileSync(filePath, code)
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
  return response.status === 409 || response.status === 302
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

    const path = new URL(url).pathname
    const dir = `${output}${dirname(path)}`
    const filePath = `${dir}/${basename(path)}.zip`
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
    const html = await downloadPage('/components')
    const $ = cheerio.load(html)

    const library = {}
    const links = $('.grid a')
    let urls = []
    for (let i = 0; i < links.length; i++) {
      const link = links[i]
      const url = $(link).attr('href')
      if (!url.startsWith('/components')) continue
      urls.push(url)
    }
    const count = process.env.COUNT || urls.length
    for (let i = 0; i < count; i++) {
      const url = urls[i]
      console.log(`⏳  Processing ${url}...`)
      const components = await processComponentPage(url)
      mergeDeep(library, components)
      console.log()
    }
    if (process.env.BUILDINDEX === '1') {
      const preview = replaceTokens(html)
      console.log('⏳  Saving preview page... this may take awhile')
      await savePageAndResources('/components', preview, $)
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
  } catch (err) {
    console.error('‼️  ', err)
    return 1
  }
  const elapsed = new Date().getTime() - start
  console.log(`🏁  Done! ${elapsed / 1000} seconds`)
  return 0
})()
