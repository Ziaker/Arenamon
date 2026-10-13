import { Fighter, Command } from './entity';
import { resolveCommand } from './commands';
export class Input {
  held = new Set<string>(); pressed = new Set<string>(); locked = false;
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
    const c = resolveCommand({
      x: Number(this.held.has('ArrowRight')) - Number(this.held.has('ArrowLeft')),
      forward: Number(this.held.has('ArrowUp')) - Number(this.held.has('ArrowDown')),
      dodge: this.pressed.has('KeyC'), guard: this.held.has('KeyF'), guardPressed: this.pressed.has('KeyF'),
    }, self, target, cameraYaw, this.locked);
    this.pressed.clear(); return c;
  }
}
