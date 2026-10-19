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
