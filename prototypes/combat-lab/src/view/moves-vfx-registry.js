// @ts-check
// Registro oficial de efeitos visuais de Moves (Documento 02 - Camada view/).
// Assume exclusivamente o ciclo de vida visual dos Moves migrados (spawn, update, onHit, dispose),
// impedindo terminantemente a execução simultânea ou duplicada dos manipuladores legados
// (atelier-game.js e elemental-game.js), e preservando todos os efeitos compartilhados dos 16 Moves restantes.

/**
 * @typedef {{
 *   id: string,
 *   handles?: (e: any) => boolean,
 *   handlesFighter?: (f: any) => boolean,
 *   spawn?: (view: any, e: any, fxAcc: any) => any,
 *   spawnRush?: (view: any, f: any, fxAcc: any) => any,
 *   update?: (view: any, e: any, state: any, dt: number, fxAcc: any) => void,
 *   updateDying?: (view: any, e: any, state: any, dt: number, fxAcc: any) => void,
 *   advanceRush?: (view: any, rush: any, dt: number) => boolean,
 *   onEvent?: (view: any, ev: any, state: any) => void,
 *   onFighterEvent?: (view: any, ev: any, rush: any) => void,
 *   onMoveEvent?: (view: any, ev: any) => void,
 *   onDeath?: (view: any, e: any, state: any) => void,
 *   isFinished?: (state: any, age: number) => boolean,
 *   signatureOf?: (e: any, fxAcc: any) => string,
 *   dispose?: (view: any, e: any, state: any) => void,
 *   disposeRush?: (view: any, rush: any) => void,
 *   positionOf?: (state: any) => {x: number, y: number, z: number} | null
 * }} MoveVfxModule
 */

import * as sandWaveVfx from '../sim/moves/sand-wave/sand-wave.vfx.js';
import * as bulletPunchVfx from '../sim/moves/bullet-punch/bullet-punch.vfx.js';
import * as waterPulseVfx from '../sim/moves/water-pulse/water-pulse.vfx.js';

export class MovesVfxRegistry {
  /**
   * @param {any} view instância do WorldView ou grupo Three.js
   */
  constructor(view) {
    this.view = view;
    /** @type {Map<string, MoveVfxModule>} */
    this.modules = new Map();
    /** @type {Map<string|number, {module: MoveVfxModule, state: any, entity: any, dying: boolean, age: number, lastPos: {x: number, y: number, z: number} | null, signature: string}>} */
    this.activeInstances = new Map();
    /** @type {Array<{module: MoveVfxModule, rush: any, action: any}>} */
    this.rushes = [];
    // Pilotos migrados registrados:
    this.register('sand-wave', sandWaveVfx);
    this.register('bullet-punch', bulletPunchVfx);
    this.register('water-pulse', waterPulseVfx);
  }

  /**
   * Registra um módulo .vfx.js para um Move específico.
   * @param {string} moveId
   * @param {MoveVfxModule} vfxModule
   */
  register(moveId, vfxModule) {
    this.modules.set(moveId, vfxModule);
  }

  /**
   * Informa se um Move já foi migrado para a nova arquitetura modular de VFX.
   * @param {string} moveId
   */
  isMigrated(moveId) {
    return this.modules.has(moveId);
  }

  /**
   * Verifica se alguma entidade do mundo é de responsabilidade de um Move migrado.
   * @param {any} e
   */
  handles(e) {
    if (!e) return false;
    // Se a entidade declarar explicitamente seu moveId
    if (e.moveId && this.modules.has(e.moveId)) {
      const mod = this.modules.get(e.moveId);
      return mod?.handles ? mod.handles(e) : true;
    }
    // Varre os módulos registrados
    for (const [, mod] of this.modules) {
      if (mod.handles && mod.handles(e)) return true;
    }
    return false;
  }

  /**
   * Localiza o módulo responsável por uma entidade.
   * @param {any} e
   * @returns {MoveVfxModule | null}
   */
  moduleFor(e) {
    if (!e) return null;
    if (e.moveId && this.modules.has(e.moveId)) return this.modules.get(e.moveId) ?? null;
    for (const [, mod] of this.modules) {
      if (mod.handles && mod.handles(e)) return mod;
    }
    return null;
  }

  /**
   * Filtra entidades retirando aquelas que pertencem a Moves já migrados,
   * para que os manipuladores legados (atelierFx e elementalFx) NUNCA processem os mesmos efeitos.
   * @param {any[]} entities
   */
  filterUnmigrated(entities) {
    if (!this.modules.size) return entities;
    return entities.filter(e => !this.handles(e));
  }

  /**
   * Ciclo de sincronização de vida visual dos Moves migrados.
   * Protegido contra reutilização de IDs entre reinícios de partida e recriação em dying.
   * @param {any[]} entities
   * @param {number} dt
   * @param {any} fxAcc acessibilidade (noFlash, reduceMotion)
   * @param {any[]} fighters
   */
  sync(entities, dt, fxAcc, fighters) {
    // Sincroniza ações de rush dos lutadores (Bullet Punch)
    if (fighters && fighters.length > 0) {
      this.rushes ??= [];
      for (const f of fighters) {
        const m = f?.action?.move;
        if (this.modules.has(m)) {
          const mod = this.modules.get(m);
          if (mod?.handlesFighter && mod.handlesFighter(f) && !this.rushes.some(r => r.rush?.f === f || r.action === f.action)) {
            if (mod.spawnRush) {
              const r = mod.spawnRush(this.view, f, fxAcc);
              this.rushes.push({module: mod, rush: r, action: f.action});
            }
          }
        }
      }
      this.rushes = this.rushes.filter(item => {
        const finished = item.module.advanceRush ? item.module.advanceRush(this.view, item.rush, dt) : true;
        if (finished) {
          if (item.module.disposeRush) item.module.disposeRush(this.view, item.rush);
          return false;
        }
        return true;
      });
    }

    const currentAliveIds = new Set();

    for (const e of entities ?? []) {
      if (!this.handles(e)) continue;
      currentAliveIds.add(e.id);

      const mod = this.moduleFor(e);
      if (!mod) continue;

      const sig = mod.signatureOf ? mod.signatureOf(e, fxAcc) : '';
      let inst = this.activeInstances.get(e.id);

      // Proteção rigorosa contra reutilização de IDs e alterações em tempo real:
      // Se a entidade mudou de referência (mundo reiniciado ou ID reciclado),
      // se o módulo responsável mudou,
      // se a instância anterior estava em fase dying (ID reaproveitado após reinício ou disparo rápido),
      // ou se a assinatura visual mudou (variante, acessibilidade, parâmetros):
      if (inst && (inst.entity !== e || inst.module !== mod || inst.dying || inst.signature !== sig)) {
        if (inst.module.dispose) inst.module.dispose(this.view, inst.entity, inst.state);
        this.activeInstances.delete(e.id);
        inst = undefined;
      }

      if (!inst) {
        const state = mod.spawn ? mod.spawn(this.view, e, fxAcc) : null;
        inst = {
          module: mod,
          state,
          entity: e,
          dying: false,
          age: 0,
          lastPos: e.pos ? {x: e.pos.x, y: e.y ?? 0.6, z: e.pos.z} : null,
          signature: sig
        };
        this.activeInstances.set(e.id, inst);
      }

      if (e.pos) {
        inst.lastPos = {x: e.pos.x, y: e.y ?? 0.6, z: e.pos.z};
      }

      if (inst.module.update) {
        inst.module.update(this.view, e, inst.state, dt, fxAcc);
      }
    }

    // Ciclo de dissipação / transição dying e limpeza de entidades destruídas / encerradas
    for (const [id, inst] of this.activeInstances) {
      if (!currentAliveIds.has(id)) {
        if (!inst.dying) {
          inst.dying = true;
          inst.age = 0;
          if (inst.module.onDeath) {
            inst.module.onDeath(this.view, inst.entity, inst.state);
          }
        } else {
          inst.age += dt;
        }

        if (inst.module.updateDying) {
          inst.module.updateDying(this.view, inst.entity, inst.state, dt, fxAcc);
        } else if (inst.module.update) {
          inst.module.update(this.view, null, inst.state, dt, fxAcc);
        }

        const isFinished = inst.module.isFinished ? inst.module.isFinished(inst.state, inst.age) : (inst.age >= 0.4);
        if (isFinished) {
          if (inst.module.dispose) {
            inst.module.dispose(this.view, inst.entity, inst.state);
          }
          this.activeInstances.delete(id);
        }
      }
    }
  }

  /**
   * Despacha eventos de impacto / colisão para o módulo de VFX do Move.
   * @param {any} ev
   */
  onEvent(ev) {
    if (!ev) return;
    // 1. Despacho direto para a entidade associada ao evento
    if (ev.entity != null) {
      const inst = this.activeInstances.get(ev.entity);
      if (inst && inst.module.onEvent) {
        inst.module.onEvent(this.view, ev, inst.state);
      }
    }
    // 2. Despacho para rushes em andamento (Bullet Punch)
    if (this.rushes && this.rushes.length > 0) {
      for (const item of this.rushes) {
        if (item.module.onFighterEvent) {
          item.module.onFighterEvent(this.view, ev, item.rush);
        }
      }
    }
    // 3. Despacho para o módulo do Move especificado no evento
    if (ev.move && this.modules.has(ev.move)) {
      const mod = this.modules.get(ev.move);
      if (mod?.onMoveEvent) {
        mod.onMoveEvent(this.view, ev);
      }
    }
  }

  /**
   * Retorna a posição 3D de uma entidade sob gestão do VFX migrado.
   * Permanece válida mesmo durante a fase dying para casamento visual perfeito dos anéis de impacto.
   * @param {string|number} entityId
   */
  positionOf(entityId) {
    const inst = this.activeInstances.get(entityId);
    if (!inst) return null;
    if (inst.module.positionOf) {
      const pos = inst.module.positionOf(inst.state);
      if (pos) return pos;
    }
    if (inst.lastPos) return inst.lastPos;
    if (inst.entity?.pos) return {x: inst.entity.pos.x, y: inst.entity.y ?? 0.6, z: inst.entity.pos.z};
    return null;
  }

  /**
   * Diagnóstico em tempo real para testes de navegador e auditoria.
   */
  diagnostics() {
    const instances = [...this.activeInstances.entries()].map(([id, inst]) => ({
      id,
      moveId: inst.module.id,
      dying: inst.dying,
      age: +inst.age.toFixed(3),
      pos: this.positionOf(id)
    }));
    const rushes = (this.rushes ?? []).map(r => ({
      move: r.module.id,
      age: +r.rush.age.toFixed(3),
      done: r.rush.done,
      phase: r.rush.fx?.phase,
      state: r.rush.state ?? null
    }));
    return {
      activeCount: instances.length,
      rushesCount: rushes.length,
      instances,
      rushes
    };
  }

  /**
   * Limpa todos os recursos e malhas ativas.
   */
  disposeAll() {
    if (this.rushes) {
      for (const item of this.rushes) {
        if (item.module.disposeRush) item.module.disposeRush(this.view, item.rush);
      }
      this.rushes = [];
    }
    for (const [, inst] of this.activeInstances) {
      if (inst.module.dispose) {
        inst.module.dispose(this.view, inst.entity, inst.state);
      }
    }
    this.activeInstances.clear();
  }

  /**
   * Sinônimo de disposeAll para padronização com elementalFx.clear() e atelierFx.clear().
   */
  clear() {
    this.disposeAll();
  }
}
