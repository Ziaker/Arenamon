// Utilitários de DOM dos HUDs: criação a partir de HTML e atualizações que só tocam o DOM quando algo mudou.
export function html(str) {
  const t = document.createElement('template'); t.innerHTML = str.trim();
  return t.content.firstElementChild;
}
export function setText(el, txt) { if (el.textContent !== txt) el.textContent = txt; }
export function setVar(el, name, v) { const s = typeof v === 'number' ? v.toFixed(4) : String(v); if (el.style.getPropertyValue(name) !== s) el.style.setProperty(name, s); }
export function setAttr(el, name, v) { if (el.getAttribute(name) !== String(v)) el.setAttribute(name, String(v)); }
export function toggle(el, cls, on) { if (el.classList.contains(cls) !== !!on) el.classList.toggle(cls, !!on); }
export const q = (el, sel) => el.querySelector(sel);
export const qa = (el, sel) => [...el.querySelectorAll(sel)];
/** Texto curto de stamina com uma casa (1.7 / 3). */
export const stText = (v, max) => `${v.toFixed(1)} / ${max}`;
