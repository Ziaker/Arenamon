# Padrão dos Ateliês de VFX — Parâmetros, Fases, Disparo e Arquitetura Visual

Versão 2.0 — 24 de outubro de 2026.
Norma mandatória para **todo ateliê, protótipo de VFX, Move com efeito visual e entidades gráficas** do Arenamon, atuais ou futuros.

Este padrão define a estrutura única, a ordem de controles, o modelo de fases sequenciais, o seletor de disparo, o afunilamento métrico e as regras de coerência artística para garantir que nenhum ajuste se perca e que todos os efeitos mantenham padrão de jogo de alto impacto (estilo *Zenless Zone Zero* e *action anime*).

---

## 1. Regra de Coerência e Fidelidade Temática do Disparo **[REGRA OBRIGATÓRIA]**

Fica expressamente **proibido o uso de efeitos de disparo genéricos ou reaproveitamento tipo "carimbo"** (como injetar uma mesma argola ou cone cinza em qualquer golpe sem justificativa de design).

1. **Identidade do Move:** O efeito de disparo deve nascer da proposta visual, peso físico e elemento do golpe:
   - **Vento / Ar / Vácuo:** Deve projetar lâminas de descompressão delgadas, anéis afilados de vácuo, fitas de ar esticadas e estalo cinético repentino (*snap*).
   - **Pedra / Terra / Areia:** Deve projetar fragmentos angulares rígidos, poeira com gravidade e atrito, choque de fratura no solo ou ondas de choque terrosas densas.
   - **Água / Fluidos:** Deve exibir tensão superficial, gotas elásticas esféricas, bocal pressurizado e coalescência hidrodinâmica.
   - **Fogo / Plasma:** Deve exibir expansão incandescente, turbulência térmica, ondas de calor refrativas e consumo rápido de combustível.
   - **Psíquico / Energia Pura:** Deve exibir distorções geométricas, anéis concêntricos de frequência, condensação ótica e linhas de força direcionadas.
2. **Direção e Momentum:** O vetor de saída do disparo deve ser rigorosamente alinhado com a animação anatômica do personagem (ponta da garra, boca, cauda, báculo ou núcleo) e transferir o impulso de velocidade diretamente para a fase de corpo/trajeto do Move.
3. **Ponte Cinética (*Bridge*):** O disparo não é um enfeite desconectado; ele marca a liberação da energia. A transição entre o disparo e o início do trajeto em voo deve ser contínua, sem teleportes visuais ou vácuos temporais estranhos.

---

## 2. As 6 Fases Obrigatórias de Todo Efeito **[REGRA]**

Todo efeito de ataque, projétil, barreira ou objeto de combate divide seu ciclo de vida em 6 fases lógicas padronizadas, nesta exata ordem:

```
[1. Surgimento] ➔ [2. Disparo] ➔ [3. Corpo/Trajeto] ➔ [4. Sustentação] ➔ [5. Finalização] (ou [6. Impacto])
```

1. **Surgimento / Conjuração (`start`):** O nascimento da energia (clarão preparatório, aviso no solo, runa, condensação ou antecipação antes da liberação).
2. **Disparo / Lançamento (`launch`):** O momento exato em que a massa do projétil ou golpe se liberta da origem (coice, estalo de vácuo, bocal pressurizado, onda de choque inicial).
3. **Corpo / Trajeto (`body`):** A entidade principal em movimento ou formação espacial (o míssil, a lâmina em rotação, a onda de areia, o feixe concentrado).
4. **Duração / Sustentação (`hold`):** O intervalo em que a entidade viaja ou permanece estável no ar/cenário até expirar ou atingir algo.
5. **Finalização / Dissipação (`finish`):** O desvanecimento natural quando o projétil atinge seu alcance máximo ou tempo de vida sem colidir com obstáculos/inimigos.
6. **Impacto / Contato (`impact`):** O evento violento de colisão ao atingir um alvo, escudo, chão ou parede (explosão, faíscas, coroa de fragmentos, onda de choque secundária).

### 2.1 Cada Fase é Desligável por Interruptor **[REGRA]**

Nem todo efeito precisa emitir todas as fases visíveis (ex.: um feixe instantâneo pode dispensar surgimento longo; uma aura contínua não tem contato de impacto). Para que isso seja controlado pelo usuário na interface:

- **Padrão: Todas as fases iniciam LIGADAS.** O desenvolvedor entrega todas as seis fases construídas; desligar é opção de quem balanceia a arte.
- **Interruptor individual:** No cabeçalho de cada grupo de sliders existe a chave `Ligar esta fase` (`startOn`, `launchOn`, `bodyOn`, `holdOn`, `finishOn`, `impactOn`).
- **Comportamento quando desligada:** A fase não é renderizada, seu tempo é ignorado no relógio sequencial e seu nome não é impresso na legenda de tela.
- **Preservação de valores:** Os sliders da fase desligada continuam visíveis, porém esmaecidos (opacidade reduzida / desabilitados); os valores numéricos são preservados e gravados normalmente no salvamento e no JSON exportado.
- **Aviso de tela vazia:** Se o usuário desligar todas as fases que geram renderização, o painel exibe aviso claro em amarelo: *"Nenhuma fase visual ligada — o efeito está invisível"*, evitando confusão com bugs de tela.

---

## 3. Afunilamento Métrico de Disparo e Trajeto (*Tapering / Choke*) **[REGRA]**

O afunilamento define a compressão focal da geometria de saída da energia. É obrigatório para jatos, cones, feixes e rajadas de vento, permitindo transições entre agulhas perfurantes pontuais e trombetas de dispersão.

Para eliminar ambiguidades conceituais, **o afunilamento é parametrizado em metros absolutos (Raio Inicial × Raio Final):**

| Parâmetro | Unidade | Faixa Padrão | Explicação |
|---|---|---|---|
| `Raio inicial do disparo` | m | 0.05 a 5.0 | Abertura cilíndrica/radial no ponto de saída (bocal da arma/boca do personagem). |
| `Raio final do trajeto/saída` | m | 0.01 a 10.0 | Abertura do fluxo ao atingir a distância focal de afunilamento. Se menor que o inicial, cria estocada concentrada; se maior, cria dispersão em leque. |
| `Distância focal de afunilamento` | m | 0.1 a 15.0 | Distância ao longo do vetor onde o afunilamento atinge seu raio final programado. |
| `Perfil de afunilamento` | seletor | Linear / Parabólico / Exponencial | **Linear:** cone reto. **Parabólico:** bico de aceleração de alta pressão (Laval). **Exponencial:** choque repentino com ponta afiada. |
| `Offset focal longitudinal` | m | -2.0 a +2.0 | Desloca o estrangulamento para frente ou para trás da boca de disparo (com sinal). |

---

## 4. Seletor de Efeito de Disparo (6 Opções Oficiais) **[REGRA]**

O módulo de disparo é unificado em todos os ateliês através do seletor `Efeito de Disparo` (`shotKind`). Os parâmetros de cada opção são independentes e mantêm seus valores salvos ao trocar de categoria no painel:

```
[0. Nenhum] | [1. Argola] | [2. Tiro em cone] | [3. Burst de vento anime] | [4. Jato pressurizado] | [5. Impacto estelar]
```

### 4.0 Opção 0: Nenhum (`none`)
Nenhuma geometria adicional é gerada no momento da saída (útil para projéteis discretos, invocações puras ou quando apenas o impacto do disparo atua).

---

### 4.1 Opção 1: Argola de Choque (`ring`)
Anel perpendicular ou inclinado que se expande a partir do vetor de lançamento.
- `Raio da argola (m)`: Dimensão circular do anel de choque.
- `Espessura do anel (m)`: Largura do toro/anel tridimensional.
- `Achatamento horizontal (×)`: Deformação elíptica ao longo do eixo frontal do golpe.
- `Deslocamento frontal / vertical (m)`: Posição relativa à origem do lutador (ambos com sinal).
- `Impulso e expansão (m/s)`: Velocidade de propagação do anel no ar.

---

### 4.2 Opção 2: Tiro em Cone (`cone`)
Jato volumétrico de partículas emitido em dispersão cônica.
- `Raio inicial e final (m)`: Aplicação direta do afunilamento métrico (§3).
- `Ângulo de abertura (°)`: Dispersão radial das partículas.
- `Quantidade de partículas (un)`: Densidade do jato no instante do disparo.
- `Comprimento do jato (m)`: Alcance balístico das partículas antes de frear.
- `Desvio angular H / V (°)`: Inclinação do cone em relação à mira (com sinal).

---

### 4.3 Opção 3: Burst de Vento Anime (`windBurst`) **[NOVA CATEGORIA OFICIAL]**
Efeito cinematográfico estilizado inspirado em *action anime* / *cel-shading* (estilo *Zenless Zone Zero*, *Guilty Gear*, cortes de vácuo tipo anime shonen):
- **Silhueta:** Composta por anéis de vácuo ultrafinos, fitas radiais de ar cortante (*crescent air blades*) e linhas de velocidade convergentes (*speedlines*).
- **Curva Temporal:** Abertura explosiva em menos de 0.08 s, com desaceleração rápida e dissipação em estalo (*snap* de vácuo).

| Parâmetro | Unidade | Faixa Padrão | Explicação |
|---|---|---|---|
| `Raio do disco de vácuo` | m | 0.5 a 4.0 | Diâmetro da lâmina circular de choque. |
| `Espessura do fio de corte` | m | 0.01 a 0.15 | Nitidez e espessura física das lâminas cortantes. |
| `Quantidade de fitas de ar` | un | 3 a 16 | Número de arcos de vento radiais projetados no estalo. |
| `Comprimento das speedlines` | m | 0.5 a 5.0 | Fitas de velocidade direcionadas ao longo do vetor do golpe. |
| `Abertura angular do leque` | ° | 15 a 180 | Ângulo do corte: 180° = semicírculo frontal; 360° = burst radial completo. |
| `Curvatura das lâminas` | ° | -90 a +90 | Curva das fitas de vento (positivo = espiral horária, negativo = anti-horária). |
| `Tempo de estalo (snap)` | s | 0.04 a 0.20 | Duração da expansão hiper-rápida do vácuo antes do desvanecer. |
| `Contraste do contorno anime` | × | 1.0 a 4.0 | Intensidade luminosa da borda de cel-shading em torno do vento. |

---

### 4.4 Opção 4: Jato Pressurizado Perfurante (`piercingJet`) **[NOVA CATEGORIA OFICIAL]**
Feixe tubular de alta compressão focal que projeta uma agulha perfurante estreita e densa, acompanhada de estrias de cavitação e micro-gotículas/fagulhas axiais.
- `Afunilamento de bocal (m)`: Raio inicial amplo (câmara de compressão) convergindo para raio final agulhado (< 0.05 m).
- `Comprimento da agulha (m)`: Extensão do feixe pressurizado perfurante.
- `Quantidade de estrias axiais (un)`: Linhas finas de pressão que correm paralelas ao longo da perfuração.
- `Pressão de ejeção (m/s)`: Velocidade extrema de projeção frontal das partículas de pressão.
- `Contração radial (×/s)`: Taxa de compressão visual que suga o ar em volta para a ponta do feixe.

---

### 4.5 Opção 5: Impacto Estelar em Cruz / Starburst (`starburst`) **[NOVA CATEGORIA OFICIAL]**
Detonação visual geométrica em cruz ortogonal com feixes perpendiculares afiados (formato de diamante/estrela de quatro pontas anime), acompanhada de centelhas que se expandem em ângulos retos.
- `Raio dos braços da cruz (m)`: Comprimento dos feixes verticais e horizontais que formam a estrela de detonação.
- `Espessura do núcleo (m)`: Largura do centro geométrico onde as lâminas da cruz se cruzam.
- `Rotação inicial (°)`: Ângulo de inclinação da cruz no disparo (0° = cruz grega perfeita, 45° = cruz em X / Saint Andrew).
- `Intensidade do brilho central` | × | Força emissiva do flash central no instante da detonação.
- `Dispersão de centelhas em cruz (un)`: Quantidade de estilhaços rápidos que viajam especificamente colados aos eixos da cruz.

---

### 4.6 Camada Adicional: Impacto do Disparo (*Recoil & Flash*)
Independente da opção geométrica escolhida no seletor (inclusive na opção *Nenhum*), todo disparo possui uma **camada física secundária que soma ao efeito**, com controles próprios:
- `Clarão frontal (brilho e raio)`: Pulso pontual de luz omnidirecional no local do disparo.
- `Halo luminoso (diâmetro)`: Brilho difuso em gradiente em volta do emissor.
- `Coice cinemático do núcleo (m)`: Recuo físico/visual momentâneo do emissor ou arma para trás.
- `Ondas de choque secundárias (un)`: Conjunto de 1 a 4 mini-ondas concêntricas de refração de calor/vácuo.
- `Jato de escape para trás`: Gotas, fumaça ou faíscas sopradas para o sentido oposto ao tiro (recoil plume).

---

## 5. Padrão de Sliders e Controles de Interface **[REGRA]**

Cada ajuste visual precisa ser operável diretamente no painel lateral do jogo e dos ateliês, sem obrigar ninguém a mexer em código-fonte:

1. **Paridade Slider + Input Numérico:** Cada parâmetro possui um slider deslizante e uma caixa de texto numérica sincronizados bi-direcionalmente em tempo real.
2. **Rótulo e Unidade Explícita:** Nunca usar nomes crípticos. Sempre exibir a unidade clara: metros (`m`), metros por segundo (`m/s`), graus (`°`), segundos (`s`), unidades inteiras (`un`) ou multiplicadores relativos (`×`).
3. **Explicação Didática:** Abaixo de cada controle há um subtítulo sucinto descrevendo o impacto visual prático na cena.
4. **Valores Bidirecionais com Sinal:** Todo controle de direção, deslocamento ou ângulo suporta **valores negativos e positivos com zero ao centro**. A legenda explicita o sentido (ex.: *positivo = frente / negativo = recuo*).
5. **Multiplicador de Limite 5×:** O controle deslizante cobre uma faixa confortável, mas o campo numérico aceita digitação direta de até **5× o valor máximo padrão** sem travar o motor.
6. **Preservação de Padrões Homologados:** Qualquer novo controle implementado deve nascer com valor padrão neutro (desligado, zero ou escala 1.0) para que nenhum efeito previamente aprovado sofra alteração indesejada sem intervenção do usuário.

---

## 6. Acessibilidade Visual e Segurança de Tela **[REGRA DO PROJETO]**

Todo ateliê e sistema de partículas do Arenamon integra controles mandatórios de conforto visual:

- **Modo Sem Flash (`noFlash`):**
  - Desativa clarões brancos plenos na tela, flashes repentinos e estrobos estáticos.
  - Substitui flashes intensos por anéis de contraste escuro ou opacidades suaves sem perder a leitura geométrica do golpe.
- **Modo Movimento Reduzido (`reduceMotion`):**
  - Reduz giros rotacionais desordenados em 75%.
  - Zera tremores de câmera caóticos (*screenshake* excessivo).
  - Respeita automaticamente a chave `prefers-reduced-motion` do sistema operacional como valor inicial.

---

## 7. Pipeline Gráfico e Estilo Visual **[REGRA]**

1. **Silhuetas Contínuas via Shaders:** Massas primárias de elementos (lâminas de vento contínuas, corpos de água, prismas de rocha, frentes de choque) devem ser geradas por malhas Three.js com shaders dedicados (Custom ShaderMaterial), garantindo bordas nítidas e ausência de borrões genéricos.
2. **Partículas Obrigatórias em Three.quarks:** Todas as partículas computadas em lote (poeira, faíscas, centelhas, gotas fluidas) devem rodar obrigatoriamente no motor `three.quarks`, garantindo pooling em GPU e performance estável a 120 Hz.
3. **Contraste Cromático Não-Monocromático:** Proibido usar cor única pura em um efeito. Todo efeito elemental deve possuir gradiente composto de ao menos 3 níveis:
   - *Núcleo / Borda incandescente:* Tom de alta energia/luminância (quase branco/emissivo).
   - *Corpo principal:* Tom saturado do elemento (verde jade, azul anil, laranja brasa, âmbar terroso).
   - *Rastro / Contorno de vácuo:* Tom escuro/fresco de dissipação para garantir leitura contra fundos claros e escuros da arena.

---

## 8. Persistência, Salvamento e Exportação **[REGRA]**

Todo painel de efeito e ateliê deve conter os seguintes utilitários no rodapé:
1. **Salvamento Automático:** Salva todo o dicionário de sliders, interruptores de fase e opções de disparo a cada alteração no `localStorage` sob chave única do Move/Ateliê.
2. **Exportar JSON Datado:** Botão que baixa arquivo de texto formatado (`arenamon-vfx-<nome>-YYYY-MM-DD.json`) contendo todas as variáveis e metadados.
3. **Importar com Validação Defensiva:** Botão que permite carregar um JSON salvo. A rotina valida o esquema, rejeita arquivos corrompidos, restaura os valores válidos e emite relatório dizendo quantas chaves foram carregadas com sucesso.
4. **Botão Restaurar de Fábrica:** Reseta todos os controles do efeito para seus valores homologados oficiais.

---

## 9. Protocolo de Entrega e Aceite Técnico **[REGRA DO PROJETO, AGENTS.md]**

Para que qualquer trabalho de VFX seja considerado entregue e aceito no repositório:

1. **Ponto de Entrada e Acesso no Portal:** Acessível diretamente pelo portal `ABRIR_ARENAMON.html` em até 2 cliques a partir da raiz da pasta oficial, sem depender de comandos de terminal.
2. **Testes Unitários e de Integração:**
   - Teste de simulação pura cobrindo o relógio de fases (`phases.test.mjs`), garantindo que fases desligadas são puladas sem quebrar a duração total.
   - Teste de contratos de parâmetros (`presets.test.mjs`), garantindo que limites, tipos e valores sobrevivem à importação e exportação.
3. **Teste de Navegador Automatizado (`.browser.mjs`):**
   - Execução em Edge headless offline.
   - Verifica se os sliders existem na DOM, se respondem a alterações e se o interruptor esmaece os campos da fase desligada.
   - Confirmação de que alternar entre as 6 opções de disparo não descarta os parâmetros customizados de cada uma.
4. **Evidências Visuais e Capturas:** Gravação de capturas e clipes estáticos na pasta de evidências oficial (`prototypes/<sistema>/evidence/`), mostrando o efeito em vista frontal e lateral.
5. **Compilação e Verificação:** Executar obrigatoriamente `npm run build:combat-lab` e checagem de tipos antes de concluir a tarefa.
6. **Relatório em Português Claro:** A resposta final lista com precisão o que foi modificado, quais arquivos foram tocados, onde abrir para testar na tela e quais limitações permanecem.

---

## 10. Ficha Padrão para Criação ou Pedido de Efeito Novo

Utilize este modelo ao especificar qualquer novo efeito visual no Arenamon:

```markdown
Nome do Move / Efeito: <Nome> (Elemento: <Tipo>)
Proposta do Disparo: <Explicar a lógica física/visual da saída>
Seletor de Disparo: <0: Nenhum | 1: Argola | 2: Cone | 3: Burst Anime | 4: Jato Perfurante | 5: Impacto Estelar>
Afunilamento Métrico: Raio Inicial = <X> m | Raio Final = <Y> m | Distância Focal = <Z> m
Fases Desligadas de Fábrica: <Nenhuma | Listar se houver>
Corpo em Voo / Trajeto: <Descrição da silhueta contínua e shaders>
Finalização sem Contato: <Como dissipa no ar>
Impacto no Alvo: <Geometria da explosão e partículas Quarks>
Acessibilidade: Suporte completo a No-Flash e Reduce-Motion
```
