# Pokémon Arena Fighter 3D — Roster de Personagens

Este documento cataloga o elenco de lutadores e os modelos 3D integrados ao projeto.

---

## 1. Croagunk (Tóxico / Lutador)

- **Identificador:** `#0453 Croagunk`
- **Modelo Principal (Produção):** [`chars/croagunk/croagunk-pokken.glb`](file:///c:/Users/zerke/OneDrive/Área%20de%20Trabalho/Arenamon/chars/croagunk/croagunk-pokken.glb)
  - **Origem:** Pokkén Tournament DX (Nintendo Switch / Bandai Namco)
  - **Articulações:** 60 bones (mandíbula independente, bochechas infláveis, dedos articulados, 3 vértebras, twist bones)
  - **Malhas:** 10 sub-malhas skinned com 24.618 vértices
  - **Expressões:** 5 variantes canônicas (`normal`, `cranky`, `fatigue`, `yarare_weak`, `yarare_strong`)
  - **Status:** **Aprovado estrutural e dinamicamente para combate**
- **Modelo Procedural (Legado v2):** [`chars/croagunk/croagunk-rigged.glb`](file:///c:/Users/zerke/OneDrive/Área%20de%20Trabalho/Arenamon/chars/croagunk/croagunk-rigged.glb)
  - **Articulações:** 15 bones procedurais com 13 animações de combate
- **Modelo Base Estático:** [`chars/croagunk/croagunk.glb`](file:///c:/Users/zerke/OneDrive/Área%20de%20Trabalho/Arenamon/chars/croagunk/croagunk.glb)
  - **Origem:** Sketchfab (nguyenlouis32, CC BY 4.0), 207 KB
- **Arquivos Fonte:** [`chars/croagunk/source/pokken-dx/`](file:///c:/Users/zerke/OneDrive/Área%20de%20Trabalho/Arenamon/chars/croagunk/source/pokken-dx/)
  - `Croagunk.dae` (COLLADA) e 19 texturas PNG originais

---

## 2. Drowzee (Psíquico)

- **Identificador:** `#0096 Drowzee`
- **Modelo Base:** [`chars/drowzee/drowzee.glb`](file:///c:/Users/zerke/OneDrive/Área%20de%20Trabalho/Arenamon/chars/drowzee/drowzee.glb)
  - **Tamanho:** 384 KB
  - **Status:** Disponível para futuro processo de rigging e animação

---

## 3. Gumshoos (Normal)

- **Identificador:** `#0735 Gumshoos`
- **Modelo Base:** [`chars/gumshoos/gumshoos.glb`](file:///c:/Users/zerke/OneDrive/Área%20de%20Trabalho/Arenamon/chars/gumshoos/gumshoos.glb)
  - **Tamanho:** 523 KB
  - **Status:** Disponível para futuro processo de rigging e animação

---

## 4. Mosh (cogumelo) — personagem autoral

- **Origem e direitos:** criado pelo responsável pelo projeto; livre de restrições, **versionado no Git** (exceção explícita no `.gitignore`).
- **Pasta:** [`chars/mosh/`](../chars/mosh/)
  - `Cogumelo_com_rig.fbx` e `Cogumelo_sem_rig.fbx` (modelo com e sem esqueleto).
  - `cogumelo_frente.png`, `cogumelo_lado.png`, `cogumelo_costas.png` (referências).
  - Animações próprias: `idle`, `alt idle`, `move 1`, `attack 1`, `charge`, `recovery`.
- **Pacote Mixamo na mesma pasta:** ~40 animações (hits, quedas, bloqueio, strafe etc.), também versionadas.
- **Status:** disponível; ainda não carregado no laboratório (o lab importa `.glb`, então é preciso converter).


---

## 5. Wookada (Clayhorn Guardian) — personagem autoral

- **Origem e direitos:** criado pelo responsável pelo projeto; livre de restrições, **versionado no Git** (exceção explícita no `.gitignore`).
- **Pasta:** [`chars/wookada/`](../chars/wookada/)
  - `wookada.glb` (modelo GLB com esqueleto Mixamo, 48 animações e manifesto `arenamonActions`).
  - `modelo bom.fbx`, `Mutant Walking.fbx`, `Meshy_AI_Clayhorn_Guardian_*.fbx`.
  - Pasta `wookada char/` com os clipes FBX individuais de origem.
- **Locomoção e Animação:**
  - Walk 8 direções: `Mutant Walking` cobre as 8 direções de caminhada; `sprint 8 dir` cobre corrida e sprint em 8 direções.
  - Vários clipes do GLB trazem deslocamento horizontal da raiz (ex.: `roll foward`, `Mutant Jump Attack`, `tackle 5`). Não são neutralizados no arquivo: o lock de root motion do laboratório (padrão ligado) descarta X/Z da raiz e a posição vem só da física.
  - Squash & Stretch com preservação de volume em torno do centro do corpo.
- **Status:** **Embutido no build do laboratório** (`JOGAR_ARENAMON.html`). O GLB vai dentro do HTML (`chars/wookada/wookada.glb`, pelo `build-lib.mjs`) e, na abertura, entra no armazenamento deste navegador como qualquer modelo. Aparece nos seletores de Azul e Vermelho, funciona como jogador ou IA e persiste como os outros. Se for excluído pela tela de armazenamento, volta na próxima abertura.
  - Pendências: validação visual no navegador, e a animação `Stabbing` como `move_2` ainda precisa de confirmação de compatibilidade com o Move.
