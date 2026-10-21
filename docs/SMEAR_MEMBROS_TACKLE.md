# Smear 3D de membros no Tackle

Entrega isolada na branch codex/tackle-limb-smear, worktree temporário .worktrees/limb-smear.
Base: Squash & Stretch, commit 32107f0fc5ae7da971052efcacd99f29c194e520. O checkout principal permanece sem alterações desta entrega.

Abra JOGAR_ARENAMON.html deste worktree. Importe um GLB animado em Personagens, abra Ações → Tackle → Smear de Membros e execute uma investida com X. O efeito só aparece quando as extremidades ultrapassam o limiar de velocidade.

## Controles

- Smear de membros: ligado por padrão.
- Persistência: 1–4 quadros de referência a 60 Hz; padrão 2 (33 ms). A duração não muda com a frequência do monitor.
- Velocidade mínima: 5–25 m/s; padrão 12 m/s.
- Largura: 0,05–0,40 m; padrão 0,18 m.
- Cor: personagem (padrão), destaque do time ou branco.
- Opacidade: 20–100%; padrão 85%.
- Reforço por PL: ligado. PL2 aumenta a largura em 25%; PL3 acrescenta contorno neon na cor do time.

Os controles entram no histórico, Ctrl+Z/Ctrl+Y e nos ajustes exportados. Mudanças de largura, duração e PL valem para as próximas lâminas emitidas; cor/opacidade afetam as lâminas visíveis imediatamente.
O controle global de efeitos e a preferência de redução de movimento também desligam o Smear. Pausar congela a aparência. Reiniciar a partida, recuar no replay, retirar ou substituir o modelo limpa o histórico.

## Geometria e anatomia

As posições mundiais são amostradas depois da animação e do Squash & Stretch, sem modificar os ossos. Cada lâmina é um prisma afilado fechado de oito vértices: uma tira de quatro faces laterais e duas tampas. O pool usa 64 lâminas por personagem, buffers fixos e no máximo dois draw calls (corpo + contorno PL3), sem novas malhas, materiais ou arrays no caminho por quadro.
A lâmina liga a posição anterior da extremidade à atual. Não são partículas soltas ou rastros no chão. Quadros maiores que 100 ms e deslocamentos semelhantes a teletransporte não criam lâminas longas atravessando a arena.

- Mosh/Cogumelo: duas âncoras nas laterais do chapéu, seguindo o osso da cabeça; offsets estimados pelos limites do modelo na pose de importação.
- Croagunk: punhos e ombros; sem ombros nomeados, pontos laterais do peito.
- Vigoroth: garras/dedos terminais, quando encontrados, e topo da crista; fallback nas mãos/cabeça.
- Genérico: mãos e cabeça; se faltarem ossos, pontos frontais do modelo.

A cor do personagem usa o material principal e, quando disponível, a média da textura amostrada uma única vez ao carregar. Nomes e proporções não padronizados podem exigir ajuste futuro das âncoras.

## Testes e limites

[Relatório com imagens e resultados](../prototypes/combat-lab/evidence/limb-smear/index.html).
Testes específicos: smear.test.mjs e smear.browser.mjs. Cobrem sete controles com desfazer, velocidade mínima, estados, PL2/PL3, cores, duração em 30–240 Hz, 100 disparos sem crescimento de recursos, reset e descarte na troca de personagem.
O teste no navegador usa chars/mosh/Cogumelo.glb e chars/croagunk/croagunk-rigged.glb; os quatro pontos do Croagunk são verificados com seu GLB de 13 clipes. A captura usa largura 0,30 m e cor de destaque para tornar as lâminas legíveis. As âncoras de Vigoroth e o fallback são testados com ossos sintéticos, sem afirmar validação visual de todo o acervo.
A medição de CPU da rotina não garante 60 FPS do jogo completo em qualquer GPU/modelo. Não foi feita uma comparação de FPS em todas as máquinas ou personagens.
O recurso está integrado ao jogo oficial e seus controles ficam em Ações → Tackle.
No benchmark delimitado (Edge headless, Intel UHD, dois Cogumelos, pose de Tackle e movimento oscilante PL3, 120 intervalos após aquecimento), foram medidos 60 FPS tanto sem quanto com Smear; P95 do quadro com efeito: 17,1 ms. P95 de atualização da rotina: 0,10 ms. Isso não representa todos os combates ou equipamentos.
O [resumo de validação](../prototypes/combat-lab/evidence/limb-smear/validacao.json) e as capturas do Cogumelo, Croagunk e controles estão no relatório.
