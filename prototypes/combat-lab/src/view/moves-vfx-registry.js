// @ts-check
// Registro oficial de efeitos visuais de Moves (Documento 02 - Camada view/).
// Assume exclusivamente o ciclo de vida visual dos Moves migrados (spawn, update, onHit, dispose),
// impedindo terminantemente a execução simultânea ou duplicada dos manipuladores legados
// (atelier-game.js e elemental-game.js), e preservando todos os efeitos compartilhados dos 16 Moves restantes.

/**
 * @typedef {{
 *   id: string,
 *   handles?: (e: any) => boolean,
 *   spawn?: (view: any, e: any, fxAcc: any) => any,
 *   update?: (view: any, e: any, state: any, dt: number, fxAcc: any) => void,
 *   onEvent?: (view: any, ev: any, state: any) => void,
 *   dispose?: (view: any, e: any, state: any) => void,
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
    /** @type {Map<string, {module: MoveVfxModule, state: any, entity: any}>} */
    this.activeInstances = new Map();
    // Pilotos migrados registrados:
    this.register('sand-wave', sandWaveVfx);
    this.register('bullet-punch', bulletPunchVfx);
    this.register('water-pulse', waterPulseVfx);
    this.rushes = [];
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
          if (mod?.handlesFighter && mod.handlesFighter(f) && !this.rushes.some(r => r.action === f.action)) {
            if (mod.spawnRush) {
              const r = mod.spawnRush(this.view, f, fxAcc);
              this.rushes.push({module: mod, rush: r, action: f.action});
            }
          }
        }
      }
      this.rushes = this.rushes.filter(item => {
        const finished = item.module.advanceRush(this.view, item.rush, dt);
        if (finished) {
          if (item.module.disposeRush) item.module.disposeRush(this.view, item.rush);
          return false;
        }
        return true;
      });
    }

    const currentAliveIds = new Set();

    for (const e of entities) {
      if (!this.handles(e)) continue;
      currentAliveIds.add(e.id);

      let inst = this.activeInstances.get(e.id);
      if (!inst) {
        const mod = this.moduleFor(e);
        if (mod) {
          const state = mod.spawn ? mod.spawn(this.view, e, fxAcc) : null;
          inst = {module: mod, state, entity: e};
          this.activeInstances.set(e.id, inst);
        }
      }

      if (inst && inst.module.update) {
        inst.module.update(this.view, e, inst.state, dt, fxAcc);
      }
    }

    // Limpeza de entidades destruídas / encerradas
    for (const [id, inst] of this.activeInstances) {
      if (!currentAliveIds.has(id)) {
        if (inst.module.dispose) {
          inst.module.dispose(this.view, inst.entity, inst.state);
        }
        this.activeInstances.delete(id);
      }
    }
  }

  /**
   * Despacha eventos de impacto / colisão para o módulo de VFX do Move.
   * @param {any} ev
   */
  onEvent(ev) {
    if (!ev || !ev.entity) return;
    const inst = this.activeInstances.get(ev.entity);
    if (inst && inst.module.onEvent) {
      inst.module.onEvent(this.view, ev, inst.state);
    }
  }

  /**
   * Retorna a posição 3D de uma entidade sob gestão do VFX migrado.
   * @param {string} entityId
   */
  positionOf(entityId) {
    const inst = this.activeInstances.get(entityId);
    if (!inst) return null;
    if (inst.module.positionOf) return inst.module.positionOf(inst.state);
    if (inst.entity?.pos) return {x: inst.entity.pos.x, y: inst.entity.y ?? 0.6, z: inst.entity.pos.z};
    return null;
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
}
