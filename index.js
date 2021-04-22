require('dotenv-expand')(require('dotenv').config())
const fs = require('fs')
const nodeFetch = require('node-fetch')
const fetch = require('fetch-cookie/node-fetch')(nodeFetch)
// @ts-ignore
const formurlencoded = require('form-urlencoded')
const cheerio = require('cheerio')
// polyfill matchAll for node versions < 12
const matchAll = require('string.prototype.matchall')
matchAll.shim()

const { dirname, basename } = require('path')
const { mergeDeep, cleanFilename, ensureDirExists } = require('./utils')

const rootUrl = 'https://tailwindui.com'
const output = process.env.OUTPUT || './output'
// list of languages to save (defaults to html)
const languages = (process.env.LANGUAGES || 'html').split(',')
const downloadCache = new Map()

async function downloadPage(url) {
  const response = await fetch(rootUrl + url)
  const html = await response.text()
  return html.trim()
}

async function postData(url, data) {
  return fetch(rootUrl + url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'manual',
    body: formurlencoded(data),
  })
}

async function processComponentPage(url) {
  const html = await downloadPage(url)
  const $ = cheerio.load(html)

  const snippets = $('section[x-init="init()"]')
  console.log(
    `🔍  Found ${snippets.length} component${snippets.length === 1 ? '' : 's'}`,
  )

  for (let i = 0; i < snippets.length; i++) {
    await processSnippet(url, $(snippets[i]))
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

async function processSnippet(url, $snippet) {
  const title = $snippet.find('header>h2>a').text().trim()

  const data = $snippet.attr('x-data')
  const json = JSON.parse(
    data.substring(data.indexOf('snippets: ') + 10, data.length - 2),
  )
  const filename = cleanFilename(title)
  const path = `${url}/${filename}`

  // output components by language
  json.forEach((item) => {
    const language = item.language.toLowerCase()
    if (!languages.includes(language)) return
    saveLanguageContent(path, language, item.snippet)
  })

  // save resources required by snippet preview
  const $iframe = $snippet.find('iframe')
  const html = $iframe.attr('srcdoc')

  // if languages contains alpine, then save the preview as alpine
  if (languages.includes('alpine')) {
    const $body = cheerio.load(html)('body')
    // strip empty wrapper divs if present
    const $container = findFirstElementWithClass($body.children().first())
    const code = $container.parent().html().trim()

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
  if ($elem.attr('class')?.length > 0 && !$elem.attr('_style')) return $elem
  return findFirstElementWithClass($elem.children().first())
}
async function saveLanguageContent(path, language, code) {
  const ext =
    language === 'react' ? 'jsx' : language === 'alpine' ? 'html' : language
  dir = `${output}/${language}${dirname(path)}`
  ensureDirExists(dir)

  const filename = basename(path)
  filePath = `${dir}/${filename}.${ext}`
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

    // check cache to see if we've already downloaded this file
    if (downloadCache.has(url)) continue

    // strip off querystring
    const qsIndex = url.indexOf('?')
    const path = qsIndex > 0 ? url.substring(0, qsIndex) : url
    const dir = `${output}/preview${dirname(path)}`
    ensureDirExists(dir)
    const filePath = `${dir}/${basename(path)}`

    const response = await fetch(rootUrl + url)
    const content = await response.buffer()
    fs.writeFileSync(filePath, content)
    // just mark this url as already downloaded
    downloadCache.set(url, filePath)
  }
  if (html) {
    // write preview index page
    const dir = `${output}/preview${url}`
    ensureDirExists(dir)
    fs.writeFileSync(`${dir}/index.html`, html)
    console.log(`📝  Writing ${url}/index.html`)
  }
}

async function login() {
  const $ = cheerio.load(await downloadPage('/login'))
  const _token = $('input[name="_token"]').val()

  const response = await postData('/login', {
    _token,
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    remember: 'true',
  })
  const html = await response.text()
  return /\<title\>Redirecting to https:\/\/tailwindui\.com\<\/title\>/.test(
    html,
  )
}

;(async function () {
  try {
    ensureDirExists(output)

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
    const count = process.env.COUNT || links.length
    for (let i = 0; i < count; i++) {
      const link = links[i]
      const url = $(link).attr('href')
      console.log(`⏳  Processing ${url}...`)
      const components = await processComponentPage(url)
      mergeDeep(library, components)
      console.log()
    }
    if (process.env.BUILDINDEX === '1') {
      let preview = html.replace(
        /\/img\/category-thumbnails-refresh\//g,
        'https://tailwindui.com/img/category-thumbnails-refresh/',
      )

      preview = replaceTokens(preview)

      await savePageAndResources('/components', preview, $)
      fs.copyFileSync('./previewindex.html', `${output}/preview/index.html`)
      console.log()
    }
  } catch (ex) {
    console.error('‼️  ', ex)
    return 1
  }
  console.log('🏁  Done!')
  return 0
})()
