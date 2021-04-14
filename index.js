require('dotenv-expand')(require('dotenv').config())
const fs = require('fs')
const nodeFetch = require('node-fetch')
const fetch = require('fetch-cookie/node-fetch')(nodeFetch)
// @ts-ignore
const formurlencoded = require('form-urlencoded').default
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
    await savePageAndResources(url, html, $)
  }
}

async function processSnippet(url, $snippet) {
  const title = $snippet
    .find('header>h2>a')
    .text()
    .trim()

  const data = $snippet.attr('x-data')
  const json = JSON.parse(
    data.substring(data.indexOf('snippets: ') + 10, data.length - 2),
  )
  const filename = cleanFilename(title)
  const path = `${url}/${filename}`

  // output components by language
  json.forEach(item => {
    const language = item.language.toLowerCase()
    if (!languages.includes(language)) return

    const ext = language === 'react' ? 'jsx' : language
    const code = item.snippet
    dir = `${output}/${language}${dirname(path)}`
    ensureDirExists(dir)

    filePath = `${dir}/${basename(path)}.${ext}`
    console.log(`📝  Writing ${language} ${filename}.${ext}`)
    fs.writeFileSync(filePath, code)
  })

  // save resources required by snippet preview
  var $iframe = $snippet.find('iframe')
  var html = $iframe.attr('srcdoc')
  await savePageAndResources(url, null, cheerio.load(html))
}

async function savePageAndResources(url, html, $) {
  // download referenced css and js inside <head>
  const items = $('head>link,script')
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
    const content = await response.text()
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

;(async function() {
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
      await savePageAndResources(
        '/components',
        html.replace(
          /\/img\/category-thumbnails-refresh\//g,
          'https://tailwindui.com/img/category-thumbnails-refresh/',
        ),
        $,
      )
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
