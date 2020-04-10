module.exports = function($, { rootUrl }) {
  $('img').each((_, img) => {
    const $img = $(img)
    const src = $img.attr('src')
    const startsWithHttp = src.indexOf('http') === 0
    $img.attr('src', startsWithHttp ? src : `${rootUrl}${src}`)
  })
}
