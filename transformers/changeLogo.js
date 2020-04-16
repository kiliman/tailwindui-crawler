module.exports = function($) {
  $('img').each((_, img) => {
    const $img = $(img)
    const src = $img.attr('src')
    const isLogo = src.indexOf('/logos/') !== -1
    $img.attr('src', isLogo ? process.env.CHANGELOGO_URL : src)
  })
}
