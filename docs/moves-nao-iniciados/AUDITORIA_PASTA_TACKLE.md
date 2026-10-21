# Auditoria de `docs/tackle/` — elegibilidade para “moves não iniciados”

**Base:** árvore Git da `main` de Ziaker/Arenamon verificada em 20/10/2026, antes desta organização.  
**Alvo:** identificar arquivos que documentem **outros moves não concluídos/não implementados** e que possam ser movidos com segurança para `docs/moves-nao-iniciados/`.

## Inventário efetivamente encontrado

| Caminho | Conteúdo real | Classificação | Ação |
|---|---|---|---|
| [`docs/tackle/VER_TACKLE.html`](../tackle/VER_TACKLE.html) | Player de vídeo para **Tackle do Vigoroth, Teste 01**; selo explícito **“Aprovado (v26)”**, 41 frames a 30 FPS, fases de animação, gráficos e vistas | **Visualizador/evidência de animação de Tackle**, não especificação de novo move pendente | **Preservado no local original** |

**Resultado:** **zero arquivos elegíveis para realocação** entre os arquivos encontrados em `docs/tackle/`. O diretório não contém arquivos de Bullet Punch, Sand Wave, Emerging Stone, Body Slam ou de outro move por implementar.

## Razões técnicas para não deslocar o HTML

1. O **Tackle** é ação de combate existente no jogo (controle **X**, com testes no `prototypes/combat-lab/test/`); o selo “aprovado v26” trata da **animação representada no player**, não prova de que seja um move ainda não iniciado.
2. O portal `ABRIR_ARENAMON.html` já possui atalho para `docs/tackle/VER_TACKLE.html`. Mover sem motivo quebraria esse acesso.
3. O HTML depende de mídia via caminhos relativos: `chars/vigor/tackle_preview.mp4` e `chars/vigor/tackle_history/...`. **Esses arquivos não constam na árvore versionada no GitHub** na verificação; `AGENTS.md` informa que os assets pesados de `chars/vigor/` ficam no ambiente **local**. Logo, **não alegar** que o vídeo e as imagens foram executados/verificados online.
4. O HTML contém informações sobre **uma animação do próprio Tackle**, não um conjunto de documentos de outros golpes inacabados. Mover para uma pasta de moves “não iniciados” resultaria em classificação enganosa e caminhos relativos ainda mais frágeis.

## Onde estão os moves ainda por implementar

- **Emerging Stone:** arquivo novo de prompt nesta pasta; fonte de todas as 103 decisões em [`../MUSHROOM_MOVES_DECISOES.md`](../MUSHROOM_MOVES_DECISOES.md).
- **Bullet Punch, Sand Wave e Body Slam:** documentos/estado no catálogo canônico de Mushroom; **não estavam na pasta Tackle**.
- **Quick Attack, Swift, Harden, Spikes, Bounce:** em [`../MOVES_GENERICOS_CATALOGO.md`](../MOVES_GENERICOS_CATALOGO.md), também **fora de `docs/tackle/`**.
- **Reflect e Psyshock:** presença comprovada de módulos reais `prototypes/combat-lab/src/sim/moves/reflect.js` e `psyshock.js`; não mover para backlog apenas por status antigo de documento histórico.

**Resultado não verificado nesta tarefa:** integração efetiva da animação **Vigoroth v26** específica no rig/cliente local e renderização de seus assets pesados. Isso não autoriza declarar o Tackle inexistente ou inacabado.
