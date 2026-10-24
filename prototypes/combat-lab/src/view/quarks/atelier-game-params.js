// Parâmetros aprovados no atelier Areia/Pedra, lidos de prototypes/sand-stone-lab/approved/<move>.json — UMA fonte só, usada pelo atelier e pelo jogo.
// Cada arquivo é exatamente a exportação «uma alternativa» do atelier (botão Exportar): para mudar o que o jogo usa, exporte do atelier e troque o arquivo.
// Só aparência: nada aqui decide dano, colisão ou alcance. Teste: test/atelier-approved.test.mjs.
import sand from '../../../../sand-stone-lab/approved/sand.json' with {type: 'json'};
import stone from '../../../../sand-stone-lab/approved/stone.json' with {type: 'json'};
import psyshock from '../../../../sand-stone-lab/approved/psyshock.json' with {type: 'json'};
import swift from '../../../../sand-stone-lab/approved/swift.json' with {type: 'json'};

export const ATELIER_APPROVED = {sand, stone, psyshock, swift};
const LETTER = {A: 0, B: 1, C: 2};
export const ATELIER_GAME_VARIANT = Object.fromEntries(Object.entries(ATELIER_APPROVED).map(([k, doc]) => [k, LETTER[doc.variant]]));
export const ATELIER_GAME_PARAMS = Object.fromEntries(Object.entries(ATELIER_APPROVED).map(([k, doc]) => [k, doc.visualParameters]));
