# Padrão dos ateliês de VFX — parâmetros iguais para cada efeito visual

Primeira versão, 23/10/2026. Vale para **todo ateliê, protótipo de VFX e Move com efeito visual** do Arenamon, atual ou futuro. O objetivo é que qualquer efeito (água, fogo, vento, grama, ou o que vier) tenha **os mesmos tipos de controle**, na mesma ordem, e que nenhum ajuste se perca.

Origem: pedidos do diretor do projeto (fases obrigatórias, slider para tudo com explicação, limites, efeitos de disparo selecionáveis, salvar/exportar). O que é **decisão do diretor** está marcado como **[regra]**. O que é **proposta de padrão a confirmar** está marcado como **[proposta]**.

Documento do estado atual dos elementais: [MOVES_ELEMENTAIS_VISUAL_QUARKS.md](MOVES_ELEMENTAIS_VISUAL_QUARKS.md). Referência de implementação: Ateliê Elemental (`prototypes/combat-lab/elemental-lab/`, `src/view/quarks/`).

---

## 1. Fases obrigatórias de todo efeito **[regra]**

Todo efeito de ataque, projétil ou objeto precisa ter, nesta ordem, e **não pode entregar protótipo sem elas**:

1. **Conjuração / surgimento:** como o efeito aparece.
2. **Disparo / lançamento:** o momento em que ele sai (clarão, coice, ondas, jato).
3. **O efeito em si:** o visual do projétil, do ataque ou do objeto em movimento.
4. **Duração média:** quanto tempo ele dura em cena.
5. **Finalização ou contato:** como ele termina ou atinge algo.
6. **Efeito de contato / explosão / finalização:** o que acontece ao atingir (só quando há contato; sem contato, a finalização).

Cada fase tem **seu grupo de sliders** no painel e **seu nome na legenda** do canto da tela (ex.: *Surgimento · Disparo (impacto) · Voo · Contato / dissipação*). Quem pede um efeito costuma deixar de fora o disparo e o contato: **estas duas fases nunca podem faltar no protótipo**.

### 1.1 Cada fase é desligável **[regra]**

Nem todo efeito precisa de todas as fases (uma aura contínua não tem contato; um raio pode não ter conjuração). Por isso **cada fase tem um interruptor “Ligar esta fase”** no topo do seu grupo de sliders:

- **Padrão: ligada.** Desligar é uma escolha de quem ajusta, não um esquecimento de quem construiu. O protótipo sempre entrega as seis fases construídas e desligáveis; a fase só some quando alguém a desliga.
- Fase desligada **não executa e não aparece na legenda**; o efeito segue direto para a próxima fase ligada.
- Os sliders da fase desligada **continuam visíveis, esmaecidos, e guardam os valores**; ao religar, voltam como estavam.
- O estado de cada interruptor entra no **Exportar/Importar** e no **salvamento automático**, junto com os demais valores.
- Isso substitui os “desligadores” avulsos de hoje (duração 0 do impacto do disparo, opção “Nenhum” do seletor de disparo): todos passam a ser o mesmo interruptor.
- Se o usuário desligar todas as fases que desenham algo, o painel avisa que não há nada para mostrar, em vez de ficar em branco sem explicação. **[proposta]**

## 2. Slider para tudo, com explicação **[regra]**

Tudo o que o usuário pode querer ajustar tem controle na interface. Nenhum valor importante fica só no código.

Cada controle tem:
- **nome claro** e **unidade** visível, por exemplo *Raio das argolas (× núcleo)*;
- **explicação curta** logo abaixo (o que muda na tela);
- **slider e campo numérico** sincronizados;
- **agrupamento por fase** (títulos de seção no painel);
- **interruptor “Ligar esta fase”** no grupo de cada fase (seção 1.1);
- botão **Restaurar** do efeito.

Parâmetros de qualquer efeito, por fase **[proposta]** (os que fizerem sentido para o efeito):

| Fase | Controles de referência |
|---|---|
| Surgimento | duração, escala inicial, partículas de surgimento |
| Disparo | seletor do efeito de disparo (seção 4), clarão, coice, atraso |
| Efeito em voo | tamanho, comprimento, largura, formato, cores, brilho, giro, velocidade, arco/altura, ondulação |
| Rastro / partículas | quantidade, raio de emissão, velocidade, tamanho, vida, cor, giro |
| Duração | duração do trajeto/sustentação, tempo de abertura e de dissipação |
| Contato / explosão | duração visual, tempo de abertura, escala inicial, expansão contínua, quantidade/velocidade/tamanho/vida/raio das partículas, coroa/onda, compressão do núcleo |

Referência prática: o Water Pulse tem 40 sliders por fase (disparo das argolas, forma, rastro, contato) e 13 do impacto do disparo.

### Limites dos sliders **[regra]**

- O máximo de cada slider é **5× o máximo base** do controle (a água usa 300×, por decisão anterior).
- **Ângulos** ficam em ±180° (sem multiplicar).
- Controles de **impulso, direção e deslocamento aceitam sinal**: mínimo **negativo**, máximo positivo, zero marcado no meio. A explicação diz o que cada sinal faz (ex.: positivo vai à frente, negativo vai para trás).

### Valores padrão

Os padrões **mantêm o visual atual**. Parâmetro novo que muda a aparência começa desligado ou discreto, para não alterar o que já foi aprovado sem aviso. **[proposta]**

## 3. Efeito escolhido pelo usuário: seletor de disparo **[regra]**

A partir de agora, os efeitos de disparo são **selecionáveis**. O painel tem **"Efeito de disparo"** com as opções **Nenhum**, **Argola** e **Tiro em cone**. Só aparecem os sliders do efeito escolhido; **os valores dos dois ficam guardados** quando se troca de opção. O seletor deve ser um **módulo reutilizável**, igual para todos os Moves.

### 3.1 Argola

Anel que sai da origem do disparo.

| Controle | Unidade | Observação |
|---|---|---|
| Tamanho | m | raio da argola |
| Vertical | m | deslocamento vertical, **com sinal** |
| Horizontal | m | deslocamento ao longo do trajeto, **com sinal** |
| Achatamento horizontal | × | comprime ou estica a argola ao longo do trajeto |
| Impulso horizontal | m/s | **com sinal**: positivo à frente, negativo para trás |

Extras **[proposta]**: espessura, quantidade de argolas, intervalo entre elas, duração, expansão (×/s), opacidade, cor e brilho.

### 3.2 Tiro em cone

Jato de partículas em cone.

| Controle | Unidade | Observação |
|---|---|---|
| Horizontal | ° | direção do cone, **com sinal** |
| Vertical | ° | direção do cone, **com sinal** |
| Tamanho | m | raio de abertura e comprimento |
| Partículas | un. | quantidade |
| Impulso horizontal | m/s | **com sinal** |
| Impulso vertical | m/s | **com sinal** |

Extras **[proposta]**: abertura do cone (°), tamanho, vida, cor e brilho das partículas, dispersão, duração da emissão, atraso.

### 3.3 Impacto do disparo (já implementado no Water Pulse e no Air Slash)

Clarão, halo, coice do núcleo, ondas de choque e jato de partículas para trás, com 13 sliders (duração, clarão, halo, coice, quantidade/raio/espessura/intervalo das ondas, quantidade/velocidade/tamanho/vida das partículas, abertura do jato). Duração 0 desliga. A relação com o seletor (se vira uma terceira opção ou se continua somando às outras) **está em aberto**.

## 4. Salvar o trabalho **[regra]**

Todo ateliê deve ter, no painel:
- **Salvamento automático** de tudo (sliders, cores, efeito e opção escolhidos, interruptores das fases, preferências de tela);
- **Exportar (.json)** com todos os efeitos e opções ajustados, com data no nome;
- **Importar**, que valida o arquivo, recusa o que não for do ateliê e conta o que ignorou;
- aviso de **onde** foi salvo e do **limite** (o salvamento automático vale para o mesmo navegador e o mesmo arquivo HTML; só o arquivo exportado é cópia segura).

Formato de referência: `arenamon-elementais-config` (versão 1), em `elemental-lab/main.js`.

## 5. Acessibilidade **[regra do projeto]**

- **Sem flash / pulsação:** zera clarão e halo luminoso; limita o brilho; mantém ondas e partículas.
- **Movimento reduzido:** reduz velocidade, quantidade e giro; respeitar `prefers-reduced-motion` como valor inicial.

## 6. Estilo visual **[proposta]**

Superfícies contínuas desenhadas por shader para a silhueta do elemento; **partículas sempre em three.quarks**. Cores diferentes por tipo de elemento, nunca tudo da mesma cor. O estilo definitivo ainda precisa ser descrito e aprovado pelo diretor; até lá, o Ateliê Elemental é a referência.

## 7. Entrega de cada ateliê ou efeito **[regra do projeto, AGENTS.md]**

1. Abre por arquivo da pasta oficial, **sem rodar comandos**, com **link no portal** (`ABRIR_ARENAMON.html`) a no máximo 2 cliques.
2. **Teste de navegador** (padrão `test/*.browser.mjs`, Edge offline) que confira cada slider na interface e no runtime, os limites (inclusive negativos), as fases, **o liga/desliga de cada fase (a legenda a pula e os valores sobrevivem)**, o salvar/exportar e a limpeza.
3. **Capturas** na galeria de evidências (`prototypes/<sistema>/evidence/`).
4. **Documentação** em `docs/` e versão do `package.json` aumentada.
5. `npm run build:combat-lab` e `npm run typecheck` antes de entregar.
6. A resposta final diz, em português, o que mudou, qual arquivo abrir, o que foi testado e **o que não foi**.

## 8. Estado atual de adoção (23/10/2026)

| Item | Água | Fogo | Ar | Grama |
|---|---|---|---|---|
| Sliders por fase | 40 + 13 | 10 de forma | 13 de disparo | só os genéricos |
| Impacto do disparo | sim | não se aplica | sim | não |
| Seletor Argola / Tiro em cone | **não** | **não** | **não** | **não** |
| Interruptor por fase | **não** | **não** | **não** | **não** |
| Exportar / importar / automático | sim (ateliê todo) | sim | sim | sim |
| Limites 5× / sinal negativo | 300×, sem sinal | 5×, sem sinal | 5×, sem sinal | 5×, sem sinal |
| Fases na legenda | Disparo / Início / Trajeto / Contato | Início / Sustentação | Disparo / Início / Trajeto / Contato | Início / Trajeto / Contato |

O seletor, o interruptor por fase, os controles com sinal e as fases de surgimento e duração **ainda não existem em nenhum Move**: este documento define o padrão para quando forem implementados. O Seed Bomb é o primeiro candidato (prompt pronto fora deste documento).

## 8.1 Adoção no Atelier Areia/Pedra (24/10/2026)

O [Atelier Areia/Pedra](LAB_AREIA_PEDRA.md) (VOL. 07) já tem, nas 24 propostas: interruptor por fase, sliders por fase com campo numérico e explicação, seletor de disparo Nenhum / Argola / Tiro em cone (decisão: o impacto do disparo é uma camada à parte que soma ao seletor), controles com sinal, limites expandidos, aviso ao desligar tudo, salvamento automático, exportação datada, importação que ignora e conta, Sem flash e Movimento reduzido. Continuam **sem** isso os Moves elementais do ateliê Quarks (Water Pulse, Fire Spin, Air Slash, Seed Bomb) e o jogo. O estilo visual definitivo (§6) segue em aberto.

## 9. Ficha copiável para pedir um efeito novo

```
Efeito: <nome e elemento>
Fases a desligar (se houver): <quais não se aplicam>
Surgimento: <como aparece>
Disparo: <Nenhum | Argola | Tiro em cone> + <clarão/coice/ondas, se quiser>
Efeito em voo: <aparência, duração média>
Contato / explosão: <o que acontece ao atingir>
Sliders: um para tudo, por fase, com unidade e explicação; limites 5×; sinal nos impulsos
Salvar: automático + Exportar/Importar
Acessibilidade: Sem flash e Movimento reduzido
Entrega: teste de navegador, capturas, docs, versão, link no portal
```

## 10. O que ainda falta decidir

- Se desligar a fase “efeito em si” deve ser permitido (hoje a regra permite, com aviso).
- Se o impacto do disparo vira terceira opção do seletor ou soma às outras.
- Padrões de cada parâmetro dos extras marcados como **[proposta]**.
- Estilo visual definitivo (seção 6).
- Aplicar o seletor ao Water Pulse e ao Air Slash (hoje só estão planejados para o Seed Bomb).
