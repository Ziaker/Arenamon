export const PHASE_NAMES = ['start', 'launch', 'body', 'hold', 'finish', 'impact'] as const;
export type PhaseName = typeof PHASE_NAMES[number];
export type OutcomePhase = 'finish' | 'impact';
export type AuthoringFps = 24 | 30 | 60;
export type Vec3 = [number, number, number];
export interface VisualTransform {position: Vec3; rotation: Vec3; scale: Vec3}
export interface PathGeometry {kind: 'stroke' | 'curve' | 'ribbon'; points: Vec3[]; width: number; endWidth?: number; extrusion?: number; closed: boolean}
export type VisualGeometry = {kind: 'box'; size: Vec3} | {kind: 'sphere'; radius: number} | {kind: 'plane'; size: [number, number]} | PathGeometry;
export interface VisualNode {id: string; kind: 'group' | 'mesh' | 'stroke' | 'particles' | 'material'; parentId: string | null; assetIds: string[]; transform?: VisualTransform; pivot?: Vec3; locked?: boolean; geometry?: VisualGeometry}
export interface AuthoringSettings {drawingPlane: {origin: Vec3; rotation: Vec3}; mirrorX: boolean; radialCopies: number}
export type NumericTrackProperty = 'opacity' | 'scale' | 'visible' | 'position.x' | 'position.y' | 'position.z' | 'rotation.x' | 'rotation.y' | 'rotation.z';
export interface NumericKeyframe {time: number; value: number; interpolation: 'linear' | 'step' | 'bezier'; inTangent?: number; outTangent?: number}
export interface PathKeyframe {time: number; value: Vec3[]; interpolation: 'linear' | 'step'}
export type VisualTrack = {id: string; targetId: string; property: NumericTrackProperty; keyframes: NumericKeyframe[]} | {id: string; targetId: string; property: 'path.points'; keyframes: PathKeyframe[]};
export interface VisualAsset {assetId: string; uri: string; kind: 'texture' | 'mesh' | 'reference'}
export interface Subeffect {id: string; componentId: string; version: string; parentId: string | null; delay: number}
export interface TimelineEvent {id: string; time: number; name: string}
export interface TextureDocument {id: string; name: string; width: number; height: number; rgbaBase64: string; spriteSheet?: {columns: number; rows: number; fps: AuthoringFps}}
export type MaterialNodeType = 'color' | 'texture' | 'gradient' | 'noise' | 'fresnel' | 'dissolve' | 'multiply' | 'output';
export interface MaterialNode {id: string; type: MaterialNodeType; params: Record<string, string | number>}
export interface MaterialConnection {fromNodeId: string; fromPort: string; toNodeId: string; toPort: string}
export interface MaterialGraph {id: string; name: string; nodes: MaterialNode[]; connections: MaterialConnection[]; outputNodeId: string}

export interface PhaseDefinition {
  enabled: boolean;
  duration: number;
  tracks: VisualTrack[];
}

export type PhaseMap = Record<PhaseName, PhaseDefinition>;

export interface PinnedComponent {
  componentId: string;
  version: string;
}

import type {ParticleEmitter} from '../particles/particles';

export interface VfxProject {
  schema: 'arenamon.vfx-project';
  schemaVersion: 1;
  projectId: string;
  revision: number;
  effectId: string;
  phases: PhaseMap;
  nodes: VisualNode[];
  assets: VisualAsset[];
  subeffects: Subeffect[];
  timeline: {fps: AuthoringFps; tracks: VisualTrack[]; duration?: number; events?: TimelineEvent[]};
  textures?: TextureDocument[];
  materials?: MaterialGraph[];
  particles?: ParticleEmitter[];
  qualityProfiles: Record<string, unknown>;
  accessibility: {noFlash: boolean; reduceMotion: boolean};
  pinnedComponents: PinnedComponent[];
  authoring?: AuthoringSettings;
}

export interface VfxRuntime {
  schema: 'arenamon.vfx-runtime';
  schemaVersion: 1;
  effectId: string;
  version: string;
  phases: PhaseMap;
  budget: BudgetCost;
}

export type ComposerTrigger = 'cast' | 'launch' | 'spawn' | 'hit' | 'partial' | 'perfect' | 'perfectDodge' | 'clash' | 'miss' | 'timeout' | 'wall' | 'ground' | 'status' | 'cancel';

export interface EffectBinding {
  moveId: string;
  trigger: ComposerTrigger;
  effectId: string;
  version: string;
  anchor: string;
  offsets: {x: number; y: number; z: number};
}

export interface BudgetCost {
  particles: number;
  lights: number;
  drawCalls: number;
}

export interface ValidationIssue {path: string; message: string}
export type ValidationResult<T> = {ok: true; value: T; issues: []} | {ok: false; issues: ValidationIssue[]};
