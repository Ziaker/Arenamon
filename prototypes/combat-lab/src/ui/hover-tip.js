// @ts-check
// Dica flutuante global: qualquer elemento com `data-tip` (texto) e, opcionalmente, `data-tip-title` mostra uma caixa ao passar o mouse ou receber foco.
// Usada nas seleções de Moves e de habilidades passivas (descrição e uso). Delegação de eventos no documento: vale para elementos criados depois.
let box = null, owner = null;
const esc = (/** @type {string} */ s) => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c] ?? c));
function hide() {owner = null;if (box) box.hidden = true;}
function show(/** @type {HTMLElement} */ el) {
  const text = el.dataset.tip;if (!text) return hide();
  owner = el;
  if (!box) {box = document.createElement('div');box.id = 'hover-tip';box.setAttribute('role', 'tooltip');box.hidden = true;document.body.append(box);}
  box.innerHTML = (el.dataset.tipTitle ? `<b>${esc(el.dataset.tipTitle)}</b>` : '') + `<span>${esc(text)}</span>`;
  box.hidden = false;
  const r = el.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
  let x = Math.min(window.innerWidth - w - 8, Math.max(8, r.left)), y = r.bottom + 6;
  if (y + h > window.innerHeight - 8) y = Math.max(8, r.top - h - 6);
  box.style.left = x + 'px';box.style.top = y + 'px';
}
/** Instala os ouvintes (idempotente). */
export function installHoverTip() {
  if (/** @type {any} */ (window).__hoverTip) return;
  /** @type {any} */ (window).__hoverTip = true;
  const target = (/** @type {EventTarget | null} */ t) => t instanceof Element ? /** @type {HTMLElement | null} */ (t.closest('[data-tip]')) : null;
  document.addEventListener('mouseover', e => {const el = target(e.target);if (el) show(el);else if (owner) hide();});
  document.addEventListener('focusin', e => {const el = target(e.target);if (el) show(el);});
  document.addEventListener('focusout', hide);
  document.addEventListener('mouseleave', hide);
  window.addEventListener('scroll', hide, true);
  document.addEventListener('keydown', e => {if (e.key === 'Escape') hide();});
}
