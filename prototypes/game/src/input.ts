import { Fighter, Command } from './entity';
import { angle, direction, length, scale, sub, unit, vec } from './math';
export class Input {
  held = new Set<string>(); pressed = new Set<string>(); locked = true;
  constructor(private canvas: HTMLCanvasElement, private shortcut: (code: string) => void) {
    window.addEventListener('keydown', e => {
      if ((e.target as HTMLElement).matches('input,select,textarea,button') && e.code !== 'Escape') return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (!this.held.has(e.code)) {
        this.pressed.add(e.code);
        if (e.code === 'Tab') this.locked = !this.locked;
        this.shortcut(e.code);
      }
      this.held.add(e.code);
    });
    window.addEventListener('keyup', e => this.held.delete(e.code));
    window.addEventListener('blur', () => this.clear());
    canvas.addEventListener('pointerdown', () => canvas.focus());
  }
  clear() { this.held.clear(); this.pressed.clear(); }
  command(self: Fighter, target: Fighter, cameraYaw: number): Command {
    const forward = this.locked ? unit(sub(target.position, self.position)) : direction(cameraYaw + Math.PI);
    const right = vec(-forward.z, forward.x);
    const x = Number(this.held.has('KeyD')) - Number(this.held.has('KeyA'));
    const z = Number(this.held.has('KeyW')) - Number(this.held.has('KeyS'));
    const raw = vec(forward.x * z + right.x * x, forward.z * z + right.z * x);
    const move = length(raw) > 1 ? unit(raw) : raw;
    const c = { move, dodge: this.pressed.has('Space'), guard: this.held.has('KeyF'), guardPressed: this.pressed.has('KeyF'), target: this.locked ? target.id : null };
    this.pressed.clear(); return c;
  }
}
