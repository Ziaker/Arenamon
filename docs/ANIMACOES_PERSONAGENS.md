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

## Conclusão visual, variantes e verificação no app real (v1.49.12)

- **Editor › Reprodução › «Conclusão visual após liberar o controle»** (liga/desliga por ação ou variante; padrão ligado): quando a ação mecânica acaba e o jogador já está livre, o clipe segue até o último quadro (andar não corta); nova ação aceita ou reação assume na hora. Só visual: não prolonga hitbox, dano, invulnerabilidade nem bloqueio.
- Variantes: `prototypes/combat-lab/test/animation-variants.test.mjs` força cada variante configurada do Wookada (14) e do Cogumelo (2) numa partida simulada e confere o clipe que o mixer executa. **Não homologadas:** `fall` do Wookada (2 variantes; só toca quando o clipe primário falta, nenhum cenário real a alcança).
- App real: `prototypes/combat-lab/test/animation-conclusao-visual.browser.mjs` abre o `dist/` no navegador, aperta X com o teclado, anda durante o clipe e confere a saída do tackle (Wookada com a configuração salva; Cogumelo carregado do `.glb`, mapeamento padrão). Capturas em `prototypes/combat-lab/evidence/conclusao-visual/`. Nesses tackles o clipe já termina junto com a ação mecânica, então o epílogo não precisou entrar; o epílogo em si é provado nos testes `animation-epilogue*.test.mjs`.
- Matriz: ainda há 2 linhas **não aprovadas** no sintético (`hit_heavy` no footstool, 2 quadros; `jump_apex`, 4 quadros: janela curta do apex), listadas sem esconder em `docs/MATRIZ_ANIMACOES_RUNTIME.md`.
- Associações salvas do Cogumelo que parecem incoerentes com o nome da ação (`walk_stop`, `sprint_stop`, `block_start`, `dodge_left`) **não foram alteradas**: são escolha sua; confira na viewport do Editor.

