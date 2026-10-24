# Relatório de código sem uso (knip) — 24/10/2026

Gerado por `npx knip@5 --reporter compact` (config: `knip.json`). **Nada foi removido**: muitos exports são usados só por testes ou pelo console do laboratório; revise antes de apagar. Nenhum arquivo inteiro sem uso foi encontrado nas pastas `combat-lab/src` e `sand-stone-lab/src`.

```
Unused exports (114)
prototypes/combat-lab/src/nav/nav-graph.js: navParams, insideSolid, layoutSignature, NavGraph
prototypes/combat-lab/src/nav/nav-planner.js: directlyReachable
prototypes/combat-lab/src/physics-poc/poc-bench.js: RapierSim
prototypes/combat-lab/src/physics-poc/poc-metrics.js: maxPenetration, restJitter
prototypes/combat-lab/src/physics-poc/poc-report.js: ENGINES, PEN_TOL, MOUNT_TOL
prototypes/combat-lab/src/sim/ai-eval.js: side, DIFFICULT_SCENARIOS, evalLoadoutMatrix, evalStyleMatrix
prototypes/combat-lab/src/sim/ai-profile.js: AI_FLAGS, AI_KINDS, clearAiProfiles
prototypes/combat-lab/src/sim/ai.js: threatens, NEUTRAL_PERSONALITY
prototypes/combat-lab/src/sim/aim-marker.js: markerMove
prototypes/combat-lab/src/sim/animation-combat-windows.js: stepsToMs, msToSteps, secondsToSteps, stepsToSeconds
prototypes/combat-lab/src/sim/attempts.js: bufferWindow
prototypes/combat-lab/src/sim/bug-capture.js: BUG_VERSION
prototypes/combat-lab/src/sim/combat.js: pushAway, knockbackReaction
prototypes/combat-lab/src/sim/compare.js: matchRows
prototypes/combat-lab/src/sim/config.js: ledgeDefaults
prototypes/combat-lab/src/sim/controller.js: approachVelocity, applyTacklePL, feintDirection, canFeint, doFeint, cancelTackleCharge, startSlamFromFlight, startSlam, cancelAim, cancelCharge
prototypes/combat-lab/src/sim/entity.js: riposteWindow
prototypes/combat-lab/src/sim/geometry.js: faceNormals
prototypes/combat-lab/src/sim/graphics.js: isGraphicsPath
prototypes/combat-lab/src/sim/ledge.js: ledgeSurfaces, findLedge
prototypes/combat-lab/src/sim/map.js: randomRange, getArenaScale, pickRandomConsumableType, dist2D, dist3D, bodyGapToBox, fighterBlocksBox, getGroundHeightAt
prototypes/combat-lab/src/sim/math.js: dodgeCurve
prototypes/combat-lab/src/sim/motion.js: phasedCurve, phasedSpeed
prototypes/combat-lab/src/sim/move-effects.js: unregisterEffect, listEffects
prototypes/combat-lab/src/sim/move-strategy.js: LEVEL_TICKS, REFLECT_TICKS
prototypes/combat-lab/src/sim/movement.js: SEQ_SCHEMA, SEQ_VERSION, metricsOf, compareSequence
prototypes/combat-lab/src/sim/moves.js: MOVE_SCHEMA_VERSION, unregisterMove, effectiveMove (Moves)
prototypes/combat-lab/src/sim/moves/air-slash.js: airSlashDef, airSlashEffect
prototypes/combat-lab/src/sim/moves/bounce.js: bounceDef, bounceHeight, bounceEffect, bounceStep
prototypes/combat-lab/src/sim/moves/bullet-punch.js: bulletPunchDef, bulletPunchSetup, bulletPunchVanish, bulletPunchReturn
prototypes/combat-lab/src/sim/moves/emerging-stone.js: emergingStoneDef, emergingStoneEffect
prototypes/combat-lab/src/sim/moves/feint.js: feintDef
prototypes/combat-lab/src/sim/moves/fire-spin.js: fireSpinDef, fireSpinEffect
prototypes/combat-lab/src/sim/moves/guard-break.js: guardBreakDef, guardBreakSetup
prototypes/combat-lab/src/sim/moves/harden.js: hardenDef, hardenEffect
prototypes/combat-lab/src/sim/moves/lunge.js: lungeDef, lungeSetup
prototypes/combat-lab/src/sim/moves/params-registry.js: PARAM_UNITS, MOVE_CATEGORIES, MOVE_TYPES
prototypes/combat-lab/src/sim/moves/projectile-util.js: headingDir
prototypes/combat-lab/src/sim/moves/psyshock.js: stoneSlots
prototypes/combat-lab/src/sim/moves/quick-attack.js: quickAttackDef, quickAttackSetup, quickAttackStep
prototypes/combat-lab/src/sim/moves/riposte.js: riposteDef
prototypes/combat-lab/src/sim/moves/sand-wave.js: sandWaveDef, sandWaveEffect
prototypes/combat-lab/src/sim/moves/second-wind.js: secondWindDef, REGEN_TICK, secondWindEffect
prototypes/combat-lab/src/sim/moves/seed-bomb.js: seedBombDef, seedBombEffect
prototypes/combat-lab/src/sim/moves/spikes.js: spikesDef, spikesEffect
prototypes/combat-lab/src/sim/moves/swift.js: swiftDef, swiftEffect
prototypes/combat-lab/src/sim/moves/water-pulse.js: waterPulseDef, waterPulseEffect
prototypes/combat-lab/src/sim/passive-engine.js: MAX_PASSIVE_CHAIN_DEPTH, passivesEnabled, hasPassive, onRoundStart
prototypes/combat-lab/src/sim/passives.js: PASSIVE_STATUS
prototypes/combat-lab/src/sim/recording.js: MATCH_SCHEMA
prototypes/combat-lab/src/sim/replay-referencia.js: CHECKPOINT
prototypes/combat-lab/src/sim/sand.js: inRect
prototypes/combat-lab/src/sim/scenarios.js: SCENARIO_KEYS
prototypes/combat-lab/src/sim/solid-contact.js: SURFACE_MEMORY_TICKS
prototypes/combat-lab/src/sim/status.js: STATS, FLAGS, removeStatus, cleanse, modifier
prototypes/combat-lab/src/sim/stone.js: destroyRock
prototypes/combat-lab/src/sim/tactics.js: revisionOf, REVISION_FEATURES, REVISION_2
prototypes/combat-lab/src/sim/training.js: scriptedEnemy
prototypes/combat-lab/src/sim/vision.js: blindRadius
prototypes/combat-lab/src/sim/world.js: tacklePL
prototypes/combat-lab/src/ui/actions-drawer.js: ACTION_TABS
prototypes/combat-lab/src/ui/actions-meta.js: LEGACY_MAP
prototypes/combat-lab/src/ui/diagnostics-panel.js: WINDOW_KEYS, activeWindows
prototypes/combat-lab/src/ui/elemental-visual-model.js: FOLLOW_ROW
prototypes/combat-lab/src/ui/homologation.js: ITEMS
prototypes/combat-lab/src/ui/hud-proposals.js: DemoCooldowns
prototypes/combat-lab/src/ui/menu-fx.js: MENU_PRESETS, reducedMotion
prototypes/combat-lab/src/ui/menu-styles-model.js: iconForPassive
prototypes/combat-lab/src/ui/move-spec-model.js: SPEC_SCHEMA
prototypes/combat-lab/src/ui/movement-panel.js: REPORT_SCHEMA, REPORT_VERSION
prototypes/combat-lab/src/ui/moves-hud.js: PL_COLORS
prototypes/combat-lab/src/ui/moves-panel.js: MECH_SUBS, SUB_ORDER, subOfParam
prototypes/combat-lab/src/ui/organize.js: MECHANICS, SUGGESTED_TAGS
prototypes/combat-lab/src/ui/passives-hud.js: passiveHudState
prototypes/combat-lab/src/ui/passives-panel.js: loadPassivesState
prototypes/combat-lab/src/ui/perf-panel.js: BENCH_CASES
prototypes/combat-lab/src/ui/presets-panel.js: SIMPLE, macroState, macroValues, switchClass, NEVER_SWITCHED, FEEL_CATEGORIES
prototypes/combat-lab/src/ui/quick-panel.js: shortcutGroups
prototypes/combat-lab/src/ui/tuning.js: pathSet, COMBAT_PATH, COMBAT_RANGE_FACTOR, widenCombatRange, officialValue, EXTRA_SECTIONS, resetConfig
prototypes/combat-lab/src/view/characters.js: STATE_ACTIONS, autoVariants, autoMapping, gameWindows
prototypes/combat-lab/src/view/quarks/adapter.js: QUARKS_PRESET_ORDER
prototypes/combat-lab/src/view/quarks/atelier-game-params.js: ATELIER_APPROVED
prototypes/combat-lab/src/view/quarks/bridge.js: chargeLevel
prototypes/combat-lab/src/view/quarks/presets.js: ELEMENTAL_PRESETS, fireDefaults, waterDefaults, shotDefaults, SHOT_EFFECT_IDS, shotRingDefaults, shotConeDefaults, shotEffectDefaults
prototypes/combat-lab/src/view/scenery.js: FLOOR_EXPOSURE, drawFloor
prototypes/combat-lab/src/view/smoke-volume.js: SMOKE_MAX_CLUSTERS
prototypes/combat-lab/src/view/solid-reflect.js: barrierOf
prototypes/combat-lab/src/view/validate.js: VERDICT
prototypes/combat-lab/src/view/vfx.js: HIT_BY_ELEMENT
prototypes/combat-lab/src/view/vfx/anchors.js: resolveAnchor
prototypes/combat-lab/src/view/vfx/beam-renderer.js: BEAM_DEFAULTS
prototypes/combat-lab/src/view/vfx/budget.js: QUALITY_LEVELS, EFFECT_COST
prototypes/combat-lab/src/view/vfx/contract.js: makeEventId, VFX_FAMILIES, isSimEvent
prototypes/combat-lab/src/view/vfx/effects/clash.js: buildClashA, buildClashB
prototypes/combat-lab/src/view/vfx/effects/defense.js: buildBlockA, buildBlockB, buildPerfectA, buildBlockC, buildPerfectB, buildPerfectC, BUILD_BLOCK, BUILD_PERFECT
prototypes/combat-lab/src/view/vfx/effects/environment.js: buildWall
prototypes/combat-lab/src/view/vfx/effects/impact.js: buildImpactA, buildImpactB, buildImpactC, BUILDERS
prototypes/combat-lab/src/view/vfx/effects/landing.js: buildLandingA, buildLandingB, buildLandingC, buildLanding, BUILD_LANDING
prototypes/combat-lab/src/view/vfx/effects/movement.js: buildDodgeA, buildDodgeB, buildDodgeC, buildSprintA, buildSprintB, buildSprintC, buildDodge, buildSprint, BUILD_DODGE, BUILD_SPRINT, buildTackle, buildVault, buildReversal, buildBrake, buildSkid
prototypes/combat-lab/src/view/vfx/effects/status.js: buildExhaustA, buildExhaustB, buildExhaustC, buildRegenA, buildRegenB, buildRegenC, buildExhaust, buildRegen, BUILD_EXHAUST, BUILD_REGEN, buildInvuln
prototypes/combat-lab/src/view/vfx/index.js: BeamRenderer, BEAM_DEFAULTS, BEAM_PL_COLORS, EffectRegistry, Scheduler, PHASES, PoolManager, Pool, ParticlePool, RingPool, MeshPool, LightPool, TrailPool, Budget, QUALITY_LIMITS, EFFECT_COST, CameraFeedback, CAMERA_PROFILES, VfxTelemetry, adaptSimEvent, classifyVisualType, freezeVisualEvent, isSimEvent, VFX_FAMILIES, QUALITY, makeEventId, eventSeed, PresetManager, PRESET_SCHEMA, PRESET_SCHEMA_VERSION, TrailManager, TrailSegmentPool, physicalTrail, anchorTrail, afterimage
prototypes/combat-lab/src/view/vfx/pools.js: ParticlePool, RingPool, MeshPool, LightPool, TrailPool
prototypes/combat-lab/src/view/vfx/trails.js: TrailSegmentPool, widthCurve, alphaCurve, Trail, TrailManager, physicalTrail, anchorTrail, afterimage
prototypes/combat-lab/src/view/view.js: predictFlight
prototypes/combat-lab/src/view/world-view.js: PL_HEX
prototypes/combat-lab/src/workspace/store.js: DB_NAME, DB_VERSION, LS_PREFIX
prototypes/combat-lab/src/workspace/workspace.js: WS_SCHEMA, PKG_SCHEMA, PKG_VERSION, DOC_KEY, MAX_CALIBRATIONS, readLegacy
prototypes/sand-stone-lab/src/approved.ts: approvedDocs
prototypes/sand-stone-lab/src/art.js: strataGeometry
prototypes/sand-stone-lab/src/config.ts: baseControls, isSelector, expand, variantDefaults, notUsed
prototypes/sand-stone-lab/src/particles.js: particleTexture
prototypes/sand-stone-lab/src/presets.ts: SCHEMA_VERSION
prototypes/sand-stone-lab/src/riposte-effect.ts: RIPOSTE_TIMING
prototypes/sand-stone-lab/src/vfx-shapes.ts: linePath, lens
Unused exported types (4)
prototypes/sand-stone-lab/src/outcome.ts: Outcome
prototypes/sand-stone-lab/src/panel-model.ts: PanelGroup
prototypes/sand-stone-lab/src/phases.ts: Span
prototypes/sand-stone-lab/src/presets.ts: Presentation, ImportStats
Duplicate exports (5)
prototypes/combat-lab/src/view/vfx/effects/landing.js: buildLandingA, buildLanding
prototypes/combat-lab/src/view/vfx/effects/movement.js: buildSprintA, buildSprint
prototypes/combat-lab/src/view/vfx/effects/movement.js: buildDodgeA, buildDodge
prototypes/combat-lab/src/view/vfx/effects/status.js: buildRegenA, buildRegen
prototypes/combat-lab/src/view/vfx/effects/status.js: buildExhaustA, buildExhaust
```
