# Path of Building 2 - Web Edition

[![Deploy to GitHub Pages](https://github.com/polaz/pob2-web/actions/workflows/deploy.yml/badge.svg)](https://github.com/polaz/pob2-web/actions/workflows/deploy.yml)

**[Live Demo](https://polaz.github.io/pob2-web/)**

Web-based PWA build planner for Path of Exile 2, inspired by [Path of Building Community Edition](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2).

## Features (Planned)

### Offensive & Defensive Calculations
- Calculate skill DPS, damage over time, and total damage output
- Factor in auras, buffs, charges, curses, and enemy resistances
- Compute life, mana, energy shield, armour, evasion, and block chance
- Full breakdown of how stats are calculated

### Passive Skill Tree Planner
- Interactive passive tree with WebGPU/WebGL rendering (PixiJS 8)
- Path tracing (hold Shift and hover to plan routes)
- Search for passive nodes by name or stat
- Support for all classes and ascendancies

### Skill & Gem System
- Configure skill gems and support links
- Automatic DPS calculations per skill setup
- Support for multiple skill groups

### Item Management
- Import items directly from game (Ctrl+C paste)
- Searchable unique item database
- Custom item crafting simulator
- Mod tier identification

### Build Sharing
- Generate shareable build codes
- Import/export builds
- Import characters from pathofexile.com

### PWA Features
- Works offline after first load
- Installable on desktop and mobile
- All data stored locally in browser (IndexedDB)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Quasar 2.x (Vue 3 + Composition API) |
| Language | TypeScript (strict mode) |
| State | Pinia |
| Rendering | PixiJS 8 (WebGPU → WebGL → Canvas) |
| Storage | Dexie.js (IndexedDB) |
| Workers | Comlink (Web Workers) |
| PWA | Workbox |

## Development

### Prerequisites

- **Node.js 20+** (24+ recommended)
- **Yarn 4.12+** (managed via `packageManager` field)

> Note: Yarn is automatically installed via corepack. If not enabled, run `corepack enable`.

### Install dependencies

```bash
yarn install
```

### Start development server

```bash
# SPA mode
yarn dev

# PWA mode
yarn dev:pwa
```

### Build for production

```bash
yarn build:pwa
```

### Run tests

```bash
yarn test           # Run all tests
yarn test:unit      # Unit tests only
yarn test:cov       # With coverage report
```

### Lint & Type Check

```bash
yarn lint
yarn type-check
```

## Project Structure

```
src/
├── components/     # Vue components
│   ├── tree/       # Passive tree renderer
│   ├── skills/     # Skill/gem management
│   ├── items/      # Item editor
│   └── stats/      # Stats display
├── engine/         # Calculation engine
├── workers/        # Web Workers (heavy computations)
├── stores/         # Pinia state stores
├── data/           # Game data (JSON)
│   ├── tree/       # Passive tree data
│   ├── gems/       # Gem definitions
│   └── mods/       # Modifier definitions
├── types/          # TypeScript definitions
└── protos/         # Generated protobuf types
```

## Credits

- Original [Path of Building](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2) by the PoB Community
- Game data from [Grinding Gear Games](https://www.pathofexile.com/)

## License

MIT
