# tailwindui-crawler

<!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->

[![All Contributors](https://img.shields.io/badge/all_contributors-4-orange.svg?style=flat-square)](#contributors-)

<!-- ALL-CONTRIBUTORS-BADGE:END -->

<img src="./images/tailwindui-crawler.png">

This script will crawl the tailwindui.com website and download all the
component HTML to the `./output` folder.

## 🛠 How to use

To install, clone this repo and run `yarn` to pull down the dependencies.

Then create a `.env` file with your email, password, and optional output folder.

```ini
EMAIL=youremail
PASSWORD=yourpassword
OUTPUT=/path/to/output # optional, defaults to ./output
TRANSFORMERS=... # comma-delimited list of transformers (see below)
BUILDINDEX=(0 | 1)  # generate index file to view components offline
```

Then finally, run `yarn start`

The script will login to tailwindui.com with your credentials, and download all the
components as individual HTML files in the `./output` folder.

## 🤔 What's it for?

The benefit of pulling down all the components is that you can commit them to a local or
private repo, and by running this periodically, you can see exactly which files were added
or changed. Hopefully, some time in the future, they will open up a private repo for those
that have purchased the library.

## 🚀 New v2.0

The crawler has been re-written to make it easier to update the processing pipeline by simply
adding a new transformer function.

It also adds the ability to generate an index page that emulates the tailwindui.com website
so you can browse components offline.

### 🔄 Transformers

Each transformer is simply a JavaScript file (in `./transformers` folder) that exports a
function to be called from the processing pipeline. Each transformer will take a [cheerio](https://github.com/cheeriojs/cheerio)
instance (basically a jQuery-like interface) which enables the transformer to update the
generated HTML. The crawler will call each transformer in turn, then writes the final HTML file.

To add a new transformer, update the `TRANSFORMERS` key in the `.env` file. This is a comma-delimited
list of transformers. The crawler will call each transformer in the specified order.

The following transformers are availble:

- `addTailwindCss` - adds link to tailwindui.css
- `prefixSrc` - adds `https://tailwindui.com` to any img src attribute that needs it
- `useInter` - adds link to Inter font css and styles
- `convertReact` - converts HTML component into React/JSX-compatible syntax
  - Use `.env` key `CONVERTREACT_OUTPUT` to specify which folder to save the React files to
    (defaults to currently configured `OUTPUT`). You can also use `$OUTPUT` to expand current
    value. For example: `CONVERTREACT_OUTPUT=$OUTPUT/react` will set the value to value of `OUTPUT` plus `/react`
  - This transformer will create a folder for each component with an `index.js` file (this is the
    React component) and an `index.html` page which is a simple wrapper that will load the React component
    to verify it is working. NOTE: The transformer does not currently update the `alpine.js` code, so
    the component does not support state or interactivity. However, that is on the TODO list.
  - You can use [Parcel](https://parceljs.org) to test the React component.
  - Based on [gist](https://gist.github.com/RobinMalfait/a90e8651196c273dfa51eec0f43e1676) by [@RobinMalfait](https://github.com/RobinMalfait)

### 🗂 Index page

You can set the `.env` key `BUILDINDEX=1` to have the crawler generate an index file similar to the
components page on tailwindui.com. Install and run the [serve](https://www.npmjs.com/package/serve) package
to view the index.

```bash
yarn add -g serve
serve
```

#### Main index page

<img src="./images/index-main.png" alt="Main index page" style="box-shadow: 5px 5px 25px 5px rgba(0,0,0,0.5);"/>

#### Component section page

<img src="./images/index-section.png" alt="Components section page" style="box-shadow: 5px 5px 25px 5px rgba(0,0,0,0.5);"/>

#### Click button to view syntax highlighted code

<img src="./images/index-component-code.png" alt="Code for component" style="box-shadow: 5px 5px 25px 5px rgba(0,0,0,0.5);"/>

You can view each component and the highlighted code. Currently resizing and copying code is not supported.

### ⚙️ Example `.env` file

```ini
EMAIL=******
PASSWORD=******
OUTPUT=$HOME/Projects/oss/tailwindui
BUILDINDEX=1
TRANSFORMERS=addTailwindCss,prefixSrc,useInter,convertReact
CONVERTREACT_OUTPUT=$OUTPUT/react
```

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
    <td align="center"><a href="https://github.com/kiliman"><img src="https://avatars3.githubusercontent.com/u/47168?v=4&size=100" width="100px;" alt=""/><br /><sub><b>Kiliman</b></sub></a></td>
    <td align="center"><a href="http://www.cemfi.de"><img src="https://avatars0.githubusercontent.com/u/8217108?v=4&size=100" width="100px;" alt=""/><br /><sub><b>Simon Waloschek</b></sub></a></td>
    <td align="center"><a href="https://github.com/nawok"><img src="https://avatars3.githubusercontent.com/u/159773?v=4&size=100" width="100px;" alt=""/><br /><sub><b>Pavel Fomchenkov</b></sub></a></td>
    <td align="center"><a href="https://robinmalfait.com"><img src="https://avatars2.githubusercontent.com/u/1834413?v=4&size=100" width="100px;" alt=""/><br /><sub><b>Robin Malfait</b></sub></a></td>
  </tr>
</table>

<!-- markdownlint-enable -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

This project follows the [all-contributors](https://github.com/all-contributors/all-contributors) specification. Contributions of any kind welcome!
