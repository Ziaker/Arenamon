# Plano: Editor de Moves (janela única que dá play no Move)

Status: **plano, nada implementado**. Escrito em 24/10/2026.

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
