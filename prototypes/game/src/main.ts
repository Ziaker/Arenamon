import { Game, FixedClock } from './game';
import { Mode } from './ai';
import { View } from './view';
import { UI } from './ui';
import { Input } from './input';
import { TEST } from './config';
const canvas = document.querySelector('canvas')!, game = new Game(), clock = new FixedClock(), ui = new UI();
let view: View;
try { view = new View(canvas); } catch (error) {
  document.getElementById('fatal')!.hidden = false; throw error;
}
const reset = () => { game.reset(); clock.reset(); input.clear(); input.locked = false; view.reset(game.fighters[0]); canvas.focus(); };
const pause = () => { game.pause(); clock.reset(); input.clear(); canvas.focus(); };
const input = new Input(canvas, code => {
  if (code === 'Escape') pause();
  if (code === 'KeyR' && game.phase !== 'menu') reset();
  if (code === 'F3') ui.debug = !ui.debug;
});
document.getElementById('start')!.onclick = () => {
  game.profile = (document.getElementById('profile') as HTMLSelectElement).value;
  game.mode = (document.getElementById('mode') as HTMLSelectElement).value as Mode; reset();
};
document.getElementById('mode')!.onchange = e => { game.mode = (e.target as HTMLSelectElement).value as Mode; game.brain.reset(); };
document.getElementById('pause')!.onclick = pause;
document.getElementById('resume')!.onclick = pause;
for (const id of ['restart', 'restart-top']) document.getElementById(id)!.onclick = reset;
document.getElementById('back')!.onclick = () => { game.phase = 'menu'; input.clear(); clock.reset(); };
document.getElementById('debug-toggle')!.onclick = () => { ui.debug = !ui.debug; canvas.focus(); };
document.getElementById('camera-reset')!.onclick = () => { view.reset(game.fighters[0]); canvas.focus(); };
const suspend = () => { if (game.phase === 'playing') game.phase = 'paused'; clock.reset(); input.clear(); };
window.addEventListener('blur', suspend); document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); });
let previous = performance.now(), fps = 60, frame = 0;
function draw(now: number) {
  const elapsed = Math.max(0, (now - previous) / 1000); previous = now;
  if (game.phase === 'playing') clock.advance(elapsed, () => {
    const command = input.command(game.fighters[0], game.fighters[1], view.rig.yaw);
    game.step(command);
    view.rig.step(game.fighters[0], game.fighters[1], input.locked, TEST.step);
  });
  else clock.reset();
  fps += ((1 / Math.max(.001, elapsed)) - fps) * .05;
  view.draw(game.fighters); ui.render(game, fps, input.locked); frame++;
  requestAnimationFrame(draw);
}
// Read-only observation seam; tests drive the playable build through real inputs.
(window as any).__arenamon = { snapshot: () => ({ ...game.snapshot(), frame, camera: view.rig.snapshot(), locked: input.locked }) };
requestAnimationFrame(draw);
