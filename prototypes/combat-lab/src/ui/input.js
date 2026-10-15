// Entrada: teclado (atalhos configuráveis do v6), gamepad e histórico de comandos.
import {C, keyFor, keyFor2} from '../sim/config.js';
import {vec, add, scale, sub, dot, length, normalize, clamp, direction, smoothstep} from '../sim/math.js';

/** Converte a intenção (setas relativas à câmera/alvo) em comando da simulação. Porto fiel do v6. */
export function toCommand(intent, self, target, cameraYaw, locked) {
  const back = direction(cameraYaw + Math.PI), side = vec(-back.z, back.x), toTarget = sub(target.position, self.position);
  const forwardToTarget = length(toTarget) > 1e-6 ? normalize(toTarget) : direction(self.combatHeading);
  let move;
  // moveFrame 0: o lock-on cuida só da câmera, da orientação e da mira; as setas continuam relativas à câmera.
  if (!locked || C.locomotion.moveFrame === 0) move = normalize(add(scale(back, intent.forward), scale(side, intent.x)));
  else if (intent.forward !== 0 && intent.x === 0) move = scale(forwardToTarget, intent.forward);
  else if (intent.forward === 0 && intent.x !== 0) move = scale(side, intent.x);
  else if (intent.forward !== 0 && intent.x !== 0) {
    const f = scale(forwardToTarget, intent.forward), s = scale(side, intent.x), screen = normalize(add(scale(back, intent.forward), s));
    const w = smoothstep(clamp(-dot(f, s), 0, 1));move = normalize(add(scale(add(f, s), 1 - w), scale(screen, w)));
  } else move = vec();
  const still = intent.x === 0 && intent.forward === 0, dodgeDirection = still ? (locked ? forwardToTarget : direction(self.facing)) : move;
  // locked: o comando vem do lock-on do jogador (o tackle persegue o alvo). A IA mira por conta própria.
  return {move, target: locked ? target.id : null, locked: !!locked, dodge: intent.dodge, dodgeHeld: !!intent.dodgeHeld, tackle: intent.tackle, guard: intent.guard, guardPressed: intent.guardPressed, dodgeDirection,
    dodgeForward: still || (intent.forward > 0 && intent.x === 0)};
}

/** Referencial travado (ver Input.frameYaw): guarda em state a direção pressionada e o ângulo lido nela. */
export function latchFrame(state, intent, cameraYaw) {
  const key = `${intent.forward},${intent.x}`;
  if (!C.locomotion.frameLatch || key === '0,0' || key !== state.latchKey || state.latchYaw === undefined) {state.latchYaw = cameraYaw;state.latchKey = key;}
  return state.latchYaw;
}

// Mapeamento padrão de gamepad (Xbox/Standard): A = tackle, B = esquiva, RB/LB = defesa, Y = alvo, Start = pausa.
const PAD = {tackle: 0, dodge: 1, lock: 3, defendR: 5, defendL: 4, pause: 9, restart: 8};

export class Input {
  /** slot 0: jogador (teclas de bindings, 1º gamepad, atalhos); slot 1: vermelho no controle manual (bindings2, 2º gamepad). */
  constructor(canvas, shortcut, {slot = 0} = {}) {
    this.slot = slot;this.key = name => slot ? keyFor2(name) : keyFor(name);
    this.canvas = canvas;this.shortcut = slot ? () => {} : shortcut;this.held = new Set();this.pressed = new Set();this.locked = false;this.history = [];this.lastIntent = '';
    this.padPrev = [];this.padName = '';
    window.addEventListener('keydown', e => {
      if (e.target.matches('input,select,textarea,button') && e.code !== 'Escape') return;
      if (C.extras.keyCodes.includes(e.code)) e.preventDefault();
      if (!this.held.has(e.code)) {this.pressed.add(e.code);if (e.code === this.key('lock')) this.locked = !this.locked;this.shortcut(e.code);}
      this.held.add(e.code);
    });
    window.addEventListener('keyup', e => this.held.delete(e.code));
    window.addEventListener('blur', () => this.clear());
    canvas.addEventListener('pointerdown', () => canvas.focus());
  }
  clear() {this.held.clear();this.pressed.clear();}
  /** Lê o primeiro gamepad conectado e devolve sua intenção (ou null). */
  pad() {
    const pads = [...(navigator.getGamepads?.() || [])].filter(Boolean), p = pads[this.slot];
    if (!p) {this.padName = '';return null;}
    this.padName = p.id;const b = i => !!p.buttons[i]?.pressed, edge = i => b(i) && !this.padPrev[i];
    let x = p.axes[0] || 0, y = -(p.axes[1] || 0);if (Math.hypot(x, y) < .3) {x = 0;y = 0;}
    if (b(14)) x = -1;if (b(15)) x = 1;if (b(12)) y = 1;if (b(13)) y = -1;
    const intent = {x: Math.sign(Math.round(x)), forward: Math.sign(Math.round(y)), tackle: edge(PAD.tackle), dodge: edge(PAD.dodge), dodgeHeld: b(PAD.dodge), guard: b(PAD.defendR) || b(PAD.defendL),
      guardPressed: edge(PAD.defendR) || edge(PAD.defendL)};
    if (edge(PAD.lock)) this.locked = !this.locked;
    if (!this.slot) {if (edge(PAD.pause)) this.shortcut(keyFor('pause'));if (edge(PAD.restart)) this.shortcut(keyFor('restart'));}
    this.padPrev = p.buttons.map(btn => btn.pressed);
    return intent;
  }
  command(self, target, cameraYaw, tick) {
    const k = name => this.held.has(this.key(name)), pk = name => this.pressed.has(this.key(name));
    const keyIntent = {x: Number(k('right')) - Number(k('left')), forward: Number(k('forward')) - Number(k('back')), dodge: pk('dodge'), dodgeHeld: k('dodge'), tackle: pk('tackle'), guard: k('defend'), guardPressed: pk('defend')};
    const p = this.pad();
    const intent = p ? {x: keyIntent.x || p.x, forward: keyIntent.forward || p.forward, dodge: keyIntent.dodge || p.dodge, dodgeHeld: keyIntent.dodgeHeld || p.dodgeHeld, tackle: keyIntent.tackle || p.tackle, guard: keyIntent.guard || p.guard, guardPressed: keyIntent.guardPressed || p.guardPressed} : keyIntent;
    this.record(intent, tick);
    const c = toCommand(intent, self, target, this.frameYaw(intent, cameraYaw), this.locked);this.pressed.clear();return c;
  }
  /**
   * Referencial das setas: com frameLatch, o ângulo da câmera é lido quando a direção pressionada muda e mantido
   * enquanto ela não muda. Assim a câmera que gira para acompanhar o alvo não encurva a trajetória do jogador.
   */
  frameYaw(intent, cameraYaw) {return latchFrame(this, intent, cameraYaw);
  }
  /** Histórico estilo modo treino: cada mudança de intenção, com a duração em quadros. */
  record(intent, tick) {
    const arrows = {'1,0': '↑', '-1,0': '↓', '0,-1': '←', '0,1': '→', '1,-1': '↖', '1,1': '↗', '-1,-1': '↙', '-1,1': '↘'}[`${intent.forward},${intent.x}`] || '·';
    const label = arrows + (intent.guard ? ' D' : '') + (intent.tackle ? ' X' : '') + (intent.dodge ? ' C' : '');
    const last = this.history[0];
    if (last && last.label === label && !intent.tackle && !intent.dodge) {last.frames++;return;}
    this.history.unshift({label, frames: 1, tick});if (this.history.length > 14) this.history.pop();
  }
}
