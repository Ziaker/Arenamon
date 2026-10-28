# Arenamon VFX Composer F3.2

## Estado

**F3.2 concluída; a F3 completa permanece parcial.** O Composer agora materializa o contrato de partículas em `three.quarks@0.17.1` e permite comparar a prévia autoral com o backend Quarks. A simulação autoral continua sendo a verdade determinística para scrub, rewind, snapshots e orçamento.

## O que mudou

- Conversor puro `toQuarksRecipe`: valida o emissor antes da biblioteca e produz dados declarativos inspecionáveis.
- Adaptador `QuarksParticlePreview`: cria `ParticleSystem` e `BatchedRenderer` reais, mapeia as quatro formas, emissão, vida, velocidade, tamanho, cor, alpha, gravidade, arrasto, turbulência, blending e `depthWrite`.
- Seletor visível **Preview** com `Autoral`, `Quarks` e `Comparar A/B`.
- No modo A/B, as prévias ficam lado a lado; a telemetria identifica sistemas, partículas, draw calls e aproximações.
- Perfil low/medium/high, Reduce motion e No flash são aplicados antes da materialização Quarks.
- Rewind reconstrói o sistema; troca de backend, remoção e descarte liberam sistemas, batches e materiais.
- Bursts periódicos são materializados individualmente, `maxParticles` é imposto no sistema real e scrub longo usa no máximo 120 passos síncronos por rebuild.
- Draft inválido não encerra o loop: o emissor é rejeitado antes do Quarks e a telemetria informa a rejeição.
- A escolha de preview é apenas de interface e não entra no `VfxProject` nem no autosave.

## Como abrir

Abra `ABRIR_ARENAMON.html` e escolha **VFX Composer · F3.2**. Na aba **Partículas**, crie um emissor e altere **Preview** para `Quarks` ou `Comparar A/B`.

## Demonstração dentro do app

O Composer não abre mais vazio: ao carregar, a cena já mostra os três efeitos da auditoria (Brasa Ascendente, Névoa Fria e Estilhaço Arcano) tocando em loop, na aba **Partículas**, com a barra de demonstração visível.

- **▶ Tocar os 3 efeitos**: recarrega a demonstração de partículas e volta a tocar.
- **💥 Explosão (cubos + esferas)**: carrega uma explosão de 8 cubos vermelhos (`#ff2b2b`) e 8 esferas amarelas (`#ffd400`) que saem do mesmo ponto (0; 0,9; 0) e se abrem em casca esférica; 16 objetos e 48 tracks de posição (X, Y, Z por objeto), 1,6 s em loop, aberta na aba **Animação** com a timeline à vista.
- **Projeto vazio**: limpa o documento para começar do zero.

Para reproduzir a explosão manualmente: **+ Cubo** ou **+ Esfera** → **Cor do objeto** no inspetor → **Posição** (0; 0,9; 0) → aba **Animação** → em `t = 0`, `t = 0,25` e `t = 0,9` ajuste a posição e use **+ Keyframe no tempo** com a propriedade em `Posição X`, `Y` e `Z` → **▶ Play**. O caminho curto é selecionar os objetos com **Ctrl+clique** e usar **Explodir selecionados**.

A cor por objeto é um campo do documento (`nodes[].color`, hexadecimal `#rrggbb`), validado pelo contrato e editável em **Cor do objeto**; sem cor, o objeto mantém o material padrão do app.

## Ferramentas de autoria (lacunas da montagem manual)

Montar a explosão à mão expôs faltas que agora estão na interface:

- **Seleção múltipla:** `Ctrl+clique` (ou `Shift+clique`) na hierarquia marca vários objetos; **+ Keyframe no tempo** e **Explodir selecionados** agem em todos. A seleção múltipla aparece destacada e o inspetor mostra `objeto + N`.
- **Explosão radial:** raio (m), tempo (s), elevação (m) e semente. Os rótulos mostram a unidade ao vivo; a semente garante o mesmo resultado para os mesmos valores. A ferramenta estende a timeline quando o tempo escolhido passa da duração atual e gera keyframes em `t = 0`, 30% do tempo e no tempo final, com o preset usando a mesma função pura `buildRadialTracks` (`src/animation/radial.ts`).
- **Trilhas do objeto:** lista as trilhas do objeto selecionado, com cada keyframe clicável para mover o playhead e um **✕** para remover a trilha; **Limpar animação do objeto** remove todas de uma vez.
- **Rotação e escala:** campos em graus (°) e multiplicador (×), aplicados aos objetos selecionados e refletidos pelo gizmo; posição e pivô continuam em metros.
- **Paleta de cores:** seis amostras rápidas (vermelho, amarelo, laranja, ciano, violeta e branco) mais o campo hexadecimal; o ponto de cor aparece na hierarquia.
- **Duplicar:** botão **⧉ Duplicar** ou `Ctrl+D`, copiando também as trilhas do objeto.
- **Remover objeto:** botão 🗑 na hierarquia ou `Delete`/`Backspace`, removendo o objeto e suas trilhas (antes não havia como apagar um objeto pela interface).
- **Enquadrar cena:** botão **Enquadrar** ou `F` enquadra tudo o que está visível, útil depois de explodir.
- **Projeto vazio:** limpa também a seleção, o inspetor e a lista de trilhas.

Evidência visual e resultado do teste: `prototypes/vfx-composer/evidence/f3-authoring/index.html`.

## Verificação focal

- `npm run test:vfx-composer:f3:quarks`: conversão pura, formas, emissão, qualidade, acessibilidade e entrada inválida.
- `npm run test:vfx-composer:f3:quarks:adapter`: biblioteca real, avanço, rewind, remoção e dispose.
- O mesmo teste cobre bursts repetidos, teto real, `depthWrite` no batch, abertura mapeada, draft inválido e horizonte de passos.
- `npm run test:vfx-composer:f3:quarks:browser`: HTML offline, três modos, não persistência da preferência e alternância sem acúmulo de geometria.
- `npm run test:vfx-composer:f3:browser`: regressão de determinismo, orçamento e acessibilidade da F3.1.
- `npm run test:vfx-composer:f3:audit`: auditoria E2E com três efeitos criados pela UI, pixels reais no canvas, playback, scrub, Quarks A/B, exportação/reimportação e recuperação de autosave.
- `npm run test:vfx-composer:f3:authoring`: seleção múltipla, explosão radial com unidades, seek/remoção de trilhas, rotação/escala, paleta, duplicar, remover objeto, atalhos `Ctrl+D`/`Delete`, enquadrar e projeto vazio; salva capturas em `evidence/f3-authoring/`.
- `npm run test:vfx-composer:f2`: inclui o gerador radial puro (determinismo por semente, limites e erros).

Resultados completos estão em `prototypes/vfx-composer/evidence/F3_2_VALIDATION.md` e na auditoria `docs/VFX_COMPOSER_F3_AUDITORIA.md`.

## Correção de recuperação incorporada

O Composer agora carrega o projeto pelo `AutosaveManager.load()`, em vez de ler o JSON bruto do `localStorage`. Com o slot principal corrompido, ele usa o backup válido e informa a recuperação em `#status`; sem nenhum snapshot válido, abre o projeto inicial e informa o fallback. O estado aparece em `window.__ARENAMON_VFX_COMPOSER__.recovery`.


## Limites honestos

- Não há paridade numérica de posições aleatórias entre Quarks e a simulação autoral. A paridade é do contrato de parâmetros; snapshots exatos continuam autorais.
- Turbulência, abertura angular e arrasto usam as aproximações oferecidas pelo Quarks e são identificados na telemetria.
- Não foi feita medição de GPU/FPS nem baseline por hardware.
- Trails/beams, impacto desenhado, decals, máscaras de profundidade, subefeitos, luzes e pós continuam para os próximos incrementos F3.
- Publicação no jogo, eventos e compilador runtime permanecem bloqueados até a F4.

## Skills aplicadas

- `arenamon-routing` e `arenamon-vfx-composer`: gate F3 e isolamento do Combat Lab.
- `performance-optimization`: limites, telemetria e ciclo de vida explícito, sem alegação de FPS.
- `shader-programming` e `threejs-scene-setup`: integração de materiais/blending/depth e um único renderer da cena.
- `game-feel`: curvas de tamanho/cor/alpha e comparação visual A/B.
- `writing-plans`, `test-driven-development`, `systematic-debugging` e `executing-plans`: plano persistido, RED→GREEN e correção da fronteira de vetores Three/Quarks pela causa raiz.
