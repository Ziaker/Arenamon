// Painel exclusivo de controle da Câmera Cinemática (estilo anime / ZZZ).
// Interface completa com toggle mestre, toggles individuais (C01 a C12),
// sliders com unidades visíveis, prévias imediatas, restauração de padrões e persistência.
import {CINEMATIC_DEFAULTS} from '../view/cinematic-camera.js';

export function createCinematicPanel({$, view, getWs}) {
  const cine = view.cinematic;
  if (!cine) return null;

  // Carregar preferências persistidas no localStorage se existirem
  try {
    const saved = localStorage.getItem('arenamon-cinematic-config');
    if (saved) {
      const parsed = JSON.parse(saved);
      cine.setConfig(parsed);
    }
  } catch (e) {
    console.warn('Erro ao restaurar config cinematica:', e);
  }

  function saveConfig() {
    try {
      localStorage.setItem('arenamon-cinematic-config', JSON.stringify(cine.config));
      const ws = getWs?.();
      if (ws?.doc) {
        ws.doc.extra ??= {};
        ws.doc.extra.cinematicConfig = cine.config;
        ws.touch?.();
      }
    } catch (e) {}
  }

  const container = document.getElementById('cine-modal');
  if (!container) return null;

  function render() {
    const c = cine.config;
    container.innerHTML = `
      <div class="cine-panel-box" role="dialog" aria-label="Configurações da Câmera Cinemática">
        <header class="cine-head">
          <div class="cine-title-wrap">
            <span class="cine-icon">🎬</span>
            <h3>Câmera Cinemática</h3>
            <span class="badge" id="cine-active-badge">Normal</span>
          </div>
          <button type="button" id="cine-close" class="icon" aria-label="Fechar painel" title="Fechar (Esc)">✕</button>
        </header>

        <div class="cine-body">
          <!-- Controle Mestre e Ações Globais -->
          <div class="cine-master-row">
            <label class="check master-switch">
              <input type="checkbox" id="cine-master" ${c.enabled ? 'checked' : ''}>
              <span><b>Ativar Câmera Cinemática</b><br><small class="muted">Camada de apresentação dinâmica sem alterar controles</small></span>
            </label>
            <div class="cine-actions">
              <button type="button" id="cine-enable-all" title="Ativar todos os efeitos cinematográficos">Ativar todos</button>
              <button type="button" id="cine-disable-all" title="Desativar todos os efeitos individuais">Desativar todos</button>
              <button type="button" id="cine-reset" title="Restaurar valores padrão recomendados">Padrões</button>
            </div>
          </div>

          <!-- Intensidade Global e Comparador A/B -->
          <div class="cine-field-row">
            <label class="field">
              Intensidade Cinematográfica Global: <output id="cine-intensity-out">${(c.globalIntensity * 100).toFixed(0)}%</output>
              <input type="range" id="cine-intensity" min="0" max="2" step="0.05" value="${c.globalIntensity}">
            </label>
            <button type="button" id="cine-compare" class="cine-btn-compare" title="Segure ou clique para alternar temporariamente e comparar câmera normal x cinematográfica">👁 Comparar Normal ⇄ Cine</button>
          </div>

          <!-- Grupo 1: Movimento e Esquiva -->
          <details class="cine-group" open>
            <summary>🏃 Movimento e Abertura</summary>
            <div class="cine-group-content">
              <!-- Intro Dinâmica de Round -->
              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="roundIntro.enabled" ${c.roundIntro?.enabled ? 'checked' : ''}> <b>Intro Dinâmica de Round (Face-off)</b></label>
                  <button type="button" data-preview="roundIntro" class="btn-preview">▶ Prévia</button>
                </div>
                <div class="cine-item-desc">Plano dramático e rasante de apresentação no início da luta, transitando suavemente para a câmera de jogo.</div>
                <label class="field">Duração: <output>${(c.roundIntro?.duration ?? 1.2).toFixed(2)} s</output><input type="range" data-opt="roundIntro.duration" min="0.6" max="2.0" step="0.1" value="${c.roundIntro?.duration ?? 1.2}"></label>
              </div>

              <!-- C01 -->
              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="dutchDodge.enabled" ${c.dutchDodge.enabled ? 'checked' : ''}> <b>C01 · Inclinação na Esquiva (Dutch Angle)</b></label>
                  <button type="button" data-preview="dutchDodge" class="btn-preview">▶ Prévia</button>
                </div>
                <div class="cine-item-desc">Inclina a linha do horizonte em até ±10° na direção lateral da esquiva.</div>
                <label class="field">Roll Máximo: <output>${c.dutchDodge.maxRoll}°</output><input type="range" data-opt="dutchDodge.maxRoll" min="2" max="20" step="1" value="${c.dutchDodge.maxRoll}"></label>
                <label class="field">Duração: <output>${c.dutchDodge.duration} s</output><input type="range" data-opt="dutchDodge.duration" min="0.1" max="0.6" step="0.02" value="${c.dutchDodge.duration}"></label>
              </div>

              <!-- C02 -->
              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="lowSpeed.enabled" ${c.lowSpeed.enabled ? 'checked' : ''}> <b>C02 · Câmera Baixa de Velocidade (Sprint & Tackle)</b></label>
                  <button type="button" data-preview="lowSpeed" class="btn-preview">▶ Prévia</button>
                </div>
                <div class="cine-item-desc">Abaixa a perspectiva (worm's-eye view suave) para realçar velocidade e porte das criaturas.</div>
                <label class="field">Rebaixamento: <output>${c.lowSpeed.dropHeight.toFixed(2)} m</output><input type="range" data-opt="lowSpeed.dropHeight" min="0.1" max="0.8" step="0.02" value="${c.lowSpeed.dropHeight}"></label>
                <label class="field">Aproximação: <output>${c.lowSpeed.zoomIn.toFixed(2)} m</output><input type="range" data-opt="lowSpeed.zoomIn" min="0" max="0.8" step="0.05" value="${c.lowSpeed.zoomIn}"></label>
              </div>
            </div>
          </details>

          <!-- Grupo 2: Ataques e Carga -->
          <details class="cine-group" open>
            <summary>⚡ Ataques, Carga e Disparo</summary>
            <div class="cine-group-content">
              <!-- C04 -->
              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="chargeFov.enabled" ${c.chargeFov.enabled ? 'checked' : ''}> <b>C04 · Respiração do FOV na Carga</b></label>
                  <button type="button" data-preview="chargeFov" class="btn-preview">▶ Prévia</button>
                </div>
                <div class="cine-item-desc">Comprime o campo de visão gradualmente enquanto segura o ataque carregado.</div>
                <label class="field">Compressão Máxima: <output>${c.chargeFov.maxCompression}°</output><input type="range" data-opt="chargeFov.maxCompression" min="2" max="18" step="1" value="${c.chargeFov.maxCompression}"></label>
              </div>

              <!-- C05 -->
              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="releaseFov.enabled" ${c.releaseFov.enabled ? 'checked' : ''}> <b>C05 · FOV Punch no Disparo</b></label>
                  <button type="button" data-preview="releaseFov" class="btn-preview">▶ Prévia</button>
                </div>
                <div class="cine-item-desc">Explosão instantânea do campo de visão no momento do release com retorno elástico.</div>
                <label class="field">Intensidade do Punch: <output>+${c.releaseFov.punchFov}°</output><input type="range" data-opt="releaseFov.punchFov" min="4" max="30" step="1" value="${c.releaseFov.punchFov}"></label>
              </div>

              <!-- C06 -->
              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="meteorSlam.enabled" ${c.meteorSlam.enabled ? 'checked' : ''}> <b>C06 · Câmera de Meteor Slam</b></label>
                  <button type="button" data-preview="meteorSlam" class="btn-preview">▶ Prévia</button>
                </div>
                <div class="cine-item-desc">Contraplongée acompanhando a queda livre e impacto vertical massivo no solo.</div>
                <label class="field">Rebaixamento no Impacto: <output>${c.meteorSlam.impactDrop.toFixed(2)} m</output><input type="range" data-opt="meteorSlam.impactDrop" min="0.1" max="1.0" step="0.05" value="${c.meteorSlam.impactDrop}"></label>
              </div>
            </div>
          </details>

          <!-- Grupo 3: Impactos e Defesas -->
          <details class="cine-group" open>
            <summary>💥 Impactos, Parries e Clashes</summary>
            <div class="cine-group-content">
              <!-- C03 -->
              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="snapParry.enabled" ${c.snapParry.enabled ? 'checked' : ''}> <b>C03 · Enquadramento Lateral de Impacto (Snap 80°)</b></label>
                  <button type="button" data-preview="snapParry" class="btn-preview">▶ Prévia</button>
                </div>
                <div class="cine-item-desc">Corta momentaneamente para um ângulo lateral de perfil estilo mangá/anime no Parry ou Clash.</div>
                <label class="field">Ângulo Relativo: <output>${c.snapParry.angle}°</output><input type="range" data-opt="snapParry.angle" min="45" max="110" step="5" value="${c.snapParry.angle}"></label>
                <label class="field">Duração: <output>${c.snapParry.duration.toFixed(2)} s</output><input type="range" data-opt="snapParry.duration" min="0.08" max="0.35" step="0.01" value="${c.snapParry.duration}"></label>
              </div>

              <!-- C08 -->
              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="impactFrames.enabled" ${c.impactFrames.enabled ? 'checked' : ''}> <b>C08 · Impact Frames Estilizados</b></label>
                  <button type="button" data-preview="impactFrames" class="btn-preview">▶ Prévia</button>
                </div>
                <div class="cine-item-desc">Transição rápida de 1-2 quadros em silhueta de alto contraste e inversão negativa de cor.</div>
                <label class="field">Força do Flash: <output>${(c.impactFrames.flashStrength * 100).toFixed(0)}%</output><input type="range" data-opt="impactFrames.flashStrength" min="0.2" max="1.0" step="0.05" value="${c.impactFrames.flashStrength}"></label>
              </div>

              <!-- C09 -->
              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="speedlines.enabled" ${c.speedlines.enabled ? 'checked' : ''}> <b>C09 · Speedlines Radiais de Choque</b></label>
                  <button type="button" data-preview="speedlines" class="btn-preview">▶ Prévia</button>
                </div>
                <div class="cine-item-desc">Linhas radiais de ação convergindo para o ponto exato de colisão no espaço de tela.</div>
                <label class="field">Quantidade de Linhas: <output>${c.speedlines.count}</output><input type="range" data-opt="speedlines.count" min="10" max="60" step="2" value="${c.speedlines.count}"></label>
                <label class="field">Opacidade: <output>${(c.speedlines.opacity * 100).toFixed(0)}%</output><input type="range" data-opt="speedlines.opacity" min="0.1" max="1" step="0.05" value="${c.speedlines.opacity}"></label>
              </div>

              <!-- Aberração Cromática RGB -->
              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="chromaticAberration.enabled" ${c.chromaticAberration?.enabled ? 'checked' : ''}> <b>Aberração Cromática RGB (Glitch de Impacto)</b></label>
                  <button type="button" data-preview="chromaticAberration" class="btn-preview">▶ Prévia</button>
                </div>
                <div class="cine-item-desc">Dispersão óptica instantânea de canais vermelho e ciano nas bordas em parries, clashes e golpes pesados.</div>
                <label class="field">Intensidade: <output>${c.chromaticAberration?.intensity ?? 6} px</output><input type="range" data-opt="chromaticAberration.intensity" min="2" max="14" step="1" value="${c.chromaticAberration?.intensity ?? 6}"></label>
              </div>
            </div>
          </details>

          <!-- Grupo: Feedback de Combate e Popups -->
          <details class="cine-group" open>
            <summary>💥 Feedback de Combate e Popups (Comic Action FX)</summary>
            <div class="cine-group-content">
              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="combatPopups.enabled" ${c.combatPopups?.enabled ? 'checked' : ''}> <b>Ativar Sistema de Popups de Combate</b></label>
                </div>
                <div class="cine-item-desc">Exibe textos dinâmicos de ação e números de dano com estilo e tipografia de anime/quadrinhos.</div>
              </div>

              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="combatPopups.showLabels" ${c.combatPopups?.showLabels ? 'checked' : ''}> <b>Chamadas de Ação (PERFECT, CLASH, K.O.)</b></label>
                  <button type="button" data-preview="combatCallouts" class="btn-preview">▶ Prévia</button>
                </div>
                <div class="cine-item-desc">Textos expressivos em parries perfeitos, choques de golpe, contra-ataques e finalização.</div>
              </div>

              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="combatPopups.showDamage" ${c.combatPopups?.showDamage ? 'checked' : ''}> <b>Números de Dano Flutuantes</b></label>
                  <button type="button" data-preview="damageNumbers" class="btn-preview">▶ Prévia</button>
                </div>
                <div class="cine-item-desc">Valores numéricos de dano saltando do ponto de impacto com destaque para acertos críticos.</div>
              </div>
            </div>
          </details>

          <!-- Grupo 4: Finalizações e K.O. -->
          <details class="cine-group" open>
            <summary>🏆 Finalizações e K.O.</summary>
            <div class="cine-group-content">
              <!-- C07 -->
              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="koCamera.enabled" ${c.koCamera.enabled ? 'checked' : ''}> <b>C07 · Câmera de K.O. e Clímax</b></label>
                  <button type="button" data-preview="koCamera" class="btn-preview">▶ Prévia</button>
                </div>
                <div class="cine-item-desc">Enquadramento baixo dramático com inclinação e arco orbital cinematográfico na derrota.</div>
                <label class="field">Roll Dramático: <output>${c.koCamera.roll}°</output><input type="range" data-opt="koCamera.roll" min="0" max="25" step="1" value="${c.koCamera.roll}"></label>
                <label class="field">Arco Orbital: <output>${c.koCamera.orbitArc}°</output><input type="range" data-opt="koCamera.orbitArc" min="5" max="60" step="5" value="${c.koCamera.orbitArc}"></label>
              </div>

              <!-- C11 -->
              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="slowMotion.enabled" ${c.slowMotion.enabled ? 'checked' : ''}> <b>C11 · Câmera Lenta Visual (Bullet Time)</b></label>
                  <button type="button" data-preview="slowMotion" class="btn-preview">▶ Prévia</button>
                </div>
                <div class="cine-item-desc">Apresentação suavemente desacelerada no clímax sem afetar a lógica física determinística.</div>
                <label class="field">Fator de Velocidade: <output>${c.slowMotion.scale.toFixed(2)}×</output><input type="range" data-opt="slowMotion.scale" min="0.1" max="0.75" step="0.05" value="${c.slowMotion.scale}"></label>
              </div>
            </div>
          </details>

          <!-- Grupo 5: Efeitos de Tela e Inércia -->
          <details class="cine-group" open>
            <summary>🎬 Efeitos de Lente e Inércia</summary>
            <div class="cine-group-content">
              <!-- C10 -->
              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="letterbox.enabled" ${c.letterbox.enabled ? 'checked' : ''}> <b>C10 · Barras Cinematográficas (Letterbox)</b></label>
                  <button type="button" data-preview="letterbox" class="btn-preview">▶ Prévia</button>
                </div>
                <div class="cine-item-desc">Faixas pretas que entram suavemente no topo e na base durante momentos épicos.</div>
                <div class="row">
                  <label class="field">Modo
                    <select data-opt="letterbox.mode">
                      <option value="subtle" ${c.letterbox.mode === 'subtle' ? 'selected' : ''}>Sutil (5% - 8%)</option>
                      <option value="cinema" ${c.letterbox.mode === 'cinema' ? 'selected' : ''}>Cinema 2.39:1</option>
                    </select>
                  </label>
                  <label class="field">Altura (%): <output>${c.letterbox.barPct}%</output><input type="range" data-opt="letterbox.barPct" min="3" max="15" step="1" value="${c.letterbox.barPct}"></label>
                </div>
              </div>

              <!-- C12 -->
              <div class="cine-item">
                <div class="cine-item-head">
                  <label class="check"><input type="checkbox" data-opt="springInertia.enabled" ${c.springInertia.enabled ? 'checked' : ''}> <b>C12 · Inércia de Mola e Amortecimento</b></label>
                </div>
                <div class="cine-item-desc">Mola com amortecimento crítico para recuperação fluida e sem cortes bruscos.</div>
                <label class="field">Rigidez da Mola: <output>${c.springInertia.stiffness}</output><input type="range" data-opt="springInertia.stiffness" min="60" max="350" step="10" value="${c.springInertia.stiffness}"></label>
                <label class="field">Amortecimento: <output>${c.springInertia.damping}</output><input type="range" data-opt="springInertia.damping" min="10" max="50" step="2" value="${c.springInertia.damping}"></label>
              </div>
            </div>
          </details>

          <!-- Grupo 6: Acessibilidade e Segurança Visual -->
          <details class="cine-group">
            <summary>🛡 Acessibilidade e Conforto Visual</summary>
            <div class="cine-group-content">
              <label class="check"><input type="checkbox" data-opt="reduceMotion" ${c.reduceMotion ? 'checked' : ''}> <b>Reduzir Movimento:</b> suaviza rotações e inclinações bruscas</label>
              <label class="check"><input type="checkbox" data-opt="noFlash" ${c.noFlash ? 'checked' : ''}> <b>Sem Flash:</b> desativa flashes brancos intensos e inversão cromática estroboscópica</label>
            </div>
          </details>
        </div>
      </div>
    `;

    bindEvents();
  }

  function bindEvents() {
    // Fechar
    $('cine-close').onclick = () => close();

    // Toggle Mestre
    $('cine-master').onchange = e => {
      cine.config.enabled = e.target.checked;
      saveConfig();
      updateBadge();
    };

    // Intensidade Global
    $('cine-intensity').oninput = e => {
      cine.config.globalIntensity = Number(e.target.value);
      $('cine-intensity-out').textContent = `${Math.round(cine.config.globalIntensity * 100)}%`;
      saveConfig();
    };

    // Botão Comparar Normal ⇄ Cinemática
    let comparing = false, savedMaster = false;
    $('cine-compare').onclick = () => {
      comparing = !comparing;
      if (comparing) {
        savedMaster = cine.config.enabled;
        cine.config.enabled = !savedMaster;
        $('cine-compare').classList.add('active');
        $('cine-compare').textContent = cine.config.enabled ? '✓ Modo Cinemático Ativo (clique p/ Normal)' : '✓ Modo Normal Ativo (clique p/ Cine)';
      } else {
        cine.config.enabled = savedMaster;
        $('cine-compare').classList.remove('active');
        $('cine-compare').textContent = '👁 Comparar Normal ⇄ Cine';
      }
      $('cine-master').checked = cine.config.enabled;
      updateBadge();
    };

    // Ativar Todos
    $('cine-enable-all').onclick = () => {
      cine.config.enabled = true;
      for (const k of ['dutchDodge', 'lowSpeed', 'snapParry', 'chargeFov', 'releaseFov', 'meteorSlam', 'koCamera', 'impactFrames', 'speedlines', 'letterbox', 'slowMotion', 'springInertia']) {
        if (cine.config[k]) cine.config[k].enabled = true;
      }
      saveConfig();
      render();
    };

    // Desativar Todos
    $('cine-disable-all').onclick = () => {
      for (const k of ['dutchDodge', 'lowSpeed', 'snapParry', 'chargeFov', 'releaseFov', 'meteorSlam', 'koCamera', 'impactFrames', 'speedlines', 'letterbox', 'slowMotion', 'springInertia']) {
        if (cine.config[k]) cine.config[k].enabled = false;
      }
      saveConfig();
      render();
    };

    // Restaurar Padrões
    $('cine-reset').onclick = () => {
      cine.resetDefaults();
      saveConfig();
      render();
    };

    // Inputs dinâmicos (data-opt)
    container.querySelectorAll('[data-opt]').forEach(input => {
      const path = input.dataset.opt;
      const isCheck = input.type === 'checkbox';

      input.onchange = e => {
        const val = isCheck ? e.target.checked : (input.type === 'range' || input.type === 'number') ? Number(e.target.value) : e.target.value;
        cine.setOption(path, val);
        saveConfig();
      };

      if (input.type === 'range') {
        input.oninput = e => {
          const out = input.parentElement.querySelector('output');
          if (out) {
            const unit = path.includes('Roll') || path.includes('angle') || path.includes('Fov') || path.includes('Arc') ? '°' : path.includes('Height') || path.includes('Drop') || path.includes('zoomIn') ? ' m' : path.includes('duration') ? ' s' : path.includes('Strength') || path.includes('opacity') || path.includes('Pct') ? '%' : '';
            const mul = path.includes('Strength') || path.includes('opacity') ? 100 : 1;
            out.textContent = `${(Number(e.target.value) * mul).toFixed(unit === ' m' || unit === ' s' ? 2 : 0)}${unit}`;
          }
        };
      }
    });

    // Botões de Prévia
    container.querySelectorAll('[data-preview]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.preview;
        cine.previewEffect(id);
      };
    });
  }

  function updateBadge() {
    const badge = $('cine-active-badge');
    if (badge) {
      badge.textContent = !cine.config.enabled ? 'Desativada' : cine.activeEffect !== 'normal' && cine.activeEffect !== 'none' ? `Ativo: ${cine.activeEffect}` : 'Ligada (Pronta)';
      badge.className = `badge ${cine.config.enabled ? 'ok' : 'muted'}`;
    }
  }

  function open() {
    container.hidden = false;
    render();
    updateBadge();
  }

  function close() {
    container.hidden = true;
  }

  function toggle() {
    if (container.hidden) open(); else close();
  }

  // Monitorar tecla Esc para fechar o painel
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !container.hidden) {
      close();
    }
  });

  return {open, close, toggle, render, updateBadge};
}
