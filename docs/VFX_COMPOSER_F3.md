# Arenamon VFX Composer F3.1

## Estado

**F3.1 concluída; a F3 completa permanece PARCIAL.** Esta fatia entrega o contrato de partículas, a simulação determinística, a prévia renderizada, o orçamento por perfil e a telemetria. Ela nasceu da autorização explícita do responsável em 27/10/2026 ("continuar o trabalho do VFX Composer"), registrada aqui como a autorização exigida pelo gate da F2.

A F3 não está encerrada: ainda faltam o adaptador real de three.quarks, rastros/feixes, impacto desenhado, decals, máscaras de profundidade, hierarquia de subefeitos e luzes/pós. Nada disso foi antecipado.

## Escopo implementado

| Decisão | O que esta fatia entrega | O que continua fora |
|---|---|---|
| 9B | Emissor modular declarativo: burst/contínuo, forma (ponto, esfera, anel, cone), velocidade, gravidade, arrasto, turbulência, vida, curvas de tamanho/alpha/cor | Colisão visual e trajetórias em curva pertencem à F3.2/F3.3 |
| 14B | Indicadores de partículas e draw calls, alerta de custo, perfil low/medium/high e bloqueio de publicação acima do orçamento | Medição real de GPU e baseline por hardware |
| 30B (parte) | `blending` normal/additive e `depthWrite` controláveis por emissor | Oclusão, máscaras e soft intersection |
| 33B | Workspace **Partículas** no mesmo documento, com painel próprio | Workspaces Modelagem/Testes completos |
| 42B | A prévia respeita o tempo da timeline (scrub, reverse, stop) | Onion skin de partículas |
| 47B | Custo acima do limite por perfil marca o efeito como **não publicável** | Publicação real (F4) |

## O que existe

- `ParticleEmitter` validado no mesmo `VfxProject` (campo opcional `particles`, compatível com projetos F0/F1/F2).
- Simulação pura e semeada em `src/particles/particles.ts`:
  - hash determinístico por partícula/canal (`randomAt`), sem `Math.random`;
  - integração **fechada** com arrasto e gravidade e turbulência senoidal, portanto sem estado acumulado entre quadros;
  - o mesmo `(emissor, tempo, perfil, acessibilidade)` devolve exatamente as mesmas amostras, inclusive ao voltar no tempo.
- Prévia em `src/app/particle-preview.ts`: um `THREE.Points` por emissor, atributos atualizados in-place, shader de disco suave (sem textura, sem assets remotos), um draw call por emissor e descarte explícito de geometria/material.
- Painel **Partículas** com slider + campo numérico sincronizados para cada parâmetro, unidade, passo e valor padrão (T28).
- Telemetria ao vivo: partículas no quadro, pico, draw calls, pico estimado e veredito de orçamento.
- Acessibilidade: **Reduce motion** reduz a emissão a 35% e **No flash** limita a opacidade a 85%; a supressão é reportada na interface.
- Undo/Redo, autosave e importação continuam passando pelo mesmo `DocumentStore`.

## Como abrir

Abra `ABRIR_ARENAMON.html` e escolha **VFX Composer · F3.1**, ou abra diretamente `prototypes/vfx-composer/dist/arenamon-vfx-composer.html`. Na aba **Partículas**, clique em **+ Emissor**.

## Como testar em 30 segundos

1. **+ Emissor** → o viewport mostra as faíscas e a telemetria passa a contar partículas.
2. Arraste **Burst**, **Vida máx.**, **Abertura** e **Arrasto**; a prévia responde antes de aplicar.
3. **Aplicar emissor** → Undo/Redo funcionam sobre o emissor.
4. Mude **Perfil** para `low`: acima de 400 partículas o selo fica vermelho e diz que o efeito não é publicável.
5. Marque **Reduce motion** e **No flash**: a contagem cai e a supressão aparece no selo.

## Verificação executada

```powershell
npm run typecheck:vfx-composer
npm run test:vfx-composer        # 23 contratos F0
npm run test:vfx-composer:f1     # DocumentStore, persistência, geometria
npm run test:vfx-composer:f2     # timeline, morph, textura, material
npm run test:vfx-composer:f3     # contrato, determinismo, orçamento, acessibilidade
npm run test:vfx-composer:f2:browser
npm run test:vfx-composer:f3:browser
```

- `f3-particles.test.mjs`: validação positiva/negativa, mesmo seed e tempo → mesmas amostras, rewind sem estado, seed diferente altera, ausência de NaN, teto por emissor, duração de emissão, perfis low/high, bloqueio de publicação, redução por acessibilidade, noFlash e roundtrip do documento.
- `f3-app.browser.mjs` (Edge offline, duas execuções independentes): cria emissor, confere slider/campo sincronizados, prova que voltar a 0,4 s reproduz o mesmo snapshot, que outra seed muda o resultado, que `low` bloqueia e `high` publica, que Reduce motion reporta supressão, que NoFlash limita a opacidade e que criar/remover/retroceder cinco vezes não acumula geometria.

Evidências versionáveis: `prototypes/vfx-composer/evidence/f3/composer-f3.png` e `resultado.json`.

## Skills realmente utilizadas

| Skill | Ação concreta nesta entrega |
|---|---|
| `arenamon-routing` | Manteve o trabalho no editor offline e fora da simulação de combate |
| `arenamon-vfx-composer` | Aplicou o gate: partículas só na F3; nada de runtime, Quarks, decals ou publicação antecipados |
| `threejs-scene-setup` | Prévia como `THREE.Points` no grupo da cena, atualizada no `setAnimationLoop` existente, sem segundo renderer |
| `shader-programming` | Shader de disco suave com `smoothstep`, `discard` e tamanho com atenuação por distância; sem `eval` nem GLSL de projeto |
| `performance-optimization` | Buffers tipados in-place, zero alocação por partícula, um draw call por emissor, telemetria de pico e teste de vazamento de geometria |
| `game-feel` | Curva de vida (tamanho/alpha/cor), fade-in curto para evitar "pop" e supressão proporcional em reduce motion |
| `physics-tuning` | Leitura seletiva: integração fechada com arrasto para evitar instabilidade de passo variável |
| TDD | Aplicado à mão: testes de contrato antes do painel, depois browser; sem skill `test-driven-development` instalada |

## Limites preservados

- Nenhuma partícula decide dano, acerto, colisão ou recurso; o Composer só desenha.
- Nenhum módulo de simulação, `Game.step`, view ou renderer de combate foi importado ou alterado.
- Sem three.quarks nesta fatia: a prévia é própria e determinística. O adaptador Quarks é o próximo passo da F3 e não foi simulado.
- Sem rastros/feixes, impacto desenhado, decals, máscaras de profundidade, subefeitos, luzes e pós-processamento.
- Sem medição de GPU, p95 ou comparação low/medium/high em hardware real; a telemetria conta partículas e draw calls, não tempo de quadro.
- A prévia usa `Points` sem ordenação por profundidade; com blending `normal` e muitas camadas transparentes pode haver sobreposição incorreta.
- Sem QA frontal/lateral dedicado das partículas nesta fatia; a captura é em perspectiva.

## Próximo passo

F3.2 (plano em `docs/superpowers/plans/2026-10-27-vfx-composer-f3-2.md`) — adaptador declarativo para three.quarks com o mesmo contrato, mantendo a simulação determinística como verdade de autoria e comparando amostra a amostra contra o runtime. Depois: rastros/feixes, impacto, decals e subefeitos, até o gate completo da F3.
