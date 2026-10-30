# Animações dos personagens no Combat Lab

Abra `JOGAR_ARENAMON.html` e use **Personagens e animações**.

- O seletor de uma linha troca a animação principal daquele estado. Ele não transforma a animação anterior em variante.
- Animações extras só entram pelo controle **+ adicionar variante…** dentro do botão de variantes.
- Só existem **andar** e **sprint**: andar e correr são o mesmo estado (clipes chamados “run” viram andar). Ambos têm estados próprios para frente, trás, esquerda e direita.
- Cada estado oferece velocidade, repetição em loop e duração máxima. Duração `0` usa o clipe inteiro.
- **Ocultar abas** recolhe os filtros; **Ocultar biblioteca** libera a largura ocupada pela biblioteca. A gaveta possui rolagem horizontal quando a tela não comporta as colunas.
- Se um estado não tiver clipe válido, o personagem mantém a animação atual. Na primeira exibição, usa o primeiro clipe compatível em vez da T-pose.
- Trocas rápidas que retornam a um clipe ainda em transição (A → B → A) reutilizam a ação sem permitir que o fade antigo a desligue; assim o mixer não cai momentaneamente na T-pose.
- Em **Personagens → Altura visual e apoio no chão**, **Travar deslocamento horizontal da animação (mundo X/Z)** neutraliza a translação gravada no osso raiz mesmo em rigs com eixos locais rotacionados, como o Mushroom. O quadril também é alinhado ao centro físico para a malha não orbitar ao mudar de direção. **Travar no chão** neutraliza a subida ou descida gravada no clipe sem remover a pose. As duas ficam ligadas por padrão; movimento, saltos, vaults e lançamentos continuam vindo da física do jogo.

Os efeitos **Squash & Stretch** e **Smear de Membros** ficam em **Ações → Tackle**, com controles próprios. Eles alteram somente a apresentação visual.

## Viewport 3D do Editor de animações

Abra `JOGAR_ARENAMON.html` › **Personagens e animações** › **Editor de animações**. A área central do Editor agora tem uma **viewport 3D própria** (cena, câmera, luz e canvas independentes da arena): o mesmo modelo e armature do lutador, tocados pelo mesmo código de tempo do jogo. O lutador da arena não é tocado.

- Transporte: ▶ Tocar / ⏸ Pausar, ⏹, ⏮ ⏭ (1 quadro = 1/30 s), laço e régua de seek com o relógio `tempo / duração · quadro`.
- Os controles de loop, recorte, velocidade e Reverso do painel de propriedades valem **ao vivo** na viewport e no jogo.
- Botões **🖥 Viewport / 🏟 Arena**: a Arena é o modo antigo (prévia no lutador da arena); entra sozinho se o WebGL não estiver disponível.
- Nada é gravado pela prévia. Teste: `prototypes/combat-lab/test/animation-editor-preview.test.mjs` e `animation-editor-viewport.browser.mjs` (Wookada real); captura em `prototypes/combat-lab/evidence/animation-editor/viewport.png`.

## Conclusão visual, variantes e verificação no app real (v1.49.14)

- **Editor › Reprodução › «Conclusão visual após liberar o controle»** (liga/desliga por ação ou variante; padrão ligado): quando a ação mecânica acaba e o jogador já está livre, o clipe segue até o último quadro (andar não corta); nova ação aceita ou reação assume na hora. Só visual: o teste de neutralidade prova que posição, vida, stamina, estado, ação e stun são idênticos com ela ligada ou desligada.
- **Leitura ao vivo** no Editor (linha abaixo do transporte): clipe tocando no lutador da arena, se há conclusão visual em curso, segundos de clipe restantes e o motivo da última troca.
- **Novos campos com efeito real:** Habilitada, Congelamento em / duração (pose parada uma vez por execução) e Escala do deslocamento (root motion horizontal liberado), além de Reverso, Peso da camada e Blend de saída. Os 8 que continuam sem efeito (autoNext, displacement, exitCondition, minTime, priority, repeats, startup, verticalSpeed) aparecem na interface como «SEM EFEITO NO JOGO (só anotação)» e há uma catraca de teste: a lista só pode encolher.
- **Correções de roteamento:** stun de footstool e Guard Break agora toca o clipe de stagger (`hit_heavy`) em vez de `guard_impact` (a locomoção reescrevia o estado para guardStun); a fase `jump_apex` agora vai até o fim do clipe durante a queda.
- **Preservação do seu trabalho:** clipes com o **mesmo nome** deixaram de colapsar numa única variante ao salvar (o 2º vira `nome@@dup2`); a migração do perfil curado do Wookada **não troca mais** associações que você já salvou (só preenche ações sem associação salva) — isto muda o comportamento anterior, que descartava o mapa antigo.
- Variantes: `animation-variants.test.mjs` força cada variante do Wookada (14) e do Cogumelo (2). **Não homologadas:** `fall` do Wookada (2 variantes; só toca sem o clipe primário).
- App real: `animation-conclusao-visual.browser.mjs` (X, andar durante o clipe, tackle com fim mecânico curto para o epílogo entrar, pouso com Espaço) com Wookada (configuração salva) e Cogumelo (carregado do `.glb`, mapeamento padrão). Capturas em `prototypes/combat-lab/evidence/conclusao-visual/`.
- Matriz (`docs/MATRIZ_ANIMACOES_RUNTIME.md`): sintético 90/90; Wookada 40 + 2 reserva; Cogumelo 33 + 1 reserva.
- Associações do Cogumelo que parecem incoerentes com o nome (`walk_stop`, `sprint_stop`, `block_start`, `dodge_left`) **não foram alteradas**: são escolha sua; confira na viewport do Editor.
- **Campos de combate com efeito real na simulação (v1.49.14):** Armadura, Interrompível, Hit-stop (×), Prioridade de combate e Buffer de entrada, por ação (tackle PL1–3 e cada Move `move_<id>`). Ponte: Editor → `combatModsOf` → `Game.setCombatMods` → lutador. Só valores que você mudou são enviados; sem edição o combate é idêntico ao original. **Armadura** (só durante a janela ativa da ação): reduz o dano recebido e dispensa stun/lançamento; **Interrompível desligado**: dano normal, sem stun nem lançamento; **Hit-stop ×**: multiplica a pausa dos impactos dados pela ação (0 = sem pausa); **Prioridade de combate**: desempata o clash de PL igual; **Buffer**: um X/C apertado durante a ação fica guardado pelo maior entre este valor e o global. Limites: valem para golpes de tackle/Move-tackle (não para feixes nem projéteis) e não existem para esquivas. Teste: `animation-combat-mods.test.mjs`.
- **Ainda sem efeito (rotulados na tela):** `startup` (redundante com a janela ativa; precisa de decisão sua), `displacement` e `verticalSpeed` (mexem na física/balanceamento), `minTime`, `autoNext`, `repeats`, `exitCondition` e `priority` (transições/laço visuais, pendentes).

