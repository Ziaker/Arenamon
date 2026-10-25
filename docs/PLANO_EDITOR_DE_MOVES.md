# Plano: Editor de Moves (janela única que dá play no Move)

Status (24/10/2026): **fases 1 a 5 entregues (19 Moves, todos)**; o painel antigo da aba Moves foi desmontado (ver «Andamento» no fim). Fases 3 a 7 ainda são plano.

## Objetivo

Mudar qualquer coisa de um Move em **um lugar só**: uma janela de edição que executa o Move de verdade (visual + mecânica) ao lado dos sliders. A aba **Moves** do jogo vira só uma vitrine: botões dos Moves **equipados** em destaque e, abaixo, os **não equipados**; clicar em um abre o editor.

## Situação hoje (o que já existe e será reaproveitado)

- Parâmetros mecânicos: `src/sim/moves/<id>.params.js` (`defineMoveParams`), sliders gerados pela aba Moves (`ui/moves-panel.js`, 558 linhas).
- Lógica do Move: `src/sim/moves/<id>.js`; fichas e índices gerados (`fichas.generated.js`, `params.generated.js`).
- Visual dos Moves de areia/pedra/psíquico/veloz: atelier `sand-stone-lab`, já com **parâmetros aprovados em fonte única** (`approved/<move>.json`).
- Visual dos demais Moves: `view/quarks/*` e `ui/moves-vfx-panel.js`, `elemental-move-controls.js` (parâmetros dispersos).
- Cenários de teste: `sim/scenarios-*.js`, treino, `move-timeline`, `move-ab`.

## Arquitetura proposta (3 camadas separadas)

1. **Definição do Move (dado puro, sem tela)** — `moves/<id>/move.json`: identidade, categoria, custo/cooldown/cast, fases, hitboxes, **parâmetros mecânicos** (hoje `.params.js`) e **parâmetros visuais** (hoje no atelier/quarks). Um só esquema, validado.
2. **Motor do Move (código)** — `moves/<id>/logic.js` (efeito na simulação) e `moves/<id>/fx.js` (renderização). Só lêem a definição; nenhum valor fixo no código.
3. **Editor (interface)** — módulo `editor/` que recebe qualquer definição e monta: palco de teste, sliders, linha do tempo, painel de eventos. Não conhece Move nenhum em particular.

Regra de dependência (verificada por teste): `editor → motor → definição`; `sim` nunca importa `view`.

## O editor

- **Palco:** a arena real do jogo com dois bonecos (executor e alvo), usando o **mesmo `World` da simulação** (não uma cópia), então o efeito mecânico é o do jogo: dano, knockback, hit-stop, cooldown, stamina.
- **Controles de play:** Executar, Repetir, Câmera lenta, Passo a passo, Reiniciar, alvo parado/andando/defendendo/no ar, distância e altura do alvo.
- **Sliders:** duas seções — **Mecânica** e **Visual** — geradas da definição (rótulo, unidade, faixa, dica), com busca, "alterado" destacado, reverter por campo e por Move.
- **Linha do tempo:** fases do Move (início, voo, impacto, fim) com marcadores de janela de dano, cancelamento e invulnerabilidade; clicar numa fase leva o play até ela.
- **Resultado numérico:** dano causado, alcance real, duração total, stamina gasta, janela de punição — comparado ao "aprovado".
- **A/B:** valor atual × aprovado, lado a lado.
- **Salvar:** grava `move.json`; **Exportar/Importar** no formato atual do atelier continua funcionando.
- Abre **dentro do jogo** (painel acoplado, tecla `E` ou clique no Move) e também como **janela separada** (mesmo HTML, segunda aba) para usar em dois monitores.

## A aba Moves (vitrine)

- Topo: Moves **equipados** (até N slots), grandes, com ícone, nome, categoria e atalho.
- Abaixo: **não equipados**, menores, filtráveis por categoria/tipo/status (proposto, aprovado, implementado, homologado).
- Clique = abre o editor naquele Move. Arrastar = equipar/desequipar (se hoje já existe, preservar).
- Sai da aba tudo que for slider; sliders só existem no editor.

## Fases de entrega (cada uma jogável e com testes)

| Fase | Entrega | Risco |
|---|---|---|
| 0 | Fechar o build quebrado (`tuning.ts`) e congelar uma linha de base de testes | baixo |
| 1 | Esquema único `move.json` + loader; migrar **Sand Wave** (modelo) preservando comportamento idêntico (hash) | médio |
| 2 | Editor mínimo: palco + play + sliders de **um** Move (Sand Wave) | médio |
| 3 | Linha do tempo + resultado numérico + A/B | baixo |
| 4 | Aba Moves vira vitrine (equipados em destaque, não equipados, clique abre editor) | baixo |
| 5 | Migrar os demais Moves, um por vez (cada um com teste de equivalência) | médio |
| 6 | Janela separada + atalhos + remover sliders antigos da aba | baixo |
| 7 | Gerador `npm run novo-move` cria `moves/<id>/` completo | baixo |

## Regras de segurança do combate

- Cada migração de Move prova **equivalência**: mesma simulação (mesmo estado final por seed) antes e depois.
- O editor **não altera** a simulação enquanto roda: cada execução captura os parâmetros na criação (contrato já existente: "sliders só valem nos próximos usos").
- Nenhuma fase apaga o fluxo atual até a seguinte estar aprovada por você.

## Decisões que preciso de você

1. **Onde o editor abre por padrão:** painel acoplado no jogo, ou janela separada?
2. **Quantos slots equipados** existem e como o jogo já os representa (aba "Ações → Moves")?
3. **Parâmetros visuais dos Moves fora do atelier** (Water Pulse, Fire Spin, Air Slash, Seed Bomb…): migrar para o mesmo `move.json` ou manter como estão na fase 5?
4. **Aplicativo de verdade (Tauri/Electron)** ou continuar no navegador? Recomendo navegador até a fase 6.

## Possibilidades consideradas (e o que cada uma muda no plano)

### Tipos de Move que o editor precisa cobrir
- **Corpo a corpo** (Tackle, Bullet Punch, Quick Attack, Lunge): hitbox ligada ao corpo, animação do personagem e root motion. Editor mostra a trajetória do corpo.
- **Projétil** (Water Pulse, Fire Spin, Air Slash, Seed Bomb, Psyshock): trajetória, velocidade, colisão com cenário, ricochete. Editor desenha o caminho previsto.
- **Campo/zona** (Sand Wave, Emerging Stone, Spikes): área no chão que persiste. Editor mostra a área e o tempo de vida.
- **Status/buff** (Harden, Second Wind, Reflect): sem alvo; o resultado é um efeito sobre o executor. Editor mostra o estado antes/depois.
- **Charge e Burst** (carga com PL1–PL3): níveis de carga. Editor tem seletor de nível e simula segurar/soltar.
- **Truque** (Feint, Riposte, Guard Break): depende da reação do alvo. Editor tem o alvo com comportamento programável.
- **Move composto** (sequência de dois ou mais): o editor edita a sequência como lista de etapas.

### Situações de teste que o palco deve reproduzir
Alvo parado, andando, em guarda, esquivando, no ar, perto de parede/borda/plataforma, em hit-stun, sem stamina, com cooldown; executor no ar, em movimento, sobre plataforma, com vida baixa; dois Moves em colisão (clash); alvo atrás do executor; alvo de outro tamanho/personagem.

### Alternativas de arquitetura avaliadas
| Opção | Prós | Contras | Decisão |
|---|---|---|---|
| Editor como aba do jogo atual | Rápido, reaproveita tudo | Mistura edição com partida | Fase 2 (acoplado) |
| Janela separada (mesmo HTML, 2ª aba) | Dois monitores, sem poluir o jogo | Precisa sincronizar estado | Fase 6, via `BroadcastChannel` |
| Aplicativo (Tauri/Electron) | Arquivos nativos, sem `file://` | Instalação, manutenção | Só depois da fase 6 |
| Editor como página independente do jogo | Isolamento total | Duplica a simulação | Descartado: o objetivo é rodar o `World` real |
| Código-fonte editável no editor | Poder total | Risco de quebrar o combate | Descartado: só dados; lógica fica em arquivo |

### Riscos e como o plano os trata
- **Parâmetro mecânico muda o equilíbrio sem querer:** todo valor alterado mostra o impacto numérico e o comparativo com o aprovado antes de salvar.
- **Visual e mecânica saem de sincronia:** a duração do visual é derivada das fases da mecânica, não digitada duas vezes.
- **Perda de trabalho:** autosave em rascunho separado do aprovado; nunca sobrescreve o aprovado sem "Aprovar".
- **Dois agentes ou duas pessoas editando o mesmo Move:** cada rascunho tem autor e data; aprovar exige resolver diferenças.
- **Desempenho:** o editor roda no mesmo laço do jogo; se um Move custar caro, o painel mostra o tempo por quadro.
- **Moves antigos sem `move.json`:** carregador de compatibilidade lê o `.params.js` até a migração.
- **Acessibilidade:** respeita "Sem flash" e "Movimento reduzido" também no editor.
- **Offline:** nenhuma dependência externa em tempo de execução; vale também com o arquivo aberto por duplo clique.

## 30 melhorias de qualidade de vida (QoL)

**Edição**
1. **Desfazer/refazer ilimitado** (Ctrl+Z / Ctrl+Y) por Move, com histórico visível.
2. **Reverter por slider** (duplo clique volta ao aprovado) e **reverter tudo**.
3. **Valor digitável** ao lado de cada slider, com unidade e setas de ajuste fino (Shift = 10×, Alt = 0,1×).
4. **Busca de parâmetro** (Ctrl+K) que salta direto ao slider, vindo do nome ou da dica.
5. **Mostrar só o que mudou** (filtro "alterados") com contagem no cabeçalho.
6. **Bloquear slider** (cadeado) para não mexer sem querer enquanto ajusta os vizinhos.
7. **Sliders ligados** (ex.: largura e altura juntas, proporção travada) e **fórmulas** simples entre campos.
8. **Presets nomeados por Move** (rápido, pesado, defensivo) com troca em um clique e exportação.

**Execução e teste**
9. **Repetir em laço** com intervalo configurável; muda um slider e o play recomeça sozinho.
10. **Câmera lenta e passo a passo** com quadro atual e tempo na tela.
11. **Reiniciar com a mesma semente** para comparar duas versões do mesmo golpe.
12. **Fantasma do aprovado:** o Move aprovado roda ao lado, em transparência, para comparar.
13. **Gravar e reproduzir** uma execução (replay) e salvar como caso de teste.
14. **Bonecos de teste prontos:** parado, em guarda, esquivando, andando, no ar, com stamina zerada — um clique.
15. **Arrastar o alvo e o executor** no palco com o mouse; posições salvas por Move.
16. **Cenários de cenário:** parede, borda, plataforma, pilar, com atalho para cada.
17. **Rodar contra a IA** por 10 s e ver quando ela usa o Move.

**Informação**
18. **Linha do tempo clicável** (arrastar o cursor leva o play até aquele instante).
19. **Hitbox, alcance, área e janela de dano desenhados** sobre a cena, ligáveis por tecla.
20. **Painel de números:** dano real, alcance real, duração total, custo, janela de punição, DPS.
21. **Comparar duas versões** (A × B) lado a lado, com tabela de diferenças.
22. **Avisos automáticos** quando um valor sai da faixa de equilíbrio (ex.: dano acima da média da categoria).
23. **Dica de cada slider com exemplo** ("2,5 s = o alvo consegue se esquivar") e **mapa de dependência** ("este valor afeta: visual, IA, custo").

**Vitrine e fluxo**
24. **Marcar favoritos** e **recentes** na aba Moves; o último editado aparece em destaque.
25. **Equipar por arrastar** e **trocar de slot** sem sair da vitrine.
26. **Pré-visualização ao passar o mouse** sobre o botão do Move (loop curto de 2 s).
27. **Selo de estado em cada botão:** proposto, aprovado, implementado, homologado, com alterações não salvas.
28. **Atalhos de teclado** completos (`E` abre, `Espaço` executa, `R` reinicia, `1–9` troca de Move, `Esc` fecha) e **tela de ajuda** com a lista.

**Segurança e conforto**
29. **Autosave com rascunho** e recuperação depois de fechar sem querer; aviso claro de "rascunho × aprovado".
30. **Exportar relatório do Move** (parâmetros, números, captura de tela e clipe curto) para colar em conversa ou documentação, com link no portal.

## Extras que entram se sobrar fôlego
Modo escuro/claro, painel redimensionável e lembrado, janela destacável por painel, importar parâmetros de outro Move ("copiar do Water Pulse"), histórico de versões aprovadas com data e quem aprovou, e modo apresentação (esconde painéis, só o play).

## Andamento

- **Fase 1 (Move como dado)** — `src/sim/moves/move-data.js` + `sand-wave.move.json`: definição, sliders de mecânica e referência ao visual aprovado num arquivo só. Teste: `test/move-data.test.mjs`.
- **Fase 2 (editor mínimo)** — botão **🛠 Editor** na barra superior (ao lado de «🎬 Cine»). Abre a gaveta com: palco (Move, distância do alvo, alvo parado/defendendo, velocidade, repetir em laço), **▶ Executar** (roda o Move de verdade no `World` da partida e mostra dano, cegueira, custo e recarga), sliders de **mecânica** (Ctrl+Z desfaz, ↺ volta ao padrão) e de **visual** (parâmetros aprovados do atelier, valem na sessão), e **Copiar move.json / Copiar visual** para guardar. Código em `src/editor/` (modelo sem interface + painel). Testes: `test/move-editor.test.mjs` (modelo, sem navegador) e `test/move-editor.browser.mjs` (16 verificações no navegador). Evidência: `evidence/editor/editor-sand-wave.png`.
- **Fase 5 (migração dos Moves) — feita para os 17 Moves com ficha de parâmetros**: air-slash, bounce, bullet-punch, emerging-stone, feint, fire-spin, guard-break, harden, lunge, quick-attack, riposte, sand-wave, second-wind, seed-bomb, spikes, swift e water-pulse. Cada um migrou sozinho (`scripts/migrar-move.mjs <id>`) com **prova de equivalência** (retrato de definição, sliders, padrões de `C.world`, Move efetivo e chaves da ficha idêntico antes e depois) e um commit por Move. O índice `moves/params.generated.js` exporta `MOVES_DATA`, de onde o editor lista os Moves: **migrar um Move novo basta para ele aparecer no editor**. Reflect e Psyshock (sem grupo em `C.world`) continuam em código.
- **Editor com todos os 17 Moves**: palco genérico (golpe, projétil, campo, buff, carga e mira por marcador), controle «Segurar o botão» para carga/mira, resumo com acerto, dano, cegueira, status no alvo e no azul, entidades criadas, falha com motivo, custo e recarga.
- **Fase 3 (análise)** — seção «Análise» do editor, sempre atualizada (ao mudar slider, alvo, distância ou segurar o botão):
  - **Linha do tempo** em faixas: azul ocupado (ação, mira ou carga), efeito no mundo (uma faixa por tipo de entidade), status no alvo/azul, e uma faixa com os **acertos (◆)** e o aperto do botão (▼). **Clique** numa faixa ou num ◆ para pausar o replay naquele instante (precisa ter executado o Move uma vez com ▶).
  - **Resultado numérico**: tempo até o efeito e até o primeiro acerto, acertos, dano total, dano por stamina, dano por segundo de efeito, duração do efeito, tempo do azul ocupado, custo e recarga.
  - **A × B**: A = padrão do Move (move.json) ou **«Fixar A = valores atuais»**; B = valores atuais dos sliders. A tabela mostra Δ com cor (verde = B melhora, vermelho = B piora; é só uma dica) e a linha do tempo desenha A e B lado a lado.
  - Código: `src/editor/move-trace.js` (rastreio e comparação, sem interface). Testes: `test/move-trace.test.mjs` (11 verificações, 17 Moves) e 5 verificações novas em `test/move-editor.browser.mjs` (27 no total). Evidência: `evidence/editor/editor-analise-ab.png`.
- **Fase 4 (vitrine)** — a aba **Moves** da barra esquerda deixou de ser uma parede de sliders e virou **vitrine**:
  - **Equipados (em destaque)**: um cartão por slot, com o botão do jogo (A, S, D, F…), nome, categoria (Burst/Normal/Charge), tipos, PL, selo de governança (proposto, implementado, aprovado, homologado), custo e recarga atuais. Slots vazios têm «+ Equipar um Move…». «✕» tira o Move do slot.
  - **Não equipados**: os demais Moves, com «Equipar…» (escolhe o slot; ocupado = troca). Seletor **Azul | Vermelho** para os dois lutadores. A vitrine acompanha mudanças de loadout feitas pela gaveta Ações ou pela Seleção Rápida.
  - **Clicar num cartão abre o Editor de Moves naquele Move** (equipado ou não). Reflect e Psyshock (ainda em código; selo «em código») abrem o painel antigo.
  - O **painel antigo** (sliders de todos os Moves, testes, IA) continua disponível, **recolhido**, logo abaixo da vitrine; some quando Reflect e Psyshock forem migrados. Código: `src/editor/move-showcase-model.js` (puro) e `move-showcase.js` (interface). Testes: `test/move-showcase.test.mjs` (7) e `test/move-showcase.browser.mjs` (19). Evidência: `evidence/editor/vitrine-moves.png`.
- **Reflect e Psyshock migrados** (`reflect.move.json`, `psyshock.move.json`) com **prova de equivalência** (definição, padrões de `C.world`, as linhas de sliders com rótulo/faixa/«aprovado», Move efetivo e ordem do registro idênticos): os rótulos e as faixas que viviam numa tabela de `ui/moves-panel.js` e os padrões que viviam em `config.js` passaram para o JSON. Os dois são fichas, mas **não** entram em `NEW_MOVES` (o `standard.js` os registra e a IA os trata à parte). Script: `scripts/migrar-reflect-psyshock.mjs`. Com isso **todos os Moves (19) estão em dado e no Editor**.
- **Painel antigo desmontado**: a aba Moves não tem mais cartões de sliders por Move. O que eles faziam foi para o Editor de Moves: **mecânica** (com os mesmos limites efetivos e o selo aprovado/provisório), **Efeitos do jogo (VFX)** (a antiga aba «Visual»), **ficha do Move** (linha do tempo da ficha em ticks, «Medir no motor» e comparação A/B com o padrão de fábrica), **▶ Disparar no jogo** e **⚔ Equipar e animações** (abre a gaveta Ações no Move). Os atalhos «parâmetros» da gaveta Ações abrem o Editor.
  - Na aba Moves ficou só **«Ajustes compartilhados e ferramentas de teste»** (recolhido): carga compartilhada, estilo global dos efeitos, emissores técnicos, laser, cenários técnicos, avaliação jogável e exportar parâmetros — nada disso é de um Move só.
  - Abrir a gaveta Ações, Personagens ou o Editor fecha as outras (ocupam o mesmo lugar).
  - Defeito da fase 2 corrigido: os sliders de mecânica do Editor usavam os limites do `move.json`, não os **efetivos** (limites ampliados de 22/10 e knockback até 15) que o painel antigo oferecia; agora usam os efetivos. Ajustes puramente visuais (`isVisualWorldParam`) e o tremor de hit ficam na seção de VFX.
- **Limites atuais:** a IA (`ficha.ai`) e a lógica dos efeitos seguem em código; o visual do atelier só está ligado a Sand Wave, Emerging Stone e Swift; não há gravação direta no disco (copiar o JSON e colar no arquivo); pendentes do plano: fases 6 e 7 (janela separada, atalhos, gerador de Move completo) e os QoLs.
