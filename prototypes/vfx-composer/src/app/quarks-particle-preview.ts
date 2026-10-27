import * as THREE from 'three';
import * as Quarks from 'three.quarks';
import {toQuarksRecipe, type QuarksRecipe} from '../particles/quarks-contract';
import type {ParticleEmitter, SimulationOptions} from '../particles/particles';

interface Entry {
  system: Quarks.ParticleSystem;
  material: THREE.Material;
}

export interface QuarksPreviewReport {
  backend: 'quarks';
  systems: number;
  active: number;
  drawCalls: number;
  rebuilds: number;
  approximations: string[];
}

const interval = (range: [number, number]): Quarks.ValueGenerator => range[0] === range[1]
  ? new Quarks.ConstantValue(range[0])
  : new Quarks.IntervalValue(range[0], range[1]);

const color = (value: string, alpha: number): Quarks.Vector4 => {
  const parsed = new THREE.Color(value);
  return new Quarks.Vector4(parsed.r, parsed.g, parsed.b, alpha);
};

const curve = (start: number, end: number): Quarks.PiecewiseBezier =>
  new Quarks.PiecewiseBezier([[new Quarks.Bezier(start, start, end, end), 0]]);

function shape(recipe: QuarksRecipe): Quarks.EmitterShape {
  switch (recipe.shape.kind) {
    case 'sphere': return new Quarks.SphereEmitter({radius: recipe.shape.radius});
    case 'ring': return new Quarks.DonutEmitter({radius: recipe.shape.radius, thickness: 0.001, arc: Math.PI * 2});
    case 'cone': return new Quarks.ConeEmitter({radius: recipe.shape.radius, angle: recipe.shape.angleRadians});
    default: return new Quarks.PointEmitter();
  }
}

function behaviors(recipe: QuarksRecipe): Quarks.Behavior[] {
  const start = new THREE.Color(recipe.look.colors[0]);
  const end = new THREE.Color(recipe.look.colors[1]);
  const list: Quarks.Behavior[] = [
    new Quarks.ColorOverLife(new Quarks.Gradient(
      [[new Quarks.Vector3(start.r, start.g, start.b), 0], [new Quarks.Vector3(end.r, end.g, end.b), 1]],
      [[recipe.look.opacity[0], 0], [recipe.look.opacity[1], 1]],
    )),
    new Quarks.SizeOverLife(curve(recipe.look.size[0], recipe.look.size[1])),
  ];
  const gravity = new Quarks.Vector3(...recipe.gravity);
  const magnitude = gravity.length();
  if (magnitude > 0) list.push(new Quarks.ApplyForce(gravity.normalize(), new Quarks.ConstantValue(magnitude)));
  if (recipe.drag > 0) list.push(new Quarks.SpeedOverLife(curve(1, Math.exp(-recipe.drag))));
  if (recipe.turbulence.amplitude > 0) {
    const frequency = Math.max(0.001, recipe.turbulence.frequency);
    list.push(new Quarks.TurbulenceField(
      new Quarks.Vector3(frequency, frequency, frequency),
      2,
      new Quarks.Vector3(recipe.turbulence.amplitude, recipe.turbulence.amplitude, recipe.turbulence.amplitude),
      new Quarks.Vector3(1, 1, 1),
    ));
  }
  return list;
}

function material(recipe: QuarksRecipe): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    depthTest: true,
    depthWrite: recipe.look.depthWrite,
    blending: recipe.look.blending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
}

function parameters(recipe: QuarksRecipe, particleMaterial: THREE.Material): Quarks.ParticleSystemParameters {
  const bursts = recipe.emission.mode === 'burst'
    ? [{time: 0, count: new Quarks.ConstantValue(recipe.emission.count), cycle: Math.floor(recipe.emission.duration / recipe.emission.interval) + 1, interval: recipe.emission.interval, probability: 1}]
    : [];
  return {
    autoDestroy: false,
    looping: false,
    duration: recipe.emission.duration,
    worldSpace: recipe.worldSpace,
    shape: shape(recipe),
    startLife: interval(recipe.lifetime),
    startSpeed: interval(recipe.speed),
    startSize: new Quarks.ConstantValue(recipe.look.size[0]),
    startColor: new Quarks.ColorRange(color(recipe.look.colors[0], recipe.look.opacity[0]), color(recipe.look.colors[0], recipe.look.opacity[0])),
    emissionOverTime: new Quarks.ConstantValue(recipe.emission.rate),
    emissionBursts: bursts,
    behaviors: behaviors(recipe),
    material: particleMaterial,
    renderMode: Quarks.RenderMode.BillBoard,
  };
}

/** Backend visual acumulativo. Scrub reverso ou mudança de contrato provoca rebuild explícito. */
export class QuarksParticlePreview {
  readonly group = new THREE.Group();
  #renderer = new Quarks.BatchedRenderer();
  #entries = new Map<string, Entry>();
  #time = 0;
  #signature = '';
  #rebuilds = 0;
  #approximations: string[] = [];

  constructor(private readonly scene: THREE.Scene) {
    this.group.name = 'quarks-particles-preview';
    this.group.add(this.#renderer);
    scene.add(this.group);
  }

  update(emitters: readonly ParticleEmitter[], time: number, options: SimulationOptions = {}): QuarksPreviewReport {
    const recipes = emitters.filter(candidate => candidate.enabled).map(candidate => toQuarksRecipe(candidate, options));
    const signature = JSON.stringify(recipes);
    const safeTime = Number.isFinite(time) ? Math.max(0, time) : 0;
    if (signature !== this.#signature || safeTime + 1e-9 < this.#time) this.#rebuild(recipes, safeTime, signature);
    else if (safeTime > this.#time) this.#advance(safeTime - this.#time);
    this.#time = safeTime;
    return this.report;
  }

  get report(): QuarksPreviewReport {
    let active = 0;
    for (const entry of this.#entries.values()) active += entry.system.particleNum;
    return {backend: 'quarks', systems: this.#entries.size, active, drawCalls: this.#entries.size, rebuilds: this.#rebuilds, approximations: [...this.#approximations]};
  }

  reset(): void {
    this.#clear();
    this.#time = 0;
    this.#signature = '';
    this.#rebuilds = 0;
    this.#approximations = [];
  }

  dispose(): void {
    this.reset();
    this.group.removeFromParent();
  }

  #rebuild(recipes: QuarksRecipe[], time: number, signature: string): void {
    this.#clear();
    this.#signature = signature;
    this.#approximations = [...new Set(recipes.flatMap(recipe => recipe.approximations))];
    for (const recipe of recipes) {
      const particleMaterial = material(recipe);
      const system = new Quarks.ParticleSystem(parameters(recipe, particleMaterial));
      system.emitter.position.set(...recipe.origin);
      this.group.add(system.emitter);
      this.#renderer.addSystem(system);
      this.#entries.set(recipe.id, {system, material: particleMaterial});
    }
    this.#rebuilds++;
    this.#advance(time);
  }

  #advance(delta: number): void {
    let remaining = Math.max(0, delta);
    while (remaining > 0) {
      const step = Math.min(1 / 30, remaining);
      this.#renderer.update(step);
      remaining -= step;
    }
  }

  #clear(): void {
    for (const entry of this.#entries.values()) {
      entry.system.dispose();
      entry.material.dispose();
    }
    this.#entries.clear();
    for (const batch of this.#renderer.batches) {
      batch.removeFromParent();
      batch.dispose();
    }
    this.#renderer.removeFromParent();
    this.#renderer = new Quarks.BatchedRenderer();
    this.group.add(this.#renderer);
  }
}

