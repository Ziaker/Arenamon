# Arenamon VFX Composer F2

## Estado

**F2 concluída.** O Composer offline agora reúne autoria geométrica, timeline, texturas e materiais declarativos seguros. O escopo para aqui: partículas são F3 e compilação/publicação no jogo são F4.

## O que foi acrescentado

- Timeline em 24, 30 ou 60 FPS, duração em segundos, scrub quantizado, play, reverse e stop.
- Tracks de posição, rotação, escala, opacidade e visibilidade com step, linear ou Bézier e dados de morph de caminhos.
- Onion skin anterior/próximo com opacidade ajustável.
- Pintura RGBA offline, pincel em pixels, cor/opacidade, limpeza, importação PNG e divisão de spritesheet.
- Grafo material declarativo com allowlist; ciclos, portas inválidas, referências ausentes, nós desconhecidos e nós órfãos são rejeitados.
- Receita material determinística para a prévia Three.js, sem aceitar código GLSL/HLSL do projeto.
- Undo/Redo e autosave continuam passando pelo mesmo `VfxProject`; projetos F0/F1 permanecem válidos.

## Como abrir

Abra `ABRIR_ARENAMON.html` e escolha **VFX Composer · F2**, ou abra diretamente `prototypes/vfx-composer/dist/arenamon-vfx-composer.html`. Use as abas **Desenho**, **Animação**, **Texturas** e **Materiais** no topo.

## Verificação executada

```powershell
npm run typecheck:vfx-composer
npm run test:vfx-composer
npm run test:vfx-composer:f1
npm run test:vfx-composer:f2
npm run test:vfx-composer:f2:browser
```

O teste de navegador roda offline no Edge, abre duas páginas WebGL, percorre timeline/reverse/keyframe/onion skin, pinta e importa PNG, configura spritesheet e comprova rejeição de grafo inválido. A captura e o resultado estruturado ficam em `prototypes/vfx-composer/evidence/f2/`.

## Limites preservados

- Sem partículas, Three.quarks, forças, colisão ou pooling nesta fase.
- Sem binding de Move, player runtime, publicação ou alteração de `Game.step`.
- Sem shader arbitrário, scripts ou recursos remotos.
- Morph cobre caminhos autorais compatíveis; não deforma malhas trianguladas importadas.

## Próximo marco

STOP normativo antes da F3. A F3 poderá introduzir partículas somente mediante nova autorização explícita. Autorização registrada em 27/10/2026; a fatia em andamento e seus limites estão em `docs/VFX_COMPOSER_F3.md`.
