# VFX Composer Visual Overhaul Design

## Intent

Rebuild the Arenamon VFX Composer interface into a distinctive, approachable and precise authoring environment. The redesign must make a first-time user comfortable without turning the professional editor into a permanent tutorial. It must retain every authoring capability and project contract already delivered through F3.2 while improving hierarchy, discoverability, density, accessibility and visual identity.

The product opens as an authoring tool. Tutorials are optional, collapsed by default and contained in their own `Academia VFX` group. The main interface is organized by task: create, transform, appearance, movement, particles and output.

## User-approved direction

The chosen concept is `Recipe Journey`, evolved into a free-authoring workspace with an optional learning drawer. The interface uses:

- a functional icon rail for authoring domains;
- project hierarchy on the left;
- the largest feasible viewport in the center;
- a contextual inspector on the right;
- a visual timeline at the bottom;
- an optional `Academia VFX` group, collapsed by default;
- mineral green light, deep blue-black surfaces and restrained warm accents for warnings or key moments;
- luminous energy-track scrollbars instead of generic browser-looking bars;
- consistent offline vector icons, tooltips and accessible names;
- a size system authored at 1.25 times the intended physical size so browser zoom at 80% is the normal reference experience.

## Goals

1. Make common creation tasks findable without reading the whole interface.
2. Keep the viewport central and maximizable.
3. Preserve exact values, explicit units and deterministic project data.
4. Support beginners through optional tutorials that create real, editable projects.
5. Support experts through command search, contextual actions, shortcuts and configurable workspaces.
6. Preserve Undo and Redo, autosave, recovery, import and export, old-project defaults and F3.2 Autoral/Quarks comparison.
7. Keep all important adjustable values visible in the interface.
8. Remain fully offline in the compiled standalone HTML.

## Non-goals

- No combat simulation, damage, collision authority or game publication work.
- No changes to the VfxProject mechanical contract merely to support presentation.
- No F4 runtime compiler or live game integration.
- No replacement of Three.js, three.quarks or the current standalone HTML architecture.
- No full Blender-style modeling suite.
- No remote icon, font, texture or tutorial dependency.

## Information architecture

### Global header

The header contains project state and universal actions only:

- project menu and current project name;
- Undo and Redo;
- Preview or Stop;
- save state and autosave health;
- import and export;
- command search;
- layout and accessibility preferences.

Frequent actions use recognizable icons. The primary action may retain a short label. Every icon has a tooltip, keyboard focus state and accessible name. No icon may depend on color alone.

### Functional icon rail

The leftmost rail switches authoring domains:

1. Create
2. Transform
3. Appearance
4. Movement
5. Particles
6. Output and validation

Preferences and help remain separated at the bottom. Icons use one embedded vector family and a consistent optical box. Selected state uses shape, contrast and a side marker, not only color.

### Project hierarchy

The hierarchy shows authorial objects, groups, type, visibility, lock and selection. It includes search and contextual creation. Rows provide:

- object-type icon;
- primary object name;
- secondary type or status line;
- visibility control;
- selection, multi-selection and warning states.

Tutorial content never appears inside the project tree.

### Viewport

The viewport receives the largest flexible column and supports:

- perspective, front and side views;
- frame all and frame selection;
- onion skin;
- transform gizmos and local or global space;
- contextual quick actions for the selected object;
- Autoral, Quarks and A/B preview states;
- a distraction-free maximize command;
- resizable boundaries against hierarchy, inspector and timeline.

Panel sizes persist as UI preferences, not VfxProject data. A reset-layout command restores safe defaults.

### Contextual inspector

The inspector is composed of collapsible groups such as Transform, Appearance, Geometry, Drawing, Animation, Material and Particles. Only groups relevant to the selected object are shown. One or two high-priority groups may open automatically; the rest retain user preference.

Every numeric control uses a stable three-part layout:

- label on the left;
- value field aligned consistently;
- unit in a fixed-width column.

Titles, descriptions, values, units, errors and actions never share an unstructured inline text run. Touch targets are at least 38 CSS pixels in the 80% reference layout. Important fields keep visible slider or selector controls where appropriate.

### Timeline

The timeline remains visible in free authoring and can collapse or resize. It adds:

- keyframe colors by property family;
- track grouping by object;
- multiple selection;
- temporal zoom and pan;
- expandable curve editing;
- clear playhead and current time;
- contact or explosion moment markers where authored;
- playback, stop, loop, FPS and backend state.

Timeline data continues to use the existing validated animation model.

### Status and budget

A compact status surface communicates:

- autosave state;
- unsaved changes;
- recovery or fallback;
- preview backend;
- validation errors;
- reduced-motion or no-flash profile;
- particle systems, effective particle count and budget pressure.

Budgets appear first as visual meters. Exact counts and warnings expand on demand. No unmeasured FPS claim is allowed.

## Optional Academia VFX

`Academia VFX` is a separate collapsed group placed below the project hierarchy or opened by a dedicated help and learning action. It is closed by default on normal launches. Its open state and lesson progress are UI preferences and must not pollute published VfxProject JSON.

Opening the group lists three lessons. Starting a lesson opens a temporary drawer or floating guide that overlays part of the interface instead of permanently shrinking the viewport. The drawer can be minimized, closed or resumed. Closing it never discards the real project produced by the lesson.

Every tutorial step:

- states the visual objective;
- highlights the real control or viewport affordance;
- provides an optional suggested value;
- allows manual values;
- explains why the visual choice works;
- validates only the minimum relevant condition;
- produces ordinary VfxProject objects, tracks, materials and emitters;
- supports Undo and Redo;
- never changes combat authority.

### Lesson 1: Magic sphere explosion

Teaches a continuous effect with:

1. sphere geometry and emissive appearance;
2. projectile path and speed;
3. deformation along the travel direction;
4. contact squash, flash and timing hold;
5. explosion burst, fragments and dissipation;
6. Autoral and Quarks comparison plus budget review.

### Lesson 2: Energy slash

Teaches:

- stroke and curve drawing;
- ribbon generation;
- width and taper;
- directional trail;
- emissive material;
- impact sparks;
- timing and fade.

### Lesson 3: Arcane circle eruption

Teaches:

- oriented planes;
- procedural texture or safe imported texture;
- material animation;
- anticipation and charge;
- persistent emission;
- eruption column or magical spikes;
- gradual disappearance and budget review.

## Visual system

### Scale and density

Browser zoom at 80% is the reference experience. Design tokens are authored at 1.25 times the intended physical dimensions. The application still occupies exactly 100% of the viewport and must never compensate with a 125% container width or CSS zoom that creates global horizontal scrolling.

Offer three density preferences:

- Reference 80%: default.
- Compact: more information for large displays.
- Enlarged: larger text and controls.

The layout must remain usable at browser zoom 100% and at narrower windows, with graceful panel collapse rather than crushed controls.

### Typography and spacing

- Use an embedded or locally bundled display face only if licensing and standalone build permit it; otherwise choose a deliberate existing project-safe family.
- Keep tool labels and body text highly legible.
- Component title, supporting description, value, unit, validation and action each have a defined slot.
- Use an 8-pixel spacing base with larger 12, 16, 20 and 24 pixel group intervals.
- Avoid text touching borders, icons, scroll tracks or neighboring controls.
- Truncation uses ellipsis plus tooltip; essential numeric values never truncate.

### Icons

- Use one consistent embedded SVG icon set with an offline-compatible license.
- Prefer well-known metaphors for save, undo, redo, play, stop, visibility, lock, search, settings and help.
- Domain-specific icons for stroke, ribbon, emitter and keyframe may use text labels until learned.
- Tooltips appear on hover and keyboard focus.
- Accessible names are mandatory.
- Do not use emoji or platform-dependent glyph rendering in the final UI.

### Scroll tracks

Scrollable panels use an energy-track treatment:

- a slim rail visually integrated with panel dividers;
- a high-contrast thumb with hover and active states;
- optional markers for errors, keyframes or important sections;
- no global horizontal scrollbar;
- content padding keeps text and controls away from the rail;
- native scrolling, keyboard scrolling and pointer dragging remain intact.

Decorative styling must not reduce scrollbar contrast or target size.

### Motion

Motion communicates cause and hierarchy: panel reveal, selection, validation and tutorial focus. It remains subtle, cancels cleanly and honors reduced motion. No ambient ornamental motion competes with the authored effect.

## Advanced productivity

### Command search

`Ctrl+K` opens a searchable command surface for tools, objects, properties, lessons and actions. Results display icon, command, context and shortcut. Commands unavailable for the current selection explain why rather than silently failing.

### Workspace layouts

Built-in layouts include Modeling, Animation, Materials and Particles. They retain the fixed semantic regions — rail, hierarchy, viewport, inspector and timeline — while changing visibility, collapsed state and pane sizes. Arbitrary docking or reordering of panels is not part of this overhaul. Users may save one custom snapshot that is explicitly overwritten by `Update custom layout` and removed by `Reset custom layout`. Layout preferences stay outside VfxProject.

### Contextual action bar

Selection-specific actions appear near the viewport without duplicating the full inspector. Examples include duplicate, isolate, frame, add keyframe, edit path and create emitter. The bar never obscures the effect center and remains keyboard accessible.

## Persistence and compatibility

- Preserve existing VfxProject schemas and migrations.
- UI layout, density, tutorial progress and open groups use a separately versioned local preference record.
- Inspector open-state preferences are keyed by workspace layout and selected object type, never by individual object ID.
- An active tutorial session stores lesson ID, exact step, associated project identity and autosave slot in UI-only state. Resume restores that step only when the linked project or recoverable autosave still exists; otherwise it offers to restart the lesson or continue with the current project without claiming the old validation state.
- Opening old projects supplies safe defaults without rewriting until the user saves.
- Tutorial projects export and reimport through the normal path.
- Import remains defensive: bounded values, relative paths, no remote imports and no executable payloads.
- Autosave and recovery must continue through `AutosaveManager` rather than raw storage access.

## Responsive behavior

The primary target is desktop authoring at 80% browser zoom. At reduced width:

1. tutorial drawer closes or overlays;
2. hierarchy and inspector collapse into labeled rail actions;
3. header labels shorten while tooltips remain;
4. timeline may collapse vertically;
5. viewport retains a usable minimum size;
6. no essential control overlaps or becomes unreachable.

Mobile is not a full authoring target, but the page must show a clear unsupported-size message or read-only project summary rather than a broken editor.

The mandatory runtime is the standalone compiled HTML opened directly by the user through the project entry points in current Microsoft Edge, including `file://` operation. Current Chrome receives a focused smoke check when practical because it shares the Chromium platform. Firefox is not a committed support target for this overhaul.

## Accessibility

- Keyboard navigation for every toolbar, panel, tree, inspector field, timeline control and tutorial step.
- Visible focus rings that remain distinct at 80% zoom.
- WCAG 2.1 AA contrast for text and interactive states.
- Icons always have accessible names.
- Color is never the only state signal.
- Reduced motion and no-flash profiles remain visible and testable.
- Touch and pointer targets remain usable after zoom scaling.
- Tutorial validation messages announce through an appropriate live region without repeated noise.

## Architecture

The redesign must not keep expanding one monolithic HTML template and one main controller. Implement presentation components without changing authorial truth:

- `ui/layout`: workspace grid, resizable panes and layouts;
- `ui/icons`: embedded icon registry and accessible icon button;
- `ui/hierarchy`: project tree and contextual object actions;
- `ui/inspector`: collapsible property groups and numeric controls;
- `ui/timeline`: visual tracks, ruler and transport;
- `ui/academy`: lesson catalog, progress, guide drawer and validators;
- `ui/commands`: command registry and search;
- `ui/status`: autosave, backend, validation and budget surface;
- `ui/preferences`: versioned UI-only preferences.

Existing editor services and DocumentStore remain authoritative. UI components call explicit editor commands so Undo and Redo, selection and persistence remain consistent.

## Delivery and discovery

- Build the standalone offline Composer HTML into its existing `dist` destination.
- Keep the Composer accessible within two clicks from `ABRIR_ARENAMON.html`.
- Add the design and implementation report to `docs/` and link them from the portal and test index where appropriate.
- Store visual evidence under `prototypes/vfx-composer/evidence/visual-overhaul/` with an accessible index.
- Do not leave the only copy of evidence in `.superpowers`, validation or temporary folders.

## Verification

Focused verification should cover:

1. unit tests for UI preference migration, command availability and tutorial validators;
2. existing F0 through F3.2 contract tests for project compatibility;
3. typecheck and VFX Composer build;
4. one focused Edge browser flow for free authoring;
5. one focused Edge browser flow for each tutorial from start through exported and reimported project;
6. Undo and Redo inside and after a tutorial;
7. autosave recovery with the new UI;
8. viewport maximize, panel resizing, layout reset and density choices;
9. 80% reference zoom, 100% zoom and narrow desktop layout;
10. keyboard-only traversal, focus visibility, reduced motion and no-flash;
11. visual evidence for closed Academia, open drawer, inspector groups, timeline and command search;
12. no console errors, overlap, clipped text, global horizontal scroll or broken assets.

Long repository-wide suites are not required for ordinary visual increments. Run the VFX Composer build and focused tests after each coherent slice, then the broader affected verification at the milestone.

## Implementation sequencing

1. Extract design tokens, icon button and workspace layout without behavior changes.
2. Add resizable panes, density preferences and layout reset.
3. Recompose hierarchy, viewport, contextual inspector and status surface around existing commands.
4. Upgrade timeline presentation without changing its authorial data model.
5. Add command search and workspace presets.
6. Add the collapsed Academia shell and UI-only progress persistence.
7. Implement the three tutorials using real editor commands and real projects.
8. Complete accessibility, responsive behavior, evidence, docs and portal links.

## Constraints from the active workspace

This design is authored in `.worktrees/vfx-composer-visual-overhaul` on branch `codex/vfx-composer-visual-overhaul`, created from commit `37741e28b42f3b80808879fd48ae69249bc68ce0`. By explicit user decision, the latest uncommitted state of `prototypes/vfx-composer/` plus the matching F3.2 documentation and audit evidence was copied into this worktree as the authoritative implementation baseline. Combat Lab and unrelated local changes were not copied or modified. The overhaul must adapt every newer authoring, radial, audit, recovery and Quarks capability present in this imported state instead of replacing it with the older committed UI. Before final integration, compare with the official checkout again and reconcile any additional committed work without discarding others' changes.

## Builder decisions

The implementer may choose internal component names, exact CSS organization, the compatible offline icon package and the specific split of modules, provided all contracts above remain true. Exact animation easing, shadow values and ornamental texture are builder decisions subject to visual QA and accessibility.
