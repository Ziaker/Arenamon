export const ICON_NAMES = ['project', 'undo', 'redo', 'play', 'stop', 'export', 'create', 'transform', 'appearance', 'movement', 'particles', 'output', 'settings', 'help', 'visibility', 'lock', 'search', 'frame', 'onion', 'keyframe', 'stroke', 'ribbon', 'emitter'] as const;
export type IconName = typeof ICON_NAMES[number];

const paths: Record<IconName, string> = {
  project: '<path d="M3 5h7l2 2h9v12H3z"/>', undo: '<path d="M9 7 4 12l5 5M5 12h8a6 6 0 0 1 6 6"/>', redo: '<path d="m15 7 5 5-5 5m4-5h-8a6 6 0 0 0-6 6"/>',
  play: '<path d="m8 5 11 7-11 7z"/>', stop: '<path d="M6 6h12v12H6z"/>', export: '<path d="M12 3v12m-5-5 5 5 5-5M5 19h14"/>', create: '<path d="M12 4v16M4 12h16"/>',
  transform: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5m11-5v5h-5M8 12h8"/>', appearance: '<path d="M12 3a9 9 0 1 0 0 18z"/>', movement: '<path d="M5 12h14m-4-4 4 4-4 4M9 8l-4 4 4 4"/>',
  particles: '<path d="M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8"/>', output: '<path d="M4 5h10v14H4zM14 9h6v10h-6m2-5h3"/>',
  settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8m0-5v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-12.8-2.1 2.1m-8.6 8.6-2.1 2.1"/>', help: '<path d="M9 9a3 3 0 1 1 4 2.8c-1 .5-1 1.2-1 2.2m0 4h.01"/>',
  visibility: '<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12m10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6"/>', lock: '<path d="M6 10h12v10H6zM8 10V7a4 4 0 0 1 8 0v3"/>', search: '<path d="m15 15 5 5m-3-9a6 6 0 1 1-12 0 6 6 0 0 1 12 0"/>',
  frame: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5m11-5v5h-5"/>', onion: '<path d="M12 4a8 8 0 1 0 0 16 6 6 0 1 0 0-16 4 4 0 1 0 0 16"/>', keyframe: '<path d="m12 4 8 8-8 8-8-8z"/>',
  stroke: '<path d="M4 17c4-9 8 2 16-10"/>', ribbon: '<path d="M4 7c5 0 5 10 10 10s5-7 6-9M4 11c5 0 5 10 10 10"/>', emitter: '<path d="M12 12h.01M12 3v4m0 10v4M3 12h4m10 0h4m-3.4-6.6-2.8 2.8m-5.6 5.6-2.8 2.8m11.2 0-2.8-2.8M9.2 8.2 6.4 5.4"/>',
};
const escape = (value: string): string => value.replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]!));

export function icon(name: IconName, options: {label: string; className?: string}): string {
  const label = escape(options.label);
  return `<svg class="${escape(options.className ?? 'icon')}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" role="img"><title>${label}</title>${paths[name]}</svg>`;
}
export function iconButton(options: {name: IconName; label: string; className?: string; text?: string; id?: string}): string {
  const label = escape(options.label);
  return `<button${options.id ? ` id="${escape(options.id)}"` : ''} class="${escape(options.className ?? 'icon-button')}" aria-label="${label}" title="${label}">${icon(options.name, {label})}${options.text ? `<span>${escape(options.text)}</span>` : ''}</button>`;
}
