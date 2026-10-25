# Desempenho de render com GPU real (2026-10-25)

> **GERADO** por `npm run bench:render` (`prototypes/combat-lab/test/bench-render.browser.mjs`). Item #15 do plano de 15 melhorias: mede o laço REAL do jogo (simulação + animação + VFX + render) no navegador desta máquina. **Metas por perfil não estão definidas** (decisão do responsável); este documento só registra os números.

## Máquina e condições

- Renderizador WebGL: **ANGLE (Intel, Intel(R) UHD Graphics (0x000046A3) Direct3D11 vs_5_0 ps_5_0, D3D11)** (Google Inc. (Intel)) · WebGL2 · cronômetro de GPU disponível
- CPU: 12th Gen Intel(R) Core(TM) i5-12450H · 12 núcleos lógicos · 7.7 GB de RAM · win32
- Navegador: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36 Edg/156.0.0.0 (sem interface, sem vsync)
- Tela de desenho: 1166×708 px (CSS 1166×708, pixel ratio 1)
- Roteiro: IA × IA tática, semente 7, aquecimento 1,5 s, medição 4 s por caso, 3 repetições; personagens = blocos (sem GLB carregado). Valores: **mediana (mín.–máx.)** das repetições.

## Resultados por caso

| Caso | Pers. | FPS | Quadro médio (ms) | P95 (ms) | Pior quadro (ms) | CPU/quadro (ms) | Render CPU (ms) | GPU (ms) | Draw calls | Partículas (pico) |
|---|---|---|---|---|---|---|---|---|---|---|
| Sem VFX | 1 | 106.4 (85.7–117.5) | 9.40 (8.51–11.66) | 12.80 (11.60–15.60) | 65.8 (30.4–722.2) | 3.33 (2.93–3.58) | 1.81 (1.70–1.96) | 1.48 (1.44–1.49) | 31 (31–32) | 0 (0–0) |
| Sem VFX | 2 | 121.5 (95.1–132.9) | 8.23 (7.53–10.52) | 11.80 (11.40–15.00) | 93.3 (29.0–219.0) | 2.60 (2.58–3.60) | 1.62 (1.60–1.73) | 1.42 (1.39–1.49) | 32 (32–32) | 0 (0–0) |
| VFX leves (perfil Baixo) | 1 | 126.6 (109.2–139.4) | 7.90 (7.17–9.16) | 11.10 (10.10–12.90) | 16.9 (16.2–34.8) | 2.67 (2.44–3.32) | 1.63 (1.46–1.81) | 2.00 (2.00–2.10) | 35 (35–35) | 22 (21–22) |
| VFX leves (perfil Baixo) | 2 | 111.1 (110.6–141.8) | 9.00 (7.05–9.04) | 12.40 (10.30–13.40) | 93.2 (14.6–332.0) | 2.82 (2.39–3.11) | 1.69 (1.46–1.80) | 2.04 (2.01–2.08) | 34 (34–35) | 22 (21–23) |
| VFX médios (perfil Médio) | 1 | 112.0 (109.7–146.7) | 8.93 (6.82–9.11) | 11.40 (10.30–13.60) | 14.4 (14.1–85.9) | 3.11 (2.30–3.11) | 1.81 (1.40–1.83) | 2.03 (1.95–2.10) | 35 (35–35) | 38 (38–39) |
| VFX médios (perfil Médio) | 2 | 117.8 (99.7–151.9) | 8.49 (6.58–10.04) | 11.60 (8.70–14.50) | 30.9 (10.9–39.8) | 2.97 (2.22–3.53) | 1.78 (1.33–1.99) | 2.04 (1.89–2.04) | 35 (35–35) | 38 (38–38) |
| Todos os efeitos (Alto + todos ligados) | 1 | 112.0 (106.4–149.5) | 8.93 (6.69–9.40) | 12.70 (8.90–13.50) | 45.0 (14.7–369.8) | 3.44 (2.29–4.16) | 2.06 (1.44–3.21) | 1.89 (1.87–2.12) | 37 (37–37) | 51 (50–51) |
| Todos os efeitos (Alto + todos ligados) | 2 | 115.6 (113.9–128.4) | 8.65 (7.79–8.78) | 11.10 (10.80–11.60) | 27.8 (27.2–266.0) | 2.95 (2.83–3.04) | 1.79 (1.48–1.88) | 2.01 (1.99–2.03) | 37 (37–37) | 51 (51–51) |

## Memória JS do navegador (performance.memory)

- Repetição 1: 20 MB antes → 56 MB depois (limite 4054 MB)
- Repetição 2: 57 MB antes → 47 MB depois (limite 4054 MB)
- Repetição 3: 48 MB antes → 60 MB depois (limite 4054 MB)

## Limitações

- Navegador sem interface e sem vsync: o FPS não está preso a 60 Hz; num monitor real o teto é a taxa da tela. P95 e CPU por quadro são os números comparáveis.
- Sem GLB: as personagens são blocos. Com modelos animados o custo de animação e de draw calls sobe (rode o benchmark pelo painel com as personagens carregadas).
- Memória: só o heap JS (Chromium); memória de GPU não é exposta pelo navegador.
- FPS é limitado pela taxa de atualização da tela (requestAnimationFrame); compare o trabalho de CPU por quadro.

Dados brutos: `prototypes/combat-lab/evidence/bench-render/2026-10-25.json`. Pelo jogo: Visualizar › Desempenho › ▶ Executar benchmark.
