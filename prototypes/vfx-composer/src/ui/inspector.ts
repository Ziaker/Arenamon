export type InspectorNode = {kind: string} | null;
export function inspectorGroupsForNode(node: InspectorNode): string[] {
  if (!node) return [];
  if (node.kind === 'particles') return ['transform', 'particles', 'budget'];
  if (node.kind === 'stroke') return ['transform', 'appearance', 'drawing', 'animation'];
  if (node.kind === 'mesh') return ['transform', 'appearance', 'geometry', 'animation'];
  return ['transform', 'appearance'];
}

export function enhanceInspector(root: HTMLElement): void {
  root.querySelectorAll(':scope > h2').forEach((heading, index) => {
    heading.classList.add('inspector-group-title'); heading.setAttribute('tabindex', '0'); heading.setAttribute('role', 'button'); heading.setAttribute('aria-expanded', index < 2 ? 'true' : 'false');
  });
}
