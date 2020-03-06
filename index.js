require('dotenv').config()
const fs = require('fs')
const nodeFetch = require('node-fetch')
const fetch = require('fetch-cookie/node-fetch')(nodeFetch)
const formurlencoded = require('form-urlencoded').default
const cheerio = require('cheerio')
const rootUrl = 'https://tailwindui.com'
const output = './output'

const downloadPage = async url => {
  const response = await fetch(rootUrl + url)
  const html = await response.text()
  return cheerio.load(html)
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

const processComponentPage = async url => {
  const $ = await downloadPage(url)
  const snippets = $('textarea')
  console.log(
    `* Found ${snippets.length} snippet${snippets.length === 1 ? '' : 's'}`,
  )
  for (let i = 0; i < snippets.length; i++) {
    const snippet = snippets[i]
    const dir = `${output}${url}`
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    const container = $(snippet.parentNode.parentNode.parentNode)
    const title = $('h3', container, $).text()
    const code = $(snippet).text()
    const path = `${dir}/${cleanFilename(title)}.html`
    console.log(`Writing ${path}...`)
    fs.writeFileSync(path, code)
  }
}

const login = async () => {
  const $ = await downloadPage('/login')
  const _token = $('input[name="_token"]').val()

  await postData('/login', {
    _token,
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
    remember: 'true',
  })
}

const cleanFilename = filename => filename.toLowerCase().replace(/[^\w.]/g, '_')

;(async function() {
  if (!fs.existsSync(output)) {
    fs.mkdirSync(output)
  }

  await login()

  const $ = await downloadPage('/components', false)
  const links = $('.grid a')
  for (let i = 0; i < links.length; i++) {
    const link = links[i]
    const url = $(link).attr('href')
    console.log(`Processing ${url}...`)
    await processComponentPage(url)
    console.log()
  }
})()
