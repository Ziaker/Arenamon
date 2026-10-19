# Patch notes — Laboratório de Combate

Versão atual: **v1.10.0** (19/10/2026). A versão aparece na barra superior do laboratório (tooltip com data de compilação e commit). Para jogar: `JOGAR_ARENAMON.html`.

---

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
