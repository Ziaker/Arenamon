# Arenamon · Jogo Principal & Laboratório de Combate

> **Este é o Jogo Principal Oficial do Arenamon (`prototypes/combat-lab/`).** O antigo `prototypes/game/dist/arenamon-jogavel.html` foi descontinuado como protótipo inicial legado de blocos.

Gere com `npm run build` (ou `npm run build:combat-lab`) e abra `dist/arenamon-combate-laboratorio.html` por duplo clique (offline, sem modelos embutidos).

## Ambiente de calibração e dashboard Bento Zero-Scroll (workspace, presets, A × B, gravador, diagnóstico, desempenho, IA)

O relatório técnico está em [`CALIBRACAO.md`](CALIBRACAO.md). Em resumo:

- **Dashboard Bento Zero-Scroll:** todas as 9 abas (`Partida`, `Cenários`, `Ajustes`, `Visualizar`, `Personagens`, `Moves`, `Controles`, `Exportar` e `Homologação`) organizam seus cartões lado a lado em grade com sub-abas instantâneas (`⊞ Tudo` | sub-cartão), alternância `⊞ Grade` ↔ `▯ Lateral`, botão `? Dicas` e `0 px` de rolagem vertical.
- **Workspace persistente:** modelos, animações, associações, ajustes e preferências restaurados ao abrir (IndexedDB, identificados por SHA-256), além do backup completo em ZIP com prévia.
- **Presets de sensação** (Storm-like, Etapa A, Pesado), **calibração simplificada** com 16 controles, **A × B jogável** por tecla e **gravador de movimento** determinístico com gráficos.
- **Diagnóstico de comandos negados** (o próprio motor diz o motivo), **janelas de combate** acima dos lutadores, **treino de defesa e esquiva perfeitas** e **validador de modelos e animações**.
- **Medidor de desempenho**, benchmark reproduzível, perfis gráficos e VFX simples/avançado + 9 famílias de VFX 3D sólidos.
- **IA revisada** (a anterior continua selecionável), **servidor local opcional** (`npm run dev:combat-lab`) e **painel de relatórios** (`dist/arenamon-painel-relatorios.html`).

## Overhaul (movimento, animação, VFX e HUD)

O relatório técnico completo está em [`OVERHAUL.md`](OVERHAUL.md). Em resumo:

- **Locomoção contínua** (`src/sim/locomotion.js`): aceleração com curva, frenagem com atrito, inversão que atravessa zero, aderência lateral e giro com aceleração angular. Todos os parâmetros têm sliders (Ajustes › Movimento). O modelo do v6 continua disponível para comparação.
- **X e C em fases** (`src/sim/motion.js`): preparação, impulso, deslocamento, desaceleração e recuperação, com a distância nominal preservada e independente da duração (inclusive com a sincronização de clipes).
- **Sprint**: C mantido depois da esquiva, com consumo de stamina e frenagem própria.
- **Lock-on separado do movimento**: as setas continuam relativas à câmera, com o referencial travado enquanto a seta é mantida. O lock-on cuida da câmera, da orientação e da mira.
- **IA** com intenções suavizadas, enviadas ao mesmo controlador do jogador. O oponente pode ser desligado em Partida.
- **Animação** (`src/view/characters.js`): máquina de estados sem reinícios indevidos, várias variantes por estado sorteadas na entrada (determinístico), importação de clipes para a biblioteca, estados Sprint, Freio da caminhada e Freio do sprint, altura visual automática e telemetria.
- **VFX** (`src/view/vfx.js`, `src/view/solid-fx.js`): 9 tipos 2D × 3 variantes + 9 famílias 3D sólidas (poeira, vento, corrida, esquiva, aterrissagem, impacto, bloqueio, clash), BeamRenderer para lasers, rochas telecinéticas e barreira de energia 3D.
- **HUD**: propostas A (Arcade Vector), B (Combat Halo) e C (Tactical Combat), alternáveis e sem escolha definitiva.
- Testes: `test/locomotion.test.mjs`, `test/animation.test.mjs`, `test/overhaul.browser.mjs`, `test/moves-ui.browser.mjs` e `test/solid-vfx.browser.mjs`.

## Origem

O laboratório v6 (`arenamon-combate-laboratorio-v6.html`) era um único HTML com o jogo compilado editado à mão e um script de ajustes colado no fim. A física dele (lançamento aéreo, clash, salto da esquiva, rebote na parede, contra-ataque, hitstop, deslizamento ao aterrissar e IA estendida) **não existia em nenhuma branch**: só naquele arquivo. Esta versão reconstrói tudo como fontes em `src/` e tornou-se o **Jogo Principal Oficial do Arenamon**.

**Comparação com o protótipo legado de blocos** (`prototypes/game/src/config.ts`, descontinuado):
- O jogo principal (`combat-lab`) usa arena 32 × 32 m (legado 20 × 20), velocidade base 4,8 (legado 4), perfis ágil e resistente, e câmera mais rápida, mais próxima do alvo e com distância máxima maior.
- O ajustador marca cada parâmetro como **jogo** (igual ao `config.ts` legado), **≠ jogo** (difere) ou **lab** (exclusivo do motor atual). O relatório em Exportar lista as diferenças.

| Pasta | Conteúdo |
| --- | --- |
| `src/sim/` | Simulação pura (testável em Node): configuração, IA, controle, combate, física, partida, telemetria, replay e cenários. |
| `src/view/` | Three.js: arena, blocos, efeitos, sobreposições técnicas, câmera e personagens do Studio. |
| `src/ui/` | HUD, entrada (teclado/gamepad), ajustador, doca da linha do tempo e referência ao `config.ts`. |

## Etapa A: núcleo X/C (em avaliação, não homologado)

A revisão de regras em relação ao GDD v0.1 está em [`docs/REVISAO_GDD_COMBATE.md`](../../docs/REVISAO_GDD_COMBATE.md).

- **X (tackle) e C (esquiva) independentes:** a aba **X e C** do ajustador tem 41 parâmetros em `actions.dodge`, `actions.tackle`, `actions.cancel` e `actions.buffer`:
  - duração, custo, invulnerabilidade, distância, arrancada da curva, esterçamento (limite e taxa);
  - transição de velocidade, encadeamento, recuperação;
  - permissões a partir da defesa, do recuo e do guard stun.
- **X em 8 direções:** o impacto depende da trajetória real, não da orientação do corpo. Cada ação acerta cada alvo uma vez. **C** nunca causa dano e só salta quando cruza o adversário.
- **Cancelamento C → X:**
  - A janela é configurável e começa no primeiro passo por padrão.
  - C fica pago e X cobra o próprio custo. Sem stamina, a esquiva continua.
  - A direção é a pedida; sem direção, X segue a de C.
  - A velocidade é contínua, com transição de 0,06 s.
  - No ar, X parte da altura atual e desce em 0,18 s.
  - A invulnerabilidade de X é só o resto da de C. O slider "Invulnerabilidade no cancelamento" compara com "nenhuma" e "janela completa de X".
- **Clash:** cada lutador recebe 30% do dano do tackle do outro, e os dois são lançados para trás e para cima.
- **Recuo e guard stun (GDD):** X não sai durante o recuo (C e D saem). X pedido no guard stun fica guardado e sai quando o stun termina.
- **Migração de JSON:** os formatos v5 a v7 são convertidos na importação, com uma tabela "campo antigo → novo" e a lista dos campos não reconhecidos. A exportação é v8.
- **Animações:** com sincronização, as durações dos clips definem só `actions.*.duration`, o recuo, o guard stun e a aterrissagem. As janelas de eventos do Studio (invulnerabilidade, hitbox) **nunca** alteram as regras.

### Ferramentas de avaliação

- **Buffer de entrada** (`actions.buffer.window`, padrão 100 ms; 0 = desligado, como no v6). X ou C apertados um pouco antes da hora ficam guardados e saem no primeiro passo permitido. Isso vale para o fim do encadeamento, a abertura da janela C → X e o fim do recuo ou da aterrissagem. Vale o pedido mais recente, e um toque em D descarta o pedido. Nos dados ao vivo, a ação aparece como "(buffer)".
- **Indicador da janela C → X** (Visualizar, ligado por padrão). Durante C, uma faixa no chão mostra o estado do cancelamento: cinza com a janela fechada, verde com X disponível (o arco encolhe com o tempo restante) e vermelha sem stamina para X. O ponto acima do lutador mostra o comando guardado no buffer.
- **Homologação** (nova aba): checklist de 17 itens para a sua avaliação jogável. Cada item recebe aprovado, reprovado ou pendente, com observação. Fica salvo no navegador, sai no JSON exportado (`homologation`) e pode ser baixado em Markdown. Testes automáticos não preenchem esta lista.
- **Prévia de X e C** (Visualizar). Com o azul livre, linhas no chão mostram para onde X (laranja) e C (verde) iriam na direção atual. Um arco indica que C saltaria sobre o rival, usando a mesma regra da simulação (`wouldVault`).
- **Gravação de partida** (Partida). Toda partida grava a semente, os perfis, os ajustes e as entradas do azul. "Salvar gravação" baixa um JSON (`arenamon-match`) com os comandos comprimidos. Há duas formas de reproduzir:
  - com os ajustes da gravação: repete a luta exatamente;
  - com os ajustes atuais: as mesmas entradas em outra configuração, com o vermelho reagindo de novo pela IA.
- **Equilíbrio IA × IA** (Cenários). N lutas rápidas com os ajustes atuais e os perfis da aba Partida. Mostra vitórias, duração, X, C, C → X, buffer, saltos, contatos, clashes, esquivas perfeitas, dano e exaustão por lutador.
- **Comparar A × B** (Cenários). Roda a mesma situação com dois conjuntos de ajustes, sem renderização, e mostra os resultados lado a lado. Os conjuntos podem ser os ajustes atuais, o padrão do laboratório, o jogo oficial ou presets salvos. A situação pode ser:
  - todos os cenários roteirizados: esperado × obtido de cada lado, mais as medições que diferem;
  - a gravação da partida atual: vencedor, HP, stamina, dano, contatos, C → X e buffer.

  A configuração atual não muda.
- **Proposta para o config.ts do jogo** (Exportar). Gera um diff unificado aplicável com `git apply`, com a tabela "jogo × proposto × origem".
  - Por padrão entra só o que você ajustou. Uma opção inclui também as diferenças padrão do laboratório.
  - **Conflitos ficam de fora e são listados.** Exemplo: X e C com durações diferentes, que no jogo ainda são um valor só (`rules.dodge`).
  - Parâmetros sem equivalente no jogo também ficam de fora e são listados.
  - O laboratório nunca altera o jogo. `test/gamepatch.test.mjs` confere o diff com `git apply --check`, sem aplicar.
- **Testes de propriedade** (`test/properties.test.mjs`). São 200 lutas aleatórias, com ajustes de X/C, cancelamento e buffer sorteados (cerca de 485 mil passos, 2 s). Cada passo verifica regras que nunca podem falhar:
  - nada de NaN, e todos ficam dentro da arena;
  - stamina, HP e altura ficam na faixa;
  - C não causa dano, e um lutador invulnerável não recebe dano;
  - um contato por ação, e o clash custa 30%;
  - o resultado é determinístico.

**Achado do equilíbrio (antes da IA tática, 20 lutas, semente 1):**
- As IAs do v6 no modo combate **nunca usam C**, e o clash domina: cerca de 10 por luta.
- 9 de 20 lutas chegavam aos 90 s sem vencedor.

A nova IA tática (abaixo) resolve isso.

**Limitações conhecidas:**
- Os valores (velocidades, janelas, 0,06 s e 0,18 s) são provisórios.
- O lançamento aéreo continua no lugar da fórmula de empurrão do GDD; a reconciliação fica para a Etapa B.
- O jogo oficial não foi alterado.
- Os testes automáticos não equivalem a aprovação jogável.

## As dez melhorias (v7)

1. **Fontes versionadas:** módulos legíveis, build reproduzível, paridade exata com o v6 e testes.
2. **Personagens do Studio** (aba Personagens): carregue o `.glb` exportado pelo Animation Studio. O mapa de ações do Studio associa cada estado da simulação a uma animação; também dá para associar por nome ou manualmente. O tempo das animações com duração definida (tackle, esquiva, recuo, guard stun, voo e aterrissagem) é calculado a partir do estado da simulação, então acompanha a física inclusive no replay. Opções: travar o deslocamento da raiz, ajustar a altura ao colisor, duração da transição e cópia tingida para o vermelho.
3. **Eventos do Studio × jogo:** compara as janelas marcadas no Studio (hitbox, invulnerabilidade, início da recuperação) com as janelas reais. O clip é reescalado para a duração da ação do jogo. A linha do tempo ganha uma faixa “Studio” sobre cada tackle e esquiva reais. É só visualização.
4. **Replay e passo a passo:** os últimos 12 s ficam gravados por estado completo. Use ◂/▸ (ou `,`/`.`) para andar um passo, clique na linha do tempo para voltar, retome a partir do passado (o futuro gravado é descartado) e use câmera lenta de 0,1× a 1×.
5. **Cenários:** oito cenários roteirizados e repetíveis: tackle contra defesa, defesa perfeita, clash frontal, esquiva perfeita com contra-ataque, esquiva lateral, lançamento, knockback na parede e exaustão. Cada um mostra esperado × obtido, com o esperado calculado a partir dos ajustes atuais. Podem ser executados ao vivo ou todos de uma vez.
6. **Ajustador reformulado:**
   - Os 342 parâmetros ficam em 9 abas (a primeira é **X e C**), com busca.
   - Filtros: alterados, ≠ jogo, só lab.
   - Desfazer/refazer, restaurar por grupo e botão “= jogo”.
   - Presets salvos neste navegador e comparação entre presets, padrão do laboratório e jogo.
7. **Telemetria e dados de quadros:**
   - Linha do tempo por lutador: estado, invulnerabilidade, janela perfeita, hitstop e stamina.
   - Registro de golpes: em que passo da ação houve contato, quando cada lutador fica livre para agir e para se mover, vantagem e lançamento.
   - Tabela de quadros nominais.
8. **Sobreposições:** colisores coloridos pelo estado, trajetória de X/C, arco de defesa, normais de contato, vetor e arco balístico previsto do lançamento (com rebote) e anel de alcance. Também mostra dados ao vivo (distância, espaço entre colisores, velocidade de aproximação).
9. **Controles:**
   - Modos de dummy: parado, sempre defendendo, sempre esquivando, defende e contra-ataca, aleatório com semente.
   - IA do jogador configurável e presets de dificuldade.
   - Gamepad: A tackle, B esquiva, LB/RB defesa, Y alvo, Start pausa.
   - Histórico de comandos estilo modo treino.
10. **Levar ajustes ao jogo com segurança:** JSON versionado (v8, com `differencesFromGame`). A importação aceita v5 a v8, migrando os formatos antigos, e é validada e pré-visualizada antes de aplicar. Há relatório de diferenças em relação ao `config.ts`, aviso ao sair com ajustes não exportados e restauração da sessão anterior.

## IA tática (`src/sim/tactics.js`)

O modo **Tático (estratégico)** é o padrão do adversário e da IA do jogador. Os modos do v6 continuam disponíveis e idênticos (paridade 16/16).

- **Estilos de luta sorteados a cada partida**, com traços que também variam de uma partida para outra:

  | Estilo | Como luta |
  |---|---|
  | Agressor | Fica perto, ataca muito, choca |
  | Contra-atacante | Isca, defesa perfeita e punição |
  | Esquivador | C, salto e C → X pelo flanco |
  | Paredão | Defende e pune |
  | Oportunista | Explora a exaustão, a aterrissagem e o recuo |
  | Imprevisível | Escolhe com grande variação |

  Em Ajustes › IA, o "Estilo de luta" fixa um deles (0 = sorteado).
- **Percepção humana:** o X do adversário só é percebido depois do tempo de reação, e às vezes há leitura errada. Por isso a IA defende principalmente **por antecipação**, e não por reflexo:
  - aprende de que distância o adversário costuma atacar;
  - fica logo fora dessa distância;
  - quando precisa entrar nela, defende de antemão ou recua.
- **Leitura e adaptação:** registra como o adversário responde aos X dela (defende, esquiva, choca ou apanha) e com que frequência ele ataca. Contra quem defende muito, troca o ataque direto por isca, C → X e paciência. A velocidade dessa adaptação é o parâmetro "Adaptação ao adversário".
- **Respostas a cada ameaça, com tempo estimado até o contato:** defesa perfeita no tempo certo, defesa, esquiva lateral na invulnerabilidade (esquiva perfeita seguida de contra-ataque), salto por cima, clash ou recuo para o X passar curto.
- **Punições:** recuo, X que passou curto, fim da esquiva, aterrissagem (chega no instante em que o adversário se levanta) e exaustão. Com o adversário no ar, espera perto do ponto de queda previsto.
- **Estratégia:**
  - X mira onde o adversário vai estar.
  - Encurrala o adversário contra a parede.
  - Guarda reserva de stamina para uma esquiva.
  - Tentar ou não o golpe final depende do placar.
  - Apanhar deixa a IA mais ousada ou mais cautelosa (humor).
  - Lutas longas aumentam a pressão para atacar.

**Resultados medidos** (`test/ai.test.mjs`, Equilíbrio IA × IA):
- Contra a IA do v6, vence **cerca de 75–80%** com a personalidade do azul e 60–75% com a do vermelho, que é mais lenta e erra mais.
- Tática × tática: os dois lados vencem em proporção parecida.
- As lutas usam todas as mecânicas: em 40 lutas, cerca de 120 C → X, mais de 170 bloqueios, cerca de 45 defesas perfeitas, cerca de 16 esquivas perfeitas e saltos. O clash é raro.
- Cerca de 20% das lutas táticas × táticas passam de 90 s: as duas defendem bem.
- A distância de ataque aprendida contra o v6 converge para cerca de 2,8–3,4 m.
- Contra quem só defende, a leitura de "defende" chega a 95%.

## Aleatoriedade das IAs

Cada IA tem personalidade própria, editável em **Ajustes › IA**:
- **Tempo de reação:** atraso mínimo mais uma variação sorteada.
- **Chance de erro:** não reagir a um tackle ou deixar passar uma oportunidade de ataque.
- **Agressividade:** alcance e intervalo entre ataques.
- **Variação de ritmo:** intervalos, troca de lado e distância preferida sorteados.
- **Hesitação:** pausas curtas.
- **Preferência por esquivar.**

Os padrões são diferentes: o vermelho reage mais devagar e hesita mais; o azul é mais agressivo e prefere esquivar. Cada combate sorteia uma semente nova; marque “Semente fixa” em Controles para repetir uma luta. Dentro de uma luta, tudo continua determinístico (replay e cenários exatos). Com a personalidade neutra (zeros e agressividade 0,5), a IA é exatamente a do v6; o teste de paridade usa essa configuração.

## Animações dos personagens

- **Associação por nome:** sem o mapa do Studio, as animações são associadas por nome com sinônimos em inglês e português (ex.: `guard` → defesa, `front`/`side`/`back` → esquivas, `push` → lançado, `recover` → levantar, `turn` → girar no lugar).
- **Estados novos:** girar no lugar, entrar/sair da defesa, defesa perfeita e recuperação após exaustão.
- **Estados sem animação:** o painel lista os estados que ainda caem em “parado” e mostra a animação tocando agora.
- **Velocidade:** cada ação tem um slider (0,25× a 3×), e há um slider geral.
- **Durações no jogo:** com “As durações das animações definem as regras”, as durações do tackle (X, agora separado da esquiva), da esquiva, do recuo, do guard stun e da aterrissagem passam a ser *duração do clip ÷ velocidade*. As janelas de invulnerabilidade e de hitbox nunca vêm do GLB. Aplica com desfazer e aparece como ≠ jogo nos Ajustes.
- **Sem sincronizar:** o clip é esticado para caber na ação, e a velocidade acelera o clip dentro dela.

## Achados da telemetria (para avaliação)

- **Bloqueio:** a vantagem **para agir** é 0. O recuo do atacante e o guard stun do defensor são canceláveis desde o primeiro passo. A vantagem **para se mover** é −12 passos (100 ms) para o atacante: recuo de 36 passos contra 24 de guard stun.
- **Lançamento:** o tempo no ar real é de 101 passos para 100 previstos por 2·v/g (integração discreta). O impacto acrescenta 5 passos de hitstop, contados à parte.

## Testes

- `node prototypes/combat-lab/test/core.test.mjs`: 20 testes da Etapa A com 167 verificações "esperado × obtido":
  - X e C nas 8 direções, com e sem lock-on;
  - C → X no início, durante e após a invulnerabilidade, no ar, sem stamina, fora da janela e desligado;
  - esquiva perfeita + C → X;
  - independência dos parâmetros;
  - clash (frontal, diagonal, sem colisão, se afastando, parede, ataques diferentes, stamina baixa);
  - defesa, recuo, guard stun, stamina, buffer de entrada e migração.

  O relatório fica em `validation/etapa-a-report.md` e `.json`, com o registro completo de cada cancelamento.
- `node prototypes/combat-lab/test/properties.test.mjs [execuções] [passos]`: testes de propriedade em lote (padrão: 200 × 2.400 passos).
- `node prototypes/combat-lab/test/ai.test.mjs`: IA tática (determinismo, replay, estilos, mecânicas, contra o v6, adaptação, percepção).
- `node prototypes/combat-lab/test/gamepatch.test.mjs`: proposta de patch do config.ts (substituições, conflitos e `git apply --check`).
- `node prototypes/combat-lab/test/sim.test.mjs`: 20 testes (inclui o equilíbrio IA × IA e a comparação A × B) (8 cenários, determinismo, replay por estado, telemetria, tabela de quadros, personalidade das IAs).
- `node prototypes/combat-lab/test/local-character.mjs modelo.glb`: diagnóstico local do mapa de animações de um modelo seu (resultado em `validation/`).
- `node prototypes/combat-lab/test/parity.mjs`: paridade passo a passo com o v6 local, no modo `V6_COMPAT` (opcional; só compara o comportamento antigo).
- `node prototypes/combat-lab/verify.mjs`: 19 verificações (incluindo a IA tática por padrão, a gravação e a reprodução idêntica de partida, a aba X e C, a migração de JSON v6, C → X pelo teclado, o indicador e a homologação) no Edge offline, incluindo o GLB gerado pelo próprio Animation Studio com mapa de ações e eventos.

## Busca rápida (Ctrl+K ou `/`)

Paleta global na barra superior (**⌕ Buscar**, **≠ N alterados**, **? Atalhos**): busca em todos os parâmetros de qualquer aba e permite editá-los ali mesmo (entram no desfazer/refazer), lista os alterados em relação ao padrão com restauração individual ou geral, aplica presets e mostra os atalhos (`?`). Esc fecha só a paleta, sem pausar a partida.

## Organização dos parâmetros (Ajustes › Todos os parâmetros)

- **Por tipo / Por mecânica:** a visão por mecânica reúne tudo que afeta o Tackle, a Esquiva, o Sprint, a Defesa, a Stamina, o empurrão, o Clash, a IA etc., inclusive os efeitos visuais e o tremor de cada uma. Um parâmetro pode aparecer em mais de uma mecânica.
- **Nível:** Básico (padrão), + Avançado ou Tudo. Busca, filtro "alterados" e etiquetas sempre mostram tudo; o contador informa quantos estão ocultos pelo nível.
- **Valores derivados:** linhas "→" abaixo de alguns sliders mostram o efeito real (distância e velocidade do X/C, usos de stamina, tempo de recarga, ms e quadros) e se atualizam ao arrastar.
- **Etiquetas:** o botão 🏷 de cada parâmetro aplica etiquetas ("em teste", "calibrar depois", "não mexer" ou as suas), filtráveis; **↓ Exportar marcados** baixa um JSON só com eles, importável pela aba Exportar. As etiquetas ficam salvas neste navegador.

## Biblioteca de personagens (Personagens)

Todo modelo carregado fica guardado neste navegador junto com as animações importadas e as associações de ações. Em cada slot, **Personagens salvos** lista todos eles: escolha um e **Carregar neste slot** para trocar de personagem e voltar depois sem reimportar nada. Para levar a outro navegador ou computador, use **Exportar Workspace Completo (ZIP)** (aba Exportar).
## Clash por empurrão e recovery rápido (Ajustes › Combate › Knockback e clash)

- **Clash por empurrão** (`Ativar ou desativar sistemas`, desligado por padrão): no clash entre tackles os dois recuam no chão (distância e duração por slider), com o mesmo dano e hitstop, em vez de serem lançados.
- **Recovery rápido** (ligado por padrão): lançado, aperte **C** até `janela` segundos antes de tocar o chão e segure uma direção; ao pousar sai uma esquiva imediata nessa direção, custando `custo de stamina` (0 a 2; substitui o custo da esquiva). Sem stamina, o lutador cai normalmente. `Tempo mínimo de voo` impede escapar logo após o golpe.
- **IA:** usa o recovery (afasta-se do rival) e corre mais; `Reserva de stamina ao correr` e `Distância para correr` ficam em Ajustes › IA.

## Moves (botão ✦ Moves no canto da arena)

O bloco de Moves saiu da barra esquerda e virou uma gaveta própria, aberta pelo botão **✦ Moves** no canto inferior direito da arena (Esc fecha). Nela:

- **Equipar:** até 4 moves por personagem (azul e vermelho), um por slot, com o **botão** de cada slot escolhido ali mesmo (é o mesmo de Controles › Teclas e entra no desfazer). Um move não ocupa dois slots do mesmo personagem.
- **Só os equipados:** cada move equipado ganha um bloco com a animação de carga (com loop) e de disparo e os sliders dele; os dos não equipados ficam ocultos. A carga compartilhada e a IA com Moves aparecem só quando há move equipado (a IA, só se o vermelho equipar).
- **Ferramentas de teste** (recolhidas): emissores, laser, cenários técnicos, estilo dos efeitos e avaliação jogável.
