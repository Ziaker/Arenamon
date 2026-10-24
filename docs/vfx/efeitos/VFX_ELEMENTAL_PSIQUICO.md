# Studio VFX 3D Elemental — Abas Psíquico (PSI), Voador & Fogo

Ambiente interativo 100% offline (`prototypes/vfx-elemental/dist/vfx-elemental-psiquico.html`) para prototipação, comparação lado a lado em 3D e calibração de efeitos visuais elementais e gerais do Arenamon.

- **Acesso direto (duplo clique):** `prototypes/vfx-elemental/dist/vfx-elemental-psiquico.html` (ou via `ABRIR_ARENAMON.html` e `HTMLS_ARENAMON.html`).
- **Código-fonte:** `prototypes/vfx-elemental/src/main.js` e `prototypes/vfx-elemental/src/template.html`.
- **Compilação:** `npm run build:vfx-elemental` (incluído no `npm run build`).
- **Verificação e evidências:** `npm run test:vfx-elemental` (`prototypes/vfx-elemental/evidence/`).

---

## Aba 1 · 🧠 Tipo Psíquico (PSI — Invocação, Hit, Aura e Sequência)

| Opção | Nome | Inspiração | Linguagem Visual 3D |
|---|---|---|---|
| **Opção A** | **PSI Kaleidoscope & Starstorm** | *EarthBound / Mother 3* | Shader GLSL caleidoscópico com faixas cromáticas quantizadas em degraus (magenta, ciano, ouro), octaedros Merkaba duplos, ondas toroidais concêntricas rítmicas e explosão geométrica estilo *PK Rockin'*. |
| **Opção B** | **Cognitive Rebel & Velvet Arcana** | *Persona 4 & Persona 5* | Shader gráfico de alto contraste (faixas diagonais e contorno preto), pontas estelares 3D com silhueta preta + núcleo neon (*Mapsi / Psycho Force*), molduras cognitivas inclinadas (TV/Tarot) e vidro cognitivo estilhaçado. |
| **Opção C** | **Mitochondrial Bio-Kinesis** | *Parasite Eve* | Domo tático geodésico em wireframe verde, hélices duplas de DNA/mitocôndria em 3D, membrana celular refrativa com pulsação orgânica e descargas de sinapses neurais (*Apobiosis / Liberate*). |

---

## Aba 2 · 🌪️ Tipo Voador (Vento, Poeira, Tornados, Vendavais & Tufões)

### As 3 Direções Artísticas em 3D
| Opção | Nome | Inspiração | Linguagem Visual 3D |
|---|---|---|---|
| **Opção A** | **Cel-Shaded Gale & Cloud Scrolls** | *The Wind Waker / Okami / Ghibli* | Funis e fitas caligráficas em S com *toon shading* em faixas limpas, lâminas crescentes celestes e colar de nuvens rolantes de poeira clara na base. |
| **Opção B** | **Graphic Sonic Shear & Garudyne** | *Persona 5 (Garudyne) / Guilty Gear* | Vórtice de alto contraste com faixas espirais de borda preta + verde-esmeralda/ciano/ouro neon, cones de pressão sônica (Mach rings), agulhas de cisalhamento e poeira facetada. |
| **Opção C** | **Atmospheric Cyclone & Dust Storm** | *Monster Hunter (Kushala Daora) / Storm King* | Funil atmosférico turbulento com precessão e sinuosidade 3D real, parede densa de areia/poeira ocre na camada-limite do solo e rochas/detritos suspensos. |

### As 5 Subcategorias Animadas na Aba Voador
1. **🌪️ 1. Tornados (`tornado` — Funil 3D + Poeira de Base)**
2. **💨 2. Vendavais & Lâminas (`gale` — Rajadas + Rastro de Poeira)**
3. **🌀 3. Tufões (`typhoon` — Super-Ciclone + Tempestade)**
4. **🌫️ 4. Vento & Poeira Contínuos (`winddust` — Aura / Passo de Vendaval)**
5. **🎬 5. Sequência Voador (`sequence`)**

---

## Aba 3 · 🔥 Tipo Fogo (Mitológico Japonês, Tinta Sumi-e & Fogo Mágico)

### As 3 Direções Artísticas em 3D
| Opção | Nome | Inspiração | Linguagem Visual 3D |
|---|---|---|---|
| **Opção A** | **Hinokami & Ukiyo-e Solar Flame** | *Okami (Amaterasu) / Demon Slayer (Hinokami Kagura) / Xilogravura Ukiyo-e* | Fogo estilizado mitológico japonês em faixas *cel-shaded* vermelhão, âmbar e folha de ouro Imperial, com línguas curvilíneas (*Kaen*), arcos de roda solar xintoísta e faíscas douradas. |
| **Opção B** | **Sumi-e Ink-Wash & Dry-Brush Flame** | *Street Fighter IV & 6 / Pintura Sumi-e* | Fogo estilizado em tinta nanquim com borda/silhueta preta espessa (*dry-brush rim*) + interior incandescente cinábrio/laranja, pontas rasgadas de pincel e respingos 3D de tinta e fuligem. |
| **Opção C** | **Astral Pyromancy & Arcane Hellfire** | *Elden Ring / Dragon's Dogma 2 / Final Fantasy XVI* | Fogo mais mágico e arcano: plasma prismático (rubi, violeta astral e núcleo dourado) com malha rúnica geométrica nos shaders, círculos herméticos duplos contra-rotativos e cristais ígneos levitantes. |

### As 5 Subcategorias Animadas na Aba Fogo
1. **🔥 1. Pilares & Vórtices (`pillar` — Coluna de Fogo 3D):**
   - Coluna ígnea espiralada ascendente com línguas *Kaen* / pontas de tinta / cristais rúnicos, anéis de base no chão e redemoinho de brasas e fumaça.
2. **☄️ 2. Rajadas & Bolas de Fogo (`fireball` — Projétil + Rastro):**
   - Disparo ígneo com núcleo estilizado para cada direção artística, cauda espiral de chamas, rastro de chão queimado e erupção no impacto.
3. **💥 3. Explosões & Erupções (`explosion` — Hit / Nova Ígnea):**
   - Detonação 3D em múltiplas camadas no alvo com domo de fogo, ondas de choque no solo, coroa de chamas/espinhos e chuva de fagulhas.
4. **✨ 4. Aura & Brasas Contínuas (`emberaura` — Manto de Chamas):**
   - Manto de fogo contínuo ao redor do personagem com línguas ascendentes, espirais de calor e brasas/tinta/runas flutuantes.
5. **🎬 5. Sequência Fogo (`sequence`):**
   - Ciclo completo encadeado (*Manto de Chamas no lançador → Disparo de Bola de Fogo → Explosão + Pilar de Fogo no alvo*).

---

## Sliders Independentes & Exportador JSON / Prompt

Todas as 3 opções (A, B, C) em todas as abas (`Psíquico`, `Voador` e `Fogo`) possuem controles próprios em tempo real:
- **Opacidade e Queda na Duração:** `opacity` (Opacidade Total `0.00`–`1.00`), `fadeStart` (`0%`–`95%`), `fadeEnd` (`5%`–`100%`), `fadePower` (`0.25×`–`3.50×`) e `endOpacity` (`0.00`–`0.80`), com gráfico de curva ao vivo.
- **Dinâmica, Espaço e Cores:** `intensity`, `size`, `duration`, `velocity`, `amount`, `scatter`, `lift`, `turbulence`, `pulseFreq`, `glow` e 3 seletores de cor (`Cor Principal`, `Cor Secundária / Tinta / Runas`, `Cor do Núcleo / Fagulhas`).
- **Exportador JSON (`arenamon-vfx-elemental-v3`) & Gerador de Prompt:** exporta todas as mudanças de sliders de todas as abas e gera o prompt pronto para implementação no jogo principal.

