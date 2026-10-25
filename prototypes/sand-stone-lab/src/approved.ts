import type {Presets} from './presets.ts';
import type {Category} from './config.ts';
import sand from '../approved/sand.json' with {type: 'json'};
import stone from '../approved/stone.json' with {type: 'json'};
import psyshock from '../approved/psyshock.json' with {type: 'json'};
import swift from '../approved/swift.json' with {type: 'json'};

/** Parâmetros APROVADOS que o jogo usa (approved/<move>.json — mesma fonte do combat-lab). O atelier abre com eles na alternativa aprovada. */
export const approvedDocs = {sand, stone, psyshock, swift} as Record<string, {category: Category; variant: 'A' | 'B' | 'C'; visualParameters: Record<string, number>}>;
export function withApproved(presets: Presets): Presets {
  for (const doc of Object.values(approvedDocs)) presets[doc.category][doc.variant] = {...presets[doc.category][doc.variant], ...doc.visualParameters};
  return presets;
}
