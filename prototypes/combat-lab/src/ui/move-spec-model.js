// @ts-check
// Assistente de ficha de Move (#02 do plano de 23/10/2026): modelo PURO da especificação de um Move novo. Segue a ficha obrigatória de
// docs/REGRAS_CRIACAO_MOVES.md §2 (nenhum campo ausente) e NUNCA preenche lacuna por suposição: campo sem resposta fica PENDENTE e aparece na
// lista de decisões abertas. Cada campo guarda valor, status de governança e fonte (proveniência), e tudo sai em JSON (máquina) e Markdown (pessoas).
// Não cria o Move: gera a especificação e o comando/rascunho para `npm run novo-move`.

export const SPEC_SCHEMA = 'arenamon-move-spec';
export const SPEC_VERSION = 2;   // v2: quatro status independentes por campo (a v1 tinha um só e ainda é lida)
/** Os QUATRO status independentes de governança (REGRAS_CRIACAO_MOVES §1): um campo pode ser proposto e implementado sem estar aprovado, por exemplo. "Pendente" = sem valor. */
export const GOV_FLAGS = ['proposto', 'aprovado', 'implementado', 'homologado'];
export const noFlags = () => ({proposto: false, aprovado: false, implementado: false, homologado: false});

/** @typedef {{key: string, label: string, help: string, kind: 'text' | 'long' | 'select' | 'number', options?: string[], required?: boolean, unit?: string}} SpecField */
/** @type {{id: string, title: string, fields: SpecField[]}[]} */
export const SPEC_SECTIONS = [
  {id: 'identidade', title: 'Identidade', fields: [
    {key: 'id', label: 'ID estável', help: 'minúsculas com hífen, ex.: second-wind. Não muda depois.', kind: 'text', required: true},
    {key: 'name', label: 'Nome', help: 'Nome que aparece no jogo.', kind: 'text', required: true},
    {key: 'description', label: 'Descrição jogável', help: 'Uma ou duas frases que o jogador entende.', kind: 'long', required: true},
    {key: 'purpose', label: 'Propósito tático', help: 'Para que serve em combate (e contra o quê).', kind: 'long', required: true},
    {key: 'eligible', label: 'Personagens elegíveis', help: 'Genérico ou exclusivo de quais Pokémon.', kind: 'text', required: true},
  ]},
  {id: 'categoria', title: 'Categoria e tipo', fields: [
    {key: 'category', label: 'Categoria oficial', help: 'Normal, Burst ou Charge (M18.1–M18.3). Segurar para mirar não é Charge.', kind: 'select', options: ['Normal', 'Burst', 'Charge'], required: true},
    {key: 'type', label: 'Tipo técnico', help: 'Melee, Projectile, Status, Field ou Trick (um principal, um secundário opcional).', kind: 'text', required: true},
    {key: 'pl', label: 'Power Level', help: 'PL1/PL2/PL3 fixo ou variável, ou "SEM PL"; elegibilidade para Clash/Counter.', kind: 'text', required: true},
  ]},
  {id: 'entrada', title: 'Entrada', fields: [
    {key: 'input', label: 'Entrada', help: 'Slot/botão, tocar, segurar ou soltar, mira, confirmação, direção, lock-on, alvo válido.', kind: 'long', required: true},
  ]},
  {id: 'execucao', title: 'Execução', fields: [
    {key: 'cast', label: 'Cast / preparação (s)', help: 'Tempo antes do efeito. Em Charge: carga mínima/máxima e progressão.', kind: 'text', required: true},
    {key: 'active', label: 'Emissão, janela ativa e duração', help: 'Quando o efeito existe e por quanto tempo; fim por evento e por tempo.', kind: 'long', required: true},
    {key: 'recovery', label: 'Recuperação', help: 'Tempo sem agir depois do efeito e o que pode cancelar.', kind: 'text', required: true},
  ]},
  {id: 'recursos', title: 'Recursos', fields: [
    {key: 'cost', label: 'Stamina (custo)', help: 'Valor e INSTANTE de cobrança (diretriz universal: cobrança no início do uso).', kind: 'text', required: true},
    {key: 'cooldown', label: 'Cooldown', help: 'Duração, início da contagem, falha/reembolso e interrupção.', kind: 'text', required: true},
  ]},
  {id: 'dano', title: 'Dano e knockback', fields: [
    {key: 'damage', label: 'Dano', help: 'Valor, unidade, fórmula/atributo, número de hits; ou "dano 0".', kind: 'long', required: true},
    {key: 'knockback', label: 'Knockback horizontal e vertical', help: 'Em m/s para cada eixo, ou "horizontal 0 e vertical 0" explícito.', kind: 'text', required: true},
  ]},
  {id: 'estado', title: 'Estado e permissões', fields: [
    {key: 'states', label: 'Permissões e cancelamentos', help: 'Chão/ar/guarda/Dodge/Tackle/Charge/stun/recovery/KO/hitstop.', kind: 'long', required: true},
  ]},
  {id: 'geometria', title: 'Geometria e entidades', fields: [
    {key: 'geometry', label: 'Alcance, hitbox e colisões', help: 'Raio de busca ≠ alcance físico; altura; paredes, tetos, plataformas, arena.', kind: 'long', required: true},
    {key: 'entities', label: 'Entidades criadas', help: 'Quantidade, dono, HP, duração, trajetória, reflexão, destruição e limpeza; ou "nenhuma".', kind: 'long', required: true},
  ]},
  {id: 'apresentacao', title: 'Apresentação', fields: [
    {key: 'vfx', label: 'VFX por fase/resultado', help: 'Carga, disparo, impacto e fim; acessibilidade.', kind: 'long', required: true},
    {key: 'audio', label: 'SFX por evento', help: 'Sons por evento ou "sem som próprio".', kind: 'text', required: true},
    {key: 'animation', label: 'Animação e HUD', help: 'Clipes (carga/loop/disparo), indicador de PL e estados no HUD.', kind: 'long', required: true},
  ]},
  {id: 'integracao', title: 'Integração', fields: [
    {key: 'ai', label: 'IA', help: 'Quando a IA usa o Move (distância útil, ameaça, objetivo, limites).', kind: 'long', required: true},
    {key: 'tests', label: 'Cenários e testes', help: 'Chão, ar, plataforma, parede, defesa, esquiva, hitstop, save/load, seed, replay.', kind: 'long', required: true},
  ]},
  {id: 'governanca', title: 'Governança', fields: [
    {key: 'refs', label: 'Decisões de referência', help: 'M/R/ES-D/SW-D relacionadas e conflitos em aberto.', kind: 'long', required: false},
  ]},
];
export const ALL_FIELDS = SPEC_SECTIONS.flatMap(s => s.fields);

/** Especificação vazia: todo campo pendente, sem valor. */
export function newSpec() {
  return {schema: SPEC_SCHEMA, version: SPEC_VERSION, createdAt: new Date().toISOString(), fields: Object.fromEntries(ALL_FIELDS.map(f => [f.key, {value: '', flags: noFlags(), source: ''}]))};
}

/**
 * Lacunas e conflitos. Lacuna = campo obrigatório sem valor (decisão PENDENTE: o assistente não preenche). Conflito = respostas que se contradizem.
 * @param {ReturnType<typeof newSpec>} spec
 */
export function validateSpec(spec) {
  /** @type {{kind: 'lacuna' | 'conflito' | 'formato', field: string, message: string}[]} */ const out = [];
  const val = (/** @type {string} */ k) => String(spec.fields[k]?.value ?? '').trim();
  for (const f of ALL_FIELDS) if (f.required && !val(f.key)) out.push({kind: 'lacuna', field: f.key, message: `${f.label}: decisão pendente`});
  if (val('id') && !/^[a-z][a-z0-9-]*$/.test(val('id'))) out.push({kind: 'formato', field: 'id', message: 'ID deve começar com letra minúscula e usar só minúsculas, números e hífen'});
  const cat = val('category'), cast = val('cast').toLowerCase(), pl = val('pl').toLowerCase();
  if (cat === 'Charge' && val('cast') && !/carg|segur|máx|max|mín|min/.test(cast)) out.push({kind: 'conflito', field: 'cast', message: 'Charge precisa descrever a carga (mínimo/máximo e progressão) no campo de cast'});
  if (cat === 'Burst' && /carg|segur/.test(cast)) out.push({kind: 'conflito', field: 'category', message: 'Burst não tem carga progressiva: o cast fala em carga/segurar. Categoria ou cast está errado'});
  if (pl.includes('sem pl') && /clash|counter/.test(val('refs').toLowerCase() + val('purpose').toLowerCase())) out.push({kind: 'conflito', field: 'pl', message: '"SEM PL" mas o texto cita Clash/Counter, que dependem de PL'});
  for (const [k, v] of Object.entries(spec.fields)) {
    const on = GOV_FLAGS.filter(g => v.flags[g]);
    if (on.length && !String(v.value).trim()) out.push({kind: 'conflito', field: k, message: `${k}: marcado como ${on.join(' e ')} mas sem valor`});
  }
  return out;
}

/** Resumo de governança: campos sem valor (pendentes) e quantos campos têm cada status ligado (independentes: um campo pode contar em vários). */
export function statusCounts(/** @type {ReturnType<typeof newSpec>} */ spec) {
  const c = {pendente: 0, ...Object.fromEntries(GOV_FLAGS.map(s => [s, 0]))};
  for (const v of Object.values(spec.fields)) {
    if (!String(v.value).trim()) c.pendente++;
    for (const g of GOV_FLAGS) if (v.flags[g]) c[g]++;
  }
  return c;
}

export function specToMarkdown(/** @type {ReturnType<typeof newSpec>} */ spec) {
  const name = String(spec.fields.name?.value || spec.fields.id?.value || 'Move sem nome');
  const gaps = validateSpec(spec), counts = statusCounts(spec);
  const out = [`# Ficha de Move — ${name}`, '', `Gerada pelo assistente de ficha (Combat Lab) em ${spec.createdAt}. **Proposta**: não aprova nada por si; cada campo carrega o próprio status.`, '',
    `Status dos campos (independentes): pendente ${counts.pendente} · ${GOV_FLAGS.map(s => `${s} ${counts[s]}`).join(' · ')}.`, ''];
  for (const s of SPEC_SECTIONS) {
    out.push(`## ${s.title}`, '', '| Campo | Valor | Governança | Fonte |', '|---|---|---|---|');
    for (const f of s.fields) {const v = spec.fields[f.key];out.push(`| ${f.label} | ${String(v.value).replace(/\|/g, '\\|').replace(/\n/g, ' ') || '**PENDENTE**'} | ${GOV_FLAGS.filter(g => v.flags[g]).join(', ') || '—'} | ${String(v.source).replace(/\|/g, '\\|') || '—'} |`);}
    out.push('');
  }
  out.push('## Decisões abertas e conflitos', '', gaps.length ? gaps.map(g => `- **${g.kind}** · ${g.message}`).join('\n') : '(nenhuma)', '');
  const id = String(spec.fields.id?.value || '').trim();
  const safeName = name.replace(/[^\p{L}\p{N} _-]/gu, '').trim();   // nome vindo de um arquivo importado: sem aspas, $ nem crases no comando que será copiado
  out.push('## Para criar o Move', '', id && name ? `\`\`\`bash\nnpm run novo-move -- "${safeName}"\n\`\`\`\n\nDepois abra \`src/sim/moves/${id}.js\` e \`${id}.params.js\`, implemente o efeito e ajuste os parâmetros (veja \`docs/COMO_CRIAR_UM_MOVE.md\`).` : 'Preencha ID e nome primeiro.', '');
  return out.join('\n');
}

export const specToJSON = (/** @type {ReturnType<typeof newSpec>} */ spec) => JSON.stringify(spec, null, 2);

/** Lê um JSON de especificação preservando valor, status e fonte de cada campo. */
export function parseSpec(/** @type {any} */ raw) {
  let data;
  try {data = typeof raw === 'string' ? JSON.parse(raw) : raw;} catch (e) {return {error: 'JSON inválido: ' + /** @type {Error} */ (e).message};}
  if (data?.schema !== SPEC_SCHEMA) return {error: 'Não é uma ficha de Move do assistente.'};
  if (!Number.isInteger(data.version) || data.version > SPEC_VERSION) return {error: `Versão ${data.version} desconhecida (este laboratório lê até a ${SPEC_VERSION}).`};
  const spec = newSpec();
  spec.createdAt = String(data.createdAt ?? spec.createdAt);
  for (const f of ALL_FIELDS) {
    const v = data.fields?.[f.key];
    if (!v) continue;
    // v1 guardava um status só (string): vira o status correspondente ligado; v2 guarda os quatro.
    const flags = noFlags();
    if (v.flags && typeof v.flags === 'object') for (const g of GOV_FLAGS) flags[g] = v.flags[g] === true;
    else if (typeof v.status === 'string' && GOV_FLAGS.includes(v.status)) flags[v.status] = true;
    spec.fields[f.key] = {value: String(v.value ?? ''), flags, source: String(v.source ?? '')};
  }
  return {spec};
}
