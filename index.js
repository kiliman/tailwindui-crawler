require('dotenv-expand')(require('dotenv').config())
const fs = require('fs')
const crypto = require('crypto')
const nodeFetch = require('node-fetch')
const fetch = require('fetch-cookie/node-fetch')(nodeFetch)
// @ts-ignore
const formurlencoded = require('form-urlencoded').default
const cheerio = require('cheerio')
const serialize = require('dom-serializer')
const { dirname, basename } = require('path')
const { mergeDeep, cleanFilename, ensureDirExists } = require('./utils')

const rootUrl = 'https://tailwindui.com'
const output = process.env.OUTPUT || './output'

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

  const transformerNames = process.env.TRANSFORMERS.split(',')
  const transformers = []
  transformerNames.forEach(name => {
    transformers.push(require(`./transformers/${name}`))
  })

  const components = []
  const snippets = $('textarea')
  console.log(
    `* Found ${snippets.length} snippet${snippets.length === 1 ? '' : 's'}`,
  )
  for (let i = 0; i < snippets.length; i++) {
    const snippet = snippets[i]
    const container = $(snippet.parentNode.parentNode.parentNode)
    const title = $('h3', container)
      .text()
      .trim()

    const filename = cleanFilename(title)
    const path = `${url}/${filename}`
    const hash = crypto
      .createHash('sha1')
      .update(path)
      .digest('hex')

    const code = applyTransformers(
      transformers,
      // @ts-ignore
      cheerio.load($(snippet).text(), {
        serialize,
      }),
      {
        rootUrl,
        output,
        title,
        path,
        fs,
      },
    ).html()

    const dir = `${output}${dirname(path)}`
    ensureDirExists(dir)

    const filePath = `${dir}/${basename(path)}.html`
    components.push({ hash, title, url: filePath })
    console.log(`Writing ${filePath}...`)
    fs.writeFileSync(filePath, code)
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

    await login()
    const library = {}

    const $ = await downloadPage('/components')
    const links = $('.grid a')
    const count = 1 //links.length
    for (let i = 0; i < count; i++) {
      const link = links[i]
      const url = $(link).attr('href')
      console.log(`Processing ${url}...`)
      const components = await processComponentPage(url)
      mergeDeep(library, components)
      console.log()
    }
  } catch (ex) {
    console.log(ex)
    return 1
  }
  return 0
})()
