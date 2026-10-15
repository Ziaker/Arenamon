// Checklist de homologação jogável: a avaliação do responsável, separada dos testes automáticos. Cada item é
// marcado como pendente, aprovado ou reprovado, com observação. Fica salvo neste navegador e sai junto do JSON.
import {escape} from './tuning.js';

export const ITEMS = [
  ['x8', 'X nas 8 direções', 'O tackle acerta pela trajetória (inclusive para trás e na diagonal), não pela orientação do corpo.'],
  ['cNoDamage', 'C nunca causa dano', 'A esquiva só salta quando cruza o rival; as outras esquivas ficam no chão.'],
  ['cxEarly', 'C → X no início da esquiva', 'O cancelamento logo nos primeiros quadros responde e vai na direção pedida.'],
  ['cxAir', 'C → X durante o salto', 'Sem teletransporte: X parte da altura atual e desce de forma natural.'],
  ['cxInvuln', 'C → X sem invulnerabilidade extra', 'O X cancelado não fica invulnerável além do que restava da esquiva.'],
  ['cxStamina', 'C → X sem stamina', 'Sem stamina para X, a esquiva continua normalmente.'],
  ['cxVelocity', 'Velocidade no C → X', 'Sem tranco nem perda brusca de velocidade ao trocar C por X.'],
  ['clash', 'Clash frontal', 'Cada um perde 30% do dano do tackle do outro; ambos voam para trás e para cima.'],
  ['clashEdge', 'Clash diagonal e perto da parede', 'Resultado coerente e ninguém atravessa a parede.'],
  ['guard', 'Defesa', 'O defensor não desliza nem voa; o atacante entra em recuo.'],
  ['recoil', 'Recuo', 'X fica bloqueado no recuo; C e D tiram o lutador do recuo.'],
  ['guardStun', 'X guardado no guard stun', 'O X pedido durante o guard stun sai assim que o stun termina.'],
  ['perfect', 'Defesa perfeita e esquiva perfeita', 'Continuam funcionando e recompensando como antes.'],
  ['stamina', 'Stamina', 'Três ações, exaustão, movimento mais lento e recuperação são legíveis.'],
  ['buffer', 'Buffer de entrada', 'Apertar X ou C um pouco antes da hora não perde o comando, sem parecer automático demais.'],
  ['indicator', 'Indicador da janela C → X', 'O anel mostra com clareza quando o cancelamento está disponível e quando falta stamina.'],
  ['feel', 'Sensação geral de controle', 'Responsividade, peso e clareza das ações em luta real contra a IA.'],
];
const STATUS = [['pending', 'Pendente'], ['ok', 'Aprovado'], ['fail', 'Reprovado']];
const KEY = 'arenamon-lab-homologation-v1';

export function createHomologation(root, onChange = () => {}) {
  let data = {};
  try {data = JSON.parse(localStorage.getItem(KEY) || '{}') || {};} catch {data = {};}
  const save = () => {try {localStorage.setItem(KEY, JSON.stringify(data));} catch {/* armazenamento indisponível: segue só na memória */}onChange();};
  const entry = id => data[id] ?? {status: 'pending', note: ''};
  function summary() {
    const s = ITEMS.map(([id]) => entry(id).status);
    return {ok: s.filter(x => x === 'ok').length, fail: s.filter(x => x === 'fail').length, pending: s.filter(x => x === 'pending').length, total: ITEMS.length};
  }
  function render() {
    const s = summary();
    root.innerHTML = `<p class="hint">Sua avaliação jogando. Testes automáticos não preenchem esta lista. Salva neste navegador e exportada junto com o JSON de ajustes.</p>
      <p id="homolog-summary"><b>${s.ok}</b> aprovados · <b class="${s.fail ? 'warn' : ''}">${s.fail}</b> reprovados · ${s.pending} pendentes (de ${s.total})</p>
      <ol class="homolog">${ITEMS.map(([id, title, help]) => {const e = entry(id);return `<li data-item="${id}" data-status="${e.status}"><div><b>${escape(title)}</b><br><small class="muted">${escape(help)}</small></div>
        <div class="row">${STATUS.map(([v, label]) => `<label class="pill"><input type="radio" name="h-${id}" value="${v}"${e.status === v ? ' checked' : ''}>${label}</label>`).join('')}</div>
        <input type="text" placeholder="Observação" value="${escape(e.note)}" aria-label="Observação: ${escape(title)}"></li>`;}).join('')}</ol>
      <div class="row"><button type="button" id="homolog-md">↓ Relatório (Markdown)</button><button type="button" id="homolog-clear">Limpar avaliação</button></div>`;
    for (const li of root.querySelectorAll('li[data-item]')) {
      const id = li.dataset.item;
      for (const r of li.querySelectorAll('input[type=radio]')) r.onchange = () => {data[id] = {...entry(id), status: r.value, at: new Date().toISOString()};save();render();};
      li.querySelector('input[type=text]').onchange = e => {data[id] = {...entry(id), note: e.target.value, at: new Date().toISOString()};save();};
    }
    root.querySelector('#homolog-md').onclick = () => {
      const url = URL.createObjectURL(new Blob([markdown()], {type: 'text/markdown'})), a = document.createElement('a');a.href = url;a.download = 'arenamon-homologacao.md';a.click();setTimeout(() => URL.revokeObjectURL(url), 2000);
    };
    root.querySelector('#homolog-clear').onclick = () => {if (confirm('Limpar toda a avaliação desta lista?')) {data = {};save();render();}};
  }
  const label = v => STATUS.find(([k]) => k === v)?.[1] ?? v;
  function markdown() {
    const s = summary();
    return ['# Arenamon · homologação jogável (Etapa A)', '', `${s.ok} aprovados · ${s.fail} reprovados · ${s.pending} pendentes (de ${s.total}).`, '',
      '| Item | Situação | Observação |', '|---|---|---|', ...ITEMS.map(([id, title]) => {const e = entry(id);return `| ${title} | ${label(e.status)} | ${(e.note || '').replaceAll('|', '/')} |`;})].join('\n');
  }
  /** Para o JSON exportado: situação de cada item, com título. */
  const exportData = () => ({summary: summary(), items: ITEMS.map(([id, title]) => ({id, title, ...entry(id)}))});
  render();
  /** Substitui a avaliação pela de um backup (formato de exportData). */
  const importData = d => {data = {};for (const it of d?.items || []) if (ITEMS.some(([id]) => id === it.id)) data[it.id] = {status: it.status || 'pending', note: it.note || '', ...(it.at ? {at: it.at} : {})};save();render();};
  return {render, summary, markdown, exportData, importData, set: (id, status, note = '') => {data[id] = {status, note};save();render();}};
}
