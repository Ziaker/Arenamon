# Editor de animações (aba 🎞 Animações)

Abrir: `JOGAR_ARENAMON.html` → botão **🎞 Animações** (canto da arena, ao lado de 👤 Personagens). Esc fecha.

## O que existe (v1.45.0)
- **Lista** (esquerda): todas as animações em grupos (Locomoção, Defesa e reação, Tackle, Esquivas, Salto, Parede, Moves), busca, filtro «só ausentes», marca ✓ / N× variantes / **ausente**.
- **Prévia** (centro): tocar/pausar, parar, quadro a quadro, laço; toca no personagem real da arena. Clicar na timeline posiciona o quadro.
- **Configurações** (direita), por aba: Visão geral (reprodução, mistura, laço), Fases e janelas, Movimento (+ parâmetros do salto), Transições (somente leitura), Hitboxes, Eventos VFX e áudio. Cada campo mostra a origem (global / padrão / sobrescrito ação ou variante) e tem ↺ para restaurar.
- **Timeline** (embaixo): faixas coloridas (clipe, startup, ativo, recovery, cancelável, invencibilidade, congelamento, laço, hitbox, eventos). Eventos do GLB são somente leitura; edições locais são uma camada à parte (contorno tracejado). Alças das faixas ativo/invencível/cancelável/startup arrastam.
- **Divisores** (esquerdo, direito, inferior): arrastar redimensiona; clicar recolhe até uma faixa com a alça visível; clicar de novo reabre. O layout é lembrado.
- **Desfazer/refazer** (Ctrl+Z / Ctrl+Y), **Exportar/Importar** perfil `.json` (preset), **Copiar do outro lutador**, **Salvar**.

## Fases do salto (novas, aditivas)
`jump_start`, `jump_rise`, `jump_apex`, `jump_fall` (+ `land` existente). Se nenhuma tiver clipe, o salto continua usando o clipe «Salto» inteiro (comportamento anterior). Associando um clipe a qualquer fase, o salto passa a seguir a velocidade vertical: início (tempo configurável) → subida → pico (faixa de velocidade configurável) → queda.

## Dados
Perfil por ação e por variante em `Character.animProfile` (schema 1, módulo `src/sim/animation-profile.js`), salvo junto do estado do personagem (`animProfile`). Dados antigos migram para perfil vazio (idempotente); velocidade, laço, duração máxima, offsets, root motion e trava ao chão continuam nos campos antigos (o editor lê/grava os mesmos).

## O que já afeta o jogo × só registrado
Aplicado: velocidade, laço, duração máxima, recorte (início/fim), laço central, blend de entrada, compensação vertical, root motion/trava ao chão (globais), fases do salto e seus parâmetros.
Apenas registrado (salvo, validado e desenhado na timeline, sem alterar o combate): startup/ativo/cancelável/invencibilidade/congelamento, blend de saída, peso de camada, habilitada, hitboxes e marcadores VFX/áudio.

## Pendências conhecidas
Desenhar a hitbox sobre o personagem na prévia; editar transições (condição, tempo mínimo, animação seguinte); animações por move/fase além de move_1…4; disparo de VFX/áudio pelos marcadores; decisão sobre clipe procedural para animações ausentes (hoje só marca como ausente e permite associar/importar).

Testes: `node prototypes/combat-lab/test/animation-profile.test.mjs` e `node prototypes/combat-lab/test/animation-editor.browser.mjs`.
