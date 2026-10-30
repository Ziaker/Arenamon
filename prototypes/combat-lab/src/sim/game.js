// Ciclo de partida de passo fixo (120 Hz), igual ao v6, mais estado serializável para replay e cenários.
import {C} from './config.js';
import {Brain} from './ai.js';
import {createFighter, emptyCommand, isInvulnerable, isOffensive, getFighterMaxStamina, combatModOf} from './entity.js';
import {updateFighter, advanceAction, bufferDuringHitstop, tickCooldowns, isDepleted} from './controller.js';
import {getEffect, stepHooks} from './move-effects.js';
import {createWorld, stepWorld, spawn} from './world.js';
import {tickStatuses, applyStatus} from './status.js';
import {getMove, placeRelative, setLoadout} from './moves.js';
import {stepPhysics} from './physics.js';
import {createMapState, initMap, stepMap, stepShield, generateFighterSpawnPositions} from './map.js';
import {attachPassives, tickPassives, passiveOnEvents, passiveOnKO, setPassiveLoadout as applyPassiveLoadout} from './passive-engine.js';
import {vec} from './math.js';
import {navAssist} from '../nav/nav-assist.js';
import {poseOf} from './interpolation.js';
import {isBlind, canSee, blindDefensiveCommand} from './vision.js';
import {normalizeCombatEvent} from './events/combat-event.js';

const finishingNow = g => g.phase === 'finishing';
export class Game {
  constructor({seed = 1} = {}) {
    this.seed = seed;
    this.brain = new Brain(seed, 'aiRed');this.playerBrain = new Brain(seed + 1, 'aiBlue');
    // A IA lê o mundo (projéteis e barreiras) e o mapa só por estas funções: elas não entram no estado salvo
    this.brain.getWorld = this.playerBrain.getWorld = () => this.world;
    this.brain.getMapState = this.playerBrain.getMapState = () => this.mapState;
    this.brain.getFighters = this.playerBrain.getFighters = () => this.fighters;   // F8: contexto das permissões da IA = esta partida (vários Game / load)
    // Movimentos equipados por lutador (ids registrados em moves.js); mantidos entre partidas.
    this.loadouts = [[], []];
    // Passivas: loadout por lutador + identidade de espécie explícita (R15), mantidos entre partidas.
    this.passiveLoadouts = [[], []];
    this.passiveIdentity = [null, null];
    this.combatWindows = [null, null];this.combatMods = [null, null];
    // R31: IDs estáveis de eventos (sequência determinística) e registro do passo de eventos de
    // passivas já processados (detecção de processamento duplicado do mesmo evento).
    this.eventSeq = 0;this.passiveProcessed = new Set();
    this.mode = 'combat';this.profile = 'balanced';this.enemyProfile = 'balanced';
    this.mapState = createMapState(seed);
    this.reset();this.phase = 'menu';
  }
  /** @param {{positions?: any}} [options] */
  reset({positions = null} = {}) {
    this.mapState = createMapState(this.seed);
    const pos = positions ?? (C.map?.arenaShape !== 'square' ? generateFighterSpawnPositions(this.mapState) : [vec(0, -4), vec(0, 2)]);
    this.fighters = [createFighter(0, C.profiles[this.profile] || C.profiles.balanced, {...pos[0]}), createFighter(1, C.profiles[this.enemyProfile] || C.profiles.balanced, {...pos[1]})];
    this.brain.reset();this.playerBrain.reset();
    this.fighters.forEach((f, i) => {
      f.loadout = [...(this.loadouts[i] || [])];
      f.combatWindows = this.combatWindows?.[i] ? structuredClone(this.combatWindows[i]) : null;
      f.combatMods = this.combatMods?.[i] ? structuredClone(this.combatMods[i]) : null;
    });
    this.world = createWorld();
    this.world.mapState = this.mapState;
    initMap(this.mapState, this.fighters);
    attachPassives(this);   // liga loadouts de passivas e restaura Sturdy (fronteira de rodada, §7/R22)
    this.tick = 0;this.events = [];this.winner = null;this.hitstop = 0;this.phase = 'playing';this.lastStepEvents = [];this.prevPose = null;
    this.eventIdSeq = 0;   // F3.4: identidade canônica (eventId) de TODO evento, por Game e por rodada; separada de eventSeq/id (hash do replay, R31)
  }
  start() {this.phase = 'playing';}
  pause() {if (this.phase === 'playing') this.phase = 'paused';else if (this.phase === 'paused') this.phase = 'playing';}
  /** Um passo de simulação. cmd1 opcional: sem ele, o adversário usa a IA do modo atual. */
  step(cmd0 = emptyCommand(), cmd1) {
    this.lastStepEvents = [];this.frozen = false;this.passiveProcessed.clear();   // R31: anti-duplicata vale por passo
    if (this.phase !== 'playing' && this.phase !== 'finishing') return;
    this.prevPose = this.fighters.map(poseOf);   // só para interpolar o desenho (view/interpolation.js); fora do save/load
    // Hitstop: o passo conta no relógio, mas a simulação fica congelada.
    if (this.hitstop > 0) {
      // Congelado, mas X/C apertados agora ficam no buffer e saem no primeiro passo depois do hitstop.
      const cmds = finishingNow(this) ? [] : [cmd0, cmd1 ?? emptyCommand()];this.fighters.forEach((f, i) => cmds[i] && bufferDuringHitstop(f, cmds[i]));
      this.hitstop = Math.max(0, this.hitstop - C.test.step);this.tick++;this.frozen = true;return;
    }
    const finishing = this.phase === 'finishing';
    // IA do oponente desligada: o vermelho fica como boneco (recebe dano, colisões e reações físicas, sem decidir nada).
    const enemy = () => this.fighters[1].absent || this.fighters[0].absent ? emptyCommand() : isBlind(this.fighters[1]) && !canSee(this.fighters[1], this.fighters[0], this.world) ? blindDefensiveCommand(this.fighters[1]) : C.extras.toggles.enableEnemyAI ? this.assistNav(this.brain, this.fighters[1], this.fighters[0], this.brain.command(this.fighters[1], this.fighters[0], this.mode, C.test.step)) : emptyCommand();
    const commands = finishing ? [emptyCommand(), emptyCommand()] : [cmd0, cmd1 ?? enemy()];
    this.lastCommands = commands;
    for (const f of this.fighters) {   // Ledge Grab: quem é a IA não sabe «apertar Espaço»; sobe sozinha depois de ledge.aiClimb s pendurada (0 = nunca; cai pelo tempo máximo)
      const lg = f.ledge, L = C.ledge;
      if (!lg || (lg.phase !== 'hang' && lg.phase !== 'snap') || !(L.aiClimb > 0) || finishing) continue;
      const ai = f.id === 1 ? !!C.extras.toggles.enableEnemyAI && !C.extras.toggles.enemyManual : !!C.extras.toggles.enablePlayerAI;
      if (!ai) continue;
      // IA pendurada: espera em silêncio (a guarda/esquiva do comando dela contava como «soltar» e ela largava a borda: só 18% de subidas), sobe com Espaço + direção da parede
      // depois de aiClimb s e, com o topo bloqueado há tempo, larga de propósito.
      commands[f.id] = lg.t < L.aiClimb ? emptyCommand() : lg.blocked && lg.t >= L.aiClimb + .6 ? {...emptyCommand(), guard: true} : {...emptyCommand(), jump: true, move: {x: -lg.n.x, z: -lg.n.z}};
    }
    for (const f of this.fighters) updateFighter(f, commands[f.id] ?? emptyCommand(), this.fighters, C.test.step, this.world);
    const actions = this.fighters.map(f => f.action), worldEvents = [];
    for (const f of this.fighters) if (f.moveEvents?.length) worldEvents.push(...f.moveEvents.splice(0));   // eventos do Charge (início, soltura, cancelamento, recarga acelerada)
    this.fireMoveEffects(worldEvents);
    const fresh = stepPhysics(this.fighters, C.test.step, this.world);
    for (const hook of stepHooks()) fresh.push(...(hook(this) ?? []));   // Moves que continuam depois do disparo (Bounce: contato na descida e no pouso)
    // Escudos temporários (R9.3-R9.7, R10.2, R11.8): timers não avançam durante finishing, pause ou hitstop
    if (!finishing && this.phase === 'playing') {
      for (const f of this.fighters) stepShield(f, C.test.step, fresh);
    }
    // Mapa: consumíveis, respawn e drops (R4, R6, R9.13)
    if (!finishing && this.phase === 'playing' && this.mapState) {
      fresh.push(...stepMap(this.mapState, C.test.step, this.fighters, [], this.tick));
    }
    // Mundo (projéteis, barreiras, paredes, áreas) e status: depois da física dos lutadores, no mesmo passo.
    fresh.push(...worldEvents, ...stepWorld(this, C.test.step));
    for (const f of this.fighters) {fresh.push(...tickStatuses(f, C.test.step, getFighterMaxStamina(f)));tickCooldowns(f, C.test.step);}
    // Passivas: timers próprios (nunca por cooldownRate, R15) e gatilhos dos eventos deste passo. Só no passo normal:
    // durante hitstop a sim está congelada e o retorno antecipado acima garante R24–R29 (cooldowns e durações
    // congelados; nenhum evento real ocorre para ativar; efeitos ativos permanecem aplicados via stat()).
    for (const f of this.fighters) fresh.push(...tickPassives(this, f, C.test.step));
    for (const e of fresh) if (e.id == null) e.id = ++this.eventSeq;   // R31: id na ORIGEM antes do engine, para a causa carregada ser real
    fresh.push(...passiveOnEvents(this, fresh));
    const koNow = this.fighters.find(f => f.hp <= 0);
    if (koNow) fresh.push(...passiveOnKO(this, koNow));   // R23: KO encerra efeitos ativos imediatamente
    for (const e of fresh) {e.tick = this.tick;if (e.id == null) e.id = ++this.eventSeq;if (e.eventId == null) e.eventId = ++this.eventIdSeq;normalizeCombatEvent(e);}   // R31: ID estável por evento; F3.4: eventId único + campos canônicos (legados intactos)
    this.events.push(...fresh);this.events = this.events.slice(-12);this.lastStepEvents = fresh;
    if (C.extras.toggles.enableHitstop) {
      if (fresh.some(e => e.result === 'clash')) this.hitstop = C.extras.combat.clashHitstop;
      else if (fresh.some(e => e.result === 'impact' || e.result === 'perfect' || e.result === 'perfectDodge' || e.result === 'footstool')) {
        // Faixas de importância: golpe fraco = hitstop base; golpe forte = até (1 + boost)× (com boost = 0 é sempre o base, como antes).
        const X = C.extras.combat, dmg = Math.max(0, ...fresh.filter(e => e.result === 'impact').map(e => e.damage ?? 0));
        this.hitstop = X.impactHitstop * (1 + (X.hitstopDamageBoost ?? 0) * Math.min(1, dmg / Math.max(1, X.hitstopDamageRef ?? 30)));
        if (fresh.some(e => e.result === 'impact' && e.riposte)) this.hitstop *= Math.max(0, C.world.riposte?.hitstopMult ?? 1);   // contra-golpe do Riposte: pausa de impacto maior
        // Editor › Hit-stop (×) da ação do atacante (tackle/Move): multiplica a pausa deste impacto; sem ajuste salvo nada muda.
        for (const e of fresh) if (e.result === 'impact') {const m = combatModOf(this.fighters.find(x => x.id === e.attacker))?.hitstopMult;if (m != null) {this.hitstop *= Math.max(0, m);break;}}
      }
    }
    for (const f of this.fighters) if (!f.action && !f.blend && !f.flight) f.locomotionVelocity = {...f.velocity};
    for (let i = 0; i < this.fighters.length; i++) if (this.fighters[i].action === actions[i]) advanceAction(this.fighters[i], C.test.step);
    this.tick++;
    if (this.fighters.some(f => f.hp <= 0)) {
      this.winner = this.fighters.find(f => f.hp > 0)?.id ?? null;
      this.phase = this.fighters.some(f => !!f.flight) ? 'finishing' : 'result';
    }
  }
  /** Navegação experimental (Yuka, extras.nav.enableNav): ajusta só a intenção de movimento/salto; desligada, devolve o comando intacto. */
  assistNav(brain, self, target, cmd) {return navAssist(this, brain, self, target, cmd);}
  /** Efeitos da linha do tempo dos movimentos que venceram neste passo (entidades, status e golpes corpo a corpo). */
  fireMoveEffects(events) {
    for (const f of this.fighters) {
      if (!f.moveFx?.length) continue;
      for (const fx of f.moveFx.splice(0)) {
        const def = fx.def ?? getMove(fx.move), ev = def?.timeline?.[fx.index];if (!ev) continue;
        const other = this.fighters.find(o => o.id !== f.id);
        if (ev.spawn) spawn(this.world, placeRelative(f, fx.heading, ev.spawn), events);
        else if (ev.status) {const who = ev.target === 'opponent' ? other : f;if (who && who.hp > 0) {applyStatus(who, ev.status, {source: f.id});events.push({result: 'statusApplied', attacker: f.id, target: who.id, damage: 0, status: ev.status.id});}}
        else if (ev.effect) this.runEffect(f, def, ev, fx, events);
        else if (ev.hit) {
          // Golpe corpo a corpo: área curta à frente, por um passo, com a mesma função de acerto das entidades.
          const range = ev.hit.range ?? 1.2, width = ev.hit.width ?? 1.2;
          spawn(this.world, placeRelative(f, fx.heading, {kind: 'area', shape: 'box', hx: width / 2, hz: range / 2, offset: {forward: C.test.halfExtent + range / 2}, y: 0, height: ev.hit.height ?? 2, life: C.test.step, pulses: 1, hit: {...ev.hit, contact: 'melee'}}), events);
        }
      }
    }
  }
  /** Executa o efeito nomeado de um evento da linha do tempo; falha (`ok: false`) desfaz custo, recarga e recuperação do Charge. */
  runEffect(f, def, ev, fx, events) {
    const handler = getEffect(ev.effect), res = handler ? handler(this, f, def, {...fx, event: ev, events}) : {ok: false, reason: 'effectMissing', detail: {effect: ev.effect}};
    if (res?.ok === false) this.failMove(f, def, fx, res, events);
  }
  /** Falha de execução (M13.7, M29.3): devolve a stamina, remove recarga e recuperação, avisa com motivo. Uma vez por soltura. */
  failMove(f, def, fx, res, events) {
    const rel = fx.charge;
    if (rel) {
      if (rel.failed) return;
      rel.failed = true;f.stamina = Math.min(C.rules.staminaMax, f.stamina + rel.cost);f.regenBase = f.stamina;f.regenAge = 0;f.exhausted = isDepleted(f.stamina);
      if (f.moveCooldowns) delete f.moveCooldowns[def.id];
      f.moveRecovery = 0;
    }
    events.push({result: 'moveFailed', attacker: f.id, target: null, damage: 0, move: def.id, reason: res.reason ?? 'failed', detail: res.detail});
  }
  /** Equipa movimentos registrados num lutador (vale a partir de agora e nas próximas partidas). */
  setLoadout(id, ids) {this.loadouts[id] = setLoadout(this.fighters[id], ids);return this.loadouts[id];}
  /** Equipa passivas de um lutador (validação dupla: UI e motor, R5). Vale a partir da próxima partida (reset). */
  setPassiveLoadout(slot, ids) {return applyPassiveLoadout(this, slot, ids);}
  /** Associa janelas de combate da animação ao lutador (tackle, dodge, etc.). */
  setCombatWindows(id, windows) {
    this.combatWindows ??= [null, null];
    this.combatWindows[id] = windows ? structuredClone(windows) : null;
    if (this.fighters?.[id]) this.fighters[id].combatWindows = this.combatWindows[id];
  }
  /** Ajustes de combate do Editor de animações (armadura, hit-stop ×, interrompível, prioridade, buffer) por ação do lutador; só entram valores diferentes do neutro. */
  setCombatMods(id, mods) {
    this.combatMods ??= [null, null];
    this.combatMods[id] = mods && Object.keys(mods).length ? structuredClone(mods) : null;
    if (this.fighters?.[id]) this.fighters[id].combatMods = this.combatMods[id];
  }
  /** Visão para o HUD e para testes (mesma forma do v6). */
  snapshot() {
    return {phase: this.phase, tick: this.tick, winner: this.winner, mode: this.mode, hitstop: this.hitstop, events: this.events,
      mapState: this.mapState,
      fighters: this.fighters.map(f => ({...f, action: f.action ? {...f.action, hits: [...f.action.hits], hitWindows: f.action.hitWindows ? f.action.hitWindows.map(s => [...s]) : null} : null,
        invulnerable: isInvulnerable(f), offensive: isOffensive(f)}))};
  }
  /** Estado completo e independente (structuredClone preserva os Sets de acertos). */
  save() {
    return structuredClone({fighters: this.fighters, tick: this.tick, events: this.events, winner: this.winner, hitstop: this.hitstop, phase: this.phase, eventSeq: this.eventSeq, eventIdSeq: this.eventIdSeq, world: this.world ?? createWorld(), mapState: this.mapState, loadouts: this.loadouts,
      passiveLoadouts: this.passiveLoadouts, passiveIdentity: this.passiveIdentity,
      mode: this.mode, seed: this.seed, profile: this.profile, enemyProfile: this.enemyProfile,   // contexto da partida (A-09): o save carrega modo, semente e perfis, não só o estado dos lutadores
      combatWindows: this.combatWindows, combatMods: this.combatMods, brain: this.brain.save(), playerBrain: this.playerBrain.save(), lastStepEvents: this.lastStepEvents});
  }
  load(state) {
    const s = structuredClone(state);
    this.prevPose = null;
    if (s.mode !== undefined) this.mode = s.mode;if (s.seed !== undefined) this.seed = s.seed;if (s.profile !== undefined) this.profile = s.profile;if (s.enemyProfile !== undefined) this.enemyProfile = s.enemyProfile;   // save antigo (sem esses campos): mantém o que a instância já tinha
    this.fighters = s.fighters;this.tick = s.tick;this.events = s.events;this.winner = s.winner;this.hitstop = s.hitstop;this.phase = s.phase;
    this.brain.load(s.brain);this.playerBrain.load(s.playerBrain);this.lastStepEvents = s.lastStepEvents || [];
    this.eventSeq = s.eventSeq ?? this.eventSeq;this.passiveProcessed.clear();
    this.eventIdSeq = s.eventIdSeq ?? s.eventSeq ?? 0;   // save antigo (sem eventIdSeq): parte de eventSeq — nenhum eventId foi emitido nele
    this.world = s.world ?? createWorld();
    this.world.contactSeq ??= Number.isFinite(s.clashContactSeq) ? s.clashContactSeq : 0;   // save antigo: o contador ficava no topo (clashContactSeq)
    if (s.mapState) {
      this.mapState = s.mapState;
      this.world.mapState = this.mapState;
    }
    if (s.loadouts) this.loadouts = s.loadouts;
    if (s.passiveLoadouts) this.passiveLoadouts = s.passiveLoadouts;
    if (s.passiveIdentity) this.passiveIdentity = s.passiveIdentity;
    this.combatWindows = s.combatWindows ? structuredClone(s.combatWindows) : [null, null];
    this.combatMods = s.combatMods ? structuredClone(s.combatMods) : [null, null];
    for (const f of this.fighters) {
      f.statuses ??= [];f.moveCooldowns ??= {};f.loadout ??= [];f.moveFx ??= [];
      f.charge ??= null;f.moveRecovery ??= 0;f.skillBuffer ??= null;f.moveEvents ??= [];f.counterStagger ??= 0;
      f.stages ??= {attack: 0, defense: 0, staminaMax: 0, cooldown: 0, speed: 0};
      f.shield ??= {hp: 0, duration: 0, maxHp: 80};
      f.jumpState ??= {canJump: true, cooldown: 0};
      // Plano D (salto/footstool): campos novos têm padrão neutro em saves/replays antigos.
      f.coyoteLeft ??= 0;f.jumpBuffered ??= 0;f.airMoveDir ??= null;f.footstoolCooldownT ??= 0;f.footstoolDoneWith ??= null;
      // Passivas de saves antigos: estado neutro SEM restaurar Sturdy (R22/§7: load/replay/menu não devolvem o uso).
      f.passiveState ??= {loadout: [...(this.passiveLoadouts?.[f.id] || [])], cooldowns: {}, actives: [], sturdyAvailable: false, sturdyUsed: false, lastDamageDealt: -1e9, lastDamageReceived: -1e9};
      if (!s.combatWindows) f.combatWindows = null;
    }
    for (let i = 0; i < this.fighters.length; i++) {
      if (this.combatWindows?.[i]) this.fighters[i].combatWindows = structuredClone(this.combatWindows[i]);
      else this.fighters[i].combatWindows = null;
      this.fighters[i].combatMods = this.combatMods?.[i] ? structuredClone(this.combatMods[i]) : null;
    }
  }
}

/** Acumulador de tempo fixo com escala (câmera lenta) e avanço manual de quadros. */
export class FixedClock {
  constructor() {this.accumulator = 0;this.timeScale = 1;}
  reset() {this.accumulator = 0;}
  advance(seconds, stepFn) {
    for (this.accumulator += Math.max(0, Math.min(seconds * this.timeScale, C.test.maxFrame)); this.accumulator >= C.test.step - 1e-10;) {stepFn();this.accumulator -= C.test.step;}
  }
}
