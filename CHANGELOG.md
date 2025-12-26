# [1.21.0](https://github.com/polaz/pob2-web/compare/v1.20.1...v1.21.0) (2025-12-26)


### Features

* **items:** implement item editor UI with slot grid, editor modal, and comparison pane ([#130](https://github.com/polaz/pob2-web/issues/130)) ([82346a0](https://github.com/polaz/pob2-web/commit/82346a019bb0def34b7f9dc8edb10edc140b4876)), closes [#30](https://github.com/polaz/pob2-web/issues/30)

## [1.20.1](https://github.com/polaz/pob2-web/compare/v1.20.0...v1.20.1) (2025-12-26)


### Bug Fixes

* **tree:** filter cross-boundary connections between ascendancy and main tree ([f8a0e1b](https://github.com/polaz/pob2-web/commit/f8a0e1b083c2cd231487f7a60f2a052db8ca27e9))

# [1.20.0](https://github.com/polaz/pob2-web/compare/v1.19.1...v1.20.0) (2025-12-26)


### Features

* **utils:** implement build code encode/decode for PoB2 compatibility ([#128](https://github.com/polaz/pob2-web/issues/128)) ([520d7b0](https://github.com/polaz/pob2-web/commit/520d7b055b851e2262784770685339c2281fc87f)), closes [#36](https://github.com/polaz/pob2-web/issues/36)

## [1.19.1](https://github.com/polaz/pob2-web/compare/v1.19.0...v1.19.1) (2025-12-25)


### Bug Fixes

* **ci:** add proto generation step to all CI jobs ([452f4ec](https://github.com/polaz/pob2-web/commit/452f4ec8cffd3a23b0bd766ca4aef1e99dd0a898)), closes [#134](https://github.com/polaz/pob2-web/issues/134)

# [1.19.0](https://github.com/polaz/pob2-web/compare/v1.18.0...v1.19.0) (2025-12-25)


### Features

* **tree:** implement class and ascendancy selection ([#131](https://github.com/polaz/pob2-web/issues/131)) ([7c8ac4f](https://github.com/polaz/pob2-web/commit/7c8ac4f9af83cf3cc5e8ff9c8b84f7920c18bed1)), closes [#19](https://github.com/polaz/pob2-web/issues/19)

# [1.18.0](https://github.com/polaz/pob2-web/compare/v1.17.2...v1.18.0) (2025-12-25)


### Features

* **tree:** implement tree node connections and paths ([#126](https://github.com/polaz/pob2-web/issues/126)) ([b58087f](https://github.com/polaz/pob2-web/commit/b58087f44102cece5b93b65cc8916e46c5c1c7fd)), closes [#16](https://github.com/polaz/pob2-web/issues/16)

## [1.17.2](https://github.com/polaz/pob2-web/compare/v1.17.1...v1.17.2) (2025-12-25)


### Bug Fixes

* **tree:** implement linear node size scaling with zoom clamping ([e456af8](https://github.com/polaz/pob2-web/commit/e456af89f74f677ae481c8618a11763ab61bab2a))

## [1.17.1](https://github.com/polaz/pob2-web/compare/v1.17.0...v1.17.1) (2025-12-25)


### Bug Fixes

* **tree:** fix canvas centering and resize behavior ([71df6bf](https://github.com/polaz/pob2-web/commit/71df6bfe854d34b415ff9f2b0bb630eef222ea48))

# [1.17.0](https://github.com/polaz/pob2-web/compare/v1.16.0...v1.17.0) (2025-12-25)


### Bug Fixes

* **tree:** improve node rendering, sizing, and viewport centering ([1dd9069](https://github.com/polaz/pob2-web/commit/1dd906971e737f517a74259f20794247ed66e6fb))


### Features

* **items:** implement item slot management with validation ([#127](https://github.com/polaz/pob2-web/issues/127)) ([9beb31e](https://github.com/polaz/pob2-web/commit/9beb31e96ef95e1cc97bd12cf2d50e4361d4c68c)), closes [#29](https://github.com/polaz/pob2-web/issues/29)

# [1.16.0](https://github.com/polaz/pob2-web/compare/v1.15.0...v1.16.0) (2025-12-25)


### Bug Fixes

* **tree:** correct coordinate scaling and viewport centering for node visibility ([437e247](https://github.com/polaz/pob2-web/commit/437e247bdc5fb8a7764e27a55836a8101d0f24dc))


### Features

* **db:** implement build save/load with IndexedDB ([#112](https://github.com/polaz/pob2-web/issues/112)) ([64c39f1](https://github.com/polaz/pob2-web/commit/64c39f1340fc94efad556af7804992e2605df829)), closes [#35](https://github.com/polaz/pob2-web/issues/35)
* **tree:** implement passive tree node rendering ([#115](https://github.com/polaz/pob2-web/issues/115)) ([01874a7](https://github.com/polaz/pob2-web/commit/01874a71217046b3df092cf8221f6b7c55e359a2)), closes [#15](https://github.com/polaz/pob2-web/issues/15)

# [1.15.0](https://github.com/polaz/pob2-web/compare/v1.14.0...v1.15.0) (2025-12-25)


### Bug Fixes

* **tree:** wrap TreePage in q-page for proper height calculation ([6839cc1](https://github.com/polaz/pob2-web/commit/6839cc1902dabf2bf1ce59f8ac0c0cb216ce81da))


### Features

* **calc:** implement StatResolver and StatConversion ([#110](https://github.com/polaz/pob2-web/issues/110)) ([2a5c6d0](https://github.com/polaz/pob2-web/commit/2a5c6d020e954912c02471c36b6064f90a2cf1d8)), closes [#13](https://github.com/polaz/pob2-web/issues/13)
* **data:** convert PoB unique items to JSON format ([#9](https://github.com/polaz/pob2-web/issues/9)) ([#111](https://github.com/polaz/pob2-web/issues/111)) ([34ed370](https://github.com/polaz/pob2-web/commit/34ed370c01ca2efd75ac2da2b9e4e9c25cf705cd))
* **engine:** implement Item data structure and parsing ([#108](https://github.com/polaz/pob2-web/issues/108)) ([801ccee](https://github.com/polaz/pob2-web/commit/801cceef1e30c840906118429d8399e5647d989d)), closes [#28](https://github.com/polaz/pob2-web/issues/28)
* **leveling:** implement LevelingPath data model ([#107](https://github.com/polaz/pob2-web/issues/107)) ([30296c1](https://github.com/polaz/pob2-web/commit/30296c1df969ec4ae6756f8baa2ede9693e3c931)), closes [#67](https://github.com/polaz/pob2-web/issues/67)

# [1.14.0](https://github.com/polaz/pob2-web/compare/v1.13.0...v1.14.0) (2025-12-25)


### Features

* **draft:** implement draft overlay layer for user contributions ([#105](https://github.com/polaz/pob2-web/issues/105)) ([0e84dfa](https://github.com/polaz/pob2-web/commit/0e84dfa97ecc3c8d326bb32e00b30d0abd18bc10)), closes [#57](https://github.com/polaz/pob2-web/issues/57)

# [1.13.0](https://github.com/polaz/pob2-web/compare/v1.12.0...v1.13.0) (2025-12-25)


### Features

* **tree:** setup PixiJS 8 canvas with WebGPU fallback ([#101](https://github.com/polaz/pob2-web/issues/101)) ([2ba2621](https://github.com/polaz/pob2-web/commit/2ba2621b91b0086681065253f2d68ee7392686df)), closes [#14](https://github.com/polaz/pob2-web/issues/14)

# [1.12.0](https://github.com/polaz/pob2-web/compare/v1.11.0...v1.12.0) (2025-12-25)


### Features

* **search:** implement n-gram indexed i18n search service ([#106](https://github.com/polaz/pob2-web/issues/106)) ([f251d85](https://github.com/polaz/pob2-web/commit/f251d85d4f55b2ad6b5689058ca7b0e40bd8c906)), closes [#55](https://github.com/polaz/pob2-web/issues/55)

# [1.11.0](https://github.com/polaz/pob2-web/compare/v1.10.0...v1.11.0) (2025-12-25)


### Features

* **data:** convert PoB item base data to JSON format ([#103](https://github.com/polaz/pob2-web/issues/103)) ([6a35b0e](https://github.com/polaz/pob2-web/commit/6a35b0ef407f3572eba6036aec6c6672a55727c1)), closes [#7](https://github.com/polaz/pob2-web/issues/7)

# [1.10.0](https://github.com/polaz/pob2-web/compare/v1.9.0...v1.10.0) (2025-12-25)


### Features

* **data:** extract complete skill stats from PoB2 Skills/*.lua ([#102](https://github.com/polaz/pob2-web/issues/102)) ([f76cbbb](https://github.com/polaz/pob2-web/commit/f76cbbb9d4ffc7b2753db168c6c0f7ebd069694f)), closes [#99](https://github.com/polaz/pob2-web/issues/99)

# [1.9.0](https://github.com/polaz/pob2-web/compare/v1.8.1...v1.9.0) (2025-12-25)


### Features

* **engine:** implement ModParser with data/logic separation ([#91](https://github.com/polaz/pob2-web/issues/91)) ([31bd3ec](https://github.com/polaz/pob2-web/commit/31bd3ec5f2180016d8b229617ed10c1b96f5db02)), closes [#12](https://github.com/polaz/pob2-web/issues/12)

## [1.8.1](https://github.com/polaz/pob2-web/compare/v1.8.0...v1.8.1) (2025-12-25)


### Performance Improvements

* **engine:** optimize ModDB size getter and removeBySource ([#90](https://github.com/polaz/pob2-web/issues/90)) ([3660e14](https://github.com/polaz/pob2-web/commit/3660e1445da155f55d3e85fd0d0f02f5df8e1d30))

# [1.8.0](https://github.com/polaz/pob2-web/compare/v1.7.0...v1.8.0) (2025-12-25)


### Features

* **engine:** implement ModList for ordered modifier collections ([#89](https://github.com/polaz/pob2-web/issues/89)) ([6d1be6c](https://github.com/polaz/pob2-web/commit/6d1be6caee59fe382fd4a61d5ee9461c8c8f3c3e)), closes [#11](https://github.com/polaz/pob2-web/issues/11)

# [1.7.0](https://github.com/polaz/pob2-web/compare/v1.6.0...v1.7.0) (2025-12-25)


### Features

* **engine:** implement ModDB modifier database for calculations ([#66](https://github.com/polaz/pob2-web/issues/66)) ([44bea78](https://github.com/polaz/pob2-web/commit/44bea78e77ebae37de6077f2bca1aa6df948dc01)), closes [#10](https://github.com/polaz/pob2-web/issues/10)

# [1.6.0](https://github.com/polaz/pob2-web/compare/v1.5.0...v1.6.0) (2025-12-25)


### Features

* **data:** convert PoB modifier data to JSON format ([#65](https://github.com/polaz/pob2-web/issues/65)) ([c5cbe7d](https://github.com/polaz/pob2-web/commit/c5cbe7d5064315b7125b0a6f9d9084795812a5b2)), closes [#8](https://github.com/polaz/pob2-web/issues/8)

# [1.5.0](https://github.com/polaz/pob2-web/compare/v1.4.0...v1.5.0) (2025-12-25)


### Features

* **data:** implement gem data system with lazy loading ([#63](https://github.com/polaz/pob2-web/issues/63)) ([e5533eb](https://github.com/polaz/pob2-web/commit/e5533ebb7bc48a4da8cc76ba910f52e5fb2aeca0))

# [1.4.0](https://github.com/polaz/pob2-web/compare/v1.3.0...v1.4.0) (2025-12-25)


### Features

* **tree:** implement passive tree data loading and graph traversal ([#54](https://github.com/polaz/pob2-web/issues/54)) ([b55a0c9](https://github.com/polaz/pob2-web/commit/b55a0c97a310e3533f17f7f13937fcdf7b43c48a)), closes [#5](https://github.com/polaz/pob2-web/issues/5)

# [1.3.0](https://github.com/polaz/pob2-web/compare/v1.2.0...v1.3.0) (2025-12-25)


### Features

* **stores:** setup Pinia stores for state management ([#53](https://github.com/polaz/pob2-web/issues/53)) ([b2551d5](https://github.com/polaz/pob2-web/commit/b2551d5112cd84207187a01887d9eec0a34e26e7)), closes [#4](https://github.com/polaz/pob2-web/issues/4)

# [1.2.0](https://github.com/polaz/pob2-web/compare/v1.1.0...v1.2.0) (2025-12-24)


### Features

* **types:** implement proto-first type architecture ([#51](https://github.com/polaz/pob2-web/issues/51)) ([b9f0377](https://github.com/polaz/pob2-web/commit/b9f0377516062c6aea78b24ec1b27514d8dfc920)), closes [#3](https://github.com/polaz/pob2-web/issues/3)
* **workers:** setup Web Worker infrastructure with Comlink ([#52](https://github.com/polaz/pob2-web/issues/52)) ([89bfb5e](https://github.com/polaz/pob2-web/commit/89bfb5ee2f4d8e8a015e29e0471d544265162dc8)), closes [#2](https://github.com/polaz/pob2-web/issues/2)

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
