module.exports = function($, { rootUrl }) {
  updateColor($, $('body'))
}

function updateColor($, $parent) {
  let _class = $parent.attr('class')
  if (_class) {
    $parent.attr(
      'class',
      _class.replace(/\bindigo\b/g, process.env.CHANGECOLOR_TO),
    )
  }

  $parent.children().each((_, child) => {
    updateColor($, $(child))
  })
}
