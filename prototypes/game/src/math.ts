export interface Vec { x: number; z: number }
export const vec = (x = 0, z = 0): Vec => ({ x, z });
export const add = (a: Vec, b: Vec): Vec => vec(a.x + b.x, a.z + b.z);
export const scale = (a: Vec, s: number): Vec => vec(a.x * s, a.z * s);
export const sub = (a: Vec, b: Vec): Vec => vec(a.x - b.x, a.z - b.z);
export const dot = (a: Vec, b: Vec) => a.x * b.x + a.z * b.z;
export const length = (a: Vec) => Math.hypot(a.x, a.z);
export const unit = (a: Vec) => length(a) > 1e-8 ? scale(a, 1 / length(a)) : vec();
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const angle = (v: Vec) => Math.atan2(v.x, v.z);
export const direction = (a: number) => vec(Math.sin(a), Math.cos(a));
export const delta = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
export const smooth = (u: number) => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
// Integral: 0→1, 70% at halfway, continuous decreasing speed, zero terminal speed.
export const dodgeProgress = (u: number) => { u = clamp(u, 0, 1); return 1.6 * u - .2 * u * u - .4 * u * u * u; };
