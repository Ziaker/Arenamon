# Editor de animações (aba 🎞 Animações)

Abrir: `JOGAR_ARENAMON.html` → botão **🎞 Animações** (canto da arena, ao lado de 👤 Personagens). Esc fecha.

## O que existe (v1.46.0)
- **Lista** (esquerda): todas as animações em grupos (Locomoção, Defesa e reação, Tackle, Esquivas, Salto, Parede, Moves), busca, filtro «só ausentes», marca ✓ / N× variantes / **ausente**.
- **Prévia** (centro): tocar/pausar, parar, quadro a quadro, laço. Desde a v1.49.11 toca numa **viewport 3D própria** (cena, câmera, luz e mixer isolados; personagem `Character` com `persist:false` copiado do lutador) — o lutador da arena não é usado; o modo «Arena» só fica como reserva se o WebGL da viewport falhar. Clicar na timeline posiciona o quadro. Prévia e jogo dão a mesma pose no mesmo tempo de clipe e o mesmo relógio (teste `animation-viewport-vs-jogo.test.mjs`).
- **Configurações** (direita), por aba: Visão geral (reprodução, mistura, laço), Fases e janelas, Movimento (+ parâmetros do salto), Transições (somente leitura), Hitboxes, Eventos VFX e áudio. Cada campo mostra a origem (global / padrão / sobrescrito ação ou variante) e tem ↺ para restaurar.
- **Timeline** (embaixo): faixas coloridas (clipe, startup, ativo, recovery, cancelável, invencibilidade, congelamento, laço, hitbox, eventos). Eventos do GLB são somente leitura; edições locais são uma camada à parte (contorno tracejado). Alças das faixas ativo/invencível/cancelável/startup arrastam.
- **Divisores** (esquerdo, direito, inferior): arrastar redimensiona; clicar recolhe até uma faixa com a alça visível; clicar de novo reabre. O layout é lembrado.
- **Desfazer/refazer** (Ctrl+Z / Ctrl+Y), **Exportar/Importar** perfil `.json` (preset), **Copiar do outro lutador**, **Salvar**.

## Abas (9)
Visão geral · Fases e janelas · Movimento · Transições · Hitboxes · Eventos VFX e áudio · **Princípios** · **Parâmetros do jogo** · **Diagnóstico**.
- **Princípios:** os 12 princípios da animação (squash & stretch, antecipação, encenação, pose a pose, continuidade/follow through, slow in/out, arcos, ação secundária, timing, exagero, volume/desenho sólido, apelo). Cada um reúne os sliders globais reais do jogo (os mesmos do Ajustes, com «?» de explicação) e os campos da animação (ex.: squash por animação, curva do blend, congelamento no pico).
- **Parâmetros do jogo:** todos os sliders globais ligados ao grupo da animação (salto: gravidade, altura, coyote, buffer, aterrissagem…; tackle, esquiva, bloqueio) + animação global (fade, fade de ação, velocidade, apoio no chão).
- **Diagnóstico:** cobertura (clipes e estados vistos), conflitos perfil × modelo, associações perdidas, telemetria com exportação/limpeza.
- **Moves:** além de move_1…4, carga e disparo do Reflect e do Psyshock (clipe + início/fim do laço da carga).
- **Hitboxes** aparecem em malha colorida sobre o personagem real (forte quando ativa no quadro atual).

## Fases do salto (novas, aditivas)
`jump_start`, `jump_rise`, `jump_apex`, `jump_fall` (+ `land` existente). Se nenhuma tiver clipe, o salto continua usando o clipe «Salto» inteiro (comportamento anterior). Associando um clipe a qualquer fase, o salto passa a seguir a velocidade vertical: início (tempo configurável) → subida → pico (faixa de velocidade configurável) → queda.

## Dados
Perfil por ação e por variante em `Character.animProfile` (schema 1, módulo `src/sim/animation-profile.js`), salvo junto do estado do personagem (`animProfile`). Dados antigos migram para perfil vazio (idempotente); velocidade, laço, duração máxima, offsets, root motion e trava ao chão continuam nos campos antigos (o editor lê/grava os mesmos).

## O que já afeta o jogo × só registrado
Estado atual (v1.49.15; a fonte é o campo `applied` em `src/sim/animation-profile.js`):
Aplicado: habilitada, velocidade, laço, duração máxima, recorte, laço central, os 15 controles de loopagem avançada (início/fim do laço em s, velocidades de introdução/ciclo/saída, pausas, intervalo, emenda, suavizações, fade da conclusão natural, atraso de saída, fase), blend de entrada/saída e curva, peso da camada, direção (Reverso), congelamento, janelas ativo/cancelável/invencível, armadura, buffer de entrada, hit-stop ×, interrompível, prioridade de combate, **Conclusão visual após liberar o controle**, compensação vertical, root motion e trava ao chão por animação, liberar X/Z, escala do deslocamento, squash & stretch, reserva (fallback), fases do salto e hitboxes visíveis.
Apenas registrado (salvo e validado, sem alterar o jogo): startup, prioridade da camada, repetições e condição de saída do laço, deslocamento total, velocidade vertical, tempo mínimo no estado, transição automática, dano/reação das hitboxes e marcadores VFX/áudio.
*(Texto anterior desta seção, da v1.46.0, listava como «só registrado» vários campos que hoje têm efeito; foi atualizado, nada foi removido do Editor.)*

## Conclusão visual (v1.49.9 em diante)
Quando a mecânica libera o lutador antes do fim do clipe, o clipe segue até o fim efetivo enquanto o corpo já anda (módulo `src/view/visual-epilogue.js`; só visual). Ação nova aceita, reação, KO, voo, defesa ou carga interrompem no mesmo passo; comando recusado e movimento comum não. Controle por animação: aba Visão geral › «Conclusão visual após liberar o controle».
v1.49.15: a conclusão visual termina corretamente com **Fim do recorte** e **Reverso** (antes ficava presa até outra ação); o **empurrão** (`pushed`/`pushed_side`) e a **subida da borda** com clipe de reserva também concluem (antes eram cortados no fim mecânico); a troca logo após a conclusão natural não aparece mais como «cancelada/interrompida» no Diagnóstico.
Relatório por execução (Wookada e Cogumelo reais): [RELATORIO_EXECUCOES_ANIMACOES.md](RELATORIO_EXECUCOES_ANIMACOES.md). Evidências no app real: `prototypes/combat-lab/evidence/conclusao-visual/` (tackle e pouso) e `…/conclusao-visual/cenarios/` (Move, esquiva, parede, plataforma, interrupção).
Testes: `animation-epilogue.test.mjs`, `animation-epilogue-casos.test.mjs` (recorte/reverso, pausa, KO, lançamento, GLBs reais), `animation-execution-report.test.mjs`, `animation-viewport-vs-jogo.test.mjs`, `animation-conclusao-visual.browser.mjs`, `animation-conclusao-cenarios.browser.mjs`.

## Pendências conhecidas
Desenhar a hitbox sobre o personagem na prévia; editar transições (condição, tempo mínimo, animação seguinte); animações por move/fase além de move_1…4; disparo de VFX/áudio pelos marcadores; decisão sobre clipe procedural para animações ausentes (hoje só marca como ausente e permite associar/importar).

Inventário anterior preservado: `node prototypes/combat-lab/test/animation-inventory.test.mjs` (42 ações e 51 estados do commit 754d6b2).
Evidência: `prototypes/combat-lab/evidence/animation-editor/principios.png`.

Testes: `node prototypes/combat-lab/test/animation-profile.test.mjs` e `node prototypes/combat-lab/test/animation-editor.browser.mjs`.

## Novos estados de animação (v1.47.0)
Todos aditivos: sem clipe próprio, o jogo se comporta exatamente como antes. Associar um clipe (aba Visão geral) ativa o estado.
- **Moves:** os 19 `.move.json` declaram `presentation` (`move_<id>`; carga e disparo `charge_<id>`/`release_<id>` nos Moves de carga).
- **Defesa perfeita:** `perfect_guard` (antes dividia o clipe de impacto/bloqueio).
- **Reações:** `hit_light` (hitstun), `hit_heavy` (stagger), `push` (empurrão), `push_side` (empurrão lateral), `hit_up` (lançado para cima), `hit_crush` (prensado na parede).
- **Recuperação de ataques:** `recovery_tackle`, `recovery_dodge`, `recovery_move` (desaceleração e retomada de equilíbrio; sem clipe mantém o clipe do ataque).
