# CHANGELOG

## v4.1.0

- ✨ Add COMPONENTS option to specify which component packages to download (defaults to all) [#71](https://github.com/kiliman/tailwindui-crawler/issues/71)

## v4.0.2

- 🐛 fix TypeError: reject.err is not a function [#77](https://github.com/kiliman/tailwindui-crawler/pull/77)

## v4.0.1

- 🔨 Specify node version supported node >= 12
- 🐛 Replace `??` with `||` to support node version before v14.5 [#73](https://github.com/kiliman/tailwindui-crawler/issues/73)

## v4.0.0

- ✨ Support new tailwindui.com site structure
- ✨ Add ability to download new Page Templates `TEMPLATES=1`

## v3.2.3

- 🐛 Fixes issue with parsing Alpine "preview" when not vaild HTML [#60](https://github.com/kiliman/tailwindui-crawler/issues/60)

## v3.2.2

- 🔨 Replace email with License User in preview
- 📦 Update package versions

## v3.2.1

- 🐛 Use correct selector to get component title due to change in format

## v3.2.0

- ✨ Add bin to package [#51](https://github.com/kiliman/tailwindui-crawler/issues/51)
- ✨ Allow preview index to be relative to file not cwd [#50](https://github.com/kiliman/tailwindui-crawler/issues/50)
- ♻️ Refactor fetch to fetchWithRetry

## v3.1.6

- 🔥 Remove optional chaining to support older node versions
- 🔥 Remove rewriting image URL now that images are downloaded locally

## v3.1.5

- 😍 Add @Yagnik as contributor
- 🔨 Allow downloading images for preview [#48](https://github.com/kiliman/tailwindui-crawler/issues/48)

## v3.1.4

- 🔨 Remove ?id=hash from HTML
