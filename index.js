require('dotenv-expand')(require('dotenv').config())
const fs = require('fs')
const crypto = require('crypto')
const nodeFetch = require('node-fetch')
const fetch = require('fetch-cookie/node-fetch')(nodeFetch)
// @ts-ignore
const formurlencoded = require('form-urlencoded').default
const cheerio = require('cheerio')
const serialize = require('dom-serializer')
// polyfill matchAll for node versions < 12
const matchAll = require('string.prototype.matchall')
matchAll.shim()

const { dirname, basename } = require('path')
const { buildIndexPage } = require('./build')
const { mergeDeep, cleanFilename, ensureDirExists } = require('./utils')

const rootUrl = 'https://tailwindui.com'
const output = process.env.OUTPUT || './output'
const htmlMode = process.env.HTMLMODE || 'alpine'
const downloadCache = new Map()

const downloadPage = async url => {
  const response = await fetch(rootUrl + url)
  const html = await response.text()
  return cheerio.load(html.trim())
}

const postData = async (url, data) =>
  fetch(rootUrl + url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirect: 'manual',
    body: formurlencoded(data),
  })

const applyTransformers = (transformers, $, options) => {
  transformers.forEach(transformer => transformer($, options))
  return $
}

const getTransformers = transformerNames =>
  transformerNames
    .filter(Boolean)
    .map(name => require(`./transformers/${name}`))

const processComponentPage = async url => {
  const $ = await downloadPage(url)
  const navLinks = $('nav a')
  const category = $(navLinks[0])
    .text()
    .trim()
  const subCategory = $(navLinks[1])
    .text()
    .trim()
  const section = $('h2')
    .text()
    .trim()

  const transformerNames = (process.env.TRANSFORMERS || '').split(',')
  const transformers = getTransformers(transformerNames)

  const components = []
  const snippets = $('textarea')
  console.log(
    `🔍  Found ${snippets.length} component${snippets.length === 1 ? '' : 's'}`,
  )

  for (let i = 0; i < snippets.length; i++) {
    const snippet = snippets[i]
    const $container = $(snippet.parentNode.parentNode.parentNode)
    const title = $('h3', $container)
      .text()
      .trim()

    const filename = cleanFilename(title)
    const path = `${url}/${filename}`
    const hash = crypto
      .createHash('sha1')
      .update(path)
      .digest('hex')

    let hasAlpine = false
    let $doc // doc to be transformed (either from snippet or preview)
    if (process.env.HTMLMODE === 'comments') {
      const html = $(snippet)
        .text()
        .trim()
      $doc = cheerio.load(html, { serialize })
    }
    if (process.env.BUILDINDEX === '1' || process.env.HTMLMODE === 'alpine') {
      const iframe = $container.parent().find('iframe')
      const preview = iframe.attr('srcdoc')

      const $previewdoc = cheerio.load(preview, { serialize })
      // if alpine mode, then transform from preview
      if (process.env.HTMLMODE === 'alpine') {
        $doc = $previewdoc
      }

      // download referenced css and js inside <head>
      const items = $previewdoc('head>link,head>script')
      for (let i = 0; i < items.length; i++) {
        const $item = $(items[i])
        const url = $item.attr('src') || $item.attr('href')
        if (!url.startsWith('/')) continue

        // check cache to see if we've already downloaded this file
        if (downloadCache.has(url)) continue

        // strip off id querystring
        const path = url.substring(0, url.indexOf('?id='))
        const dir = `${output}/preview${dirname(path)}`
        ensureDirExists(dir)
        const filePath = `${dir}/${basename(path)}`

        const response = await fetch(rootUrl + url)
        const content = await response.text()
        fs.writeFileSync(filePath, content)
        // just mark this url as already downloaded
        downloadCache.set(url, filePath)
      }

      // write alpine preview
      let dir = `${output}/preview/${dirname(path)}`
      ensureDirExists(dir)
      let filePath = `${dir}/${basename(path)}.html`
      console.log(`📸  Saving preview ${filename}.html`)
      fs.writeFileSync(filePath, preview)
      hasAlpine = /x-(data|show)/.test(preview)
    }
    const $body = applyTransformers(transformers, $doc, {
      rootUrl,
      output,
      title,
      path,
      fs,
    })('body')
    const $first = $body.children().first()
    // strip empty wrapper div if present
    const code = ($first.attr('class') === ''
      ? $first.html()
      : $body.html()
    ).trim()

    dir = `${output}/html${dirname(path)}`
    ensureDirExists(dir)

    filePath = `${dir}/${basename(path)}.html`
    console.log(`📝  Writing ${filename}.html`)
    fs.writeFileSync(filePath, code)

    components.push({
      hash,
      title,
      url: `${url}/${filename}.html`,
      source: `html/${url}/${filename}.html`,
      hasAlpine,
    })
  }
  return {
    [category]: {
      [subCategory]: {
        [section]: {
          url: `${url}/index.html`,
          components,
        },
      },
    },
  }
}

const login = async () => {
  const $ = await downloadPage('/login')
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

    if (!/alpine|comments/.test(htmlMode)) {
      console.log(
        `🚫  Unknown HTMLMODE '${htmlMode}' - should be alpine|comments`,
      )
      return 1
    }

    console.log('🔐  Logging into tailwindui.com...')
    const success = await login()
    if (!success) {
      console.log('🚫  Invalid credentials')
      return 1
    }
    console.log('✅  Success!\n')

    console.log(`🗂   Output is ${output}`)
    const $ = await downloadPage('/components')
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
      console.log(`⏳  Building index pages...`)
      buildIndexPage(output, library)
      console.log()
    }
  } catch (ex) {
    console.error('‼️  ', ex)
    return 1
  }
  console.log('🏁  Done!')
  return 0
})()
