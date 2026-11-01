// Para cada personagem: clipe de cada estado, se é próprio ou reserva, duração, deslocamento da raiz no clipe e velocidade.
import {chromium} from '@playwright/test';
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const ROOT = 'C:/Users/zerke/OneDrive/Área de Trabalho/Arenamon/';
const OUT = process.argv[2];
const CHARS = [['Eggo', 'chars/Eggo/eggo.glb'], ['Wookada', 'chars/wookada/wookada.glb'], ['Cogumelo', 'chars/mosh/Cogumelo.glb']];
const browser = await chromium.launch({channel: 'msedge', headless: true});
const page = await browser.newPage({viewport: {width: 1280, height: 800}});
await page.goto(pathToFileURL(ROOT + 'prototypes/combat-lab/dist/arenamon-combate-laboratorio.html').href);
await page.waitForFunction(() => window.__lab);
const all = {};
for (const [label, rel] of CHARS) {
  const bytes = readFileSync(ROOT + rel).toString('base64');
  all[label] = await page.evaluate(async ([encoded, name]) => {
    const L = window.__lab, raw = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    L.setCharacter(0, await L.loadStudioFile(new File([raw], name)));
    const ch = L.ui.characters[0], C = L.C;
    ch.groundCurve(0);const probe = ch.probe;let hips = null;probe.root.traverse(o => {if (o.isBone && !hips && /hips|pelvis/i.test(o.name)) hips = o;});
    const V = () => new (ch.root.position.constructor)();
    const travel = clip => {
      const a = probe.mixer.clipAction(clip);probe.mixer.stopAllAction();a.reset();a.play();
      const at = t => {a.time = t;probe.mixer.update(0);probe.root.updateMatrixWorld(true);return hips ? hips.getWorldPosition(V()) : V();};
      const p0 = at(0), p1 = at(clip.duration);let ymin = Infinity, ymax = -Infinity;for (let i = 0; i <= 16; i++) {const p = at(clip.duration * i / 16);ymin = Math.min(ymin, p.y);ymax = Math.max(ymax, p.y);}
      return {dist: Math.hypot(p1.x - p0.x, p1.z - p0.z), up: ymax - ymin};
    };
    const scale = ch.root.scale.y, speed = C.test.speed, sprintMul = C.locomotion?.sprint?.speedMultiplier ?? 1.55;
    const keys = ['idle', 'walk', 'walk_back', 'walk_left', 'walk_right', 'sprint', 'sprint_back', 'sprint_left', 'sprint_right', 'turn', 'dodge_forward', 'dodge_back', 'dodge_left', 'dodge_right', 'jump', 'jump_start', 'jump_rise', 'jump_apex', 'jump_fall', 'fall', 'land', 'tackle', 'tackle_charge', 'block', 'hit', 'knockback', 'recover', 'downed', 'death'];
    const rows = [];
    for (const k of keys) {
      const own = ch.variantsOf(k), idx = own[0] ?? ch.actionFor?.(k)?.index;
      const used = own.length ? own[0] : null;
      const clip = used != null ? ch.clips[used] : null, tv = clip ? travel(clip) : null;
      rows.push({estado: k, clipe: clip?.name ?? '— (usa reserva)', proprio: !!own.length, dur: clip ? +clip.duration.toFixed(2) : null,
        raizAnda_m: tv ? +(tv.dist * scale).toFixed(2) : null, raizSobe_m: tv ? +(tv.up * scale).toFixed(2) : null, velClipe_ms: tv ? +(tv.dist * scale / clip.duration).toFixed(2) : null});
    }
    return {scale: +scale.toFixed(3), velAndar: speed, velSprint: +(speed * sprintMul).toFixed(2), dodge: C.rules.dodge, dodgeDist: C.actions?.dodge?.distance, tackleDur: C.rules.tackleDuration, rows};
  }, [bytes, rel.split('/').pop()]);
}
writeFileSync(OUT, JSON.stringify(all, null, 1));
for (const [k, v] of Object.entries(all)) {console.log('==', k, 'escala', v.scale, 'andar', v.velAndar, 'sprint', v.velSprint, 'dodge', v.dodge, v.dodgeDist, 'tackle', v.tackleDur);for (const r of v.rows) if (r.proprio) console.log(' ', JSON.stringify(r));console.log('  sem clipe proprio:', v.rows.filter(r => !r.proprio).map(r => r.estado).join(', '));}
await browser.close();
