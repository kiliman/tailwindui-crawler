# tailwindui-crawler

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-8-orange.svg?style=flat-square)](#contributors-)
<!-- ALL-CONTRIBUTORS-BADGE:END -->

<img src="./images/tailwindui-crawler.png">

This script will crawl the [tailwindui.com](https://tailwindui.com) website and download all the
components to the `./output` folder.

## 🛠 How to use

To install, clone this repo and run `yarn` or `npm install` to pull down the dependencies.

Then create a `.env` file with your email, password, and optional output folder.

```ini
EMAIL=youremail
PASSWORD=yourpassword
OUTPUT=/path/to/output # optional, defaults to ./output
LANGUAGES=html,react,vue # defaults to html
BUILDINDEX=(0 | 1)  # generate index file to view components offline
```

> NOTE: The tool uses [dotenv-expand](https://github.com/motdotla/dotenv-expand) to support variable expansion like `$HOME/path/to/output`
> so if your password or any other value includes a `$`, make sure you add a `\` (backslash) to
> escape the `$`. For example, `PASSWORD=p@\$\$w0rd`

Then finally, run `yarn start` or `npm start`

The script will login to [tailwindui.com](https://tailwindui.com) with your credentials, and download all the
components as individual files in the `./output` folder.

## 🤔 What's it for?

The benefit of pulling down all the components is that you can commit them to a local or
private repo, and by running this periodically, you can see exactly which files were added
or changed. Hopefully, some time in the future, they will open up a private repo for those
that have purchased the library.

## 🚀 New v3.0

The crawler now supports the new Tailwind UI site and can download HTML, React
and Vue versions of the components.

It also adds the ability to generate an index page that emulates the [tailwindui.com](https://tailwindui.com) website
so you can browse components offline.

### 🗂 Preview page

You can set the `.env` key `BUILDINDEX=1` to have the crawler generate an index file similar to the components
page on [tailwindui.com](https://tailwindui.com). Install and run the [serve](https://www.npmjs.com/package/serve) package
to view the index.

> NOTE: The HTML Preview does not apply transformers. It's a copy of the
> component site on [tailwindui.com](https://tailwindui.com).

```bash
yarn global add serve
cd $OUTPUT # change to your OUTPUT folder
serve
```

### ⚙️ Example `.env` file

```ini
EMAIL=******
PASSWORD=******
OUTPUT=$HOME/Projects/oss/tailwindui
LANGUAGES=html,react,vue  # default is html
BUILDINDEX=1    # 0 | 1
```

## 🤖 Automatically keep a **private** GitHub Repository up-to-date

You can automatically keep a **private** GitHub repository up-to-date with component changes from TailwindUI by using this tool with GitHub Actions.

1. [Create a **private** GitHub repository](https://github.com/new/).
1. [Add `TAILWINDUI_EMAIL` and `TAILWINDUI_PASSWORD` secrets to the GitHub repository](https://help.github.com/en/actions/configuring-and-managing-workflows/creating-and-storing-encrypted-secrets#creating-encrypted-secrets).
1. [Optionally create a `.env` file with additional settings for the crawler](#%EF%B8%8F-example-env-file).
1. Create a new file `.github/workflows/default.yml`:

   ```yml
   name: Update
   on:
     schedule:
       - cron: '0 0 * * *' # Every day at midnight

   jobs:
     update:
       name: Update
       runs-on: ubuntu-latest
       steps:
         - name: Checkout
           uses: actions/checkout@v2
         - name: Run crawler
           uses: gregbrimble/tailwindui-crawler-action@v1.0.0
           with:
             email: ${{ secrets.TAILWINDUI_EMAIL }}
             password: ${{ secrets.TAILWINDUI_PASSWORD }}
   ```

   Read more about the schedule cron syntax in [the official GitHub Actions documentation](https://help.github.com/en/actions/reference/events-that-trigger-workflows#scheduled-events-schedule).

### Email Notifications

To be emailed whenever there is a change to a component, simply setup [GitHub Notifications](https://help.github.com/en/github/administering-a-repository/about-email-notifications-for-pushes-to-your-repository#enabling-email-notifications-for-pushes-to-your-repository) on your repository.

## 🚦 Upgrading to v3.

This is a major change. Unfortunately, v2 will no longer work with the existing
site due to the updates they may to add support for React/Vue components.

Currently, there is no support for transformers, as the need for them is not
as critical since the components don't need to be converted to React or Vue.

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
    <td align="center"><a href="https://github.com/kiliman"><img src="https://avatars3.githubusercontent.com/u/47168?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Kiliman</b></sub></a><br /><a href="https://github.com/kiliman/tailwindui-crawler/commits?author=kiliman" title="Code">💻</a></td>
    <td align="center"><a href="http://www.cemfi.de"><img src="https://avatars0.githubusercontent.com/u/8217108?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Simon Waloschek</b></sub></a><br /><a href="https://github.com/kiliman/tailwindui-crawler/commits?author=sonovice" title="Code">💻</a></td>
    <td align="center"><a href="https://github.com/nawok"><img src="https://avatars3.githubusercontent.com/u/159773?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Pavel Fomchenkov</b></sub></a><br /><a href="https://github.com/kiliman/tailwindui-crawler/commits?author=nawok" title="Code">💻</a></td>
    <td align="center"><a href="https://robinmalfait.com"><img src="https://avatars2.githubusercontent.com/u/1834413?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Robin Malfait</b></sub></a><br /><a href="https://github.com/kiliman/tailwindui-crawler/commits?author=RobinMalfait" title="Code">💻</a></td>
    <td align="center"><a href="https://miguelpiedrafita.com"><img src="https://avatars0.githubusercontent.com/u/23558090?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Miguel Piedrafita</b></sub></a><br /><a href="https://github.com/kiliman/tailwindui-crawler/commits?author=m1guelpf" title="Code">💻</a> <a href="https://github.com/kiliman/tailwindui-crawler/commits?author=m1guelpf" title="Documentation">📖</a> <a href="#ideas-m1guelpf" title="Ideas, Planning, & Feedback">🤔</a></td>
    <td align="center"><a href="https://github.com/vladdu"><img src="https://avatars0.githubusercontent.com/u/9707?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Vlad Dumitrescu</b></sub></a><br /><a href="https://github.com/kiliman/tailwindui-crawler/commits?author=vladdu" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/vesper8"><img src="https://avatars1.githubusercontent.com/u/816028?v=4?s=100" width="100px;" alt=""/><br /><sub><b>C-Bass</b></sub></a><br /><a href="https://github.com/kiliman/tailwindui-crawler/commits?author=vesper8" title="Code">💻</a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://gregbrimble.com/"><img src="https://avatars.githubusercontent.com/u/8484333?v=4?s=100" width="100px;" alt=""/><br /><sub><b>Greg Brimble</b></sub></a><br /><a href="https://github.com/kiliman/tailwindui-crawler/commits?author=GregBrimble" title="Documentation">📖</a> <a href="#tool-GregBrimble" title="Tools">🔧</a></td>
  </tr>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
