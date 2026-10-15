// Valores do jogo oficial (prototypes/game/src/config.ts), compilados pelo esbuild no build do laboratório.
// Usados apenas para COMPARAÇÃO: o laboratório nunca altera o jogo. Cada parâmetro é marcado como oficial
// (igual ao jogo), experimental (difere do jogo) ou só do laboratório (não existe no jogo).
import {RULES, TEST, LOCOMOTION, CAMERA, profiles} from '../../../game/src/config.ts';
export const OFFICIAL = {rules: RULES, test: TEST, locomotion: LOCOMOTION, camera: CAMERA, profiles};
