# [1.1.0](https://github.com/polaz/pob2-web/compare/v1.0.6...v1.1.0) (2025-12-24)


### Features

* **db:** implement Dexie.js database for offline storage ([#48](https://github.com/polaz/pob2-web/issues/48)) ([de00ce2](https://github.com/polaz/pob2-web/commit/de00ce2235c332b2aceb3ff3d1a4c24d2f31ab11))

## [1.0.6](https://github.com/polaz/pob2-web/compare/v1.0.5...v1.0.6) (2025-12-24)


### Bug Fixes

* **ci:** update package.json version before building ([7160acb](https://github.com/polaz/pob2-web/commit/7160acb393bdfb147075cbe1c85b9d4ce6fa1abd))

## [1.0.5](https://github.com/polaz/pob2-web/compare/v1.0.4...v1.0.5) (2025-12-24)


### Bug Fixes

* **ci:** build only native arch on each macOS runner ([5a28ebe](https://github.com/polaz/pob2-web/commit/5a28ebed20a482bc220f442eb9959f765c633a92))
* **config:** cast BUILD_ARCH to correct ArchType ([dd5bf2d](https://github.com/polaz/pob2-web/commit/dd5bf2db1b3e10d9484129f7610a3fce4178cd6a))

## [1.0.4](https://github.com/polaz/pob2-web/compare/v1.0.3...v1.0.4) (2025-12-24)


### Bug Fixes

* **config:** correct publish conditional logic to use ternary ([4e2eb19](https://github.com/polaz/pob2-web/commit/4e2eb19785dad83049ac556c46c304294cda7e1d))

## [1.0.3](https://github.com/polaz/pob2-web/compare/v1.0.2...v1.0.3) (2025-12-24)


### Bug Fixes

* **ci:** conditionally disable publish config via PUBLISH env ([82cb93a](https://github.com/polaz/pob2-web/commit/82cb93a761493bbc6499e8b740e8ebc21ce88c4a))

## [1.0.2](https://github.com/polaz/pob2-web/compare/v1.0.1...v1.0.2) (2025-12-24)


### Bug Fixes

* **ci:** pass GH_TOKEN to electron build for publisher init ([0c7f66f](https://github.com/polaz/pob2-web/commit/0c7f66f6864919ca28f9e40dbac8daabbd6646cb))

## [1.0.1](https://github.com/polaz/pob2-web/compare/v1.0.0...v1.0.1) (2025-12-24)


### Bug Fixes

* **ci:** add PUBLISH=never env to prevent auto-publish in CI ([64a8fc8](https://github.com/polaz/pob2-web/commit/64a8fc8d0339ebfb7c2a05728ab9a80201f8699b))

# 1.0.0 (2025-12-24)


### Bug Fixes

* **ci:** configure git for Yarn 4 git dependencies ([65afc82](https://github.com/polaz/pob2-web/commit/65afc824920adcb158223b2d34bf930deceb0cf9))
* **ci:** remove --immutable flag for git-based dependencies ([99f942d](https://github.com/polaz/pob2-web/commit/99f942d20e426caec47dd298ad7c3721bd25b7fa))
* **ci:** restore --immutable with npm resolution for @electron/node-gyp ([30d4708](https://github.com/polaz/pob2-web/commit/30d470893946b99b01d13dded65fda98a58b95ce))
* **ci:** trigger release with corrected macOS runners ([298cb05](https://github.com/polaz/pob2-web/commit/298cb05ca20005804febd401c8ccf847f6003bb6))
* **electron:** resolve cross-compilation issues for macOS ARM64 ([06fccb6](https://github.com/polaz/pob2-web/commit/06fccb68da256e3981daa72bef5ef53ffbf0eab0))
* **pwa:** resolve ESLint errors and update README ([e514235](https://github.com/polaz/pob2-web/commit/e514235f894cd0b54928d7e7768ea54b6c70521b))


### Features

* **build:** upgrade to Yarn 4.6.0 and update all dependencies ([4806e22](https://github.com/polaz/pob2-web/commit/4806e225a91ebf101db838c9192ee4168d58b013))
* **electron:** add desktop app with auto-update and semantic-release ([62e4b90](https://github.com/polaz/pob2-web/commit/62e4b90ad46af5796442d1fb34d55fa3f733d64a))

# 1.0.0 (2025-12-24)


### Bug Fixes

* **ci:** trigger release with corrected macOS runners ([298cb05](https://github.com/polaz/pob2-web/commit/298cb05ca20005804febd401c8ccf847f6003bb6))
* **electron:** resolve cross-compilation issues for macOS ARM64 ([06fccb6](https://github.com/polaz/pob2-web/commit/06fccb68da256e3981daa72bef5ef53ffbf0eab0))
* **pwa:** resolve ESLint errors and update README ([e514235](https://github.com/polaz/pob2-web/commit/e514235f894cd0b54928d7e7768ea54b6c70521b))


### Features

* **electron:** add desktop app with auto-update and semantic-release ([62e4b90](https://github.com/polaz/pob2-web/commit/62e4b90ad46af5796442d1fb34d55fa3f733d64a))

# 1.0.0 (2025-12-24)


### Bug Fixes

* **electron:** resolve cross-compilation issues for macOS ARM64 ([06fccb6](https://github.com/polaz/pob2-web/commit/06fccb68da256e3981daa72bef5ef53ffbf0eab0))
* **pwa:** resolve ESLint errors and update README ([e514235](https://github.com/polaz/pob2-web/commit/e514235f894cd0b54928d7e7768ea54b6c70521b))


### Features

* **electron:** add desktop app with auto-update and semantic-release ([62e4b90](https://github.com/polaz/pob2-web/commit/62e4b90ad46af5796442d1fb34d55fa3f733d64a))

# 1.0.0 (2025-12-24)


### Bug Fixes

* **pwa:** resolve ESLint errors and update README ([e514235](https://github.com/polaz/pob2-web/commit/e514235f894cd0b54928d7e7768ea54b6c70521b))


### Features

* **electron:** add desktop app with auto-update and semantic-release ([62e4b90](https://github.com/polaz/pob2-web/commit/62e4b90ad46af5796442d1fb34d55fa3f733d64a))
