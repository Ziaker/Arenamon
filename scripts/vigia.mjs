// Vigia: recompila o jogo sozinho a cada arquivo salvo. Deixe rodando e só dê F5 em JOGAR_ARENAMON.html.
// Uso: npm run vigia   (ou duplo clique em INICIAR_VIGIA.bat). Roda o mesmo build oficial do combat-lab (~1,5 s).
import {watch} from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WATCH = ['prototypes/combat-lab/src', 'prototypes/combat-lab/reports', 'prototypes/combat-lab/quarks-lab', 'prototypes/combat-lab/nav-lab', 'prototypes/combat-lab/post-lab', 'prototypes/combat-lab/physics-lab', 'prototypes/combat-lab/elemental-lab', 'prototypes/combat-lab/inicial', 'prototypes/sand-stone-lab/src', 'prototypes/game/src'];
const IGNORE = /(\.generated\.js|\.tmp|~|\.swp|\.crswap)$/i;   // o próprio build regrava fichas.generated.js: ignorar evita laço infinito
let timer = null, running = false, again = false;

function build() {
  if (running) {again = true; return;}
  running = true;
  const t0 = Date.now(), p = spawn(process.execPath, ['prototypes/combat-lab/build.mjs'], {cwd: root});
  let out = '';
  p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
  p.on('close', code => {
    const hora = new Date().toLocaleTimeString('pt-BR');
    if (code === 0) console.log(`[${hora}] pronto em ${((Date.now() - t0) / 1000).toFixed(1)}s — dê F5 no jogo`);
    else console.log(`[${hora}] ERRO no build (o jogo anterior continua valendo):\n${out.split('\n').filter(l => /ERROR|Error|rror:/.test(l)).slice(0, 6).join('\n') || out.slice(-600)}`);
    running = false;
    if (again) {again = false; build();}
  });
}
function agenda(file) {
  if (file && IGNORE.test(file)) return;
  clearTimeout(timer); timer = setTimeout(build, 200);
}
for (const d of WATCH) {
  try {watch(path.join(root, d), {recursive: true}, (_e, f) => agenda(f));} catch (e) {console.log(`(sem vigiar ${d}: ${e.code})`);}
}
console.log('Vigia ligado: salve qualquer arquivo do jogo e o HTML é refeito sozinho. Ctrl+C para parar.');
build();
