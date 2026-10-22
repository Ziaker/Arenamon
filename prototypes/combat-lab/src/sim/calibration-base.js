// @ts-check
// BASE DE CALIBRAÇÃO v8 — valores do laboratório que passam a ser o PADRÃO do jogo/laboratório a partir de 22/10/2026 (decisão do responsável).
// Origem: arenamon-calibracao-v8 (1).json («arenamon-tuning» v9, exportado em 21/10/2026 21:04 UTC) e config-ts-proposta.patch (aplicado em prototypes/game/src/config.ts).
// Cada linha é [caminho em C, valor NOVO, valor anterior do código]; o valor anterior fica registrado para reverter linha a linha. Os números documentados em config.js
// continuam sendo os «de fábrica»; defaults() aplica esta tabela por cima, então resetConfig(defaults()), «Ajustes padrão» e os testes partem desta base.
// Fora da tabela: parâmetros que o export não trazia (por exemplo os criados depois) e tudo que o responsável não alterou.
/** @type {Array<[string, any, any]>} */
export const CALIBRATION_BASE = [
  // rules
  ["rules.recoil", 0.514, 0.3],
  ["rules.blend", 0.43, 0.1],
  ["rules.guardStun", 0.514, 0.2],
  ["rules.launchGravity", 39.6, 17.5],
  ["rules.launchUp", 7.1, 7.3],
  ["rules.launchHorizontal", 19.3, 11],
  ["rules.landingRecovery", 0.629, 0.19],
  ["rules.staminaMax", 11.1, 3],
  ["rules.regenTime", 4, 5],
  // test
  ["test.arenaHalf", 16, 10.4],
  // locomotion
  ["locomotion.acceleration", 40, 26],
  ["locomotion.braking", 34, 22],
  ["locomotion.reversal", 62, 38],
  ["locomotion.turnRate", 18.84955592153876, 12.566370614359172],
  ["locomotion.visualTurnRate", 21.991148575128552, 15.707963267948966],
  ["locomotion.accelCurve", 0.55, 0.45],
  ["locomotion.brakeCurve", 0.5, 0.35],
  ["locomotion.friction", 1.95, 0.8],
  ["locomotion.turnGrip", 52, 34],
  ["locomotion.residualSpeed", 0.35, 0.25],
  ["locomotion.turnAcceleration", 160, 90],
  // profiles
  ["profiles.balanced.speed", 4.19, 4.8],
  // extras.ai
  ["extras.ai.revision", 1, 2],
  // extras.toggles
  ["extras.toggles.enableClashPush", 1, 0],
  // extras.bindings
  ["extras.bindings.skill3", 49, 49],
  ["extras.bindings.skill4", 50, 50],
  // extras.bindings2
  ["extras.bindings2.forward", 31, 33],
  ["extras.bindings2.back", 28, 35],
  ["extras.bindings2.left", 27, 34],
  ["extras.bindings2.right", 29, 36],
  // actions
  ["actions.dodge.duration", 0.5, 0.4],
  ["actions.dodge.distance", 2.05, 2.5],
  ["actions.dodge.blend", 0.06, 0.1],
  ["actions.dodge.prepTime", 0.03, 0.06],
  ["actions.dodge.impulseTime", 0.1, 0.14],
  ["actions.dodge.decelStart", 0.6, 0.55],
  ["actions.dodge.recoveryTime", 0.1, 0.12],
  ["actions.dodge.prepSpeed", 0.6, 0.45],
  ["actions.dodge.travelEnd", 0.78, 0.7],
  ["actions.tackle.duration", 0.65, 0.4],
  ["actions.tackle.invulnerable", 0, 0.2],
  ["actions.tackle.distance", 1.55, 2.5],
  ["actions.tackle.blend", 0.06, 0.1],
  ["actions.tackle.prepTime", 0.04, 0.06],
  ["actions.tackle.impulseTime", 0.08, 0.1],
  ["actions.tackle.decelStart", 0.55, 0.5],
  ["actions.tackle.prepSpeed", 0.55, 0.5],
  ["actions.tackle.travelEnd", 0.62, 0.55],
  ["actions.sprint.speedMultiplier", 1.8, 1.55],
  ["actions.sprint.acceleration", 26, 16],
  ["actions.sprint.braking", 15, 12],
  ["actions.sprint.turnGrip", 28, 20],
  ["actions.cancel.windowStart", 0.3, 0],
  ["actions.cancel.windowEnd", 2.35, 0.4],
  ["actions.cancel.windowMode", 0, 1],
  ["actions.cancel.fromEnd", 0.61, 0.15],
  // vfx
  ["vfx.hit.variant", 1, 0],
  ["vfx.hit.size", 2.23, 1.3],
  ["vfx.hit.duration", 0.71, 0.38],
  ["vfx.hit.count", 18, 18],
  ["vfx.hit.intensity", 2.63, 1],
  ["vfx.hit.speed", 6, 6],
  ["vfx.hit.opacity", 0.95, 0.95],
  ["vfx.hit.color", 16777215, 16757601],
  ["vfx.hit.fade", 2.58, 1.6],
  ["vfx.hit.color2", 16773577, 16773577],
  ["vfx.hit.cone", 0.55, 0.55],
  ["vfx.hit.debris", 1, 1],
  ["vfx.hit.dust", 1, 1],
  ["vfx.hit.crack", 1, 1],
  ["vfx.dodge.color", 16777215, 10354648],
  ["vfx.block.variant", 2, 1],
  ["vfx.block.intensity", 1.22, 1],
  ["vfx.perfect.intensity", 2.84, 1.3],
  ["vfx.ground.variant", 3, 0],
  ["vfx.ground.radius", 2.9, 1.3],
  ["vfx.ground.density", 1.52, 1],
  ["vfx.ground.duration", 0.82, 0.55],
  ["vfx.ground.intensity", 1.57, 1],
  ["vfx.clash.intensity", 2.52, 1.3],
  ["vfx.exhaust.glow", 0.65, 1],
  ["vfx.regen.intensity", 2.23, 1],
  ["vfx.rock.variant", 1, 0],
  ["vfx.solidDust.variant", 4, 0],
  ["vfx.solidDust.intensity", 0.82, 1],
  ["vfx.solidDust.amount", 3, 1],
  ["vfx.solidDust.size", 0.49, 1],
  ["vfx.solidDust.velocity", 1.85, 1],
  ["vfx.solidDust.scatter", 0.77, 1],
  ["vfx.solidDust.lift", 2.38, 1],
  ["vfx.solidDust.fadeStart", 0.39, 0.6],
  ["vfx.solidDust.color", 16777215, 12165242],
  ["vfx.solidDust.color2", 16777215, 8388576],
  ["vfx.solidWind.enabled", 0, 1],
  ["vfx.solidWind.variant", 2, 0],
  ["vfx.solidWind.opacity", 0.7, 1],
  ["vfx.solidWind.color", 40447, 16054783],
  ["vfx.solidRunDust.variant", 2, 0],
  ["vfx.solidRunDust.intensity", 0.63, 1],
  ["vfx.solidRunDust.amount", 3, 1],
  ["vfx.solidRunDust.size", 0.72, 1],
  ["vfx.solidRunDust.duration", 0.73, 1],
  ["vfx.solidRunDust.velocity", 1.48, 1],
  ["vfx.solidRunDust.scatter", 0.6, 1],
  ["vfx.solidRunDust.lift", 0.69, 1],
  ["vfx.solidRunDust.opacity", 0.75, 1],
  ["vfx.solidRunDust.fadeStart", 0.38, 0.6],
  ["vfx.solidRunDust.color", 16777215, 14207405],
  ["vfx.solidRunWind.enabled", 0, 1],
  ["vfx.solidRunWind.variant", 2, 0],
  ["vfx.solidRunWind.intensity", 1.98, 1],
  ["vfx.solidRunWind.amount", 0.52, 1],
  ["vfx.solidRunWind.size", 0.6, 1],
  ["vfx.solidRunWind.duration", 0.64, 1],
  ["vfx.solidRunWind.velocity", 1.8, 1],
  ["vfx.solidRunWind.opacity", 0.7, 1],
  ["vfx.solidRunWind.color", 14676991, 16054783],
  ["vfx.solidDodge.variant", 2, 0],
  ["vfx.solidDodge.intensity", 1.57, 1],
  ["vfx.solidDodge.amount", 0.75, 1],
  ["vfx.solidDodge.size", 1.6, 1],
  ["vfx.solidDodge.duration", 0.59, 1],
  ["vfx.solidDodge.velocity", 1.95, 1],
  ["vfx.solidDodge.scatter", 0.4, 1],
  ["vfx.solidDodge.lift", 0.47, 1],
  ["vfx.solidDodge.turbulence", 1.72, 1],
  ["vfx.solidDodge.fadeStart", 0.3, 0.6],
  ["vfx.solidDodge.color", 16777215, 10354648],
  ["vfx.solidLanding.intensity", 1.33, 1],
  ["vfx.solidLanding.duration", 1.5, 1],
  ["vfx.solidLanding.velocity", 0.66, 1],
  ["vfx.solidLanding.scatter", 0.76, 1],
  ["vfx.solidLanding.lift", 1.12, 1],
  ["vfx.solidBlock.variant", 2, 0],
  ["vfx.solidClash.enabled", 0, 1],
  // display
  ["display.hud.scale", 1.11, 1],
  ["display.animation.fade", 0.19, 0.18],
  ["display.animation.actionFade", 0.09, 0.07],
  ["display.animation.locomotionHold", 0.08, 0.1],
  ["display.animation.speed", 1.75, 1],
  ["display.diagnostics.toast", 1, 0],
  // world
  ["world.riposte.cooldown", 8, 8],   // fora de changedFromLabDefaults do export (ajuste do usuário no laboratório)
  ["world.riposte.cast", 0.65, 0.65],   // fora de changedFromLabDefaults do export (ajuste do usuário no laboratório)
  ["world.riposte.windowStart", 0, 0.13],   // fora de changedFromLabDefaults do export (ajuste do usuário no laboratório)
  ["world.riposte.windowEnd", 0.59, 0.3],   // fora de changedFromLabDefaults do export (ajuste do usuário no laboratório)
  ["world.riposte.knockbackH", 16.8, 3],   // fora de changedFromLabDefaults do export (ajuste do usuário no laboratório)
  ["world.riposte.knockbackV", 6.6, 0],   // fora de changedFromLabDefaults do export (ajuste do usuário no laboratório)
  ["world.riposte.strikeRange", 3.8, 1.6],   // fora de changedFromLabDefaults do export (ajuste do usuário no laboratório)
  ["world.bulletPunch.cast", 0.2, 0.75],   // fora de changedFromLabDefaults do export (ajuste do usuário no laboratório)
  ["world.bulletPunch.vanish", 0.2, 0.2],   // fora de changedFromLabDefaults do export (ajuste do usuário no laboratório)
  ["world.bulletPunch.searchRadius", 8.5, 5],   // fora de changedFromLabDefaults do export (ajuste do usuário no laboratório)
  ["world.bulletPunch.startDistance", 3, 3],   // fora de changedFromLabDefaults do export (ajuste do usuário no laboratório)
  ["world.bulletPunch.maxDistance", 10, 10],   // fora de changedFromLabDefaults do export (ajuste do usuário no laboratório)
  ["world.bulletPunch.growTime", 1.1, 2],   // fora de changedFromLabDefaults do export (ajuste do usuário no laboratório)
  // map
  ["map.jumpHeight", 2.4, 2],
  ["map.jumpGravityUp", 17.5, 17.5],
  ["map.jumpGravityDown", 28.5, 22],
  ["map.jumpAirControl", 0.85, 0],
  // 2ª exportação (22/10/2026 12:12 -03): valores acrescentados sobre a base anterior
  ["rules.recoilFraction", 0.8, 0.15],
  ["rules.chargeTackleSpeed2", 1.5, 1.25],
  ["rules.chargeTackleSpeed3", 2.2, 1.6],
  ["rules.feintWindow", 0.33, 0.12],
  ["rules.tackleFriction1", 1.8, 0],
  ["rules.tackleFriction2", 1.2, 0],
  ["rules.tackleFriction3", 1.8, 0],
  ["rules.slamFxLength", 1.45, 1],
  ["rules.perfect", 0.34, 0.2],
  ["extras.combat.clashHitstop", 0.033, 0.085],
  ["extras.combat.impactHitstop", 0.008, 0.035],
  ["extras.combat.perfectGuardCounterWindow", 1.98, 0.7],
  ["extras.visual.smear.smearDurationFrames", 3, 2],
  ["extras.visual.smear.smearWidth", 0.24, 0.18],
  ["extras.visual.smear.smearOpacity", 1, 0.85],
  ["extras.visual.squashStretch.squashIntensity", 0.17, 0.15],
  ["extras.visual.squashStretch.stretchIntensity", 0.31, 0.2],
  ["world.riposte.cost", 1.55, 0.8],
  ["world.bulletPunch.reach", 6, 3],
  ["world.bulletPunch.impactMult", 2.6, 1],
  ["map.platformCount", 5, 2],
  ["map.jumpMaxFallSpeed", 15.14, 12],
  ["map.jumpAirAccel", 10.5, 8],
  ["map.footstoolBounce", 11.1, 6.5],
  ["map.footstoolAirAccel", 46, 20],
  ["map.footstoolStagger", 0.55, 0.25],
];

/** Aplica a base de calibração a um objeto de configuração recém-criado (muta e devolve). */
export function applyCalibrationBase(/** @type {any} */ cfg) {
  for (const [path, value] of CALIBRATION_BASE) {
    const keys = path.split('.'), last = keys.pop();
    let o = cfg;
    for (const k of keys) {
      if (o == null || typeof o !== 'object') throw new Error('calibração: caminho inexistente ' + path);
      o = o[k];
    }
    if (o == null || !(last in o)) throw new Error('calibração: parâmetro inexistente ' + path);
    o[last] = value;
  }
  return cfg;
}
