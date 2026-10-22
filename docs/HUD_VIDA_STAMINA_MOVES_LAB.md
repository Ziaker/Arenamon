# Laboratório visual — HUD de vida, stamina e 4 moves (propostas)

> **Status: três alternativas visuais NÃO aprovadas.** Serve só para avaliação. Nenhuma regra, GDD, mecânica ou o HUD
> oficial do jogo foi alterado, e nenhuma proposta foi escolhida pela IA.

**Abrir:** `prototypes/hud-moves/dist/hud-moves-laboratorio.html` (duplo clique; HTML único, offline, funciona por `file://`).
Também pelo portal `ABRIR_ARENAMON.html` › Jogo Principal › **🎛️ Laboratório HUD de Vida, Stamina & Moves** e por `HTMLS_ARENAMON.html`.

**Código:** `prototypes/hud-moves/src/` · **Build:** `npm run build:hud-moves` · **Teste de navegador:** `npm run test:hud-moves` ·
**Evidências:** `prototypes/hud-moves/evidence/` (cada HUD nos 4 cenários em 720p, 1080p, câmera rente ao chão e fundo claro).

## O que é

Uma arena 3D de contexto (piso circular, anel de blocos e dois lutadores geométricos, jogador azul × adversário vermelho)
com **três HUDs alternáveis em tempo real** para a mesma informação: vida e stamina dos dois lutadores e os 4 slots de moves
do jogador. Trocar de HUD (teclas 1–3) não reinicia nada: o estado dos valores e dos moves é um só.

Não implementa combate, stamina nem cooldown reais. As escalas espelham o jogo (HP 0–100, stamina base 3 pontos, teclas
padrão A, S, 3, 4 dos slots), e os estados dos slots seguem `sim/move-state.js` (pronto, carregando, recarga, bloqueado).
Os nomes dos moves são editáveis (sugestões do catálogo real); a duração de recarga exibida é fictícia (6 s = 100%).

## As três propostas

| | A · Impacto | B · Quadrinhos | C · Clássico |
|---|---|---|---|
| Direção | urbana, angular, agressiva; vermelho/preto/branco; tipografia pesada itálica | página de quadrinhos: painéis, contorno grosso, halftone, balões e onomatopeias | limpo, sólido, profissional; vidro escuro, azul/verde-água |
| Jogador | placa grande embaixo à esquerda | painel no alto à esquerda, balão com o nome | barra centrada no alto, à esquerda do "VS" |
| Adversário | placa menor no alto à direita | painel no alto à direita, mais compacto | barra espelhada no alto, à direita do "VS" |
| Vida | placa preta rasgada, fill branco de ponta cortada, número enorme; crítico = vermelho pulsando | barra segmentada de 10 com número numa explosão; crítico = painel treme e "CRASH!/CRACK!" | barra arredondada verde → âmbar → vermelho, "64 / 100" |
| Stamina | três lâminas amarelas paralelas + valor | três bolinhas de tinta que enchem de baixo para cima ("FÔLEGO") | três segmentos finos verde-água + valor |
| Moves | cascata de 4 cartas diagonais à direita | página 2×2 irregular embaixo à esquerda | barra de 4 slots quadrados embaixo ao centro |
| Recarga | preenchimento vermelho + segundos | halftone cinza que encolhe + etiqueta de segundos | varredura radial escura + segundos |
| Carga | carta amarela com preenchimento subindo e tremendo; % | linhas de velocidade rosa, enchimento ciano e "CARREGA!!" | anel dourado que fecha + enchimento; % |
| Bloqueado | carta cinza hachurada, nome riscado | fita de perigo e "NÃO!" | cadeado, ícone apagado, nome riscado |
| Sem stamina | listras amarelas e "SEM ST", custo pisca | fundo azul-claro, "ZZZ" e "SEM FÔLEGO" | borda vermelha, hachura e "Precisa N ST" |
| Selecionado | carta avança, sombra vermelha e seta | borda dupla vermelha e "ZAP!" | slot sobe e ganha contorno branco |

Todas dizem o estado com **texto, forma e cor** (não dependem só de cor). A escala do HUD é ajustável (60–150%) e há ajuste
automático para telas maiores. Originalidade: nenhum asset, ícone, logotipo ou layout de terceiros; os 10 ícones são
caminhos SVG próprios.

## Estados dos moves

`Pronto`, `Em recarga`, `Carregando`, `Bloqueado/indisponível` e `Sem stamina` (mais `Selecionado`, que é uma camada à parte).
Regra derivada: um move marcado como *Pronto* cujo custo de stamina é maior que a stamina atual do jogador aparece como
*Sem stamina* nos três HUDs. *Bloqueado* e *Sem stamina* são visualmente distintos.

## Controles

Barra superior: HUD A/B/C (1–3), cenários (4–7), Animar recarga/carga (N), Ocultar HUD (H), Controles (P).
Gaveta **Controles**: cenários e "Resetar para o padrão"; sliders de HP e stamina dos dois lutadores; para cada um dos 4 moves
nome (com sugestões), tecla, ícone, estado, recarga restante, carga, custo de stamina e "selecionado"; mostrar/ocultar HUD e
escala; fundo da arena (escuro, claro, quente), lutadores em movimento e câmeras (Inicial, Frente, Lado, Cima, Rente ao chão,
Longe; R volta à inicial). Câmera livre: arrastar gira, roda dá zoom, botão direito move.

Cenários: **Neutro** (tudo cheio, moves prontos) · **Combate avançado** (HP/stamina parciais, dois moves em recarga) ·
**Situação crítica** (HP 14, stamina 0,25, um bloqueado e outro sem stamina) · **Carga / especial** (um carregando, um pronto,
um em recarga, um indisponível).

## Isolamento

Não importa nada de `prototypes/combat-lab`, não altera o HUD oficial, física, câmera do jogo, regras nem o Animation Studio.
Usa só `three` (empacotado no HTML); sem CDN nem servidor.

## Pendências

Escolher (ou combinar) uma direção; só então decidir como portar para o jogo (não autorizado aqui). Medição de desempenho em
GPU real não feita (a verificação usa WebGL por software).
