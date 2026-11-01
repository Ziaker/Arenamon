// Gera docs/MATRIZ_CAMPOS_ANIMACAO.md: quais controles do editor de animações valem em cada ação (F1 do plano do editor, 01/11/2026).
// Lê as mesmas listas que o jogo usa (TIMED, ONE_SHOT, ANIMATION_GROUPS, FIELDS) — não roda partida, ≈ 1 s.
// Uso: node scripts/gen-matriz-campos-animacao.mjs
import {writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {ANIMATION_GROUPS, FIELDS} from '../prototypes/combat-lab/src/sim/animation-profile.js';
import {TIMED, ONE_SHOT} from '../prototypes/combat-lab/src/view/characters.js';

const label = new Map(ANIMATION_GROUPS.map(([id, nome]) => [id, nome]));
const comRelogioLivre = id => !TIMED.has(id) && !id.startsWith('charge_') && id !== 'ledge_climb';   // characters.js: só estes passam pelo agendador (loop avançado + segurar quadro)
const camposAplicados = FIELDS.filter(f => f.applied).length, camposRegistrados = FIELDS.length - camposAplicados;
const porGrupo = {};
for (const f of FIELDS) (porGrupo[f.group] ??= []).push(f.id);

let md = `# Matriz de campos do editor de animações

Gerada por \`node scripts/gen-matriz-campos-animacao.mjs\` a partir de \`TIMED\`/\`ONE_SHOT\` (\`view/characters.js\`) e \`FIELDS\` (\`sim/animation-profile.js\`). É leitura do código, **não** uma partida rodando.

- Campos no editor: **${FIELDS.length}** (${camposAplicados} aplicados, ${camposRegistrados} só registrados).
- Regra do relógio (\`characters.js\`, \`blend()\`): estados **TIMED** têm o tempo do clipe decidido pela simulação (progresso da ação). Eles **ignoram** os grupos **Loop avançado** e **Segurar quadro**. Os demais usam o relógio livre e passam pelo agendador (\`view/clip-scheduler.js\`).
- Fases do pulo (\`jump_start/rise/apex/fall\`) usam o relógio livre, mas **a troca de fase é da física** (velocidade vertical); só o «Tempo segurado» finito atrasa a troca visual (\`Character.jumpHoldKeeps\`), e o pouso/reação interrompem na hora.

## Ações × controles

| Grupo | Ação | Relógio do clipe | Execução | Loop avançado e Segurar quadro |
|---|---|---|---|---|
`;
for (const [grupo, , ids] of ANIMATION_GROUPS) {
  for (const id of ids) {
    const timed = TIMED.has(id), unica = ONE_SHOT.has(id);
    md += `| ${label.get(grupo)} | \`${id}\` | ${timed ? 'simulação (TIMED)' : 'livre'} | ${unica ? 'uma vez' : timed ? 'pela simulação' : 'laço por padrão'} | ${comRelogioLivre(id) ? 'vale' : 'ignorado'} |\n`;
  }
}
md += `\n## Campos por grupo\n\n`;
for (const [g, ids] of Object.entries(porGrupo)) md += `- **${g}** (${ids.length}): ${ids.map(i => `\`${i}\``).join(', ')}\n`;
md += `\n## Como ler\n\n- «ignorado» não é defeito do campo: o estado depende da física. Para esses estados o controle que vale é o do próprio estado (duração da ação, regras do jogo).\n- Os perfis ficam por **modelo** (hash do GLB no workspace; por nome sem workspace). Dois lutadores com o mesmo modelo dividem o perfil: é a causa mais provável de «aplica em todos» e está avisada no editor (Plano F2).\n`;
writeFileSync(fileURLToPath(new URL('../docs/MATRIZ_CAMPOS_ANIMACAO.md', import.meta.url)), md);
console.log(`docs/MATRIZ_CAMPOS_ANIMACAO.md: ${ANIMATION_GROUPS.flatMap(g => g[2]).length} ações, ${FIELDS.length} campos`);
