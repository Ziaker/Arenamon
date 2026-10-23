# Revisão atual — 3 opções por efeito e contatos (23/10/2026)

Abra o **Ateliê Elemental Quarks** no portal. Escolha Água, Fogo ou Vento e use o seletor **Opção visual** (A/B/C). **Contato agora** dispara o contato durante o trajeto; ele também acontece automaticamente ao terminar o trajeto. São animações da prévia, sem regras de colisão ou dano.

| Move | A | B | C |
|---|---|---|---|
| Water Pulse | Hadouken compacto | Lança com ponta longa | Hélice com três jatos |
| Fire Spin | Anel de chamas | Braços espirais abertos | Coroa dupla |
| Air Slash | Arco único branco | Três navalhas | Arco com rastros longos |

A água mantém seu shader de correntes e espuma. A ponta avança no eixo do disparo e o stretch cresce com a velocidade durante a aceleração. O contato comprime o núcleo e abre uma explosão transversal de água e gotas Quarks. Controles: **Alongamento pela velocidade** e **Tamanho do contato**.

O fogo ocupa uma faixa anular: o centro fica aberto nas três variantes. **Raio do centro aberto** ajusta a abertura. O cone de tornado foi removido.

Air Slash usa superfícies brancas lisas, arcos abertos e retos no plano do corte. O contato usa riscos radiais e arcos de pressão; nenhuma superfície aquática é criada para vento.

[Galeria das nove opções e seis contatos](../prototypes/combat-lab/evidence/elemental-quarks/index.html). [Resultado automatizado](../prototypes/combat-lab/evidence/elemental-quarks/variants-results.json).

Teste: `node prototypes/combat-lab/test/elemental-variants.browser.mjs`: 9 opções, contatos, aceleração/stretch, acessibilidade e limpeza. Build, typecheck e testes Quarks executados. Desempenho em hardware lento não medido.

As seções abaixo registram versões anteriores; esta revisão substitui as descrições antigas de tornado, lâmina inclinada e dissipação aquática.

---
# Moves elementais — protótipos visuais com three.quarks

## Abrir
No `ABRIR_ARENAMON.html`, clique **Ateliê Elemental Quarks · Água, Fogo e Vento refeitos**.
Arquivo direto: `prototypes/combat-lab/dist/arenamon-elementais-quarks.html`.
Escolha o Move, ajuste os controles e clique **Reproduzir**. A repetição começa ativada; **Parar** limpa a cena. O seletor PL aparece somente para Water Pulse. Arraste a cena para mudar a câmera.

## Conteúdo
- **Water Pulse:** esfera translúcida azul, anéis orbitais, gotas e rastro. PL2/PL3 multiplicam tamanho, quantidade e brilho e acrescentam anéis aos valores-base dos controles.
- **Fire Spin:** emissor Quarks em cone sequencial e órbita produz chamas ascendentes em espiral, com brasas e anéis no solo. A emissão cresce no início e decai ao final.
- **Air Slash:** superfície crescente com faixas finas, partículas alongadas de vento e dissipação em rajada.
- **Seed Bomb:** semente em arco, folhas no rastro, explosão radial de folhas e poeira no fim do trajeto visual.

As superfícies contínuas (esfera, anéis, lâmina e semente) são malhas Three.js. Todas as partículas, inclusive folhas, chamas e explosões, usam `ParticleSystem`, emissores, curvas e comportamentos do **three.quarks 0.17.1**. Não há simulação manual de partículas. Não há dano, colisão ou implementação dos Moves no jogo.

## Ajustes
Controles por Move: duas cores, tamanho do núcleo, quantidade/taxa de emissão, velocidade, duração, brilho, tamanho e vida das partículas, rotação, altura/arco, dispersão e número de anéis/faixas quando aplicável. Os ajustes são mantidos durante a sessão e **Restaurar este Move** recupera o preset. Não são gravados no balanceamento nem persistidos após fechar a página.

**Sem flash / pulsação** elimina a pulsação dos anéis, reduz o brilho e usa mistura normal das partículas. **Movimento reduzido** diminui emissão, deslocamento e rotação; respeita também a preferência de movimento reduzido do sistema na abertura. Nenhum efeito usa flash de tela ou tremor de câmera.

## Correção do laboratório original
Confirmado no código instalado: `PiecewiseBezier` recebe o início do segmento; `1` deixava toda a curva anterior a 1 sem função. Corrigido para `0`. `ParticleSystem` já cria seu `emitter`; as três criações duplicadas foram substituídas por `system.emitter`.
O preset de carga foi reproduzido e capturado no Edge **antes** da criação dos novos efeitos: [captura inicial](../prototypes/combat-lab/evidence/elemental-quarks/step-0-charge.png).
A ponte do jogo e seu comportamento de fallback não foram modificados.

## Evidências e verificação
[Galeria de capturas](../prototypes/combat-lab/evidence/elemental-quarks/index.html) · [Resultados do navegador](../prototypes/combat-lab/evidence/elemental-quarks/results.json).

- `npm run build:combat-lab`: gera também a nova página offline.
- `npm run typecheck`.
- `node prototypes/combat-lab/test/quarks.test.mjs`: inclui regressão para identidade do emissor e tamanho positivo das partículas.
- `node prototypes/combat-lab/test/elemental-quarks.browser.mjs`: Edge offline, quatro efeitos, PLs, mudança de parâmetro, acessibilidade, parada e encerramento/limpeza.

Limitações: protótipos para ajuste visual; não foi medido desempenho em computadores lentos, nem feita integração dos elementais ao combate. O fallback sem Quarks não sofreu alterações; não foi injetada falha de carregamento no jogo nesta tarefa. Base: `origin/main` em `0ed46dc`; sem uso do PR #94.

Verificação geral: `npm run verify` interrompido em `skills:check` por 11 skills preexistentes ausentes/divergentes em `.claude/skills`. O typecheck executado separadamente passou.

## Reconstrução visual — água, fogo e vento

Revisão a partir das sete referências fornecidas pelo usuário, com direção visual inspirada em Genshin Impact e Naruto Ultimate Ninja Storm 4. As imagens orientaram forma, cor e movimento; não foram usadas como texturas.

As três construções anteriores foram removidas do runtime e substituídas:
- **Água:** esfera com deformação suave, sombreamento azul, correntes procedurais, espuma e borda luminosa. Faixas orbitais se acomodam à esfera. A ruptura abre uma coroa curva, onda e gotas Quarks.
- **Fogo:** tornado com volume cônico irregular, três faixas largas em espiral, recortes animados, tons quentes e anéis no solo. Chamas menores e brasas continuam no Quarks. Cresce na entrada e se contrai no encerramento.
- **Vento:** lâmina inclinada com borda afiada, várias superfícies translúcidas que formam um rastro longo e dissipação circular. As linhas de velocidade são emitidas pelo Quarks.

Novos controles: contraste das faixas/espuma, comprimento do rastro de vento, halo luminoso e acompanhamento da câmera. O halo é desligado por **Sem flash**. As superfícies usam UVs animadas, ruído, transparência e Fresnel; suas animações também respeitam movimento reduzido. Nenhuma malha antiga dos três efeitos continua sendo criada.

Arquivos: `elemental-surfaces.js` concentra as novas superfícies/shaders; `elemental-preview.js` integra as superfícies aos emissores Quarks. A galeria vinculada no portal foi atualizada, incluindo a ruptura de Water Pulse.

Testes da reconstrução: build e typecheck, 20 testes do adaptador e navegador Edge offline (incluindo erros de shader/console, reprodução, PL, controles, acessibilidade e limpeza). A qualidade artística ainda depende da avaliação do usuário. Não medido em máquinas lentas; não validado em outros navegadores.
