export interface HierarchyItem {id: string; name: string; kind: string}
export const filterHierarchy = (items: readonly HierarchyItem[], query: string): HierarchyItem[] => {
  const normalized = query.trim().toLocaleLowerCase('pt-BR');
  return normalized ? items.filter(item => `${item.name} ${item.kind}`.toLocaleLowerCase('pt-BR').includes(normalized)) : [...items];
};
