# Patch notes — Laboratório de Combate

Versão atual: **v1.18.3** (22/10/2026). A versão aparece na barra superior do laboratório (tooltip com data de compilação e commit). Para jogar: `JOGAR_ARENAMON.html`.

---

## v1.18.3 — Auditoria de fechamento (22/10/2026)
- **Efeitos no chão passam a aparecer:** o quad dos efeitos de modo «ground» (anéis e ondas rente ao piso, inclusive o anel no chão da variante D e a onda do pouso do pulo) era descartado pelo culling de faces e **nunca aparecia**. Corrigido com `DoubleSide` no material das partículas; a onda do pouso do pulo ficou um pouco mais clara (opacidade 0,8, intensidade 1,4).
- **`npm run typecheck` volta a passar** (32 erros de tipo corrigidos nos 13 Moves novos, `types.d.ts` do `MoveDef` e `getGroundHeight`).
- **`npm test` agora roda tudo:** 12 testes unitários e 3 de navegador que não estavam no script, e 6 testes soltos (janelas de combate, interrupções, física 3D, smear, squash & stretch) foram incluídos; os que dependiam de valores de fábrica foram fixados em `factoryDefaults()`.
- Novo teste de navegador `ui-rodada-22-10` (16 verificações) com capturas em `evidence/ui-22-10/`: botões de IA, atalho da duração da animação, tooltips, Riposte, blocos novos de VFX e os efeitos disparando na arena.
- Riposte no ar (contra-golpe desce e termina no chão) e Emerging Stone no ar agora têm teste.

## v1.18.2 — Pouso do pulo regular e impacto vertical em paredes e objetos (22/10/2026)
- **Pulo regular** (e queda de borda) agora termina só com uma **onda circular simples, sem tremor** e sem a poeira de pouso; o efeito de colisão com o chão fica para knockback, Bounce e Meteor Slam.
- **Impacto vertical** ao bater na **parede da arena** ou em **pilares, caixas, plataformas e destrutíveis**: onda no plano da parede, faixa vertical de luz, faíscas e poeira que sobe, com tamanho vindo do objeto (e da velocidade do choque). Blocos próprios de sliders em Visualizar/Ajustes e um bloco de tremor (desligado por padrão). Detalhes em `docs/VFX_POUSO_E_PAREDES.md`.

## v1.18.1 — Impacto (hit) variante D: remover círculos e mais controles (22/10/2026)
- Em **Visualizar › Impacto (hit) › D · Direcional**: liga/desliga do **núcleo de brilho (círculo central)**, do **anel de pressão**, do **anel no chão**, da **lâmina de luz**, das **fagulhas em risco** e das **faíscas que caem**; sliders de tamanho/expansão/espessura de cada peça, opacidade dos anéis, respingo para trás, tamanho de detritos e de poeira. Padrões iguais aos de antes (nada some sozinho).

## v1.18.0 — Moves no ar (22/10/2026)
- Salto normal, queda de borda e arco do vault da esquiva **deixam de bloquear os Moves**. Cada Move declara `air`: **cast** (o corpo segue em voo: Harden, Second Wind, Swift, Riposte, Feint, Reflect, Psyshock, Spikes, Emerging Stone, Sand Wave, Bounce) ou **descend** (desce em `airDescent` e age: Lunge, Quick Attack, Guard Break, Bullet Punch). Lançado por golpe e preso na parede continuam sem comando.
- O Bounce no ar recomeça da altitude do corpo; a Sand Wave nasce no chão sob o lutador; o HUD mostra «pronto» no ar quando o motor aceita.
- Testes novos: `moves-air` (13) e varredura de travamentos com os Moves no ar.

## v1.17.0 — Calibração de 22/10, correções e interface (22/10/2026)
- **Base de calibração** atualizada com a 2ª exportação do responsável (184 linhas; stamina 11,1, regeneração 4 s, Tackle 0,65 s/1,55 m, salto 2,4 m, VFX de impacto, Riposte e Bullet Punch). `config.ts` do jogo acompanha.
- **Softlock do Bullet Punch** corrigido: sobre plataforma o lutador «ausente» caía da borda e ficava invisível e intangível para sempre; agora a física não o derruba e a ausência termina se a ação some.
- **Riposte** ganha visual (postura com disco e lâmina de guarda, dourados na janela; contra-golpe com clarão, anel e corte em X) e 3 sliders.
- **Sliders de combate** com limite máximo **dobrado** (regras, ações, Moves, atributos, locomoção, passivas, salto).
- **IA jogador/oponente** na barra superior, ao lado da busca; **tooltips** de descrição e uso nos Moves e nas passivas; atalho visível «Término do movimento trava outras ações pela duração da animação» na gaveta Ações (agora também ajusta o cast dos Moves com clipe próprio).

## v1.16.0 — Base de calibração v8 e regras de combate (22/10/2026)
- Valores do export do responsável viram o **padrão do laboratório e do jogo** (`sim/calibration-base.js`, reversível linha a linha).
- **Recarga acelerada em todos os Moves** (apertar o botão em recarga gasta stamina e encurta a recarga); **Riposte** contra-golpe PL 4 e sem clash; **Meteor Slam** PL 2, sem clash e hitbox só no chão.
- Exportar/importar ajustes inclui todos os parâmetros alterados, também os de Moves (`world.*`).

## v1.15.x — Salto 3D, footstool, HUDs e overhaul de colisões (21–22/10/2026)
- **v1.15.0:** footstool pela esquiva (C) por cima do rival, rebote e controle aéreo; salto 3D (Plano D). **v1.15.3:** lutador em plataforma usa a altura do próprio chão nos acertos.
- **v1.15.4–v1.15.7:** laboratórios de HUD (progressão/consumíveis e vida/stamina/4 Moves) e HUD «Banco de Células» compacto, gemas facetadas e cenário «Laboratório técnico» no jogo.
- **v1.15.8–v1.15.17:** overhaul de colisões em 7 fases (depenetração, contatos simultâneos, CCD de projéteis, contrato de apoio físico, rebote em caixas, feixe e cenário, sonda de colisão com 15 cenários de um clique).

## v1.14.x — 13 Moves novos (21/10/2026)
- Harden, Second Wind, Swift, Lunge, Quick Attack, Guard Break, Feint, Riposte, Bounce, Spikes, Sand Wave, Bullet Punch e Emerging Stone, com sliders por Move, ficha, IA e testes por Move. Bullet Punch 5× mais rápido e com viagem invisível (v1.14.5).

## v1.12–v1.13 — Colisão, hitbox, interpolação e hitstop (21/10/2026)
- Melhorias medidas por varredura de partidas (v1.13.0): colisão, hitbox espacial, interpolação e hitstop por faixa de dano; ferramentas open source avaliadas (Rapier: não adotado agora).

## v1.11.x — Personagens, slam e ajustes (19/10/2026)
- **v1.11.0:** gaveta de **Personagens** do zero. **v1.11.1:** slam mira o rival, andar carregando o tackle, K.O. antes do cartão. **v1.11.2–v1.11.4:** sem mergulho no ar para quem leva knockback, botão **Avisos** na barra, grupos de sliders começam fechados. **v1.11.18:** ajustes de tackle, slam e carga.
## v1.10.0 — IA do tackle (fase 4)
- A IA **carrega o tackle** (PL2/PL3) quando o alvo está fora do alcance normal e há tempo seguro; solta no PL planejado, ou finta se o rival ataca.
- A IA **finta** o próprio tackle no começo se o rival abre a defesa perfeita ou esquiva.
- A IA **foge do wall-splat**: lançada rumo à parede, mergulha (X) para sair do voo.
- Controles em **Ações › Tackle › 🤖 IA e o tackle** (3 toggles, 3 sliders).
- Medido em simulação: a força da IA ficou igual à anterior (≈48% contra ≈50% de referência).

## v1.9.0 — Finta e brake slide (fase 3)
- **C ou D** no começo do tackle (janela em slider) ou durante a carga **cancelam o ataque**: sem esquiva, o lutador só derrapa (com poeira nos pés).
- Paga só uma fração da stamina (`feintStaminaCost`) e volta ao neutro bem antes de um tackle que erra.
- Não vale para tackle que já acertou nem para o meteor slam. Toggle `enableTackleFeint`.
- Atenção: nos primeiros 0,12 s do tackle, **D passa a ser finta** (antes era o cancelamento por defesa perfeita).

## v1.8.0 — Wall-splat, meteor slam e ground bounce (fase 2)
- **Wall-splat:** lançamento (tackle, clash, Psyshock) que bate na parede **já caindo** e rápido deixa o lutador suspenso e indefeso (janela de combo, acertável de novo). Subindo, vale o ricochete.
- **Meteor slam:** C → X no salto do vault, ou X de quem foi lançado, vira mergulho de 45° (+20% de dano; recuperação longa se errar).
- **Ground bounce:** o rival acertado pelo mergulho quica para cima.
- Toggles `enableWallSplat` e `enableMeteorSlam` e 9 sliders; estado de animação "Preso na parede".

## v1.7.0 — Tackle carregado (fase 1) e gaveta de Ações
- **Segurar X carrega; soltar dispara.** Toque rápido = PL1; 50% a 99% = PL2; carga máxima = PL3 (velocidade/alcance e dano por PL em sliders). Dreno de stamina por segundo, giro lento durante a carga.
- **X correndo (sprint) sai PL2** na hora; **C → X continua imediato**. D ou C cancelam a carga; um golpe sofrido também.
- **PL dinâmico:** vale no clash entre tackles (o maior vence), contra as pedras do Psyshock e no counter.
- Anel colorido por PL no chão e barra de carga no HUD; novos estados de animação (carga, PL2, PL3, freio) com fallback para o tackle.
- **Gaveta ⚔ Ações:** botão no canto da arena com abas Moves, Tackle, Esquiva e Bloqueio.

## v1.6.0 — Workspace inicial embutido
- O HTML carrega o seu workspace (calibração v8, Cogumelo e arenamon-prototipo com animações) e o importa na **primeira abertura** de um navegador sem workspace. Depois o workspace do navegador manda. Detalhes: `prototypes/combat-lab/inicial/README.md`.

## v1.5.0 — Moves
- Moves saíram da barra esquerda para a gaveta própria. **Até 4 moves por personagem**, com o **botão de cada slot** escolhido ali mesmo; só aparecem os ajustes (sliders, animação e loop) dos moves equipados.

## v1.4.0 — Clash por empurrão, recovery rápido, IA
- **Clash por empurrão** (toggle): os dois recuam no chão em vez de serem lançados (distância e duração em sliders).
- **Recovery rápido:** C no ar, pouco antes do chão, faz uma esquiva imediata ao pousar (janela, tempo mínimo e custo de 0 a 2 em sliders).
- A IA usa o recovery e corre mais (sliders de reserva e distância).

## v1.3.0 — Biblioteca de personagens
- Em cada slot, "Personagens salvos" lista todos os modelos já carregados; trocar de personagem e voltar traz as animações e associações sem reimportar.

## v1.2.x — Barra superior e correções
- Barra enxuta: chips curtos com tooltip, botões **ON/OFF**, menu **Ferramentas** (Hitboxes, Câmera, F3, Som), botões compactos de busca, alterados e atalhos.
- Aviso de "sessão anterior restaurada" virou uma barra fina (não ocupa mais uma coluna inteira).

## v1.1.0 — Versão automática
- O número da versão vem do `package.json`, com data de compilação e commit no tooltip.

## Antes das versões numeradas (outubro/2026)
- **IA única:** só a IA mais recente, na dificuldade normal. Modos: Normal, Ataque constante, Defesa constante e Parado. Botão **🧠 IA oponente** na HUD.
- **Busca rápida (Ctrl+K ou /):** busca em todos os parâmetros, lista de alterados com restauração, presets e atalhos (`?`).
- **Organização dos parâmetros:** visão por mecânica, níveis Básico/Avançado/Técnico, valores derivados nos sliders e etiquetas próprias com exportação.
- **Mosh e `chars/`:** modelo e animações do cogumelo; a pasta `chars/` passou a ser versionada.

---

## Correções e mudanças internas
- Tackle mútuo sem vantagem de índice (dois tackles que se acertam no mesmo contato valem como clash), morte por dano periódico desarma a guarda e estado após quebra de barreira.
- Teste `solid-vfx.browser` corrigido (o painel de VFX mostra um efeito por vez).
- Testes novos: `clash-tech`, `organize`, `tackle-charge`, `tackle-slam`, `tackle-feint`, `tackle-ai`, `mutual-tackle`.
- Testes antigos ajustados (ricochete, C → X aéreo, diagnóstico, avaliação da IA): rodam com o toggle da mecânica nova desligado ou aceitam o novo comportamento.

## Regras do projeto
- `AGENTS.md`: removida a regra de "conteúdo restrito"; `chars/` é versionada (só o Vigor pesado, ~1,5 GB, fica local).
- A versão do `package.json` sobe a cada entrega.

## Pendências conhecidas
- A IA nova empata com a anterior; a exaustão (~25 s por luta) vem do ritmo de gasto contra a regeneração de stamina.
- Botão de pular, itens e objetos interativos do cenário: planejados para depois (já existe o gancho `startSlam`).
- Drowzee e Gumshoos continuam sem rig.
- Alguns testes de navegador que dependem de tempo real (segurar X por 0,7 s) oscilam sob carga da máquina.
