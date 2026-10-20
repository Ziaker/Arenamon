// Sistema de notificações toast para ativação de habilidades passivas.
// Cada proposta (A/B/C) tem cor, ícone e estilo próprios.

const PASSIVE_META = {
  A: {
    key: 'A',
    name: 'Halo Orbital',
    icon: '◯',
    color: '#4fc3f7',
    bg: 'rgba(79,195,247,.12)',
    border: 'rgba(79,195,247,.45)',
    soundHint: 'Halo Orbitando',
  },
  B: {
    key: 'B',
    name: 'Interseções Celestiais',
    icon: '✦',
    color: '#ffd54f',
    bg: 'rgba(255,213,79,.12)',
    border: 'rgba(255,213,79,.45)',
    soundHint: 'Constelação Acordada',
  },
  C: {
    key: 'C',
    name: 'Ressonância Luminosa',
    icon: '◉',
    color: '#e040fb',
    bg: 'rgba(224,64,251,.12)',
    border: 'rgba(224,64,251,.45)',
    soundHint: 'Pulso Luminoso',
  },
};

export class PassiveToast {
  constructor(containerId = 'passive-toasts') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = containerId;
      this.container.style.cssText = `
        position: fixed; top: 72px; right: 16px;
        display: flex; flex-direction: column; gap: 8px;
        z-index: 1000; pointer-events: none;
      `;
      document.body.appendChild(this.container);
    }
    this.active = new Map(); // id -> {element, timeout}
    this.defaultDuration = 2800;
  }

  show(type, opts = {}) {
    const meta = PASSIVE_META[type];
    if (!meta) return;
    const {
      duration = this.defaultDuration,
      fighter = 'Jogador',
      onDismiss,
    } = opts;
    const id = `passive_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const el = document.createElement('div');
    el.id = id;
    el.style.cssText = `
      display: flex; align-items: center; gap: 10px;
      padding: 10px 16px; border-radius: 10px;
      background: ${meta.bg};
      border: 1px solid ${meta.border};
      backdrop-filter: blur(8px);
      color: ${meta.color};
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 13px; font-weight: 600;
      text-shadow: 0 1px 3px rgba(0,0,0,.4);
      transform: translateX(120%); opacity: 0;
      transition: transform .35s cubic-bezier(.22,1,.36,1), opacity .3s ease;
      pointer-events: auto; min-width: 200px;
      box-shadow: 0 4px 20px ${meta.bg.replace('.12', '.25')};
    `;

    el.innerHTML = `
      <span style="font-size:18px;line-height:1;">${meta.icon}</span>
      <div style="display:flex;flex-direction:column;gap:1px;">
        <span style="font-size:12px;opacity:.75;font-weight:500;">Passiva ativada · ${fighter}</span>
        <span style="font-size:14px;">${meta.name}</span>
      </div>
    `;

    this.container.appendChild(el);

    // Animação de entrada
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transform = 'translateX(0)';
        el.style.opacity = '1';
      });
    });

    // Timer de saída
    const timeout = setTimeout(() => this.dismiss(id, onDismiss), duration);
    this.active.set(id, {element: el, timeout, meta});

    return id;
  }

  dismiss(id, callback) {
    const entry = this.active.get(id);
    if (!entry) return;
    clearTimeout(entry.timeout);
    const el = entry.element;
    el.style.transform = 'translateX(120%)';
    el.style.opacity = '0';
    setTimeout(() => {
      el.remove();
      this.active.delete(id);
      if (callback) callback(id);
    }, 350);
  }

  dismissAll() {
    for (const [id] of this.active) this.dismiss(id);
  }

  dismissByType(type) {
    for (const [id, entry] of this.active) {
      if (entry.meta.key === type) this.dismiss(id);
    }
  }

  // Ativa múltiplas passivas simultaneamente (teste de sobreposição)
  showMultiple(types, opts = {}) {
    const ids = [];
    types.forEach((type, i) => {
      setTimeout(() => {
        ids.push(this.show(type, opts));
      }, i * (opts.stagger || 120));
    });
    return ids;
  }

  getActiveCount() {
    return this.active.size;
  }

  getActiveTypes() {
    return [...new Set([...this.active.values()].map(v => v.meta.key))];
  }
}

// Singleton export para uso global
export const passiveToast = new PassiveToast();

// Helpers de ativação rápida
export function notifyPassiveA(opts) { return passiveToast.show('A', opts); }
export function notifyPassiveB(opts) { return passiveToast.show('B', opts); }
export function notifyPassiveC(opts) { return passiveToast.show('C', opts); }
