# Pré-jogo em três identidades visuais — A Impacto · B Quadrinhos · C Clássico (v1.21.0)

Ordem do diretor: `ARENAMON_PROMPT_CLAUDE_PRE_JOGO_3_ESTILOS.docx` (22/10/2026). **Nenhuma das três telas é a oficial**; o padrão do menu continua sendo «Atual». Verificação técnica; a aprovação visual e de sensação é do diretor.

**Como abrir:** `JOGAR_ARENAMON.html` → na tela inicial (Seleção Rápida) use o seletor **Estilo: Atual · A · B · C**. Capturas e comparações: `prototypes/combat-lab/evidence/prejogo/README.md` (link no portal `ABRIR_ARENAMON.html`).

## O que é (e o que não é)
- **É** uma camada de visão sobre o menu REAL (`#menu` → `quickMenu` → `applyAll()` → `startMatch()`), com UM estado (`quickMenu.state`): a troca de estilo só redesenha; não chama `game.reset()`, não inicia partida, não guarda loadout por tema (só a preferência de estilo, em `localStorage`).
- **Dados reais:** Moves = `listMoves()` do registro executável (15 hoje); descrição e uso = texto do painel de Moves + custo/recarga do Move efetivo; passivas = `genericPassives()`/`exclusivePassives()`/`validateLoadout()`; personagens = modelos salvos no workspace + o carregado; prévia 3D = o `createMenuPreview` existente (mesmos canvases, reparentados).
- **«Equipamentos»:** auditado — o projeto **não tem inventário nem itens equipáveis**. Em `docs/PASSIVAS_DECISOES.md` (Rodada 5) «equipamento» são os **dois espaços de passivas**. Interpretação adotada: **equipamentos = o loadout (4 Moves + 2 passivas)**. Nada foi inventado. Se o diretor queria acessórios/itens, é decisão nova (ver Pendências).

## Arquivos
| Arquivo | Papel |
|---|---|
| `src/ui/menu-quick.js` (modificado) | Mesma fonte de estado; ganhou `setMove`, `setPassive`, `selectCharacter`, `characters`, `speciesOf`, `onChange`, `previews`; os `<select>` atuais passam pelos MESMOS setters. Corrigido de passagem: sem espécie identificada as passivas genéricas apareciam **duas vezes** na lista. |
| `src/ui/menu-styles-model.js` (novo) | Cartas de Moves/passivas a partir dos catálogos reais (funções puras, testadas em Node). |
| `src/ui/menu-styles.js` (novo) | As três telas: HTML, cliques, teclado, detalhe, reparentar prévias, preferência de estilo. |
| `src/ui/menu-fx.js` (novo) | Feedback de seleção com **three.quarks** (`QuarksFx` na cena de cada prévia), três presets próprios. |
| `src/ui/menu-preview.js` (modificado) | Expõe `scene`, `resize`, `onTick`, `modelHeight`, `setTint`/`tint`; materiais próprios da prévia (copiados do GLB) para a cor da prévia não vazar no jogo nem no outro lutador. |
| `src/view/character-colors.js` (novo) | Paleta do lutador (`auto`, azul, vermelho, amarelo, roxo), regra da automática e a mistura de cor usada pela prévia e pelo jogo. |
| `src/view/characters.js` (modificado) | `Character.setTint(hex|null)`: clona o material na primeira aplicação e guarda a cor original em `userData.baseColor`; `null` restaura. |
| `src/ui/input.js` (modificado, 1 linha) | Teclas do combate não valem com o foco dentro do menu estilizado (senão a tecla «roubava» o foco para a arena: nada de navegação por teclado). |
| `src/menu-styles.css` + `build-lib.mjs` | CSS das três telas, concatenado ao mesmo `<style>` do build. |
| `src/template.html`, `src/main.js` | Contêiner `#menu-styled` e ligação (`menuStyles`, exposto em `window.__lab`). |
| `prototypes/hud-moves/` | **Não foi alterado.** Só o conjunto de ícones (`data.js`) é importado. |
| `src/ui/fighter-identity.js` (novo) | Identidade única (cor, rótulo e símbolo) usada pelo HUD da arena, pelos cabeçalhos do menu e pelo indicador de recarga acelerada. |
| `src/ui/boost-feedback.js` (novo) | Lê o evento `cooldownBoost` e dispara a faixa `#boost-flash`, o flash do slot e o anel no chão. |
| `src/view/boost-ring.js` (novo) | Duas ondas de anel no chão, na cor do lutador, com pool fixo de 8 malhas. |

## Cor do lutador no HUD da arena (itens 1 e 4)
A cor escolhida no pré-jogo agora vale também **dentro da partida**, não só na prévia:

- `hud.js` escreve o nome (`JOGADOR · ROXO`, `ADVERSÁRIO · AMARELO`), `data-glyph`, `data-slot` e `--fc` em cada cartão. Vida e stamina continuam com as cores semânticas; a cor do lutador pinta nome, borda, brilho, medidores e o rótulo dos slots de Move.
- **Pista sem cor:** o jogador usa `◆` e o adversário `●`, e o fundo do cartão difere (lavagem sólida × hachura diagonal). Quem não distingue cor (daltonismo, captura em preto e branco) continua identificando os dois lados.
- `menu-quick.js` passou a sincronizar o cabeçalho do menu (`◆ Lutador Roxo`, `● Adversário Amarelo`) pela mesma fonte, em vez do texto fixo "Lutador Azul"/"Adversário Vermelho".
- Sem tingimento (`Automática` sem conflito de modelos) o nome fica só `JOGADOR`/`ADVERSÁRIO` e o cartão usa o azul/vermelho padrão de cada lado.

## Indicador de recarga acelerada (`cooldownBoost`)
Apertar de novo o botão de um Move **em recarga** gasta stamina e encurta o cooldown (`sim/charge.js` → `boostPlan`, `ctrl-moves.js` → `boostCooldown`). O motor já emitia `cooldownBoost {attacker, move, slot, reduced, cost}`, mas a tela não mostrava nada. Agora, a cada evento novo:

1. **Faixa `#boost-flash`** (abaixo do HUD, no lado do lutador): kicker `RECARGA ACELERADA`, `+0,85 s` grande, `−2,15 ST` e `JOGADOR · ROXO · NOME DO MOVE`, com pop, anel de contorno e brilho na cor do lutador.
2. **Slot do Move** (`moves-hud.js`): o cartão dá um soco (escala 1,15), ganha borda/brilho na cor do lutador e uma varredura de luz (`data-boost="1"`, ~0,7 s).
3. **Anel no chão** (`view/boost-ring.js`): duas ondas concêntricas na posição do lutador, na cor dele.

Detalhes: o `BoostFeedback` deduplica por identidade do objeto (WeakSet), só dispara com a partida **ao vivo** (`live`) e marca os eventos mesmo pausado — voltar no replay não repete o flash. Não altera a simulação nem o despachante de VFX. Com `prefers-reduced-motion`, a faixa encurta, o anel de contorno some e o slot troca a animação por um contorno estático. Sem cor escolhida, a faixa usa dourado (`#ffd23f`).

## Matriz de correspondência (componente novo → original → alteração justificada)
Fonte dos originais: `prototypes/hud-moves/src/css/hud-a.css`, `hud-b.css`, `hud-c.css`.

### A · Impacto (`hud-a.css`)
| Novo (`menu-styles.css`) | Original | Alteração |
|---|---|---|
| tokens `--ink #0a0a0f --paper #f8f5ee --red #ff2b3f --red2 #b8001a --yel #ffd400`, Impact itálico | `.hA` | nenhuma |
| `.qs-title` (nome do lutador) | `.a-name span` (placa clara/escura chanfrada, tira vermelha) | cores invertidas (papel sobre painel preto) para ler no painel escuro do menu |
| `.qs-species` | `.a-tags` (amarelo sobre preto, `skewX(-14deg)`) | nenhuma |
| `.qs-fighter` (painel) | `.a-hp` (preto, borda papel, recorte, sombra dura vermelha, riscas diagonais) | recorte nos 4 cantos (painel grande) |
| `.qs-slot-main` / `.qs-card` | `.a-face` (papel, recorte `polygon(22px…)`, tira vermelha 8 px) | recorte 14 px e tira 5 px (cartas menores) |
| `.qs-key` | `.a-key` (bloco preto, traço vermelho no texto) | tamanho |
| slot vazio | `.a-card[data-state="recarga"]` (cartela escura) | reuso do estado escuro para «vazio» |
| slot em foco | `.a-card.sel` (desloca, escala, sombra vermelha, seta) | deslocamento 6 px (grade, não cascata) |
| carta ao passar o mouse | `.a-card[data-state="pronto"]` (brilho `aGlint`) | só no hover/foco |
| `.qs-status` | `.a-badge` + `aPulse` em passos | nenhuma |
### B · Quadrinhos (`hud-b.css`)
| Novo | Original | Alteração |
|---|---|---|
| tokens `--paper #fff4d6 --ink #15110f --red #ff3b30 --yel #ffd60a --cy #19b5e8 --mg #ff4fa3`, halftone `--dots` | `.hB` | nenhuma |
| `.qs-fighter` | `.b-panel` (borda 4 px, sombra 7 px, canto halftone amarelo/ciano) | inclinação ±0,7° (original ±1,2°) |
| `.qs-title` | `.b-balloon` (balão com rabicho) | nenhuma |
| `.qs-slot-main` / `.qs-card` | `.b-box` (papel + halftone, borda 4 px, sombra 6 px) | sombra 4 px |
| `.qs-key` | `.b-key` (etiqueta girada, contorno duplo) | tamanho |
| `.qs-ico` | `.b-ico` (círculo amarelo, borda, sombra) | tamanho |
| slot em foco | `.b-mv.sel` (escala 1,07, borda 6 px, contorno vermelho) | nenhuma |
| carta equipada | `.b-tag` (selo girado) | selo com ✓ |
| caixa de detalhe | balão de fala (`b-balloon`) | usado para o texto de descrição |
### C · Clássico (`hud-c.css`)
| Novo | Original | Alteração |
|---|---|---|
| tokens `--glass rgba(14,20,33,.84) --edge --acc #5aa9ff --st #2dd4bf --ok --warn --bad`, Segoe UI | `.hC` | nenhuma |
| `.qs-fighter` | `.c-fighter` (vidro, borda suave, raio 10, `blur(6px)`) | nenhuma |
| `.qs-species` | `.c-tag` (pílula amarela) | nenhuma |
| `.qs-slot-main` / `.qs-card` | `.c-sq` (gradiente `160deg #26324a→#172033`, borda 2 px, raio 14) | formato retangular (cartas largas) |
| slot ocupado | `.c-slot[data-state="pronto"]` (borda azul + brilho) | nenhuma |
| slot vazio | `.c-slot[data-state="bloqueado"]` | reuso para «vazio» |
| slot em foco | `.c-slot.sel` (sobe 6 px, anel branco) | sobe 3 px |
| `.qs-key` | `.c-key` | nenhuma |

**Desvios relevantes (mostrados, não escondidos):** (1) os originais são HUDs de combate sobre a arena; aqui o mesmo vocabulário é aplicado a um menu de seleção, então cartas viram grade de candidatos e slots viram botões; (2) o painel do A usa recortes nos quatro cantos; (3) tamanhos de fonte/ícone menores nas cartas. Não há asset de terceiros nem fonte proprietária.

## Cores por classe (pedido do diretor, 23/10/2026)
Cada carta/slot tem a cor da sua **classe**, derivada dos dados reais (`menu-styles-model.js`): **Moves** = Charge (segura e solta), Destino (marcador no mundo), Burst, Normal (etiqueta «Burst/Normal» da descrição); **passivas** = a categoria real do catálogo, Permanente ou Gatilho (e o selo EXCL./GEN. mostra a origem). **Não existe «elemento» (tipo Pokémon) nos dados dos Moves**; se o diretor quiser cores por elemento, é preciso definir esse dado antes. Paleta de cada estilo, dentro da identidade do respectivo HUD:
| Classe | A Impacto | B Quadrinhos | C Clássico |
|---|---|---|---|
| Normal | vermelho `#ff2b3f` | amarelo `#ffd60a` | azul `#5aa9ff` |
| Burst | amarelo `#ffd400` | vermelho `#ff3b30` | âmbar `#fbbf24` |
| Charge | laranja `#ff7a1a` | magenta `#ff4fa3` | violeta `#a78bfa` |
| Destino | ciano `#19c8ff` | ciano `#19b5e8` | verde-água `#2dd4bf` |
| Passiva Permanente | ciano | ciano | verde `#4ade80` |
| Passiva Gatilho | amarelo | vermelho | âmbar |
Uma legenda de cores aparece acima de cada lista. A moldura do estilo (painéis, nomes) mantém a cor-assinatura do HUD.

## Cor do lutador (pedido do diretor, 28/10/2026)
O menu atual (select **Cor** abaixo de Personagem) e as três telas (botões com bolinha de cor) oferecem **Automática**, **Azul**, **Vermelho**, **Amarelo** e **Roxo**. A escolha vale para a **prévia 3D e para o personagem da partida** (`Character.setTint`), inclusive em modelos sem textura; a cor é aplicada ao `color` de cada material, preservando o sombreado/brilho.
- **Automática** mantém o comportamento antigo: com **modelos diferentes** ninguém é tingido; com o **mesmo modelo** nos dois espaços, o segundo lutador fica **vermelho**. Se o primeiro já escolheu vermelho, a automática do segundo usa azul para os dois nunca ficarem iguais.
- **Escolha explícita** vence a automática e é gravada no workspace junto do loadout (`collect`/`apply`), então volta ao reabrir o laboratório e é reaplicada em `applyAll()` antes de `startMatch()`.
- **Materiais separados:** cada lutador (e a prévia) passa a ter os próprios materiais na primeira coloração; tingir um **não** tinge o outro mesmo quando os dois usam o mesmo GLB. `setTint(null)` devolve a cor original do modelo.
- **Força da cor:** modelos com textura recebem mistura mais discreta (60%); sem textura a cor domina (88%), para azul/vermelho/amarelo/roxo lerem de longe na arena.

## Comportamento
- **Lutadores:** chips de personagem (carregado + salvos no workspace); sem salvos há aviso; sem modelo a prévia mostra «Prévia 3D indisponível»; sem WebGL o canvas some e o menu segue funcional.
- **Moves (4 slots):** clique num slot para «armá-lo» e depois na carta (o Move muda de lugar); sem slot armado a carta vai ao primeiro slot livre; clicar numa carta equipada a desequipa; ✕ esvazia. Duplicata no mesmo lutador é impossível (o slot antigo esvazia); id inválido é recusado.
- **Passivas (2):** exclusivas da espécie primeiro, depois genéricas; sem duplicata; a mais antiga cede se não houver espaço; status de validade com o texto real do motor; detalhe mostra gatilho, efeito, origem e «experimental».
- **Teclado:** Tab/Shift+Tab, setas nas listas de cartas e no seletor de estilo, Enter/Espaço ativam; foco com contorno visível. **Decisão de integração com atalhos:** com o foco dentro do menu estilizado as teclas do combate não valem (uma linha em `input.js`); fora dele nada muda.
- **Movimento reduzido:** `prefers-reduced-motion` (e o «reduzir movimento» do laboratório) desligam animações CSS, rotações e as rajadas three.quarks; a seleção continua legível por forma, cor e texto.
- **three.quarks:** ao trocar personagem/Move/passiva (e ao trocar de estilo) nasce uma rajada curta no modelo: A faíscas vermelho/amarelo, B estrelas ciano/amarelo/magenta, C partículas suaves verde-água/azul (`ui/menu-fx.js`, presets `menuA/B/C`).

## Testes e evidências
`test/prejogo.test.mjs` (Node, catálogo/regras e as cores de lutador: paleta, regra da automática, mistura) e `test/prejogo.browser.mjs` (Edge real, offline: 43 verificações — registro × candidatos, estado único, A→B→C→A sem perder nada, partida com o loadout visível, voltar ao menu, teclado, movimento reduzido, sem modelo, sem WebGL, 1280×720, 1920×1080 e viewport reduzida). Cores no navegador: `test/character-colors.browser.mjs` (automática vermelha com o mesmo modelo, quatro cores explícitas na prévia e no Character do jogo, materiais não compartilhados, `setTint(null)` restaura e a escolha persiste/volta com `apply`). Capturas: `prototypes/combat-lab/evidence/prejogo/` (`pre-jogo-{A,B,C}-{1280x720,1920x1080}.png`, `fidelidade-{A,B,C}-original-x-novo.png`).

## Defeitos achados no caminho (revisão e testes)
- **Pré-existente e grave — o jogo parava com um modelo sem clipe de «idle»:** com Cogumelo × `drowzee-knockback.glb` (1 clipe) a partida lançava `TypeError` no laço de desenho em ~90% das tentativas (11/12 na build oficial v1.20.1) quando alguém carregava um Move (ex.: Psyshock da IA). Causa: `Character.actionFor` devolvia o texto `'idle'` (e `'tackle'`) como reserva mesmo sem variante, e `enter()` recebia índice indefinido. Corrigido em `view/characters.js`; teste novo em `animation.test.mjs`; confirmado 0/12 na build nova.
- Revisão independente do código (superpowers:requesting-code-review) apontou 16 itens; corrigidos os importantes: `<select>` nativo fora de sincronia com a escolha das telas, chip «Carregado» morto, laço das prévias vulnerável a exceção de gancho, foco do teclado cortado pelo recorte do estilo A, foco perdido ao esvaziar slot, margem herdada de `.card button`, tecla Esc/F2/F3 engolida pelo menu, z-index acima de gavetas, slot «armado» invisível/obsoleto, dica em cache, rajada com o menu oculto, falha ao aplicar estilo sem volta ao menu atual, roving tabindex do seletor.

## Superpowers e «Superskills»
- **Superpowers:** plugin `superpowers@claude-plugins-official` **7.0.0** (`installed_plugins.json`, ref `bb92a77…`), invocado pela ferramenta `Skill`. Usadas de fato: `superpowers:writing-plans` (plano em `docs/superpowers/plans/2026-10-22-prejogo-tres-estilos.md`), `superpowers:executing-plans` (execução nativa, tarefas T1–T6), `superpowers:verification-before-completion` e `superpowers:requesting-code-review` (revisão final, ver relatório).
- **«Superskills»:** **não existe nenhum recurso com esse nome** no ambiente (busca em `~/.claude/plugins`, `settings.json`, `.claude/`, `docs/`, `scripts/`: zero ocorrências). O que existe são as **GameDev Agent Skills** do projeto (`.claude/skills`, roteamento em `arenamon-routing`). Usadas como consulta: `arenamon-routing` (mapa tarefa→skill), `threejs-scene-setup`/`game-feel` (feedback). **Isso não foi tratado como «Superskills».** Se o diretor se referia a outro pacote, é preciso o nome/origem para instalar (sem instalar nada sem autorização).

## Pendências / não verificado
- Aprovação visual das três telas e escolha (ou não) de um estilo: do diretor.
- «Equipamentos» como sistema de itens: não existe; decisão do diretor se for desejado.
- Sem gamepad no menu (inalterado). Zoom do navegador em 200% não foi medido; 960×640 e 1280×720 sim.
- Modelos usados nos testes: `chars/mosh/Cogumelo.glb` e `chars/drowzee/drowzee-knockback.glb`.
