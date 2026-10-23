// @ts-check
// Painel do assistente de ficha de Move (#02): formulário guiado na aba Moves. A lógica está em move-spec-model.js (testada em Node).
import {SPEC_SECTIONS, FIELD_STATUS, newSpec, validateSpec, statusCounts, specToMarkdown, specToJSON, parseSpec} from './move-spec-model.js';

const esc = (/** @type {any} */ s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c] ?? c));
const DRAFT_KEY = 'arenamon-move-spec-draft';
const loadDraft = () => {try {const p = parseSpec(localStorage.getItem(DRAFT_KEY) ?? '');return p.spec ?? null;} catch {return null;}};
const saveDraft = (/** @type {any} */ spec) => {try {localStorage.setItem(DRAFT_KEY, specToJSON(spec));} catch {/* sem armazenamento: o rascunho vale só nesta sessão; o arquivo exportado é a cópia segura */}};

/** @param {{download: (data: string, name: string, type?: string) => void}} deps */
export function createMoveSpecPanel({download}) {
  let spec = loadDraft() ?? newSpec();
  const summary = () => {
    const gaps = validateSpec(spec), c = statusCounts(spec);
    return `<p class="hint"><b>${gaps.filter(g => g.kind === 'lacuna').length}</b> decisões pendentes · <b>${gaps.filter(g => g.kind !== 'lacuna').length}</b> conflitos/avisos · ${FIELD_STATUS.map(s => `${s} ${c[s]}`).join(' · ')}</p>`
      + (gaps.length ? `<ul class="mv-spec-gaps">${gaps.slice(0, 40).map(g => `<li class="${g.kind === 'lacuna' ? 'muted' : 'warn'}">${esc(g.kind)} · ${esc(g.message)}</li>`).join('')}</ul>` : '<p class="ok">Nenhuma lacuna nem conflito.</p>');
  };
  return {
    markup() {
      return `<details class="mv-wizard" data-k="wizard"><summary><b>✚ Assistente de ficha de Move</b> <small class="muted">especificar um Move novo, sem inventar nada</small></summary>
        <p class="hint">Responda só o que está decidido. O que ficar vazio continua <b>pendente</b> (o assistente nunca preenche por suposição). Cada campo guarda o <b>status</b> (proposto, aprovado, implementado, homologado) e a <b>fonte</b>. Exporte em JSON (máquina) ou Markdown (pessoas); depois crie os arquivos com <code>npm run novo-move</code> (veja <code>docs/COMO_CRIAR_UM_MOVE.md</code>).</p>
        <div class="row"><button type="button" data-spec-md>↓ Markdown</button><button type="button" data-spec-json>↓ JSON</button><label class="field">Abrir ficha (.json)<input type="file" data-spec-file accept=".json,application/json"></label><button type="button" data-spec-clear>Limpar</button></div>
        <div data-spec-summary>${summary()}</div>
        ${SPEC_SECTIONS.map(s => `<details class="mv-spec-sec" data-k="spec:${s.id}"><summary><b>${esc(s.title)}</b></summary>${s.fields.map(f => {
          const v = spec.fields[f.key];
          const input = f.kind === 'select'
            ? `<select data-spec-value="${f.key}"><option value="">— pendente —</option>${f.options?.map(o => `<option ${v.value === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
            : f.kind === 'long' ? `<textarea rows="2" data-spec-value="${f.key}">${esc(v.value)}</textarea>` : `<input type="text" data-spec-value="${f.key}" value="${esc(v.value)}">`;
          return `<div class="mv-spec-field"><label title="${esc(f.help)}"><span>${esc(f.label)}${f.required ? ' *' : ''}</span>${input}</label>
            <select data-spec-status="${f.key}" aria-label="Status de ${esc(f.label)}">${FIELD_STATUS.map(st => `<option ${v.status === st ? 'selected' : ''}>${st}</option>`).join('')}</select>
            <input type="text" data-spec-source="${f.key}" value="${esc(v.source)}" placeholder="fonte (ex.: M18.1)" aria-label="Fonte de ${esc(f.label)}"><small class="muted">${esc(f.help)}</small></div>`;
        }).join('')}</details>`).join('')}
        <div data-spec-result class="report" aria-live="polite"></div></details>`;
    },
    /** @param {HTMLElement} root */
    bind(root) {
      const refresh = () => {const el = root.querySelector('[data-spec-summary]');if (el) el.innerHTML = summary();saveDraft(spec);};
      for (const el of root.querySelectorAll('[data-spec-value]')) /** @type {HTMLElement} */ (el).oninput = () => {
        const k = /** @type {HTMLElement} */ (el).dataset.specValue ?? '', v = /** @type {HTMLInputElement} */ (el).value;
        spec.fields[k].value = v;
        // Responder um campo sem escolher status não o deixa "pendente": vira "proposto" (nunca aprovado sozinho).
        if (v.trim() && spec.fields[k].status === 'pendente') {spec.fields[k].status = 'proposto';const st = /** @type {HTMLSelectElement | null} */ (root.querySelector(`[data-spec-status="${k}"]`));if (st) st.value = 'proposto';}
        if (!v.trim()) {spec.fields[k].status = 'pendente';const st = /** @type {HTMLSelectElement | null} */ (root.querySelector(`[data-spec-status="${k}"]`));if (st) st.value = 'pendente';}
        refresh();
      };
      for (const el of root.querySelectorAll('[data-spec-status]')) /** @type {HTMLElement} */ (el).onchange = () => {spec.fields[/** @type {HTMLElement} */ (el).dataset.specStatus ?? ''].status = /** @type {HTMLSelectElement} */ (el).value;refresh();};
      for (const el of root.querySelectorAll('[data-spec-source]')) /** @type {HTMLElement} */ (el).oninput = () => {spec.fields[/** @type {HTMLElement} */ (el).dataset.specSource ?? ''].source = /** @type {HTMLInputElement} */ (el).value;saveDraft(spec);};
      const name = () => String(spec.fields.id.value || 'move-novo');
      const md = root.querySelector('[data-spec-md]'), js = root.querySelector('[data-spec-json]'), clr = root.querySelector('[data-spec-clear]'), file = /** @type {HTMLInputElement | null} */ (root.querySelector('[data-spec-file]'));
      if (md) /** @type {HTMLElement} */ (md).onclick = () => download(specToMarkdown(spec), `ficha-${name()}.md`, 'text/markdown');
      if (js) /** @type {HTMLElement} */ (js).onclick = () => download(specToJSON(spec), `ficha-${name()}.json`);
      if (clr) /** @type {HTMLElement} */ (clr).onclick = () => {spec = newSpec();saveDraft(spec);const host = root.querySelector('[data-spec-result]');if (host) host.innerHTML = '<p class="muted">Ficha limpa. Reabra a aba Moves para ver os campos vazios.</p>';refresh();};
      if (file) file.onchange = async () => {
        const f = file.files?.[0];if (!f) return;
        const p = parseSpec(await f.text());file.value = '';
        const host = root.querySelector('[data-spec-result]');
        if (p.error) {if (host) host.innerHTML = `<p class="warn">${esc(p.error)}</p>`;return;}
        spec = /** @type {any} */ (p.spec);saveDraft(spec);
        if (host) host.innerHTML = `<p class="ok">Ficha aberta (${esc(f.name)}). Reabra a aba Moves para ver os campos preenchidos.</p>`;
        refresh();
      };
    },
    get spec() {return spec;},
  };
}
