# tailwindui-crawler

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->

[![All Contributors](https://img.shields.io/badge/all_contributors-2-orange.svg?style=flat-square)](#contributors-)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

<img src="tailwindui-crawler.png">

This script will crawl the https://tailwindui.com website and download all the
component HTML to the `./output` folder.

## 🛠 How to use

To install, clone this repo and run `yarn` to pull down the dependencies.

Then create a `.env` file with your email, password, and optional output folder.

```ini
EMAIL=youremail
PASSWORD=yourpassword
OUTPUT=/path/to/output #optional, defaults to ./output
```

Then finally, run `node index.js`

The script will login to https://tailwindui.com with your credentials, and download all the
components as individual HTML files in the `./output` folder.

## 🤔 What's it for?

The benefit of pulling down all the components is that you can commit them to a local or
private repo, and by running this periodically, you can see exactly which files were added
or changed. Hopefully, some time in the future, they will open up a private repo for those
that have purchased the library.

## ⚠️ Warning

NOTE: Since this script is essentially screen scraping, there's the potential
of it breaking if the HTML structure changes. I will do my best to keep it in sync with
the website.

## 😍 Thank you

Thanks to Adam and Steve for making an amazing library. This has definitely made creating
a UI for my applications a pleasant experience.

Enjoy and let me know if you have any questions.

Kiliman

## Contributors ✨

Thanks goes to these wonderful people ([emoji key](https://allcontributors.org/docs/en/emoji-key)):

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/kiliman"><img src="https://avatars3.githubusercontent.com/u/47168?v=4" width="100px;" alt=""/><br /><sub><b>Kiliman</b></sub></a><br /><a href="https://github.com/kiliman/tailwindui-crawler/commits?author=kiliman" title="Code">💻</a></td>
    <td align="center"><a href="http://www.cemfi.de"><img src="https://avatars0.githubusercontent.com/u/8217108?v=4" width="100px;" alt=""/><br /><sub><b>Simon Waloschek</b></sub></a><br /><a href="https://github.com/kiliman/tailwindui-crawler/commits?author=sonovice" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
