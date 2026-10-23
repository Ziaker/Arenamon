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
| `src/ui/menu-preview.js` (modificado) | Expõe `scene`, `resize`, `onTick`, `modelHeight`; comportamento do menu atual intacto. |
| `src/ui/input.js` (modificado, 1 linha) | Teclas do combate não valem com o foco dentro do menu estilizado (senão a tecla «roubava» o foco para a arena: nada de navegação por teclado). |
| `src/menu-styles.css` + `build-lib.mjs` | CSS das três telas, concatenado ao mesmo `<style>` do build. |
| `src/template.html`, `src/main.js` | Contêiner `#menu-styled` e ligação (`menuStyles`, exposto em `window.__lab`). |
| `prototypes/hud-moves/` | **Não foi alterado.** Só o conjunto de ícones (`data.js`) é importado. |

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

## Comportamento
- **Lutadores:** chips de personagem (carregado + salvos no workspace); sem salvos há aviso; sem modelo a prévia mostra «Prévia 3D indisponível»; sem WebGL o canvas some e o menu segue funcional.
- **Moves (4 slots):** clique num slot para «armá-lo» e depois na carta (o Move muda de lugar); sem slot armado a carta vai ao primeiro slot livre; clicar numa carta equipada a desequipa; ✕ esvazia. Duplicata no mesmo lutador é impossível (o slot antigo esvazia); id inválido é recusado.
- **Passivas (2):** exclusivas da espécie primeiro, depois genéricas; sem duplicata; a mais antiga cede se não houver espaço; status de validade com o texto real do motor; detalhe mostra gatilho, efeito, origem e «experimental».
- **Teclado:** Tab/Shift+Tab, setas nas listas de cartas e no seletor de estilo, Enter/Espaço ativam; foco com contorno visível. **Decisão de integração com atalhos:** com o foco dentro do menu estilizado as teclas do combate não valem (uma linha em `input.js`); fora dele nada muda.
- **Movimento reduzido:** `prefers-reduced-motion` (e o «reduzir movimento» do laboratório) desligam animações CSS, rotações e as rajadas three.quarks; a seleção continua legível por forma, cor e texto.
- **three.quarks:** ao trocar personagem/Move/passiva (e ao trocar de estilo) nasce uma rajada curta no modelo: A faíscas vermelho/amarelo, B estrelas ciano/amarelo/magenta, C partículas suaves verde-água/azul (`ui/menu-fx.js`, presets `menuA/B/C`).

## Testes e evidências
`test/prejogo.test.mjs` (Node, catálogo/regras) e `test/prejogo.browser.mjs` (Edge real, offline: 40 verificações — registro × candidatos, estado único, A→B→C→A sem perder nada, partida com o loadout visível, voltar ao menu, teclado, movimento reduzido, sem modelo, sem WebGL, 1280×720, 1920×1080 e viewport reduzida). Capturas: `prototypes/combat-lab/evidence/prejogo/` (`pre-jogo-{A,B,C}-{1280x720,1920x1080}.png`, `fidelidade-{A,B,C}-original-x-novo.png`).

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
