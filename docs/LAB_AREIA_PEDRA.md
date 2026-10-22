# Laboratório visual: Sand Wave e Emerging Stone

Abra [o laboratório](../prototypes/sand-stone-lab/dist/arenamon-areia-pedra.html) diretamente ou pelo `ABRIR_ARENAMON.html`. O arquivo compilado é um HTML único e offline. Escolha uma das três categorias, alterne A/B/C, use os sliders e o botão **Reexecutar**. As teclas 1–3 alternam variantes; espaço reexecuta.

## Auditoria

- `docs/MUSHROOM_MOVES_DECISOES.md`: Sand Wave é o move 3 e sua arte final segue pendente (SW-D68). O move usa 0,25 s de preparação, 0,75 s de janela ofensiva e 0,75 s de dissipação; a área padrão é 4 × 3 m. Emerging Stone é o move 1; a rocha emerge em 0,40 s e a escala padrão é 1.
- `prototypes/combat-lab/src/sim/moves/sand-wave.js`, `emerging-stone.js`, `src/sim/sand.js`, `stone.js` e `src/sim/config.js`: regras e valores conferidos. O laboratório visual não executa a simulação nem altera colisões, dano ou tempos do jogo.
- `prototypes/combat-lab/src/view/world-view.js` e `src/view/quarks/adapter.js`: havia formas provisórias e uma integração de `three.quarks` reutilizável. `package.json` já dependia de `three.quarks` 0.17.1.
- `prototypes/combat-lab/build-lib.mjs` e `quarks-lab/`: padrão de HTML offline com esbuild e licenças embutidas.

## Nove propostas

| Categoria | A | B | C |
|---|---|---|---|
| Sand Wave | Lâmina baixa com crista contínua | Frente larga, densa e turbulenta | Cristas dentadas e fragmentos |
| Emerging Stone VFX | Ruptura pesada, poeira baixa | Erupção agressiva com estilhaços | Ascensão telúrica com anéis e fragmentos orbitais |
| Rocha | Monólito bruto facetado | Obelisco de lâminas minerais | Aglomerado natural irregular |

## Implementação de partículas

`prototypes/sand-stone-lab/src/main.js` instancia `Q.BatchedRenderer`, `Q.ParticleSystem` e os emissores retornados por `system.emitter`. Usa `presetToSystemParams` do adaptador existente. Sand Wave emite ao longo da frente móvel e no impacto; Emerging Stone emite na ruptura e durante a subida. A, B e C têm contagem, cor, tamanho, velocidade e forma de emissor distintos. Os sliders de **Partículas (×)** ajustam a contagem. O modo **Movimento reduzido** diminui a velocidade da apresentação e a quantidade de partículas.

Os demais controles são: alcance (m), largura (m), velocidade (×) e altura da crista (m) para Sand Wave; aviso (s), subida (s) e escala (×) para Emerging Stone; escala (×) e rotação (°) para a rocha. São parâmetros de comparação visual, sem alterar a configuração do move no jogo.

## Arquivos e reprodução

- Fonte: `prototypes/sand-stone-lab/src/`.
- Build: `npm run build:sand-stone-lab` → `prototypes/sand-stone-lab/dist/arenamon-areia-pedra.html`.
- Verificação curta: `npm run test:sand-stone-lab`.
- Acesso: `ABRIR_ARENAMON.html`, `HTMLS_ARENAMON.html` e `TESTES_ARENAMON.html`.

## Limites e recomendação

As nove propostas são visuais. A onda não contorna obstáculos neste laboratório e os modelos não substituem a malha/colisor do jogo. O VFX de cegueira do Sand Wave também não faz parte desta comparação. Para gameplay, a alternativa **A** de Sand Wave tende a ter melhor leitura da frente; a **A** de Emerging Stone sinaliza melhor o ponto de surgimento; a rocha **C** tem silhueta mais orgânica. São recomendações técnicas, não escolhas para o jogo. A seleção final cabe ao usuário após testar.
