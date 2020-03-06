# tailwindui-crawler

This script will crawl the https://tailwindui.com website and download all the
component HTML to the `./output` folder.

## 🛠 How to use

To install, clone this repo and run `yarn` to pull down the dependencies.

Then create a `.env` file with your email and password.

```ini
EMAIL=youremail
PASSWORD=yourpassword
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
