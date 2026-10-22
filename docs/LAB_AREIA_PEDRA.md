# Laboratório visual: Sand Wave e Emerging Stone

## Ampliação do atelier (22/10/2026)

O mesmo HTML offline agora inclui cinco categorias e 15 alternativas: Sand Wave, Emerging Stone, modelos de rocha, Swift e Psyshock, cada uma em A/B/C. As nove opções anteriores permanecem. Swift mostra três estrelas como prévia do Burst atual; Psyshock apresenta de 3 a 8 pedras conforme o estágio de carga escolhido **apenas para inspeção**, sem executar a simulação. Nenhum parâmetro visual altera dano, trajetória, hitbox ou regras de combate.

As seis opções novas usam Three.js para estrelas, pedras, anéis e rastros, e `three.quarks` com `BatchedRenderer` e `ParticleSystem` para estrelas, orbes e fragmentos. Sand Wave e Emerging Stone ganharam controles de forma, partículas, luz e dissipação, agrupados em painéis recolhíveis. Sliders reconstroem a prévia com descarte dos emissores e geometrias anteriores. Valores iniciais antigos foram mantidos.

O editor salva/carrega no navegador e exporta uma alternativa ou todas em arquivo `.json`. A importação valida tamanho máximo de 500 KB, versão 1 do schema, categoria, variante, faixas numéricas, campos conhecidos, recursos embutidos e parâmetros de apresentação. Uma importação individual só substitui a opção indicada, após confirmação visível. O arquivo identifica `atelier: "arenamon-vfx"`, `atelierVersion: "3.0.0"`, `exportScope`, `visualParameters` ou `presets`, `presentation` e `assets`. Arquivos v2 do armazenamento local são migrados para as três variantes de cada categoria, mantendo seus valores comuns. O round-trip numérico preserva os números JSON sem arredondamento adicional.

Comandos desta ampliação: `npx tsc --noEmit -p prototypes/sand-stone-lab/tsconfig.json`, `npm run build:sand-stone-lab`, `node prototypes/sand-stone-lab/test.mjs`, `node prototypes/sand-stone-lab/presets.test.mjs` e `node prototypes/sand-stone-lab/verify.mjs`. O portal `ABRIR_ARENAMON.html` já oferece link direto ao atelier; `HTMLS_ARENAMON.html` também aponta para ele. A homologação artística das seis novas opções permanece com o usuário.

Capturas de 1280 × 720: [Swift C](../prototypes/sand-stone-lab/evidence/swift-c-720p.png) e [Psyshock C](../prototypes/sand-stone-lab/evidence/psyshock-c-720p.png). São evidências da renderização no Edge com SwiftShader; não representam a escolha final. A bateria `npm run verify` parou em `skills:check` por 11 cópias `.claude/skills` ausentes ou divergentes, condição anterior e sem relação com este atelier.

Abra [o laboratório](../prototypes/sand-stone-lab/dist/arenamon-areia-pedra.html) diretamente ou pelo `ABRIR_ARENAMON.html`. O arquivo compilado é um HTML único e offline. **Revisão visual 2 (21/10/2026):** a primeira proposta foi reprovada pelo usuário por falta de qualidade e identidade. Esta revisão substitui sua construção visual. Recarregue a aba para ver **VOL. 02**.

Escolha uma categoria, alterne A/B/C e ajuste os sliders. A linha do tempo permite inspecionar qualquer instante; espaço pausa, R reexecuta e 1–3 alternam variantes. Há câmera ao nível do chão/superior/¾, tela cheia, opção de salvar/carregar ajustes no navegador e seleção independente da rocha associada ao VFX.

## Auditoria

- `docs/MUSHROOM_MOVES_DECISOES.md`: Sand Wave é o move 3 e sua arte final segue pendente (SW-D68). O move usa 0,25 s de preparação, 0,75 s de janela ofensiva e 0,75 s de dissipação; a área padrão é 4 × 3 m. Emerging Stone é o move 1; a rocha emerge em 0,40 s e a escala padrão é 1.
- `prototypes/combat-lab/src/sim/moves/sand-wave.js`, `emerging-stone.js`, `src/sim/sand.js`, `stone.js` e `src/sim/config.js`: regras e valores conferidos. O laboratório visual não executa a simulação nem altera colisões, dano ou tempos do jogo.
- `prototypes/combat-lab/src/view/world-view.js` e `src/view/quarks/adapter.js`: havia formas provisórias e uma integração de `three.quarks` reutilizável. `package.json` já dependia de `three.quarks` 0.17.1.
- `prototypes/combat-lab/build-lib.mjs` e `quarks-lab/`: padrão de HTML offline com esbuild e licenças embutidas.

## Nove propostas

| Categoria | A | B | C |
|---|---|---|---|
| Sand Wave | Foice do deserto: crescente de areia e corte rápido | Muralha de siroco: frente enrolada em camadas | Marcha das dunas: três cristas dentadas em sequência |
| Emerging Stone VFX | Falha tectônica: fraturas, ruptura e poeira radial | Coroa de obsidiana: estilhaços altos e impacto quente | Selo de Gaia: círculo mineral e partículas ascendentes |
| Rocha | Bastião de basalto: estratos e colunas assimétricas | Presa de obsidiana: lâminas inclinadas e veios quentes | Relíquia telúrica: núcleo com coroa e peças suspensas |

## Implementação de partículas

`src/particles.js` instancia diretamente `Q.BatchedRenderer` e `Q.ParticleSystem`, usando `system.emitter`. A revisão 2 tem três materiais procedurais: poeira com textura irregular e transparência normal, grãos finos aditivos e riscos de impacto. Emissores ConeEmitter são orientados do eixo Z local para a direção solicitada; a matriz do emissor é atualizada antes da simulação. Há curvas de cor/alfa/tamanho ao longo da vida e gravidade. Cada sistema vive até a última partícula desaparecer.

Sand Wave usa sete pares de emissores móveis de poeira/grãos, emissão inicial e explosão final. B tem partículas de poeira maiores e mais duradouras. Emerging Stone usa doze emissores radiais no chão e um jato de grãos; B acrescenta riscos de impacto e maior velocidade; C acrescenta emissão ascendente persistente. A contagem de partículas vivas aparece no rodapé.

`src/art.js` contém a geometria de areia curva com shader de ruído animado, modelos de rocha com estratos irregulares, textura/bump procedural, veios, rachaduras, anéis e detritos instanciados com trajetória balística. `src/effects.js` controla a sequência temporal das propostas. Esses sólidos e superfícies complementam as partículas Quarks.

Os controles incluem alcance, largura e altura (m), quantidade de grãos e poeira (×), antecipação e subida (s), escala, ângulo e giro da rocha (°/s), velocidade de reprodução, brilho mineral, luminosidade e tremor. Movimento reduzido diminui partículas e ritmo e desliga o tremor. São parâmetros de apresentação; não alteram o jogo.

## Arquivos e reprodução

- Fonte: `prototypes/sand-stone-lab/src/`.
- Build: `npm run build:sand-stone-lab` → `prototypes/sand-stone-lab/dist/arenamon-areia-pedra.html`.
- Verificação de CPU: `node prototypes/sand-stone-lab/test.mjs` (não abre navegador).
- Verificação de navegador disponível: `npm run test:sand-stone-lab` (não executada nesta revisão por bloqueio da política de inspeção de `file://`).
- Acesso: `ABRIR_ARENAMON.html`, `HTMLS_ARENAMON.html` e `TESTES_ARENAMON.html`.

## Limites e recomendação

As nove propostas são visuais. A onda não contorna obstáculos neste laboratório e os modelos não substituem a malha/colisor do jogo. O VFX de cegueira do Sand Wave também não faz parte desta comparação. A largura visual inicial é 3,4 m e o aviso inicial é 0,70 s, propostas de apresentação (não mudanças dos valores canônicos auditados). A rocha recolhe ao fim do ciclo para repetir a demonstração; no jogo ela continua persistente conforme a regra existente.

Verificações desta revisão: compilação do HTML; nove ciclos em CPU, partículas Quarks vivas com coordenadas e tamanhos finitos, cleanup, controles presentes e dependências embutidas. **Renderização GPU e qualidade visual em tela não foram verificadas nesta revisão:** a inspeção da aba local foi recusada pela política do navegador. Os testes de funcionamento da versão anterior não validam esta nova arte. A recomendação de escolha fica pendente da comparação visual; nenhuma proposta foi aprovada ou aplicada ao jogo.

O build do Combat Lab foi refeito. `npm run verify` foi executado e voltou a parar em `skills:check`, pelas mesmas 11 cópias ausentes/divergentes em `.claude/skills`; as etapas posteriores não executaram.
