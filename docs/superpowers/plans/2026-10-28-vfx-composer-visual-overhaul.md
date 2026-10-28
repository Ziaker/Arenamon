# VFX Composer Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dense F3.2 Composer shell with a distinctive, organized, resizable authoring workspace and an optional three-lesson Academia VFX while preserving every current authoring and persistence capability.

**Architecture:** Keep `DocumentStore`, `AutosaveManager`, validated `VfxProject`, timeline, particle and Quarks services as authorial truth. Extract UI-only layout, preferences, commands, inspector, hierarchy, timeline, status and academy modules from the current monolithic `app/main.ts`; wire them through explicit editor commands so Undo/Redo and project compatibility stay intact.

**Tech Stack:** TypeScript, Three.js 0.186, three.quarks 0.17.1, DOM/CSS, esbuild standalone offline HTML, Node test runner, Playwright Edge browser tests.

**Spec:** `docs/superpowers/specs/2026-10-28-vfx-composer-visual-overhaul-design.md`

## Global Constraints

- Use the imported latest F3.2 worktree state as the implementation baseline; do not replace radial authoring, recovery, audit, particle or Quarks work with the older committed UI.
- Keep `VfxProject` free of layout, density, tutorial-progress and inspector-open state.
- Preserve Undo/Redo, autosave recovery, import/export, deterministic timeline, real Autoral/Quarks comparison and existing old-project defaults.
- Standalone compiled HTML must work from `file://` in current Microsoft Edge with no remote dependency.
- Browser zoom 80% is the reference experience; use 1.25× design tokens while the application remains exactly 100% viewport width and has no global horizontal scroll.
- Academia VFX is optional, collapsed by default and separate from the project hierarchy.
- Use one consistent embedded SVG icon family with tooltips, accessible names and no emoji-dependent final rendering.
- Do not touch combat simulation, damage, collision authority, game publication or F4 runtime compilation.
- All user-adjustable important values retain visible controls and units.
- Evidence belongs in `prototypes/vfx-composer/evidence/visual-overhaul/`; docs and evidence must be reachable within two clicks from `ABRIR_ARENAMON.html`.

## Review Focus

- Corrupted or unavailable localStorage must keep the editor usable in memory and must not lose the current recovery notice; Task 2 adds the preference fallback test and Task 8 re-runs recovery E2E.
- Old imported projects without UI preferences must render with safe default layout without rewriting the project; Task 2 tests this boundary.
- Rapid selection changes between mesh, path and emitter must not leave stale inspector controls or commands; Task 4 adds a selection-switch browser test.
- Browser zoom 80%, zoom 100% and narrow desktop must not create global horizontal scrolling or unreachable controls; Task 3 and Task 8 test all three.
- Closing or losing a tutorial-linked autosave must not claim stale step validation; Task 7 tests restart/current-project recovery choices.

---

## File Structure

- `prototypes/vfx-composer/src/app/main.ts`: composition root only; Three.js scene ownership and service wiring remain here.
- `prototypes/vfx-composer/src/app/template.html`: semantic workspace regions and static fallback shell.
- `prototypes/vfx-composer/src/app/style.css`: token imports and global workspace styling; component rules move beside their domains only if the build supports CSS imports without duplicating standalone output.
- `prototypes/vfx-composer/src/ui/icons.ts`: embedded SVG registry and accessible icon-button renderer.
- `prototypes/vfx-composer/src/ui/preferences.ts`: versioned UI-only preference schema, migration and storage fallback.
- `prototypes/vfx-composer/src/ui/layout.ts`: pane sizing, collapse/maximize, workspace presets and density.
- `prototypes/vfx-composer/src/ui/commands.ts`: command registry, availability and Ctrl+K search.
- `prototypes/vfx-composer/src/ui/hierarchy.ts`: project tree rendering, search and row actions.
- `prototypes/vfx-composer/src/ui/inspector.ts`: selection-aware groups and stable numeric control layout.
- `prototypes/vfx-composer/src/ui/timeline-view.ts`: timeline ruler, tracks, markers, transport and temporal zoom UI.
- `prototypes/vfx-composer/src/ui/status.ts`: autosave, backend, validation and budget display.
- `prototypes/vfx-composer/src/ui/academy.ts`: catalog, session state, guide drawer and lesson validators.
- `prototypes/vfx-composer/src/ui/tutorials/*.ts`: three lesson definitions using real editor commands.
- `prototypes/vfx-composer/test/visual-overhaul.test.mjs`: pure UI preference, command and lesson-validator contracts.
- `prototypes/vfx-composer/test/visual-overhaul.browser.mjs`: focused Edge authoring, layout and accessibility flow.
- `prototypes/vfx-composer/test/academy.browser.mjs`: focused three-lesson resume/export/reimport flow.

### Task 1: Lock the imported F3.2 baseline

**Files:**
- Modify: `docs/VFX_COMPOSER_F3_2.md`
- Create: `docs/VFX_COMPOSER_VISUAL_OVERHAUL.md`
- Test: existing `prototypes/vfx-composer/test/f3-authoring.browser.mjs`
- Test: existing `prototypes/vfx-composer/test/f3-audit.browser.mjs`

**Interfaces:**
- Consumes: imported current F3.2 files and evidence.
- Produces: documented baseline commands and a passing reference result before UI extraction.

- [ ] **Step 1: Record imported baseline identity and capability inventory**

Add a section to `docs/VFX_COMPOSER_VISUAL_OVERHAUL.md` listing radial explosion, multi-selection, rotation/scale, palette, duplication/removal, recovery, Autoral/Quarks and the three live effects as preserved capabilities.

- [ ] **Step 2: Install worktree dependencies without changing package versions**

Run: `npm install`
Expected: dependencies resolve and `package-lock.json` has no unrelated version drift.

- [ ] **Step 3: Run the focused baseline**

Run: `npm run test:vfx-composer:f3:authoring`
Expected: PASS and current F3.2 authoring evidence is generated.

Run: `npm run test:vfx-composer:f3:audit`
Expected: PASS for creation, playback, scrub, Quarks A/B, export/reimport and recovery.

- [ ] **Step 4: Commit the imported baseline**

```bash
git add prototypes/vfx-composer docs/VFX_COMPOSER_F3_2.md docs/VFX_COMPOSER_F3_AUDITORIA.md docs/VFX_COMPOSER_VISUAL_OVERHAUL.md
git commit -m "chore(vfx-composer): import latest f3.2 authoring baseline"
```

### Task 2: Add UI-only preferences and icon foundation

**Files:**
- Create: `prototypes/vfx-composer/src/ui/preferences.ts`
- Create: `prototypes/vfx-composer/src/ui/icons.ts`
- Modify: `prototypes/vfx-composer/src/index.ts`
- Test: `prototypes/vfx-composer/test/visual-overhaul.test.mjs`

**Interfaces:**
- Consumes: a `Storage`-compatible `{getItem,setItem,removeItem}` adapter.
- Produces: `UiPreferencesV1`, `DEFAULT_UI_PREFERENCES`, `loadUiPreferences(storage)`, `saveUiPreferences(storage, value)`, `icon(name, options)` and `iconButton(options)`.

- [ ] **Step 1: Write failing preference and icon tests**

Test names and assertions:

- `defaults UI preferences without mutating a VfxProject` asserts density `reference-80`, workspace `modeling`, academy closed, viewport not maximized and no project keys in saved preference JSON.
- `migrates malformed or old UI preference records safely` asserts bounded pane sizes and default fallback.
- `continues in memory when storage throws` asserts load and save do not throw.
- `renders every icon with title and aria-label` iterates the required icon registry and rejects emoji or remote URLs.

- [ ] **Step 2: Run the tests to verify RED**

Run: `node --test prototypes/vfx-composer/test/visual-overhaul.test.mjs`
Expected: FAIL because `src/ui/preferences.ts` and `src/ui/icons.ts` do not exist.

- [ ] **Step 3: Implement the preference contract**

Define:

```ts
export type Density = 'reference-80' | 'compact' | 'enlarged';
export type WorkspacePreset = 'modeling' | 'animation' | 'materials' | 'particles' | 'custom';
export interface UiPreferencesV1 {version: 1; density: Density; workspace: WorkspacePreset; paneSizes: {hierarchy: number; inspector: number; timeline: number}; collapsedPanes: string[]; inspectorGroups: Record<string, string[]>; academy: {open: boolean; activeSession: TutorialSessionRef | null}; customLayout: UiLayoutSnapshot | null}
export function loadUiPreferences(storage?: UiPreferenceStorage): UiPreferencesV1;
export function saveUiPreferences(storage: UiPreferenceStorage | undefined, value: UiPreferencesV1): void;
```

Clamp hierarchy and inspector to 180–520 CSS px and timeline to 96–480 CSS px. Store under `arenamon.vfx.ui.v1`.

- [ ] **Step 4: Implement the embedded icon registry**

Provide one offline SVG path registry for project, undo, redo, play, stop, export, create, transform, appearance, movement, particles, output, settings, help, visibility, lock, search, frame, onion, keyframe, stroke, ribbon and emitter. `iconButton` must require `label` even when visible text is omitted.

- [ ] **Step 5: Run the tests to verify GREEN**

Run: `node --test prototypes/vfx-composer/test/visual-overhaul.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prototypes/vfx-composer/src/ui prototypes/vfx-composer/src/index.ts prototypes/vfx-composer/test/visual-overhaul.test.mjs
git commit -m "feat(vfx-composer): add ui preferences and icon foundation"
```

### Task 3: Build the resizable workspace shell

**Files:**
- Create: `prototypes/vfx-composer/src/ui/layout.ts`
- Modify: `prototypes/vfx-composer/src/app/template.html`
- Modify: `prototypes/vfx-composer/src/app/style.css`
- Modify: `prototypes/vfx-composer/src/app/main.ts`
- Test: `prototypes/vfx-composer/test/visual-overhaul.test.mjs`
- Test: `prototypes/vfx-composer/test/visual-overhaul.browser.mjs`

**Interfaces:**
- Consumes: `UiPreferencesV1`, `saveUiPreferences`, icon buttons and existing viewport element.
- Produces: `WorkspaceLayout.mount(root, preferences, callbacks)`, `applyPreset(preset)`, `maximizeViewport()`, `restoreViewport()`, `resetLayout()` and `dispose()`.

- [ ] **Step 1: Add failing layout model tests**

Assert preset pane sizes, clamping, one overwritable custom snapshot, reset behavior and exact 1.25× token values for reference density without CSS `zoom` or 125% container width.

- [ ] **Step 2: Add a failing browser shell test**

Assert semantic regions `global-header`, `domain-rail`, `project-hierarchy`, `authoring-viewport`, `context-inspector`, `authoring-timeline`, `composer-status` and collapsed `academy-vfx`; drag each splitter and maximize/restore the viewport.

- [ ] **Step 3: Run RED tests**

Run: `node --test prototypes/vfx-composer/test/visual-overhaul.test.mjs`
Expected: FAIL for missing layout module.

Run: `node prototypes/vfx-composer/test/visual-overhaul.browser.mjs`
Expected: FAIL for missing semantic shell.

- [ ] **Step 4: Implement the layout module and semantic template**

Use CSS Grid fixed regions and pointer-driven separators with keyboard arrow adjustment. Persist only sizes, collapse state, density and selected preset.

- [ ] **Step 5: Implement the visual tokens and energy scroll tracks**

Define tokens for reference density at 1.25× intended physical size, 8-pixel spacing rhythm, 38 CSS pixel minimum actions, mineral green/deep blue surfaces, focus rings and high-contrast scroll thumbs. Set `overflow-x:hidden` only on known panels; fix underlying width overflow instead of masking document overflow.

- [ ] **Step 6: Test 80%, 100% and narrow desktop**

In the browser test set zoom emulation or viewport equivalents and assert `document.documentElement.scrollWidth === document.documentElement.clientWidth`, visible primary controls and viewport minimum dimensions.

- [ ] **Step 7: Run GREEN tests and build**

Run: `node --test prototypes/vfx-composer/test/visual-overhaul.test.mjs`
Expected: PASS.

Run: `node prototypes/vfx-composer/test/visual-overhaul.browser.mjs`
Expected: PASS.

Run: `npm run build:vfx-composer`
Expected: standalone HTML generated successfully.

- [ ] **Step 8: Commit**

```bash
git add prototypes/vfx-composer/src/app prototypes/vfx-composer/src/ui/layout.ts prototypes/vfx-composer/test/visual-overhaul*
git commit -m "feat(vfx-composer): add resizable authoring workspace"
```

### Task 4: Extract hierarchy, contextual inspector and commands

**Files:**
- Create: `prototypes/vfx-composer/src/ui/commands.ts`
- Create: `prototypes/vfx-composer/src/ui/hierarchy.ts`
- Create: `prototypes/vfx-composer/src/ui/inspector.ts`
- Modify: `prototypes/vfx-composer/src/app/main.ts`
- Modify: `prototypes/vfx-composer/src/app/style.css`
- Test: `prototypes/vfx-composer/test/visual-overhaul.test.mjs`
- Test: `prototypes/vfx-composer/test/visual-overhaul.browser.mjs`

**Interfaces:**
- Consumes: `DocumentStore`, selection state, existing editor mutations and `UiPreferencesV1`.
- Produces: `CommandRegistry`, `ProjectHierarchy`, `ContextInspector`, `ComposerCommand` and selection-specific command availability.

- [ ] **Step 1: Write failing command and inspector tests**

Assert `Ctrl+K` registry results, disabled reasons, hierarchy search, group visibility by node kind, inspector open-state keyed by workspace plus object type and no stale fields after mesh → path → emitter selection.

- [ ] **Step 2: Run RED tests**

Run: `node --test prototypes/vfx-composer/test/visual-overhaul.test.mjs`
Expected: FAIL for missing command, hierarchy and inspector modules.

- [ ] **Step 3: Implement explicit editor command adapters**

Define `ComposerCommand {id, label, icon, shortcut?, isAvailable(context), unavailableReason?(context), execute(context)}` and adapt existing add, duplicate, delete, isolate, frame, drawing, radial explosion, material, texture, particle and keyframe actions without duplicating mutations.

- [ ] **Step 4: Implement hierarchy and inspector renderers**

Render stable title/description/value/unit/action slots. Show only applicable groups and preserve all current F3.2 fields, sliders, palettes, multi-selection, tracks and particle controls.

- [ ] **Step 5: Implement command search and contextual viewport bar**

`Ctrl+K` searches command label, object name, property label and lesson title. The viewport bar uses only available selection actions and never overlaps the effect center.

- [ ] **Step 6: Run focused tests and existing authoring regression**

Run: `node --test prototypes/vfx-composer/test/visual-overhaul.test.mjs`
Expected: PASS.

Run: `node prototypes/vfx-composer/test/visual-overhaul.browser.mjs`
Expected: PASS including rapid selection switching.

Run: `npm run test:vfx-composer:f3:authoring`
Expected: PASS with no F3.2 capability loss.

- [ ] **Step 7: Commit**

```bash
git add prototypes/vfx-composer/src/ui prototypes/vfx-composer/src/app prototypes/vfx-composer/test
git commit -m "feat(vfx-composer): organize hierarchy inspector and commands"
```

### Task 5: Upgrade timeline and status surfaces

**Files:**
- Create: `prototypes/vfx-composer/src/ui/timeline-view.ts`
- Create: `prototypes/vfx-composer/src/ui/status.ts`
- Modify: `prototypes/vfx-composer/src/app/main.ts`
- Modify: `prototypes/vfx-composer/src/app/style.css`
- Test: `prototypes/vfx-composer/test/visual-overhaul.test.mjs`
- Test: `prototypes/vfx-composer/test/visual-overhaul.browser.mjs`

**Interfaces:**
- Consumes: existing `VisualTrack`, playback state, particle budget reports, recovery notice and preview backend.
- Produces: `TimelineView.mount`, `TimelineView.update`, `StatusSurface.update` and UI-only temporal zoom state.

- [ ] **Step 1: Write failing timeline and status tests**

Assert property-family colors, track grouping, multiple keyframe selection, time zoom bounds, contact/explosion markers, budget meter thresholds, autosave/recovery/backend states and accessible text equivalents.

- [ ] **Step 2: Run RED tests**

Run: `node --test prototypes/vfx-composer/test/visual-overhaul.test.mjs`
Expected: FAIL for missing timeline and status modules.

- [ ] **Step 3: Implement the timeline view over existing track data**

Do not introduce a parallel animation model. Add renderer selection and interaction callbacks that call existing timeline/DocumentStore mutations.

- [ ] **Step 4: Implement compact status and visual budgets**

Show meters first and exact counts on expansion. Preserve the current recovery message and never claim measured FPS.

- [ ] **Step 5: Run tests and F2/F3 regressions**

Run: `node --test prototypes/vfx-composer/test/visual-overhaul.test.mjs`
Expected: PASS.

Run: `node prototypes/vfx-composer/test/visual-overhaul.browser.mjs`
Expected: PASS.

Run: `npm run test:vfx-composer:f2`
Expected: PASS.

Run: `npm run test:vfx-composer:f3:browser`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add prototypes/vfx-composer/src/ui prototypes/vfx-composer/src/app prototypes/vfx-composer/test
git commit -m "feat(vfx-composer): add visual timeline and status surfaces"
```

### Task 6: Add the optional Academia shell and resumable sessions

**Files:**
- Create: `prototypes/vfx-composer/src/ui/academy.ts`
- Modify: `prototypes/vfx-composer/src/ui/preferences.ts`
- Modify: `prototypes/vfx-composer/src/ui/commands.ts`
- Modify: `prototypes/vfx-composer/src/app/main.ts`
- Test: `prototypes/vfx-composer/test/visual-overhaul.test.mjs`
- Test: `prototypes/vfx-composer/test/academy.browser.mjs`

**Interfaces:**
- Consumes: `DocumentStore`, `AutosaveManager`, command registry and UI preferences.
- Produces: `TutorialLesson`, `TutorialStep`, `TutorialSessionRef`, `AcademyController.start`, `minimize`, `resume`, `close`, `validateCurrentStep`.

- [ ] **Step 1: Write failing academy-state tests**

Assert closed-by-default, open state outside VfxProject, exact-step resume with matching project/autosave, stale-session rejection, restart/current-project choices and Undo/Redo compatibility.

- [ ] **Step 2: Run RED tests**

Run: `node --test prototypes/vfx-composer/test/visual-overhaul.test.mjs`
Expected: FAIL for missing academy module.

- [ ] **Step 3: Implement catalog, collapsed group and temporary drawer**

Keep the group below project hierarchy. The guide drawer overlays without changing persisted pane width and can minimize to a small resume chip.

- [ ] **Step 4: Implement lesson-step validation boundary**

Validators read project state and return `{ok:boolean; message:string; focusCommandId?:string}`. They never mutate the project and never validate combat outcomes.

- [ ] **Step 5: Run GREEN tests and collapsed-state browser flow**

Run: `node --test prototypes/vfx-composer/test/visual-overhaul.test.mjs`
Expected: PASS.

Run: `node prototypes/vfx-composer/test/academy.browser.mjs`
Expected: PASS for closed default, open, minimize, resume and stale recovery.

- [ ] **Step 6: Commit**

```bash
git add prototypes/vfx-composer/src/ui prototypes/vfx-composer/src/app prototypes/vfx-composer/test
git commit -m "feat(vfx-composer): add optional academy sessions"
```

### Task 7: Implement the three real-project tutorials

**Files:**
- Create: `prototypes/vfx-composer/src/ui/tutorials/magic-sphere.ts`
- Create: `prototypes/vfx-composer/src/ui/tutorials/energy-slash.ts`
- Create: `prototypes/vfx-composer/src/ui/tutorials/arcane-circle.ts`
- Modify: `prototypes/vfx-composer/src/ui/academy.ts`
- Test: `prototypes/vfx-composer/test/visual-overhaul.test.mjs`
- Test: `prototypes/vfx-composer/test/academy.browser.mjs`

**Interfaces:**
- Consumes: `TutorialLesson`, explicit `ComposerCommand` IDs, current project snapshot and existing geometry/timeline/material/particle services.
- Produces: `MAGIC_SPHERE_LESSON`, `ENERGY_SLASH_LESSON`, `ARCANE_CIRCLE_LESSON`.

- [ ] **Step 1: Write failing pure lesson tests**

Assert exact lesson IDs, ordered step IDs, real command IDs, optional suggested values with units, read-only validators, no remote assets, no combat fields and exported projects that pass `validateProject`.

- [ ] **Step 2: Run RED tests**

Run: `node --test prototypes/vfx-composer/test/visual-overhaul.test.mjs`
Expected: FAIL for missing lesson definitions.

- [ ] **Step 3: Implement magic sphere lesson**

Steps: geometry/material, launch path/speed, directional deformation, contact squash/flash/hold, burst/fragments/dissipation, Autoral/Quarks and budget review.

- [ ] **Step 4: Implement energy slash lesson**

Steps: draw stroke/curve, ribbon, width/taper, trail, emissive material, sparks, timing/fade and review.

- [ ] **Step 5: Implement arcane circle lesson**

Steps: oriented plane, procedural or safe texture, material animation, anticipation/charge, persistent emission, eruption, fade and review.

- [ ] **Step 6: Run each real browser lesson through export/reimport**

Run: `node prototypes/vfx-composer/test/academy.browser.mjs`
Expected: all three lessons reach completion, produce ordinary editable projects, export, reimport, preserve Undo/Redo and remain within validated budgets.

- [ ] **Step 7: Commit**

```bash
git add prototypes/vfx-composer/src/ui/tutorials prototypes/vfx-composer/src/ui/academy.ts prototypes/vfx-composer/test
git commit -m "feat(vfx-composer): add three guided vfx lessons"
```

### Task 8: Accessibility, evidence, discovery and final verification

**Files:**
- Modify: `prototypes/vfx-composer/src/app/style.css`
- Modify: `prototypes/vfx-composer/test/visual-overhaul.browser.mjs`
- Modify: `prototypes/vfx-composer/test/academy.browser.mjs`
- Create: `prototypes/vfx-composer/evidence/visual-overhaul/index.html`
- Create: `prototypes/vfx-composer/evidence/visual-overhaul/resultado.json`
- Modify: `ABRIR_ARENAMON.html`
- Modify: `TESTES_ARENAMON.html`
- Modify: `HTMLS_ARENAMON.html`
- Modify: `docs/VFX_COMPOSER_VISUAL_OVERHAUL.md`
- Modify: `docs/GAMEDEV_SKILLS.md`

**Interfaces:**
- Consumes: completed visual overhaul and focused browser flows.
- Produces: accessible standalone build, navigable evidence and delivery documentation.

- [ ] **Step 1: Add failing accessibility and responsive assertions**

Assert keyboard-only traversal, visible focus, AA text contrast samples, accessible icon names, reduce-motion/no-flash behavior, current Edge `file://`, 80%/100%/narrow widths, no global horizontal scroll and an intentional small-screen message.

- [ ] **Step 2: Run the browser tests to verify RED where polish is missing**

Run: `node prototypes/vfx-composer/test/visual-overhaul.browser.mjs`
Expected: FAIL only on the newly added unmet accessibility or responsive assertions.

- [ ] **Step 3: Fix accessibility and responsive defects**

Keep tutorial motion, panel transitions and focus guidance disabled or simplified under reduced motion. Do not remove essential state signals under no-flash.

- [ ] **Step 4: Build and run focused final verification**

Run: `npm run build:vfx-composer`
Expected: PASS and updated standalone Composer HTML.

Run: `npm run test:vfx-composer:f2`
Expected: PASS.

Run: `npm run test:vfx-composer:f3:quarks`
Expected: PASS.

Run: `npm run test:vfx-composer:f3:quarks:adapter`
Expected: PASS.

Run: `npm run test:vfx-composer:f3:authoring`
Expected: PASS.

Run: `npm run test:vfx-composer:f3:audit`
Expected: PASS.

Run: `node prototypes/vfx-composer/test/visual-overhaul.browser.mjs`
Expected: PASS.

Run: `node prototypes/vfx-composer/test/academy.browser.mjs`
Expected: PASS.

- [ ] **Step 5: Capture versionable evidence**

Save closed Academia, open guide, maximized viewport, inspector groups, timeline, command search and one completed state from each lesson under `prototypes/vfx-composer/evidence/visual-overhaul/`. Generate `resultado.json` from assertions, not hand-authored claims.

- [ ] **Step 6: Update portal, test index and documentation**

Link the Composer, report and evidence within two clicks from `ABRIR_ARENAMON.html`; add focused test access to `TESTES_ARENAMON.html`; update `HTMLS_ARENAMON.html` and record real skill use in `docs/GAMEDEV_SKILLS.md`.

- [ ] **Step 7: Run workspace and quick verification**

Run: `npm run verify:workspace`
Expected: official internal worktree accepted and required entries present.

Run: `npm run rapido`
Expected: affected build, typecheck and fast unit tests PASS.

- [ ] **Step 8: Review diff and commit**

Run: `git diff --check`
Expected: no whitespace errors.

Run: `git status --short`
Expected: only visual-overhaul source, tests, docs, portal and evidence changes.

```bash
git add prototypes/vfx-composer ABRIR_ARENAMON.html TESTES_ARENAMON.html HTMLS_ARENAMON.html docs
git commit -m "feat(vfx-composer): deliver visual overhaul and academy"
```

## Self-review result

- Spec coverage: layout, icons, scroll tracks, density, hierarchy, viewport, inspector, timeline, status, command search, presets, Academia, three tutorials, persistence, accessibility, responsive behavior, evidence and portal discovery each map to a task.
- Step scan: each implementation step names a module/interface or exact observable behavior; verification steps name commands and pass conditions.
- Type consistency: `UiPreferencesV1`, `WorkspacePreset`, `ComposerCommand`, `TutorialLesson`, `TutorialStep` and `TutorialSessionRef` are introduced once and consumed by later tasks under the same names.
- Review focus: all five risks have explicit tests in Tasks 2, 3, 4, 7 and 8.
- Proportion: the plan specifies contracts and tests without transcribing component implementations.
