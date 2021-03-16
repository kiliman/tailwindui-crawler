# tailwindui-crawler

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->

[![All Contributors](https://img.shields.io/badge/all_contributors-7-orange.svg?style=flat-square)](#contributors-)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

<img src="./images/tailwindui-crawler.png">

This script will crawl the [tailwindui.com](https://tailwindui.com) website and download all the
component HTML to the `./output` folder.

## 🛠 How to use

To install, clone this repo and run `yarn` or `npm install` to pull down the dependencies.

Then create a `.env` file with your email, password, and optional output folder.

```ini
EMAIL=youremail
PASSWORD=yourpassword
OUTPUT=/path/to/output # optional, defaults to ./output
HTMLMODE=alpine|comments # save HTML with alpine (default) or comments
TRANSFORMERS=... # comma-delimited list of transformers (see below)
BUILDINDEX=(0 | 1)  # generate index file to view components offline
```

### ✨ New in v2.3

The Tailwind UI components have removed the Alpine.js code from the HTML. The
crawler now includes a `HTMLMODE` setting to include either the Alpine.js code
(`alpine` default) or download with HTML comments (`comments`).

There are also new transformers to change the color and logo of the HTML components.

> NOTE: The tool uses [dotenv-expand](https://github.com/motdotla/dotenv-expand) to support variable expansion like `$HOME/path/to/output`
> so if your password or any other value includes a `$`, make sure you add a `\` (backslash) to
> escape the `$`. For example, `PASSWORD=p@\$\$w0rd`

Then finally, run `yarn start` or `npm start`

The script will login to [tailwindui.com](https://tailwindui.com) with your credentials, and download all the
components as individual HTML files in the `./output` folder.

## 🤔 What's it for?

The benefit of pulling down all the components is that you can commit them to a local or
private repo, and by running this periodically, you can see exactly which files were added
or changed. Hopefully, some time in the future, they will open up a private repo for those
that have purchased the library.

## 🚀 New v2.0

The crawler has been re-written to make it easier to update the processing pipeline by simply
adding a new transformer function.

It also adds the ability to generate an index page that emulates the [tailwindui.com](https://tailwindui.com) website
so you can browse components offline.

### 🔄 Transformers

Each transformer is simply a JavaScript file (in `./transformers` folder) that exports a
function to be called from the processing pipeline. Each transformer will take a [cheerio](https://github.com/cheeriojs/cheerio)
instance (basically a jQuery-like interface) which enables the transformer to update the
generated HTML. The crawler will call each transformer in turn, then writes the final HTML file.

To add a new transformer, update the `TRANSFORMERS` key in the `.env` file. This is a comma-delimited
list of transformers. The crawler will call each transformer in the specified order.

The following transformers are availble:

<table>
<thead>
<tr><th>Transformer</th><th>Description</th></tr>
</thead>
<tbody>
<tr style="vertical-align: baseline;"><td><code>addTailwindCss</code></td><td>Adds link to tailwindui.css
<ul><li>Use <code>ADDTAILWINDCSS_URL</code> to specify URL to css (defaults to tailwindui CDN)</li>
</ul></td></tr>
<tr style="vertical-align: baseline;"><td><code>prefixSrc</code></td><td>Adds <code>https://tailwindui.com</code> to any img src attribute that needs it</td></tr>
<tr style="vertical-align: baseline;"><td><code>useInter</code></td><td>Adds link to Inter font css and styles</td></tr>

<tr style="vertical-align: baseline;"><td><code>convertVue</code></td><td>Converts HTML component into a Vue component
<ul><li>Use <code>.env</code> key <code>VUE_OUTPUT</code> to specify which folder to save the Vue files to (defaults to currently
configured <code>OUTPUT</code>)</li>
<li>This transformer will create a Vue component for each Tailwind UI component. This components may need some adjustements,
but should in most cases be ready to go. An index script is not included, so the components can't be viewed in the browser yet.</li>
</ul></td></tr>

<tr style="vertical-align: baseline;"><td><code>convertReact</code></td><td>Converts HTML component into React/JSX-compatible syntax
<ul><li>Use <code>.env</code> key <code>CONVERTREACT_OUTPUT</code> to specify which folder to save the React files to
(defaults to currently configured <code>OUTPUT</code>).</li>
<li>This transformer will create a folder for each component with an <code>index.js</code> file (this is the React component) and an <code>index.html</code>
page which is a simple wrapper that will load the React component to verify it is working. NOTE: The transformer does not currently update the
<code>alpine.js</code> code, so the component does not support state or interactivity. However, that is on the TODO list.</li>
<li>You can use <a href="https://parceljs.org">Parcel</a> to test the React component.</li>
<li>Based on <a href="https://gist.github.com/RobinMalfait/a90e8651196c273dfa51eec0f43e1676">gist</a> by <a href="https://github.com/RobinMalfait">@RobinMalfait</a></li>
</ul></td></tr>

<tr style="vertical-align: baseline;"><td><code>stripAlpine</code></td><td>Removes all the Alpine.js attributes from the markup
<ul><li>Use <code>.env</code> key <code>STRIPALPINE_OUTPUT</code> to specify which folder to save the files to. You must
specify the output folder to ensure the raw HTML files are not overwritten</li>
</ul></td></tr>
<tr style="vertical-align: baseline;"><td>✨v2.3 <code>changeColor</code></code></td><td>Changes the default color from <code>indigo</code> to value in <code>CHANGECOLOR_TO</code></td></tr>
<tr style="vertical-align: baseline;"><td>✨v2.3 <code>changeLogo</code></code></td><td>Changes the logo image from the generic to URL in <code>CHANGELOGO_URL</code></td></tr>
<tr style="vertical-align: baseline;"><td>✨v2.4 <code>prefixClasses</code></code></td><td>Adds prefix specified in <code>PREFIXCLASSES_PREFIX</code> to all Tailwind classes
<ul><li>NOTE: You will want to use the <code>addTailwindCss</code> transformer and specify the URL to your custom css in <code>ADDTAILWINDCSS_URL</code></li>
</ul></td></tr>
</tbody>
</table>

### 🗂 Preview page

You can set the `.env` key `BUILDINDEX=1` to have the crawler generate an index file similar to the components
page on [tailwindui.com](https://tailwindui.com). Install and run the [serve](https://www.npmjs.com/package/serve) package
to view the index.

> NOTE: The HTML Preview does not apply transformers. It's a copy of the
> component site on [tailwindui.com](https://tailwindui.com). However, the **CODE** button will show the transformed code. It now includes
> the ability to resize the iframe. All existing interactivity should work. The **COPY** function is not available.

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
HTMLMODE=alpine # apline | comments
BUILDINDEX=1    # 0 | 1

TRANSFORMERS=addTailwindCss,prefixSrc,useInter,changeColor,changeLogo,prefixClasses,convertReact,stripAlpine

# addTailwindCss
ADDTAILWINDCSS_URL=http://localhost/path/to/css # defaults to twui CDN

# convertVue
VUE_OUTPUT=$OUTPUT/vue  # path to save Vue files (defaults to $OUTPUT)

# convertReact
CONVERTREACT_OUTPUT=$OUTPUT/react # path to save React files (default to $OUTPUT)

# stripAlpine
STRIPALPINE_OUTPUT=$OUTPUT/no-alpine # path to save stripped HTML files (REQUIRED)

# changeColor
CHANGECOLOR_TO=red # name of color to change from indigo

# changeLogo
CHANGELOGO_URL=http://localhost/path/to/logo # URL of logo (defaults to generic tailwind logo)

# prefixClasses
PREFIXCLASSES_PREFIX=tw- # adds prefix to all tailwind classes
```

## Automatically keep a **private** GitHub Repository up-to-date

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

## 🚦 Upgrading to v2.

Since the transformers can make a lot of changes to the files, I would recommend
you run the current crawler first to generate the diffs and commit those. Then upgrade
and run with transformers enabled. This way you're not mixing up changes.

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
    <td align="center"><a href="https://github.com/nawok"><img src="https://avatars3.githubusercontent.com/u/159773?v=4" width="100px;" alt=""/><br /><sub><b>Pavel Fomchenkov</b></sub></a><br /><a href="https://github.com/kiliman/tailwindui-crawler/commits?author=nawok" title="Code">💻</a></td>
    <td align="center"><a href="https://robinmalfait.com"><img src="https://avatars2.githubusercontent.com/u/1834413?v=4" width="100px;" alt=""/><br /><sub><b>Robin Malfait</b></sub></a><br /><a href="https://github.com/kiliman/tailwindui-crawler/commits?author=RobinMalfait" title="Code">💻</a></td>
    <td align="center"><a href="https://miguelpiedrafita.com"><img src="https://avatars0.githubusercontent.com/u/23558090?v=4" width="100px;" alt=""/><br /><sub><b>Miguel Piedrafita</b></sub></a><br /><a href="https://github.com/kiliman/tailwindui-crawler/commits?author=m1guelpf" title="Code">💻</a> <a href="https://github.com/kiliman/tailwindui-crawler/commits?author=m1guelpf" title="Documentation">📖</a> <a href="#ideas-m1guelpf" title="Ideas, Planning, & Feedback">🤔</a></td>
    <td align="center"><a href="https://github.com/vladdu"><img src="https://avatars0.githubusercontent.com/u/9707?v=4" width="100px;" alt=""/><br /><sub><b>Vlad Dumitrescu</b></sub></a><br /><a href="https://github.com/kiliman/tailwindui-crawler/commits?author=vladdu" title="Documentation">📖</a></td>
    <td align="center"><a href="https://github.com/vesper8"><img src="https://avatars1.githubusercontent.com/u/816028?v=4" width="100px;" alt=""/><br /><sub><b>C-Bass</b></sub></a><br /><a href="https://github.com/kiliman/tailwindui-crawler/commits?author=vesper8" title="Code">💻</a></td>
  </tr>
</table>

<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
