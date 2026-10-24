# Laboratório visual: Sand Wave e Emerging Stone

## VOL. 07 — Seis fases desligáveis em todos os efeitos (24/10/2026)

O atelier (versão 7.0.0 dos arquivos exportados) passa a cumprir [PADRAO_ATELIES_VFX.md](PADRAO_ATELIES_VFX.md) nas 24 propostas. Auditoria v2.0: [AUDITORIA_ATELIER_VFX_V2_2026-10-24.md](AUDITORIA_ATELIER_VFX_V2_2026-10-24.md). Plano e decisões: [plans/2026-10-24-vfx-por-fase-atelier.md](plans/2026-10-24-vfx-por-fase-atelier.md). [Galeria de capturas](../prototypes/sand-stone-lab/evidence/fases-24-10/index.html).

- **Seis fases por efeito**, cada uma com o interruptor «Ligar esta fase» (ligada por padrão): Surgimento / preparação, Disparo / lançamento, Corpo e trajeto, Duração em cena, Finalização / retorno e Impacto / explosão / hit. Fase desligada não executa e não aparece na legenda; os sliders dela ficam esmaecidos e guardam os valores. Se todas ficarem desligadas, o painel avisa que não há nada para mostrar.
- **Todo controle** tem nome, unidade, explicação curta, slider e campo numérico sincronizados, agrupado pela fase. Ângulos em ±180°; impulsos e deslocamentos aceitam sinal (positivo à frente, negativo para trás).
- **Efeito de disparo**: Nenhum (padrão, o visual atual não muda), Argola ou Tiro em cone. Os valores de cada opção ficam guardados ao trocar. O clarão/impacto do disparo continua uma camada à parte.
- **Ciclo real de cada Move**: Quick Attack volta à origem depois do contato (sem segundo hit); Bullet Punch some durante a corrida e reaparece no golpe (o punho estilizado é só um efeito); Emerging Stone ganhou o trajeto subterrâneo (0 s por padrão: ajuste «Duração do trajeto»); Riposte mantém os quatro cenários; só o Psyshock tem carga; Swift é Burst (o surgimento não é carga); a **Rocha** é inspeção de objeto, não um ataque, e só tem a fase de duração em cena (as outras ficam desabilitadas com a razão).
- **Salvar**: salvamento automático neste navegador (vale só para o mesmo navegador e o mesmo arquivo HTML), exportação com a data no nome do arquivo e importação que valida o arquivo, **ignora e conta** campos desconhecidos e completa os que faltam com o padrão. O .json exportado é a cópia segura. Arquivos das versões 3, 5 e 6 continuam entrando.
- **Acessibilidade**: «Sem flash / pulsação» (zera clarão e halo, limita o brilho, mantém ondas e partículas) e «Movimento reduzido» (valor inicial vem da preferência do sistema).
- **Com os valores padrão o visual não muda**, com duas exceções pedidas pela auditoria de 24/10: o retorno do Quick Attack e o corpo ausente do Bullet Punch na corrida. Um golden de cada efeito (`golden/*.json`) foi gravado antes das mudanças e os testes conferem.
- **Testes**: `npm run test:sand-stone` (build, 12 testes em Node e o teste de navegador `phases.browser.mjs`, GPU real por padrão). **Não verificado:** desempenho em GPU nos limites ampliados dos sliders; a aprovação visual é do responsável.

## VOL. 06 — Riposte: abertura da guarda e contra-ataque (22/10/2026)

O atelier passa a 24 propostas. [Galeria Riposte](../prototypes/sand-stone-lab/evidence/revision-6/index.html) com abertura, guarda ativa, interceptação, contra-ataque, impacto, expiração, golpe tardio e Guard Break. Há links no portal, índice e central de testes.

### Regra conferida diretamente no GitHub

- [Calibração atual](https://github.com/Ziaker/Arenamon/blob/main/prototypes/combat-lab/src/sim/calibration-base.js#L162): cast 0,65 s, janela 0–0,59 s e alcance 3,8 m. O atelier usa essa referência para encenar a prévia, sem editar a simulação.
- [Interceptação](https://github.com/Ziaker/Arenamon/blob/main/prototypes/combat-lab/src/sim/entity.js#L81): apenas dentro da janela; dano e lançamento anulados. Marca o gatilho, processado no passo seguinte do controlador.
- [Contra-golpe real](https://github.com/Ziaker/Arenamon/blob/main/prototypes/combat-lab/src/sim/controller.js#L790): dirige-se ao atacante, PL4, duração restante do cast (mínimo 0,1 s) e invulnerabilidade até o fim da janela. [Combate](https://github.com/Ziaker/Arenamon/blob/main/prototypes/combat-lab/src/sim/combat.js#L34): nunca faz clash.
- Guard Break não é interceptado. A ficha e os comentários antigos ainda citam PL1/janela 0,13–0,30 s; esses trechos não foram usados como autoridade sobre a execução atual.

### Três construções completas

A — **Égide de aço:** seis placas se fecham diante do defensor; no acerto válido, a guarda desaparece e vira estocada radial.

B — **Guarda cruzada:** duas lâminas armam o X; a interceptação abre cortes cruzados que seguem o corpo na resposta.

C — **Mola de retorno:** crescentes formam uma guarda em tensão; o gatilho libera uma hélice que avança até o atacante.

O seletor **Cenário de prévia** oferece acerto na janela, sem acerto, golpe tardio em 0,62 s e Guard Break. Só o primeiro produz contra-ataque. A guarda perde intensidade quando a janela fecha e encerra ao fim do cast; um golpe que a atravessa interrompe o visual. O instante do acerto é editável apenas na encenação. Tamanhos da guarda/resposta, lâminas, giro, rastros, cor, partículas, impacto e dissipação possuem controles.

JSON exporta versão 6.0.0 e continua aceitando 3.0.0 e 5.0.0, completando as novas categorias com padrões. Testes CPU verificam os quatro cenários nas três propostas; riposte-review.mjs verifica fases, JSON do cenário e limpeza dos recursos em navegador. Sem teste de desempenho em GPU física ou integração dessas propostas no combate. O VFX do jogo principal permanece independente.

## VOL. 05 — Bullet Punch e Quick Attack (22/10/2026)

O atelier agora tem sete categorias e 21 propostas. [Comparação das seis opções novas](../prototypes/sand-stone-lab/evidence/revision-5/index.html), com carga, avanço e impacto. Acesso também pelo portal, índice rápido e central de testes.

| Move | A | B | C |
| --- | --- | --- | --- |
| Bullet Punch | Pistão de aço: punho metálico, rastros axiais, impacto de pressão | Broca helicoidal: punho giratório com hélices e arcos | Rajada de punhos: ecos deslocados e estilhaços radiais |
| Quick Attack | Arrancada supersônica: corpo alongado, rastros paralelos | Passo em zigue-zague: trajetória lateral e fitas contínuas | Salto de imagem: passos descontínuos e silhuetas separadas |

Controles: escala, antecipação e duração do avanço em segundos, espessura, abertura lateral, persistência do rastro, cor, opacidade, partículas, impacto e dissipação. Quick Attack possui alongamento; Bullet Punch possui giro helicoidal. As prévias usam personagens geométricos apenas como referência de movimento. Nenhuma regra de combate foi alterada. As categorias anteriores foram preservadas.

JSON do atelier exporta versão 5.0.0. Importação de arquivos 3.0.0 continua disponível: os presets antigos são preservados e as categorias novas recebem os padrões iniciais. O armazenamento local anterior também migra. Os 21 presets exportam individualmente ou em conjunto.

Validação: TypeScript, ciclos CPU com movimento/descarte, JSON com migração 3→5, navegador e galeria de 18 capturas. Desempenho em GPU física e aprovação artística não são inferidos dessas capturas. Script: node prototypes/sand-stone-lab/rush-review.mjs.

## Correção do Psyshock: substituição integral (22/10/2026)

A versão anterior foi rejeitada por sobrepor um padrão às animações antigas. A correção remove psi-pattern.ts e todo o antigo Psyshock: giroscópios, satélites, gaiolas, lentes, túnel e fundo animado. A construção agora usa somente pedras e glifos locais, ecos de movimento e impactos próprios. A: compressão/expansão de losangos; B: descargas e cortes serrilhados; C: floração hexagonal em pétalas. Os controles de anéis foram renomeados para glifos, preservando as chaves JSON. A galeria vinculada no portal foi atualizada. Teste de regressão verifica ausência do plano/túnel/giroscópios e presença dos glifos em cada pedra.

## Revisão visual 4 — Swift e Psyshock (22/10/2026)

Abra o atelier e confira **VOL. 04** no cabeçalho. [Comparação das seis opções em carga, voo e impacto](../prototypes/sand-stone-lab/evidence/revision-4/index.html), também acessível no portal, índice e central de testes.

- Swift A — Lâminas solares: estrelas com volume e chanfro, lâminas de luz e coroa radial.
- Swift B — Tempestade de cometas: núcleos menores, facetas de chama, caudas âmbar largas e explosão em ondas.
- Swift C — Atlas estelar: estrelas vazadas, bússolas poligonais, satélites e constelação conectada.
- Psyshock A — Ressonância PSI: losangos pixelados em expansão, pedras orbitais e ecos cromáticos.
- Psyshock B — Ruptura PSI: ondas serrilhadas, mosaico, minerais fraturados e estilhaços triangulares.
- Psyshock C — Vertigem PSI: faixas concêntricas deformadas, lentes e túnel com superfície de energia.

A direção PSI segue o pedido de inspiração em Mother 3 e EarthBound, com grafismos procedurais originais, cores em faixas e animação em passos. Sem sprites extraídos. As pedras continuam legíveis e os sliders de cor, opacidade, emissividade e pulsação afetam as novas camadas. Movimento reduzido também diminui emissividade e fragmentos. A revisão visual é 4; o formato JSON permanece compatível com a versão 3 do atelier.

Implementação: módulos Swift/Psyshock separados, ribbons dinâmicos, fragmentos instanciados e shaders de halo, lente e padrões PSI. Diagnóstico de draw calls agora inclui a cena e o pós-processamento. A galeria contém 18 capturas e diagnóstico de limpeza de geometrias/texturas. Verificação artística por capturas no Edge/SwiftShader; desempenho em GPU física e aprovação artística do usuário não foram verificados. Sem alteração nas regras de combate.

Validação: TypeScript do atelier, 15 ciclos CPU e presets JSON; builds do atelier e combate. O comando global npm run verify continua limitado pelas cópias de skills ausentes/divergentes, problema anterior. Script de inspeção: node prototypes/sand-stone-lab/visual-review.mjs.

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

## Atualização 24/10 (v1.33.0)
Camada Recoil & Flash (5 controles, nascem em 0), tema por elemento nos disparos e fase `hold` (antes `sustain`, com migração de presets antigos). Detalhes em [AUDITORIA_ATELIER_VFX_V2_2026-10-24.md](AUDITORIA_ATELIER_VFX_V2_2026-10-24.md).

## Sand Wave e Emerging Stone no jogo (24/10/2026, v1.36.0)
O jogo (`JOGAR_ARENAMON.html`) passou a desenhar a barragem do **Sand Wave** (proposta C) e o trajeto/erupção do **Emerging Stone** (proposta A) com o renderizador deste atelier, usando os parâmetros exportados por você em 24/10 (`prototypes/combat-lab/src/view/quarks/atelier-game-params.js`). A simulação continua mandando: posição, alcance, tempo, dano, cegueira e a rocha 3×3×3 são os de sempre; só a aparência mudou (`view/quarks/atelier-game.js`). Os outros Moves ficam como estavam.
**Psyshock e Swift ainda NÃO foram para o jogo:** no atelier eles são coreografias de cena (3 estrelas / pedras em trajetos roteirizados), e no jogo cada estrela/pedra é uma entidade com mira e física própria; isso pede um renderizador por entidade e ficou para a próxima etapa. Teste: `prototypes/combat-lab/test/atelier-game.browser.mjs`.
