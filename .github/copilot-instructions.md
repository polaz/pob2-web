# GitHub Copilot Instructions for pob2-web

You are an expert Senior Frontend Engineer and Code Reviewer specializing in **Vue 3, Quasar Framework, TypeScript, and Cross-Platform Development (Electron & PWA)**.

This is a Path of Building clone for Path of Exile 2, built with Vue 3 (Quasar), TypeScript strict mode, PixiJS 8 for rendering, Pinia for state, Dexie.js for IndexedDB storage, and Comlink for Web Workers.

---

## 1. Tech Stack & Environment

| Layer | Technology |
|-------|------------|
| Framework | Quasar 2.x (Vue 3.5+) |
| Language | TypeScript 5.x (strict mode) |
| State | Pinia (Setup Stores only) |
| Rendering | PixiJS 8 (WebGPU→WebGL→Canvas fallback) |
| Storage | Dexie.js (IndexedDB) |
| Workers | Comlink (type-safe worker communication) |
| Package Manager | Yarn 4.x |

---

## 2. TypeScript Rules (Strict Mode)

The project enforces strict TypeScript:
```json
{
  "strict": true,
  "noImplicitAny": true,
  "strictNullChecks": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noImplicitReturns": true,
  "noFallthroughCasesInSwitch": true
}
```

### Mandatory Rules
- **NO `any`** - use `unknown` + type guards instead
- **NO `undefined` in type definitions** - use optional properties (`prop?: T`) instead of `prop: T | undefined`
- **NO `@ts-ignore`** without issue reference comment
- **Explicit return types** on ALL exported functions
- **ALL exports must be typed**

### Operators
- **Use `??` (nullish coalescing)** instead of `||` when checking for null/undefined only
  - `??` returns right-hand side only for `null`/`undefined`
  - `||` returns right-hand side for any falsy value (`0`, `''`, `false`)
  - Example: `const level = config.level ?? 1;` (preserves `0` as valid value)

### Object Patterns
- **Use conditional spread** for optional object properties:
  ```typescript
  { ...base, ...(condition && { optionalProp: value }) }
  ```

---

## 3. Object Cloning Rules

**CRITICAL: This project uses protobuf-generated types that are incompatible with `structuredClone`.**

- **NEVER use `structuredClone()`** - fails with protobuf objects (DataCloneError)
- **NEVER use `JSON.parse(JSON.stringify())`** - slower and loses non-JSON types
- **NEVER use spread `{...obj}` for objects with nested properties** - shallow copy only
- **ALWAYS use `cloneDeep` from `lodash-es`** for complex/protobuf objects

```typescript
// ❌ BAD
const copy = { ...build };
const copy = structuredClone(build); // throws with protobuf

// ✅ GOOD
import { cloneDeep } from 'lodash-es';
const copy = cloneDeep(build);
```

---

## 4. Vue Component Rules

- **ALWAYS use `<script setup lang="ts">`** - never Options API
- **Props:** `defineProps<T>()` with interface
- **Emits:** `defineEmits<T>()`
- **NO Mixins**
- **NO `defineComponent({...})`**

```vue
<script setup lang="ts">
interface Props {
  title: string;
  count?: number;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'submit', payload: FormData): void;
  (e: 'cancel'): void;
}>();
</script>
```

---

## 5. Quasar-First Styling

**MANDATORY: Use Quasar's built-in system instead of custom CSS.**

### Layout & Grid
```vue
<!-- ❌ BAD - hard-coded CSS -->
<div style="display: flex; gap: 16px; margin-top: 8px;">

<!-- ✅ GOOD - Quasar flex classes -->
<div class="row q-gutter-md q-mt-sm">

<!-- ✅ BETTER - fully responsive -->
<div class="row q-gutter-md q-mt-sm">
  <div class="col-12 col-md-8">Main content</div>
  <div class="col-12 col-md-4">Sidebar</div>
</div>
```

### Spacing Classes
| Pattern | Meaning | Sizes |
|---------|---------|-------|
| `q-{p\|m}{a\|t\|r\|b\|l\|x\|y}-{xs\|sm\|md\|lg\|xl}` | padding/margin | 4/8/16/24/48px |

### Components
**ALWAYS prefer Quasar components over raw HTML:**

| Instead of | Use |
|-----------|-----|
| `<button>` | `<q-btn>` |
| `<input>` | `<q-input>` |
| `<select>` | `<q-select>` |
| `<div class="card">` | `<q-card>` |
| `<ul><li>` | `<q-list><q-item>` |
| `<table>` | `<q-table>` |
| `<dialog>` | `<q-dialog>` |

### When Custom CSS is Acceptable
Only for:
1. PixiJS canvas styling (WebGL/canvas requires direct manipulation)
2. Complex animations beyond Quasar's transition system
3. Third-party component overrides
4. Pixel-perfect game UI elements matching PoE2 visual style

Even then, prefer CSS custom properties:
```scss
// ❌ BAD
.tree-node { width: 48px; height: 48px; }

// ✅ GOOD
.tree-node {
  --node-size: 48px;
  width: var(--node-size);
  height: var(--node-size);
}
```

---

## 6. Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase.vue | `TreeNode.vue` |
| Composables | useCamelCase.ts | `useTreeNavigation.ts` |
| Stores | camelCaseStore.ts | `buildStore.ts` |
| Workers | camelCase.worker.ts | `calc.worker.ts` |
| Types | PascalCase | `interface PassiveNode` |

### File Size Limits
- Components: <300 lines
- Functions: <50 lines
- Files: <500 lines

---

## 7. Runtime Type Validation

### JSON Parsing
```typescript
// ❌ BAD - no validation
const data = JSON.parse(stored) as Item[];

// ✅ GOOD - validate with type guard
const parsed: unknown = JSON.parse(stored);
if (!isValidItemArray(parsed)) return [];
const data = parsed;
```

### Number Parsing
```typescript
// ❌ BAD - NaN propagates
const num = parseInt(id, 10);

// ✅ GOOD
const num = parseInt(id, 10);
if (Number.isNaN(num)) return defaultValue;
```

### Enum Conversion
```typescript
// ALWAYS create bidirectional helpers for enums stored as strings
function enumToString(value: MyEnum): string {
  const name = MyEnum[value];
  return typeof name === 'string' ? name : 'DEFAULT';
}

function stringToEnum(name: string): MyEnum {
  const value = MyEnum[name as keyof typeof MyEnum];
  return typeof value === 'number' ? value : MyEnum.DEFAULT;
}
```

---

## 8. Magic Numbers

**ALWAYS extract hardcoded values to named constants at file top with JSDoc:**

```typescript
// ❌ BAD
if (zoom < 0.1) zoom = 0.1;
items.slice(0, 20);

// ✅ GOOD
/** Minimum zoom level for tree viewport */
const ZOOM_MIN = 0.1;
/** Maximum items in recent list */
const MAX_RECENT_ITEMS = 20;
```

---

## 9. Error Handling

```typescript
// ❌ BAD - empty catch
try { await load(); } catch { /* silent */ }

// ✅ GOOD - at minimum log
try {
  await load();
} catch (e) {
  console.warn('Load failed, using fallback:', e);
}

// ✅ GOOD - promise cleanup for retry support
loadingPromise = (async () => { ... })();
void loadingPromise.finally(() => { loadingPromise = null; });
```

---

## 10. Performance Patterns

### BFS/Queue - NEVER use array.shift() in loops
```typescript
// ❌ BAD - O(n²)
while (queue.length > 0) {
  const current = queue.shift()!;
}

// ✅ GOOD - O(n) with head pointer
let head = 0;
while (head < queue.length) {
  const current = queue[head++]!;
}
```

### Debounce & Throttle
```typescript
import { useDebounceFn, useThrottleFn } from '@vueuse/core';

// Search input - debounce 150ms
const debouncedSearch = useDebounceFn((query: string) => {
  performSearch(query);
}, 150);

// Scroll/resize - throttle 16ms (60fps)
const throttledScroll = useThrottleFn((event: Event) => {
  updateViewport(event);
}, 16);
```

### Web Workers for Heavy Computation
Operations >16ms MUST run in Web Workers. Use Comlink for type-safe communication:

```typescript
// worker/calc.worker.ts
import { expose } from 'comlink';

const calcApi = {
  async calculateDPS(build: Build): Promise<DPSResult> {
    return result;
  }
};
expose(calcApi);

// composables/useCalc.ts
import { wrap } from 'comlink';
const worker = new Worker(new URL('./worker/calc.worker.ts', import.meta.url));
const calcApi = wrap<CalcWorker>(worker);
const result = await calcApi.calculateDPS(build);
```

---

## 11. Async Store Actions

Store actions that perform I/O MUST be async with loading state:

```typescript
// ❌ BAD - synchronous blocks UI
function loadBuild(id: number) {
  const build = db.builds.get(id);
  currentBuild.value = build;
}

// ✅ GOOD - async with loading state
async function loadBuild(id: number): Promise<void> {
  isLoading.value = true;
  try {
    const build = await db.builds.get(id);
    currentBuild.value = build ?? createEmptyBuild();
  } finally {
    isLoading.value = false;
  }
}
```

---

## 12. Proto-First Type Architecture

### Generated Files - DO NOT EDIT
Files in `src/protos/` are auto-generated from `.proto` definitions. **NEVER manually edit these files.**

### Type Categories
| Category | Location | When to Use |
|----------|----------|-------------|
| Network/Storage | `proto/pob2.proto` | Data from API, saved to DB |
| Shared Logic | `shared/*.ts` | Calculation logic |
| Local UI State | `types/local/*.ts` | UI-only fields (selected, hovered) |

### Local State Extensions
When UI needs extra fields not stored/transmitted:
```typescript
// types/local/items.local.ts
import type { Item } from 'src/protos/items_pb';

export interface LocalItem extends Item {
  editing?: boolean;
  highlighted?: boolean;
}
```

---

## 13. Data Overlay Architecture

### Auto-Generated Files - DO NOT "FIX"
Files like `*-cache.json` are auto-scraped from external sources. They may contain quirks (trailing spaces, inconsistent casing). **DO NOT modify these files directly.**

Use override files instead:
```
src/data/<type>/
├── <type>-cache.json           # Auto-generated - NEVER EDIT
├── <type>-overrides.json       # Manual corrections
```

### Testing with External Data Quirks
```typescript
// ✅ GOOD - Test reflects real external data quirks
it('should accept definition with displayText', () => {
  const def: ModDefinition = {
    text: '10% increased Damage',
    // Note: trailing space matches actual PoB data
    displayText: '10% increased Damage ',
  };
  expect(def.displayText).toBe('10% increased Damage ');
});

// ❌ BAD - "Fixing" external data in tests
displayText: '10% increased Damage', // Removed trailing space
```

---

## 14. Documentation Requirements

### Early Returns
```typescript
// ✅ GOOD - document the no-op condition
function remove(index: number): void {
  // Silently ignore invalid indices - no state change
  if (index < 0 || index >= items.length) return;
  items.splice(index, 1);
}
```

### Non-Obvious Patterns
Document patterns like head pointer, singleton, lazy initialization:
```typescript
/**
 * BFS with head pointer for O(1) dequeue.
 * Queue grows but isn't trimmed - acceptable for ~1500 nodes.
 */
let head = 0;
while (head < queue.length) {
  const current = queue[head++]!;
}
```

---

## 15. Testing Best Practices

- **NEVER reimplement algorithms in tests** - test actual code
- **Use hand-verified expected values** instead of computing them
- **Test through public API** of composables/stores

```typescript
// ❌ BAD - reimplements BFS, tests itself
function testFindPath() { /* 50 lines of duplicated BFS */ }

// ✅ GOOD - tests actual implementation
it('finds shortest path', () => {
  const result = composable.findPath('1', '5');
  expect(result.path).toEqual(['1', '2', '3', '5']); // hand-verified
});
```

---

## 16. Code Review Checklist

When reviewing code, flag:

### TypeScript
- [ ] Use of `any` type (use `unknown` + type guards)
- [ ] Missing return types on exported functions
- [ ] `@ts-ignore` without issue reference
- [ ] `structuredClone()` usage (incompatible with protobuf)
- [ ] Spread operator on nested objects (shallow copy issue)

### Vue/Quasar
- [ ] Options API usage (must use `<script setup>`)
- [ ] Raw HTML elements that should be Quasar components
- [ ] Hardcoded CSS that could use Quasar utility classes
- [ ] Missing TypeScript in `<script>` tag

### Performance
- [ ] `array.shift()` in loops (O(n²) - use head pointer)
- [ ] Synchronous heavy operations on main thread (use Web Worker)
- [ ] Missing debounce on search inputs
- [ ] Missing throttle on scroll/resize handlers

### Error Handling
- [ ] Empty catch blocks (at minimum add `console.warn`)
- [ ] Missing `Number.isNaN()` check after parseInt/parseFloat
- [ ] Unvalidated JSON.parse results

### Architecture
- [ ] Manual edits to `src/protos/` files (auto-generated)
- [ ] Manual edits to `*-cache.json` files (use overrides)
- [ ] Node.js primitives in Vue components (use preload bridge)
- [ ] Magic numbers without named constants

### State Management
- [ ] Mutually exclusive states not enforced in all code paths
- [ ] Missing loading states on async operations
- [ ] Memory leaks (event listeners not removed)

---

## 17. Negative Constraints (NEVER DO)

- **NO** `defineComponent({...})` - use `<script setup>`
- **NO** Mixins
- **NO** `var` - use `const` or `let`
- **NO** `any` types
- **NO** `structuredClone()` - use `cloneDeep` from lodash-es
- **NO** Direct DOM manipulation in Vue components
- **NO** Node.js APIs (`fs`, `path`, `require`) in renderer
- **NO** jQuery or Axios direct imports (use project's API layer)
- **NO** `array.shift()` in loops
