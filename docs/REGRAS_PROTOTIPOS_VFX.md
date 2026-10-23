# ARENAMON — Regras para criar protótipos de VFX

Norma para **todo** protótipo visual (ateliê/laboratório de efeitos) de Move, passiva, objeto ou evento do Arenamon, de qualquer agente ou pessoa. Complementa — nunca substitui — `docs/REGRAS_CRIACAO_MOVES.md` (§14 Audiovisual obrigatório, §15 Sliders e determinismo) e o `AGENTS.md`. Se houver conflito, vale a regra mais restritiva e o conflito deve ser descrito ao responsável.

**Um protótipo de VFX é só apresentação.** Não altera dano, física, stamina, tempos nem cooldowns; não aprova gameplay; não torna nenhuma variante «oficial». A aprovação visual é sempre do responsável.

---

## 1. Estilo visual que todo protótipo deve seguir

Estas regras resumem a linguagem que já existe no projeto (`VFX_SOLIDOS.md`, `VFX_IMPACTO_D.md`, `MOVES_ELEMENTAIS_VISUAL_QUARKS.md`, os três HUDs de `HUD_VIDA_STAMINA_MOVES_LAB.md`). Um efeito novo deve parecer **da mesma família** dos que já estão no jogo.

| Princípio | O que significa na prática |
|---|---|
| **Estilizado, não realista** | Formas limpas e gráficas, silhueta legível. Nada de fotorrealismo, texturas fotográficas ou simulação «de verdade» de fluidos/fogo. |
| **Superfícies lisas e chapadas** | Malhas de Three.js com poucas faixas de tom (até 3 tons chapados, como os volumes de `VFX_SOLIDOS.md`); contornos e bordas claras; brilho aditivo só como acento, nunca como base do efeito. |
| **Volume real onde houver corpo** | Esferas, anéis, lâminas, cones e sementes são **malhas com volume** (ou superfícies lisas no plano do efeito), não sprites achatados. Partículas (three.quarks) acompanham o corpo: gotas, brasas, folhas, riscos, poeira. |
| **Identidade por elemento/tipo** | Cada efeito tem uma forma-assinatura reconhecível sem cor: água = correntes e espuma, fogo = faixa anular com o centro aberto, vento = arcos brancos lisos no plano do corte, grama = semente e folhas, psíquico = geometria e faixas cromáticas. Dois efeitos diferentes não podem ter a mesma silhueta. |
| **Paleta curta e configurável** | Até **2 cores principais** (ajustáveis por slider/seletor) + um acento. A cor **nunca é a única pista**: forma, tamanho e movimento também distinguem o efeito (acessibilidade e leitura a 720p). |
| **Escala do jogo** | Tamanhos em **metros reais** do jogo: corpo do lutador ≈ 1,3 m de altura, raio de colisão ≈ 0,35 m. Anéis, esferas e explosões usam o **raio físico real** do Move (não um raio genérico). O efeito nunca finge acertar onde a simulação não acerta. |
| **Legível e limpo** | Não esconder o personagem nem a arena; legível em 720p e 1080p; sem poluir a cena (poucos elementos, vida curta). |
| **Sem sustos** | Sem flash de tela, sem tremor de câmera, sem pulsação rápida por padrão. O que for forte tem versão «Sem flash/pulsação» e «Movimento reduzido» (§4). |
| **Autoral e offline** | Formas geradas por código e por três.quarks do projeto. Referências externas (jogos, vídeos, imagens) valem só como **vocabulário**; não copiar arte, logotipos, fontes ou assets de terceiros. Tudo roda offline em HTML único. |
| **Três opções para escolher** | Quando o diretor pede um efeito novo, o protótipo oferece **3 opções visuais (A/B/C)** distintas e comparáveis (seletor «Opção visual»). Nenhuma é a oficial até aprovação. |

**Partículas e superfícies:** partículas = `ParticleSystem` do three.quarks (via `QuarksFx`/presets, `view/quarks/`); superfícies contínuas = malhas Three.js. Não simular partículas à mão.

---

## 2. Fases obrigatórias de todo efeito

Todo protótipo de efeito de ataque, projétil, objeto ou Move deve ser construído, mostrado e ajustado **em fases separadas**, na ordem abaixo. A interface mostra o nome da **fase atual** enquanto reproduz (`role="status"`) e permite **reproduzir cada fase isoladamente**.

```
1 Conjuração/surgimento ─► 2 Disparo/lançamento ─► 3 Corpo do efeito (projétil/ataque/objeto)
     ─► 4 Duração média ─► 5 Finalização ou contato ─► 6 Efeito de contato / explosão / finalização
                                                      (obrigatória quando há contato)
```

| # | Fase | O que o protótipo deve mostrar | Evento mecânico real associado (REGRAS §14) | Tempo e variantes obrigatórios |
|---|---|---|---|---|
| 1 | **Conjuração / surgimento** | Como o efeito nasce: carga na mão, marcador, anel de invocação, brotar do chão, esfera que cresce (PL1→PL3 quando houver carga). | Pressionar/preparar/carga; cast | Duração própria; variação por PL se existir; o que acontece se for **interrompida** (dissipação). |
| 2 | **Disparo / lançamento** | O instante da soltura: confirmação (clarão curto, recuo, anel de saída), posição do emissor, rastro inicial. | Soltar/cast/disparo | Duração do pulso de saída; direção e origem reais (altitude do atirador). |
| 3 | **Corpo do efeito** | O visual em si do projétil/ataque/objeto enquanto existe: forma-assinatura, rotação, rastro, partículas associadas. | Deslocamento/voo; persistência | Velocidade e aceleração (o alongamento pode seguir a velocidade real); comportamento no solo e no ar. |
| 4 | **Duração média** | Quanto tempo o efeito **costuma viver** (média em jogo) e o que ele faz durante esse tempo (oscila, encolhe, acelera, pulsa pouco). A página mostra a duração média como número com unidade e a barra de tempo da fase. | Vida útil / alcance ÷ velocidade | Valor médio, mínimo e máximo; a duração visual **acompanha a real** do Move (alcance, zona, vida). |
| 5 | **Finalização ou contato** | Como o efeito **termina**: expira no ar, é interrompido, bate em parede/chão/alvo/escudo, é refletido ou anulado. Cada desfecho é um botão de teste («Contato agora», «Expirar», «Interromper»). | Acerto; defesa parcial/perfeita; Clash/Counter/reflexão; falha/expiração | Um desfecho por situação real; contato automático ao fim do trajeto. |
| 6 | **Contato / explosão / finalização** | O efeito de impacto em si: explosão, esguicho, estilhaços, nuvem, anel de choque, dissipação; no ponto físico do contato, orientado pela normal. Sem contato: dissipação final (a fase 6 vira «finalização»). | Acerto no ponto físico; hitstop previsto; cleanup | Duração; tamanho pelo raio real da explosão; versão sem contato. Nunca mostrar acerto visual onde não houve acerto. |

**Regras das fases**
1. **Nenhuma fase pode ser omitida.** Se o Move não tem uma fase (ex.: Burst sem carga), o protótipo declara «não se aplica» e mostra o que a substitui (ex.: surgimento instantâneo).
2. Cada fase tem **tempo de início, duração e gatilho de saída** explícitos, em segundos, na ficha e na página.
3. A fase 6 é **obrigatória quando há contato** e deve existir também uma **finalização sem contato** (expirar no ar) e uma **interrompida** (cancelar a conjuração).
4. A ordem e as durações mostradas no ateliê têm de ser as que o Move real usa (cast, soltura, vida, alcance); se forem provisórias, a página diz «provisório».
5. Cada fase entra nos controles (§3) e nas capturas de evidência (§6).

---

## 3. Sliders de configuração: obrigatórios e explicados

**Todo parâmetro visual importante tem um controle na interface** (regra do `AGENTS.md`). Nada fica só no código.

Cada slider precisa ter **todos** estes campos:

| Campo | Exigência |
|---|---|
| **Nome** | Claro, em português, sem jargão («Tamanho do núcleo», não «coreScale»). |
| **Unidade** | Sempre visível (m, s, %, ×, graus, partículas/s). |
| **Valor padrão, mínimo, máximo e passo** | Definidos; o padrão é o valor aprovado/proposto; faixa que nunca quebra o efeito. |
| **Explicação** | Frase curta: **o que muda** e **qual a consequência visual** (ex.: «Raio do centro aberto — abertura do anel de fogo; 0 = anel fechado, 0,8 m = só uma faixa fina»). Em dica ao passar o mouse **e** em linha de apoio. |
| **Valor atual** | Mostrado ao lado, com a unidade. |
| **Restaurar** | Botão «Restaurar este efeito» volta aos padrões; o ajuste persiste durante a sessão. |

**Agrupe os sliders pelas fases da §2** (uma seção por fase). Mínimo esperado por fase:

| Fase | Sliders mínimos |
|---|---|
| 1 Conjuração | duração, tamanho inicial/final, brilho, quantidade de partículas, anéis/elementos de carga, intensidade por PL |
| 2 Disparo | duração do pulso, tamanho do clarão/anel, distância de recuo, intensidade do rastro inicial |
| 3 Corpo | tamanho, velocidade visual, **alongamento pela velocidade**, rotação, dispersão, quantidade e vida das partículas, 2 cores, brilho |
| 4 Duração | duração média visual, oscilação/encolhimento ao longo da vida, comportamento no fim da vida |
| 5 Finalização | duração da dissipação, distância de parada, sensibilidade do «Contato agora» (apenas visual) |
| 6 Contato | **tamanho do contato**, quantidade de estilhaços/gotas/folhas, duração, brilho, raio do choque, alcance dos riscos |

**Controles globais obrigatórios em todo protótipo**
- **Opção visual** A/B/C (quando houver).
- **Sem flash / pulsação** — remove pulsação, reduz brilho, usa mistura normal.
- **Movimento reduzido** — reduz emissão, deslocamento e rotação; **respeita também `prefers-reduced-motion` do sistema na abertura**.
- **Reproduzir** (com repetição), **Parar** (limpa a cena e os sistemas), **Contato agora**, **Restaurar este efeito**, seletor de **PL** quando o Move tem carga.

**Para a integração futura:** os valores dos sliders viram parâmetros do grupo do Move e são **capturados ao nascer** (contrato M28.4 de `REGRAS_CRIACAO_MOVES.md` §15): mexer no slider afeta só os **próximos** usos; efeito já criado não muda no meio da vida. Sem aleatoriedade fora de sementes controladas.

---

## 4. Acessibilidade e desempenho

- `noFlash` e `reduceMotion` do laboratório **e** `prefers-reduced-motion` do sistema valem em todo protótipo.
- Contraste e legibilidade verificados em **720p e 1080p**; o personagem e os controles nunca ficam escondidos.
- **Teto de partículas** por efeito (`maxParticles`) e por cena; partículas e malhas **descartadas** ao terminar (`dispose`); «Parar» deixa a cena vazia (verificado em teste).
- Registrar o custo: contagem de sistemas/partículas ativos e, quando possível, tempo de quadro. **Se o desempenho em hardware lento não foi medido, a documentação diz isso.**
- Nenhum efeito usa flash de tela, tremor de câmera ou hitstop próprios (só os já previstos pelo Move).

---

## 5. Estrutura técnica do protótipo

1. **Local:** laboratório próprio em `prototypes/combat-lab/<nome>-lab/` (ex.: `elemental-lab/`), compilado para uma **página HTML única e offline** em `prototypes/combat-lab/dist/` (ex.: `arenamon-elementais-quarks.html`). Sem rede, sem dependência nova.
2. **Dados, não código espalhado:** cada efeito é descrito por um **preset declarativo** (como `view/quarks/presets.js`) e por uma **definição de fases**:
```js
// Exemplo de definição de efeito (provisório, sem balanceamento)
{
  id: 'water-pulse', nome: 'Water Pulse', opcoes: ['A', 'B', 'C'],
  fases: [
    {id: 'conjuracao', nome: 'Conjuração', inicio: 0,    duracao: 1.5, sliders: ['coreSize', 'orbitRings', 'glow']},
    {id: 'disparo',    nome: 'Disparo',    inicio: 1.5,  duracao: .15, sliders: ['flashSize', 'recoil']},
    {id: 'corpo',      nome: 'Corpo',      inicio: 1.65, duracao: 1.0, sliders: ['size', 'stretch', 'trail', 'colorA', 'colorB']},
    {id: 'duracao',    nome: 'Duração média', media: 1.0, min: .6, max: 1.2, sliders: ['life']},
    {id: 'final',      nome: 'Finalização',   saidas: ['contato', 'expirar', 'interromper'], sliders: ['fade']},
    {id: 'contato',    nome: 'Contato',    duracao: .5, sliders: ['impactSize', 'droplets']},
  ],
}
```
3. **Cada slider** é declarado com `{id, nome, unidade, padrao, min, max, passo, explicacao}`; a interface é gerada a partir disso (nada de controle sem explicação).
4. **Reaproveitar** `QuarksFx`/`presetToSystemParams` (`src/view/quarks/adapter.js`) e as superfícies de `elemental-surfaces.js`; não reescrever a camada.
5. **Teste de navegador obrigatório** (Edge real, offline): abre a página, percorre as **6 fases** nas **3 opções**, aciona cada desfecho da fase 5, altera um slider por fase, liga «Sem flash» e «Movimento reduzido», clica **Parar** e confere **cena limpa e sem erros de console**.

---

## 6. Entrega e evidências

Um protótipo de VFX só está entregue quando:
1. **Link no portal** (`ABRIR_ARENAMON.html`) e menção em `docs/` (regra do `AGENTS.md`: até 2 cliques a partir do portal).
2. **Documento do efeito** com: como abrir, tabela das opções A/B/C, **tabela das 6 fases com durações**, lista de **todos os sliders com unidade, faixa e explicação**, limites conhecidos e o que **não** foi verificado.
3. **Capturas de evidência**: **uma por fase, por opção** (6 × 3), em 720p e 1080p, mais a galeria (`evidence/<nome>/index.html`) e o resultado automatizado (`results.json`).
4. **Build recompilado** (`npm run build:combat-lab`), `typecheck`, teste de navegador e `verify:workspace` com saída real; falhas pré-existentes registradas à parte das novas.
5. **Versão** no `package.json` atualizada quando o jogo muda; commit descritivo, push e comparação com o remoto (`git rev-parse HEAD` × `origin/<branch>`).
6. **Resposta em português claro**: o que mudou, onde abrir, o que testou e o que **não** foi verificado. Aprovação visual e de sensação: do responsável.

---

## 7. Integração no jogo (depois da aprovação)

- A integração liga o efeito aos **eventos reais da simulação** (conjuração = carga/cast, disparo = soltura, corpo = entidade, contato = acerto no ponto físico, finalização = expiração/cleanup). Nunca disparar efeito de acerto sem acerto.
- O botão de **prévia** não executa dano real.
- VFX de passiva (toast e aros brancos) é um sistema distinto: não reutilizar para Moves por suposição.
- Moves com **cor por classe** (Normal, Burst, Charge, Destino) e passivas (Permanente, Gatilho) usam essas classes nas telas de seleção; a cor **do efeito** segue o elemento/identidade do Move, não a classe.

---

## 8. Ficha copiável de protótipo de VFX

```
# VFX [nome] — [id-estável]
Origem/pedido: [quem pediu, data]   Move/objeto: [id do Move ou evento]
Opções visuais: A [nome] · B [nome] · C [nome]
Identidade (forma-assinatura sem cor): [descrever]
Paleta: cor 1 [#hex] · cor 2 [#hex] · acento [#hex]

## Fases (tempo em s; «n/a» + substituto quando não existir)
1 Conjuração/surgimento:   início 0 · duração __ · saída: __ · variação por PL: __ · se interrompida: __
2 Disparo/lançamento:      início __ · duração __ · origem/direção reais: __
3 Corpo do efeito:         velocidade __ · alongamento __ · rastro __ · partículas __
4 Duração média:           média __ s · mín __ · máx __ · o que faz durante a vida: __
5 Finalização ou contato:  desfechos: contato / expirar / interromper / parede / chão / escudo / reflexão
6 Contato/explosão/final:  tamanho (raio real __ m) · duração __ · orientação pela normal · versão sem contato: __

## Sliders (nome · unidade · padrão · mín · máx · passo · explicação)
[uma tabela por fase]

## Acessibilidade e desempenho
Sem flash: __ · Movimento reduzido: __ · teto de partículas: __ · custo medido: __ (ou «não medido»)

## Evidências
Capturas 6×3 (720p e 1080p): [caminho] · results.json: [caminho] · teste: [comando]

## Limites e o que NÃO foi verificado
[listar] — Aprovação visual: pendente do responsável
```

---

## 9. Checklist de aceite

☐ Estilo: estilizado, formas lisas, forma-assinatura própria, paleta curta, escala real, sem flash/tremor, autoral e offline.
☐ **3 opções** A/B/C distintas; nenhuma marcada como oficial.
☐ **6 fases** presentes (ou «n/a» justificado), cada uma com início, duração, gatilho e botão de teste; fase 6 também sem contato e interrompida.
☐ **Todo slider** com nome, unidade, padrão, mín, máx, passo, **explicação** e restaurar; agrupados por fase; valor atual visível.
☐ Controles globais: Opção visual, Sem flash, Movimento reduzido (+ `prefers-reduced-motion`), Reproduzir, Parar, Contato agora, Restaurar, PL.
☐ Parâmetros prontos para captura ao nascer (M28.4); sem mexer em regras.
☐ Teste de navegador passando; **Parar** deixa a cena limpa; sem erros de console.
☐ Capturas 6×3 em 720p/1080p, galeria e `results.json`.
☐ Portal, documento do efeito, build, typecheck, `verify:workspace`, versão, commit e comparação com o remoto.
☐ Limites e o que **não** foi verificado declarados; aprovação visual pendente do responsável.

---

## 10. Referências no repositório
`docs/REGRAS_CRIACAO_MOVES.md` (§14, §15, §20) · `docs/MOVES_ELEMENTAIS_VISUAL_QUARKS.md` e `docs/MOVES_ELEMENTAIS_PROTOTIPO.md` (exemplo real de 3 opções por efeito e contatos) · `docs/VFX_SOLIDOS.md` · `docs/VFX_IMPACTO_D.md` · `docs/VFX_POUSO_E_PAREDES.md` · `docs/VFX_ELEMENTAL_PSIQUICO.md` · `docs/HUD_VIDA_STAMINA_MOVES_LAB.md` · `prototypes/combat-lab/src/view/quarks/` (`adapter.js`, `presets.js`, `elemental-surfaces.js`) · `prototypes/combat-lab/elemental-lab/`.
