// Cenários › Treino de defesa e esquiva perfeitas: configuração, placar, histórico e aviso por tentativa na arena.
import {C} from '../sim/config.js';
import {Trainer, TRAIN_MODES, TRAIN_ATTACKS} from '../sim/training.js';
import {escape} from './tuning.js';

export function createTrainingPanel({$, game, ui, start, stop, toast, download, clock}) {
  let trainer = null;
  function render() {
    $('train-mode').replaceChildren(...TRAIN_MODES.map(([v, t]) => new Option(t, v)));$('train-attack').replaceChildren(...TRAIN_ATTACKS.map(([v, t]) => new Option(t, v)));
    $('train-start').onclick = () => trainer ? end() : begin();$('train-restart').onclick = () => {if (trainer) begin();};
    $('train-export').onclick = () => {if (trainer) download(JSON.stringify(exportData(), null, 1), `arenamon-treino-${trainer.mode}.json`);};
    $('train-speed').onchange = () => {clock.timeScale = Number($('train-speed').value) || 1;$('rp-speed').value = $('train-speed').value;};
    status();
  }
  function begin() {
    trainer = new Trainer({mode: $('train-mode').value, attack: $('train-attack').value, interval: Math.max(.5, Number($('train-interval').value) || 2), seed: Math.max(1, Number($('train-seed').value) || 1)});
    clock.timeScale = Number($('train-speed').value) || 1;$('rp-speed').value = $('train-speed').value;start(trainer);ui.training = trainer;status();return trainer;
  }
  function end() {trainer = null;ui.training = null;stop();status();}
  /** Chamado pelo laço ao vivo depois de cada passo. */
  function afterStep(c0) {
    if (!trainer) return;const done = trainer.observe(game, c0);
    if (done) {toast({text: `#${done.n} ${done.resultLabel}. ${done.text}`, fighter: 0, kind: done.success ? 'ok' : 'train'});status();}
  }
  function status() {
    const s = trainer?.stats;$('train-start').textContent = trainer ? '■ Encerrar treino' : '▶ Iniciar treino';$('train-restart').disabled = !trainer;$('train-export').disabled = !trainer?.attempts.length;
    if (!trainer) {$('train-report').innerHTML = '<p class="hint">O vermelho repete o ataque escolhido; responda com D (defesa perfeita) ou C (esquiva perfeita). Cada tentativa é cronometrada em passos de simulação.</p>';return;}
    const ms = v => v == null ? '—' : `${Math.round(v * 1000)} ms`, step = C.test.step;
    const rows = trainer.attempts.slice(-15).reverse().map(a => `<tr class="${a.success ? 'ok' : 'warn'}"><td>${a.n}</td><td>${escape(a.kind)}</td><td>${a.attackTick != null ? (a.attackTick * step).toFixed(2) : '—'}</td><td>${a.impactUsed != null ? (a.impactUsed * step).toFixed(2) + (a.impactSource === 'previsto' ? '*' : '') : '—'}</td><td>${a.commandTick != null ? (a.commandTick * step).toFixed(2) : '—'}</td><td>${escape(a.resultLabel)}</td><td>${a.timing === 'inside' ? `dentro (margem ${ms(a.margin)})` : a.timing === 'early' ? `${ms(a.error)} cedo` : a.timing === 'late' ? `${ms(a.error)} tarde` : a.timing === 'cooldown' ? 'recarga' : '—'}</td></tr>`).join('');
    $('train-report').innerHTML = `<p><b>${s.hits} de ${s.total}</b> ${trainer.mode === 'guard' ? 'defesas' : 'esquivas'} perfeitas (${(s.rate * 100).toFixed(0)}%) · erro médio até a janela ${ms(s.meanError)} · janela ${ms(trainer.mode === 'guard' ? C.rules.perfect : C.actions.dodge.invulnerable)}</p>
      ${rows ? `<table><tr><th>#</th><th>Ataque</th><th>Início</th><th>Impacto</th><th>Comando</th><th>Resultado</th><th>Até a janela</th></tr>${rows}</table><p class="hint">Tempos em segundos de simulação. * impacto previsto pelo motor (não houve contato).</p>` : '<p class="hint">Aguardando o primeiro ataque…</p>'}`;
  }
  const exportData = () => ({schema: 'arenamon-lab-report', version: 1, kind: 'perfect-training', createdAt: new Date().toISOString(), step: C.test.step, mode: trainer.mode, attack: trainer.attack, interval: trainer.interval, seed: trainer.seed,
    window: trainer.mode === 'guard' ? C.rules.perfect : C.actions.dodge.invulnerable, stats: trainer.stats, attempts: trainer.attempts.map(a => ({...a}))});
  render();
  return {afterStep, begin, end, status, exportData, get trainer() {return trainer;}};
}
