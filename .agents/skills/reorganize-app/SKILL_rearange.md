---
name: reorganize-app
description: Systematically audits, modularizes, and reorganizes the React Native / Expo application codebase. Use when the user asks to restructure or rearrange the app, break down oversized monolithic screens and modals, extract business logic into domain services and custom hooks, unify types and design tokens, or clean up architecture while preserving full functionality.
---

# 🏗️ App Reorganization & Architecture Refactoring Skill

This skill provides a battle-tested, zero-regression protocol for restructuring and modularizing React Native (Expo) applications. It transforms monolithic, bloated components and coupled service files into clean, maintainable, single-responsibility layers.

---

## 🎯 Architectural Target State

The target repository structure adheres strictly to the project boundaries defined in `AGENTS.md`:

```text
src/
├── app/                  # Expo Router file-based screens & navigation routes ONLY
│   ├── _layout.tsx       # Root layout & providers
│   ├── index.tsx         # Entry screen (thin container composition)
│   ├── cycle-selection.tsx
│   └── report/           # Route subtrees (Kashrag, Kashpal, etc.)
├── components/           # Reusable, self-contained UI components
│   ├── common/           # Generic dumb elements (buttons, inputs, dropdowns, banners)
│   └── modals/           # Dialogs and workflow modals
├── hooks/                # Custom React hooks encapsulating business logic & local state
│   ├── useKashragReport.ts
│   ├── useDeviceManagement.ts
│   └── useOfflineSync.ts
├── firebase/             # Backend & Firestore layer
│   ├── config.ts         # Firebase initialization
│   ├── services/         # Domain-specific Firestore operations
│   │   ├── devices.ts    # Device CRUD & inventory status
│   │   ├── faults.ts     # Fault reporting & status updates
│   │   ├── verifications.ts # Verification sessions & history
│   │   └── cycles.ts     # Active cycle management
│   └── api.ts            # Backward-compatible barrel re-exporting all services
├── context/              # Global React contexts (e.g., AppContext.tsx)
├── types/                # Centralized TypeScript interfaces and models
│   ├── device.types.ts
│   ├── fault.types.ts
│   ├── user.types.ts
│   └── report.types.ts
├── theme/                # Design tokens (colors, spacing, elevation, radii)
│   └── theme.ts
├── utils/                # Pure helper functions, offline queue, formatters
└── constants/            # Static configuration values and dropdown lists
```

---

## 📋 The 5-Phase Execution Protocol

Never attempt a massive, big-bang rewrite. Always proceed through these five phases incrementally, ensuring tests pass at each boundary.

### Phase 1: Codebase Audit & Dependency Mapping
1. **Identify Monoliths:** Scan for files exceeding 250 lines (e.g. `src/firebase/api.ts`, `src/app/index.tsx`, `src/app/report/kashrag/index.tsx`, `AddDeviceModal.tsx`, `DailySummaryModal.tsx`).
2. **Catalog Shared Types:** Find all TypeScript interfaces duplicated across screens and services.
3. **Map State & Side Effects:** Identify which components execute direct Firestore queries vs which receive data via props/context.

### Phase 2: Centralize TypeScript Models (`src/types/`)
1. Create `src/types/` domain files (`device.types.ts`, `fault.types.ts`, `user.types.ts`, `report.types.ts`).
2. Move interfaces (e.g. `DeviceItem`, `FaultRecord`, `UserRole`, `VerificationSession`) to their respective domain files.
3. Create an `index.ts` barrel file inside `src/types/` to export all definitions.
4. Re-export existing types from `src/firebase/api.ts` so older imports don't break.
5. **Verification:** Run `npx tsc --noEmit` to verify type resolution.

### Phase 3: Modularize the Backend Layer (`src/firebase/services/`)
1. Create `src/firebase/services/` for each bounded context:
   - `devices.service.ts`: Adding devices, location updates, replacement, transfer.
   - `faults.service.ts`: Fault logging, status progression, repairs.
   - `verifications.service.ts`: Start/save session, auto-healing, verification history.
   - `cycles.service.ts`: Cycle selection, active status, summary retrieval.
2. Maintain `src/firebase/api.ts` as a facade/barrel exporting all functions from `services/` to avoid breaking existing callers.
3. Keep offline caching (`AsyncStorage`) and network-awareness properly encapsulated.
4. **Verification:** Verify with typecheck and existing API calls.

### Phase 4: Extract Business Logic into Custom Hooks (`src/hooks/`)
1. Never leave multi-step Firebase operations or heavy `useEffect` blocks inside UI components.
2. For each major workflow, extract a custom hook:
   - Encapsulates `useState`, `useCallback`, loading flags, error handling, and Firebase calls.
   - Returns a clean, declarative API to the screen (e.g. `{ data, isLoading, onSave, onFilter }`).
3. Screens should only handle layout and pass handlers to child components.

### Phase 5: Decompose Monolithic Screens & Modals
1. **Screen Decomposition:**
   - Deconstruct screens into subcomponents: Header, FilterBar, ItemList, EmptyState, BottomActionBar.
   - Place screen-specific subcomponents in a dedicated `components/` subfolder or adjacent folder.
2. **Modal Deconstruction:**
   - Break 500+ line modals into smaller logical parts (e.g., form fields, scanner view, action buttons).
3. **Styling Unification:**
   - Replace hardcoded hex colors (`#64748B`, `#15803D`, `#0F4C3A`) with `theme.colors` from `src/theme/theme.ts`.
   - Preserve all RTL alignment (`direction: 'rtl'`, `textAlign: 'right'`, flex layouts).

---

## 🛡️ Guardrails & Safety Rules

1. **Zero Breaking Changes to Routing:**
   - Keep Expo Router paths (`src/app/`) stable. Changing file names in `src/app/` changes routes.
2. **Backward Compatibility via Barrels:**
   - Whenever moving a function or type, leave a re-export at the original location during refactoring so nothing breaks mid-stream.
3. **Atomic Verification:**
   - After modifying any section, always run:
     ```bash
     npx tsc --noEmit
     ```
   - For web flow tests, run:
     ```bash
     npx playwright test
     ```
4. **No Zombie Code:**
   - Remove dead imports, commented-out legacy blocks, and forgotten console logs immediately.
5. **Ask Before Big Overhauls:**
   - Always present the proposed directory changes and file breakdowns to the user before editing more than 3 files simultaneously.
