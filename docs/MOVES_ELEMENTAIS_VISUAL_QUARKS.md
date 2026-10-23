# Seed Bomb: controles completos por fase e efeito de disparo selecionável — 23/10/2026

Abra **ABRIR_ARENAMON.html → Ateliê Elemental Quarks** (`prototypes/combat-lab/dist/arenamon-elementais-quarks.html`), escolha **Seed Bomb** e role o painel esquerdo. O painel agora abre com **Base (vale para todas as fases)** e segue as fases pedidas: **Surgimento**, **Disparo**, **Voo**, **Rastro de folhas** e **Contato / explosão**. A legenda sobre a cena mostra a fase atual (`Surgimento`, `Disparo`, `Voo`, `Contato`).

## Efeito de disparo (novo, reutilizável)

Em **Disparo** há o seletor **Efeito de disparo** com três opções:

- **Nenhum** — desliga o disparo (padrão).
- **Argola** — anéis que saem da semente: raio, deslocamento vertical, deslocamento no trajeto, achatamento horizontal, impulso horizontal (positivo avança, negativo recua), espessura, quantidade, intervalo, duração, expansão, opacidade, tempo de aparecimento, inclinação, cor e brilho.
- **Tiro em cone** — jato de partículas: direção horizontal e vertical (graus, com sinal), raio de abertura, comprimento, abertura do cone, quantidade, tamanho, vida, impulso horizontal e vertical (m/s, com sinal), dispersão, duração da emissão, atraso, gravidade, cor e brilho.

Só os sliders do efeito escolhido aparecem. Os dois efeitos guardam valores **independentes** (`shotRing` e `shotCone` no arquivo exportado), então trocar de efeito nunca apaga os ajustes do outro. O módulo é `src/view/quarks/shot-effect.js` (`ShotEffect`), sem nenhum nome de Move fixo: para aplicar em Water Pulse/Air Slash basta criar `new ShotEffect(preview)` e chamar `start(settings.shotEffect, settings)` / `update(t)`. Neste pedido ele está ativo **somente no Seed Bomb**.

## Controles por fase

**89 controles** no total: 58 do Seed Bomb (incluindo 8 seletores de cor), 15 da Argola e 16 do Tiro em cone. Todos têm nome, unidade, explicação curta e campo numérico.

- **Base (5):** quantidade base de partículas, intensidade luminosa, tamanho base, vida base e dispersão base.
- **Surgimento (8):** duração do surgimento, escala inicial, quantidade/raio/velocidade/tamanho/vida/cor das partículas de surgimento.
- **Disparo (6):** o seletor + clarão, duração do clarão e do coice, coice, ângulo de lançamento e velocidade de lançamento.
- **Voo (13):** tamanho geral, comprimento, largura, formato (redonda → ponta), espessura/brilho/cor da costura, eixo e velocidade do giro, altura e posição do ponto mais alto do arco, velocidade ao longo do arco e duração do voo.
- **Rastro de folhas (7):** quantidade, raio de emissão, velocidade, tamanho, vida, giro e cor.
- **Contato / explosão (21):** duração visual, tempo de abertura, escala inicial, expansão contínua, folhas da explosão (quantidade/velocidade/tamanho/vida/raio/cor), poeira (quantidade/velocidade/tamanho/vida/cor), anel no chão (tamanho/expansão/espessura/cor), duração e força da compressão da semente.

## Padrões preservam o visual atual

Tudo que é novo nasce neutro ou desligado, para o Seed Bomb continuar idêntico ao anterior: `shotEffect: none`, surgimento em 0 s e 0 partículas, clarão e coice em 0, anel no chão em 0, formato 0 (redonda), comprimento 1,2 e largura 0,72 (a semente atual), giro 0,48 rad/s no eixo Z, arco 2,8 m com topo no meio, rastro e explosão com os mesmos números de antes. Para ver cada novidade, aumente o slider correspondente.

## Limites, acessibilidade e persistência

- Máximo **5×** em todos os sliders do Seed Bomb e dos dois efeitos de disparo; nos sliders com sinal o mínimo também é 5× (ex.: impulso da argola −6 a +6 vira −30 a +30). Ângulos de direção ficam em **±180°**; aberturas em 0..180°.
- **Sem flash / pulsação** desliga o clarão do disparo e troca a mistura aditiva das argolas. **Movimento reduzido** diminui impulsos, expansão e giro; a contagem de partículas do cone também cai.
- A escolha do efeito e os valores dos dois efeitos entram no **Exportar/Importar** e no **salvamento automático** (`arenamon.elementais.config.v1`). Um override parcial de `shotRing`/`shotCone` é mesclado com os padrões, sem perder chaves.

## Validação

`npm run build:combat-lab`, `npm run typecheck`, 20 testes Quarks, 74 de VFX e 14 de VFX sólidos. O teste novo `test/elemental-seed-controls.browser.mjs` (Edge offline) confere os 89 controles na interface e no runtime, os limites 5×/negativos/±180°, o seletor e os dois efeitos, a troca sem perder valores, as quatro fases na legenda, clarão/coice/arco/giro/contato/anel no chão, "Sem flash", movimento reduzido, exportar/importar e o autosave após recarregar a página. Os testes anteriores de água, disparo, lançamento e variantes continuam passando. Capturas e `seed-controls-results.json` estão na [galeria](../prototypes/combat-lab/evidence/elemental-quarks/index.html).

**Não verificado:** desempenho com todos os sliders no máximo ao mesmo tempo, uso em celular/toque e o efeito dentro do jogo (o pedido era só o ateliê; Water Pulse, Fire Spin, Air Slash e o jogo não foram alterados).

---

# Água: controles completos por fase — 23/10/2026

Abra o portal **ABRIR_ARENAMON.html → Ateliê Elemental Quarks** e selecione **Water Pulse**. Role o painel esquerdo: os novos grupos são **Disparo das argolas**, **Forma e faixas da água**, **Gotas do rastro** e **Contato e explosão**. Cada slider tem explicação e campo numérico. O botão de restauração recupera os padrões da variante atual.

Foram acrescentados **40 sliders**:

- **12 de disparo:** quantidade, atraso inicial, intervalo entre argolas, duração individual, raio, espessura, espaçamento, aumento do raio por argola, escala inicial, expansão, velocidade de avanço e opacidade. Cada argola tem seu próprio relógio. O padrão continua sendo três argolas simultâneas de 0,3 s; atrasos e durações maiores também são respeitados depois do contato.
- **8 de forma:** ponta, ondulação, afinamento, raio e largura das faixas orbitais, quantidade, comprimento e largura dos jatos da opção C.
- **5 de rastro:** quantidade, raio de emissão, velocidade, tamanho e vida das gotas.
- **15 de contato:** duração visual, tempo e velocidade da expansão, escala inicial, duração e força da compressão, quantidade/velocidade/tamanho/vida/raio de emissão das gotas, altura/raio/cristas da coroa e raio da onda.

A duração da coroa é independente da vida das gotas. O descarte aguarda os tempos configurados. Cor, tamanho geral, brilho, velocidade, duração do voo, smear, dispersão e anéis orbitais continuam disponíveis nos controles gerais.

**Limites:** água conserva máximos 300×, inclusive nos controles novos; Fire Spin, Air Slash e Seed Bomb passam a máximos 5× (também o halo: 1,2 → 6). Os valores padrão dos outros Moves não mudaram. A opacidade física satura em 1. Valores extremos podem ultrapassar o enquadramento; não foi validado desempenho com todos os máximos simultâneos.

**Validação:** build, typecheck, 20 testes Quarks e navegador Edge offline. O teste elemental-water-controls.browser.mjs verifica os 40 controles na interface/runtime, limites, sequenciamento de três argolas, contato prolongado e descarte. Capturas e resultados estão na [galeria](../prototypes/combat-lab/evidence/elemental-quarks/index.html). A verificação geral npm run verify para nas 11 skills de .claude ausentes/divergentes, problema anterior a esta alteração.

---

# Revisão de lançamento e controles — 23/10/2026

- **Air Slash:** corte deitado no plano XZ, paralelo ao chão. Surge por escala e opacidade em 0,22 s, com um arco inicial de pressão. As três variantes permanecem disponíveis.
- **Water Pulse:** a frente do projétil permanece ancorada; o smear se estende para trás (oposto ao vetor de deslocamento). Três argolas de água expandem no ponto de lançamento e desaparecem aos **0,3 s**. O acabamento da água foi mantido.
- **Limites da água:** máximos de todos os sliders exibidos para Water Pulse multiplicados por **300**, inclusive o halo. Mínimos, passos e valores padrão preservados. Campos numéricos permitem precisão sem arrastar uma escala tão ampla. A contagem de anéis não é truncada; sua malha usa menos subdivisões quando a contagem sobe.
- **Fire Spin:** dez controles adicionais: braços, volta de cada braço, largura, elevação, abertura radial, coroas, espaçamento, tempo de surgimento, tempo de apagamento e multiplicador de brasas. Todos conectados à geometria, emissão ou animação correspondente. O centro aberto permanece preservado.
- **Explicações:** texto visível abaixo de todos os sliders, incluindo os controles antigos e o halo, com associação acessível ao campo.

Teste dedicado: prototypes/combat-lab/test/elemental-launch-controls.browser.mjs. Verifica limites 300×, três malhas de argolas, presença aos 100 ms/ausência aos 301 ms, orientação horizontal e crescimento do Air Slash, dez controles do fogo e descrições. A galeria do portal inclui capturas e o JSON do teste.

Não foi validado o uso simultâneo de todos os máximos ampliados, nem desempenho em máquinas lentas. Build, typecheck, testes Quarks e validação offline no Edge foram executados. A verificação geral permanece interrompida pelas 11 skills preexistentes de .claude.

---

# Revisão atual — 3 opções por efeito e contatos (23/10/2026)

Abra o **Ateliê Elemental Quarks** no portal. Escolha Água, Fogo ou Vento e use o seletor **Opção visual** (A/B/C). **Contato agora** dispara o contato durante o trajeto; ele também acontece automaticamente ao terminar o trajeto. São animações da prévia, sem regras de colisão ou dano.

| Move | A | B | C |
|---|---|---|---|
| Water Pulse | Hadouken compacto | Lança com ponta longa | Hélice com três jatos |
| Fire Spin | Anel de chamas | Braços espirais abertos | Coroa dupla |
| Air Slash | Arco único branco | Três navalhas | Arco com rastros longos |

A água mantém seu shader de correntes e espuma. A ponta avança no eixo do disparo e o stretch cresce com a velocidade durante a aceleração. O contato comprime o núcleo e abre uma explosão transversal de água e gotas Quarks. Controles: **Alongamento pela velocidade** e **Tamanho do contato**.

O fogo ocupa uma faixa anular: o centro fica aberto nas três variantes. **Raio do centro aberto** ajusta a abertura. O cone de tornado foi removido.

Air Slash usa superfícies brancas lisas, arcos abertos e retos no plano do corte. O contato usa riscos radiais e arcos de pressão; nenhuma superfície aquática é criada para vento.

[Galeria das nove opções e seis contatos](../prototypes/combat-lab/evidence/elemental-quarks/index.html). [Resultado automatizado](../prototypes/combat-lab/evidence/elemental-quarks/variants-results.json).

Teste: `node prototypes/combat-lab/test/elemental-variants.browser.mjs`: 9 opções, contatos, aceleração/stretch, acessibilidade e limpeza. Build, typecheck e testes Quarks executados. Desempenho em hardware lento não medido.

As seções abaixo registram versões anteriores; esta revisão substitui as descrições antigas de tornado, lâmina inclinada e dissipação aquática.

---
# Moves elementais — protótipos visuais com three.quarks

## Abrir
No `ABRIR_ARENAMON.html`, clique **Ateliê Elemental Quarks · Água, Fogo e Vento refeitos**.
Arquivo direto: `prototypes/combat-lab/dist/arenamon-elementais-quarks.html`.
Escolha o Move, ajuste os controles e clique **Reproduzir**. A repetição começa ativada; **Parar** limpa a cena. O seletor PL aparece somente para Water Pulse. Arraste a cena para mudar a câmera.

## Conteúdo
- **Water Pulse:** esfera translúcida azul, anéis orbitais, gotas e rastro. PL2/PL3 multiplicam tamanho, quantidade e brilho e acrescentam anéis aos valores-base dos controles.
- **Fire Spin:** emissor Quarks em cone sequencial e órbita produz chamas ascendentes em espiral, com brasas e anéis no solo. A emissão cresce no início e decai ao final.
- **Air Slash:** superfície crescente com faixas finas, partículas alongadas de vento e dissipação em rajada.
- **Seed Bomb:** semente em arco, folhas no rastro, explosão radial de folhas e poeira no fim do trajeto visual.

As superfícies contínuas (esfera, anéis, lâmina e semente) são malhas Three.js. Todas as partículas, inclusive folhas, chamas e explosões, usam `ParticleSystem`, emissores, curvas e comportamentos do **three.quarks 0.17.1**. Não há simulação manual de partículas. Não há dano, colisão ou implementação dos Moves no jogo.

## Ajustes
Controles por Move: duas cores, tamanho do núcleo, quantidade/taxa de emissão, velocidade, duração, brilho, tamanho e vida das partículas, rotação, altura/arco, dispersão e número de anéis/faixas quando aplicável. Os ajustes são mantidos durante a sessão e **Restaurar este Move** recupera o preset. Não são gravados no balanceamento nem persistidos após fechar a página.

**Sem flash / pulsação** elimina a pulsação dos anéis, reduz o brilho e usa mistura normal das partículas. **Movimento reduzido** diminui emissão, deslocamento e rotação; respeita também a preferência de movimento reduzido do sistema na abertura. Nenhum efeito usa flash de tela ou tremor de câmera.

## Correção do laboratório original
Confirmado no código instalado: `PiecewiseBezier` recebe o início do segmento; `1` deixava toda a curva anterior a 1 sem função. Corrigido para `0`. `ParticleSystem` já cria seu `emitter`; as três criações duplicadas foram substituídas por `system.emitter`.
O preset de carga foi reproduzido e capturado no Edge **antes** da criação dos novos efeitos: [captura inicial](../prototypes/combat-lab/evidence/elemental-quarks/step-0-charge.png).
A ponte do jogo e seu comportamento de fallback não foram modificados.

## Evidências e verificação
[Galeria de capturas](../prototypes/combat-lab/evidence/elemental-quarks/index.html) · [Resultados do navegador](../prototypes/combat-lab/evidence/elemental-quarks/results.json).

- `npm run build:combat-lab`: gera também a nova página offline.
- `npm run typecheck`.
- `node prototypes/combat-lab/test/quarks.test.mjs`: inclui regressão para identidade do emissor e tamanho positivo das partículas.
- `node prototypes/combat-lab/test/elemental-quarks.browser.mjs`: Edge offline, quatro efeitos, PLs, mudança de parâmetro, acessibilidade, parada e encerramento/limpeza.

Limitações: protótipos para ajuste visual; não foi medido desempenho em computadores lentos, nem feita integração dos elementais ao combate. O fallback sem Quarks não sofreu alterações; não foi injetada falha de carregamento no jogo nesta tarefa. Base: `origin/main` em `0ed46dc`; sem uso do PR #94.

Verificação geral: `npm run verify` interrompido em `skills:check` por 11 skills preexistentes ausentes/divergentes em `.claude/skills`. O typecheck executado separadamente passou.

## Reconstrução visual — água, fogo e vento

Revisão a partir das sete referências fornecidas pelo usuário, com direção visual inspirada em Genshin Impact e Naruto Ultimate Ninja Storm 4. As imagens orientaram forma, cor e movimento; não foram usadas como texturas.

As três construções anteriores foram removidas do runtime e substituídas:
- **Água:** esfera com deformação suave, sombreamento azul, correntes procedurais, espuma e borda luminosa. Faixas orbitais se acomodam à esfera. A ruptura abre uma coroa curva, onda e gotas Quarks.
- **Fogo:** tornado com volume cônico irregular, três faixas largas em espiral, recortes animados, tons quentes e anéis no solo. Chamas menores e brasas continuam no Quarks. Cresce na entrada e se contrai no encerramento.
- **Vento:** lâmina inclinada com borda afiada, várias superfícies translúcidas que formam um rastro longo e dissipação circular. As linhas de velocidade são emitidas pelo Quarks.

Novos controles: contraste das faixas/espuma, comprimento do rastro de vento, halo luminoso e acompanhamento da câmera. O halo é desligado por **Sem flash**. As superfícies usam UVs animadas, ruído, transparência e Fresnel; suas animações também respeitam movimento reduzido. Nenhuma malha antiga dos três efeitos continua sendo criada.

Arquivos: `elemental-surfaces.js` concentra as novas superfícies/shaders; `elemental-preview.js` integra as superfícies aos emissores Quarks. A galeria vinculada no portal foi atualizada, incluindo a ruptura de Water Pulse.

Testes da reconstrução: build e typecheck, 20 testes do adaptador e navegador Edge offline (incluindo erros de shader/console, reprodução, PL, controles, acessibilidade e limpeza). A qualidade artística ainda depende da avaliação do usuário. Não medido em máquinas lentas; não validado em outros navegadores.

# Impacto visual do disparo (Water Pulse e Air Slash) — 23/10/2026

Abra **ABRIR_ARENAMON.html → Ateliê Elemental Quarks**, escolha **Water Pulse** ou **Air Slash** e role o painel até o grupo **Impacto do disparo**. A legenda do canto mostra a fase **Disparo (impacto)** enquanto ele acontece.

No instante do disparo, ao mesmo tempo:

- **Clarão** no núcleo (brilho extra que decai) e **halo** luminoso na origem;
- **Coice do núcleo**: alongamento para a frente que se recupera sozinho;
- **Ondas de choque**: anéis que se expandem perpendicularmente ao disparo (água em espuma, ar em vento);
- **Jato de partículas para trás**: gotas na água, riscos de vento no ar.

13 sliders, todos com unidade e explicação: duração, clarão, halo, impulso do núcleo, quantidade, raio, espessura e intervalo das ondas, quantidade, velocidade, tamanho e vida das partículas e abertura do cone do jato. **Duração = 0 desliga todo o impacto.** Limites seguem a regra do ateliê (água 300×, ar 5×; a abertura do jato fica em 180°). **Sem flash** zera clarão e halo e mantém ondas e jato; **Movimento reduzido** reduz a velocidade do jato. Valores padrão: água 0,45 s, 3 ondas, 140 gotas; ar 0,4 s, 3 ondas, 90 riscos.

Teste: `test/elemental-shot.browser.mjs` (Edge offline) confere os 13 sliders na interface e no runtime, os limites, a fase, ondas/clarão/impulso/jato nos primeiros 60 ms, o fim das ondas, o desligamento por duração 0, Sem flash, movimento reduzido e que o jato vai para trás. Capturas na [galeria](../prototypes/combat-lab/evidence/elemental-quarks/index.html). Não foi medido desempenho com os máximos simultâneos nem validado o impacto dentro da partida (só no ateliê).

# Salvar, exportar e importar configurações do ateliê — 23/10/2026

No painel esquerdo do **Ateliê Elemental Quarks**, grupo **Salvar configurações** (abaixo de "Restaurar este Move"):

- **Salvamento automático:** todo ajuste (sliders, cores, Move e opção escolhidos, PL, halo, sem flash etc.) é guardado no navegador e volta ao reabrir ou recarregar a página. "Restaurar este Move" apaga só os ajustes daquele Move/opção.
- **Exportar (.json):** baixa `arenamon-elementais-AAAA-MM-DD-HHMM.json` com **todos** os Moves e opções ajustados. É a cópia segura: guarde-a em `docs/` ou na pasta do projeto.
- **Importar:** carrega um desses arquivos e restaura tudo. Arquivo inválido é recusado com mensagem, sem alterar nada; campos desconhecidos são ignorados e contados.

Limite: o salvamento automático vale só para o mesmo navegador e o mesmo arquivo HTML; trocar de navegador, limpar dados do site ou mover o HTML de pasta o perde — por isso exporte. Os valores exportados ainda não viram o padrão do jogo: isso exige aplicá-los aos presets (peça com o arquivo em mãos). Teste: `test/elemental-export.browser.mjs`.
