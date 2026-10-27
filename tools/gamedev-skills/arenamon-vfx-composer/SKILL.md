---
name: arenamon-vfx-composer
description: Use when implementing, reviewing, debugging, or planning the Arenamon VFX Composer, including its document schema, offline Three.js editor, geometry, timeline, textures, materials, particles, runtime compilation, game integration, or phased F0–F5 delivery.
---

# Arenamon VFX Composer

## Core rule

Treat the Composer as an independent visual-authoring application. The game simulation owns hits, damage, collision, resources and outcomes. Never move mechanical authority into VFX or couple editor modules to combat simulation.

## Required sources

Before changing the Composer, read:

1. `AGENTS.md`.
2. `docs/ARENAMON_VFX_COMPOSER_ESPECIFICACAO_E_PROMPT_CODEX_48_DECISOES.docx`.
3. The latest `docs/VFX_COMPOSER_F*.md` and matching plan/spec.
4. Existing code and tests in `prototypes/vfx-composer/`.

The repository sources override generic skill advice. Preserve local changes from other agents.

## Phase gate

| Phase | Scope | Do not anticipate |
|---|---|---|
| F0 | contracts, security, determinism, persistence foundation | UI/editor |
| F1/F1.1 | offline viewport and geometric authoring | timeline/materials/particles |
| F2 | timeline 24/30/60, tracks/curves, frame/vertex animation, onion skin, texture painting/import and safe material graph | Quarks/runtime integration |
| F3 | three.quarks, trails/beams, impacts, decals, depth/blending, subeffects, budgets and telemetry | game publication |
| F4 | compiler/runtime, real events/anchors, GLB preview, revisioned live preview and protected publication | legacy migration |
| F5 | compatible importers, accessibility/performance validation, captures and three pilots | unproved blanket migration |

Stop at the requested phase gate. A phase name is a contract, not a suggestion.

## Routing

- Viewport/camera/scene graph: **REQUIRED SUB-SKILL:** `threejs-scene-setup`.
- Materials and lighting: **REQUIRED SUB-SKILLS:** `threejs-materials-lighting`, then `shader-programming`.
- UI ergonomics: use `frontend-design`; preserve the editor’s dense-tool layout and existing architecture.
- Browser evidence: use existing `*.browser.mjs` patterns. Use `playwright` for ad-hoc real-browser inspection, not as a reason to replace repository tests.
- GPU cost, disposal, pooling or budgets: `performance-optimization`.
- Timing, anticipation, hold, smear and impact readability: `game-feel`.
- GLB/animation import only when the active phase permits it: `threejs-gltf-loading`.

Do not route ordinary Composer work to physics, AI, Unity, Unreal, Godot or other engines.

## Delivery contract

- Use one validated `VfxProject` as authorial truth; UI-only state stays transient unless reopening must preserve it.
- Important adjustable values need visible controls, unit, default, step and demonstrable behavior.
- Keep JSON/ZIP defensive: finite values, bounded counts, relative paths, no executable payloads or remote imports.
- Preserve Undo/Redo, autosave, roundtrip compatibility and old-project defaults.
- Build the offline HTML and expose docs/evidence within two portal clicks.
- Test the real boundary: unit contracts, typecheck/build and only the focused Edge browser flow. Record what was not verified.

## Common mistakes

- Starting Quarks in F2: particles belong to F3.
- Treating a green mock as runtime integration: F4 needs the real boundary.
- Adding editor-only flags to published JSON without a persistence need.
- Changing combat code to make a visual test pass.
- Claiming performance from particle counts without a measured scene baseline.
