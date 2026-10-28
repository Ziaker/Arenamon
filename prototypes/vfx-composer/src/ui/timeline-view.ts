import type {VisualTrack} from '../core/types';

export type TimelineFamily = 'transform' | 'appearance' | 'geometry';
export interface TimelineMarker {id: string; time: number; label: string; kind?: 'contact' | 'explosion' | 'launch' | 'event'}
export interface TimelineOptions {duration: number; zoom?: number; selectedKeyframes?: readonly string[]; markers?: readonly TimelineMarker[]}

const familyFor = (property: VisualTrack['property']): TimelineFamily => property.startsWith('position.') || property.startsWith('rotation.') || property === 'scale' ? 'transform' : property === 'path.points' ? 'geometry' : 'appearance';
export const clampTimelineZoom = (zoom: number): number => Math.max(.5, Math.min(4, Number.isFinite(zoom) ? zoom : 1));

export function timelineViewModel(tracks: readonly VisualTrack[], options: TimelineOptions) {
  const selected = new Set(options.selectedKeyframes ?? []);
  const groups = new Map<string, {targetId: string; tracks: Array<{id: string; property: string; family: TimelineFamily; keyframes: Array<{time: number; selected: boolean}>}>}>();
  for (const track of tracks) {
    const group = groups.get(track.targetId) ?? {targetId: track.targetId, tracks: []};
    group.tracks.push({id: track.id, property: track.property, family: familyFor(track.property), keyframes: track.keyframes.map(frame => ({time: frame.time, selected: selected.has(`${track.id}@${frame.time}`)}))});
    groups.set(track.targetId, group);
  }
  return {duration: Math.max(.1, options.duration), zoom: clampTimelineZoom(options.zoom ?? 1), groups: [...groups.values()], markers: (options.markers ?? []).map(marker => ({...marker, kind: marker.kind ?? (marker.id === 'contact' || marker.id === 'explosion' || marker.id === 'launch' ? marker.id : 'event') as TimelineMarker['kind']}))};
}

const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]!));

export class TimelineView {
  private zoom = 1;
  constructor(private readonly root: HTMLElement, private readonly onSeek: (time: number) => void) {
    root.addEventListener('click', event => {
      const time = (event.target as HTMLElement).closest<HTMLElement>('[data-time]')?.dataset.time;
      if (time !== undefined) this.onSeek(Number(time));
    });
  }
  mount(tracks: readonly VisualTrack[], options: TimelineOptions): void { this.update(tracks, options); }
  update(tracks: readonly VisualTrack[], options: TimelineOptions): void {
    this.zoom = clampTimelineZoom(options.zoom ?? this.zoom);
    const model = timelineViewModel(tracks, {...options, zoom: this.zoom});
    const scale = 100 * model.zoom;
    const rows = model.groups.length ? model.groups.flatMap(group => [
      `<div class="timeline-object"><strong>${escapeHtml(group.targetId)}</strong><span>${group.tracks.length} trilhas</span></div>`,
      ...group.tracks.map(track => `<div class="timeline-track" data-family="${track.family}"><span>${escapeHtml(track.property)}</span><div class="timeline-lane" style="--timeline-scale:${scale}%">${track.keyframes.map(frame => `<button class="timeline-key${frame.selected ? ' selected' : ''}" data-time="${frame.time}" style="left:${Math.min(100, frame.time / model.duration * 100)}%" aria-label="Ir para ${frame.time.toFixed(2)} segundos" title="${frame.time.toFixed(2)} s"></button>`).join('')}</div></div>`)
    ]).join('') : '<div class="timeline-empty">Adicione keyframes para revelar o ritmo do efeito.</div>';
    const markers = model.markers.map(marker => `<button class="timeline-marker" data-kind="${marker.kind}" data-time="${marker.time}" style="left:${Math.min(100, marker.time / model.duration * 100)}%" title="${escapeHtml(marker.label)}"><span>${escapeHtml(marker.label)}</span></button>`).join('');
    this.root.innerHTML = `<div class="timeline-head"><strong>Ritmo do efeito</strong><span>${model.groups.length} objetos animados</span><label>Zoom <input data-timeline-zoom type="range" min="0.5" max="4" step="0.25" value="${model.zoom}"></label></div><div class="timeline-ruler">${markers}</div><div class="timeline-rows">${rows}</div>`;
    this.root.querySelector<HTMLInputElement>('[data-timeline-zoom]')!.oninput = event => {this.zoom = clampTimelineZoom(Number((event.target as HTMLInputElement).value)); this.update(tracks, {...options, zoom: this.zoom});};
  }
}
