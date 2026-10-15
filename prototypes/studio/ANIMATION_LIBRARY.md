# Biblioteca de animações genéricas (CC0)

Cartão **Biblioteca de animações (CC0)** em **Projeto**, no Animation Studio. Ele converte animações reais, de licença livre, para o rig humanoide do personagem carregado e as adiciona à lista de animações.

- **Branch:** `feat/studio-cc0-animation-library`. Parte do commit de integração da Workbench (`516ca8d`); o diff contra ele contém só a biblioteca.
- **Merge na `main`:** não foi feito.

## Fonte e licença

| Campo | Valor |
|---|---|
| Obra | RobotExpressive: 14 animações de personagem |
| Autor | Tomás Laulhé (Quaternius) |
| Modificações no arquivo de origem | Don McCurdy (morph targets, conversão, materiais). Nada disso é usado aqui. |
| Licença | **CC0 1.0 Universal** (domínio público): uso, modificação e redistribuição livres, inclusive comercial, sem exigir atribuição |
| Origem | [`mrdoob/three.js` @ `b924f0c`](https://github.com/mrdoob/three.js/tree/b924f0cad4058dc4dde71445c796980c3cd5b5ed/examples/models/gltf/RobotExpressive), com o README do autor declarando CC0 1.0 |
| Arquivo | `RobotExpressive.glb`, 463 988 bytes |
| SHA-256 | `047f5e5fb3bb6d378bd1df16ca6137f2a596c99b3a1b5690b4020c05aaf6f319` |

O texto completo está em `src/library/LICENSE-CC0-robot-expressive.txt`.

**O que entra no Git:** só os dados de animação (`src/library/robot-expressive.anim.json`, 200 KB):
- keyframes de rotação e translação dos ossos;
- esqueleto de repouso;
- procedência.

O GLB (malha, materiais, morph targets) **não** entra no Git: o `.gitignore` exclui `*.glb` e não foi contornado. O extrator confere o SHA-256 antes de gerar os dados:

```bash
node prototypes/studio/tools/extract-cc0-animations.mjs caminho/RobotExpressive.glb
```

## Animações

| Ciclo | Ações |
|---|---|
| Idle, Walking, Running, Dance | Jump, WalkJump, Punch, Death, Wave, Yes, No, ThumbsUp, Sitting, Standing |

## Retarget (`src/library/retarget.js`)

1. **Papéis anatômicos pelo nome do osso:** raiz, tórax, pescoço, cabeça e, de cada lado, clavícula, braço, antebraço, coxa e canela. São reconhecidas as convenções do template Arenamon/Codex (`LeftClavicle`, `LeftShoulder`…), do Mixamo (`mixamorigLeftShoulder` = clavícula, `mixamorigLeftArm`…) e a da própria fonte. Sem os papéis obrigatórios, o personagem é recusado com a lista do que falta.
2. **Alinhamento A** entre os eixos dos dois rigs: cima = raiz → cabeça; lado = braço direito → braço esquerdo.
3. **Membros:** cada membro do personagem é primeiro girado para a direção de repouso da fonte (corrige T-pose × braços baixos). Depois ele segue a variação da fonte quadro a quadro. Resultado: **cada membro aponta exatamente como na fonte.**
4. **Tronco e cabeça** seguem a variação de rotação da fonte.
5. **Translações:**
   - a da raiz é escalada pela altura raiz → cabeça;
   - as de outros ossos (cabeça e ombros em Death) são escaladas pelo comprimento do osso;
   - todas são convertidas para o espaço do pai (inclusive a `Armature` 0,01 do Mixamo).
6. **Mãos, pés e dedos** ficam na pose de repouso do personagem. A fonte usa IK para os pés, e os dedos não têm equivalente no template.

**Limitações:**
- não há IK de pés: em personagens com proporções muito diferentes, os pés podem deslizar;
- não há retarget de dedos;
- só funciona em rigs humanoides bípedes.

## Uso no Studio

1. Importe um personagem humanoide com esqueleto. Se ele não tiver rig, use **Rigging** → template → **Vincular**.

   Para testar sem arquivo, clique em **Criar manequim de teste**: ele cria um personagem sintético com rig e skin pela aba Rigging.
2. Marque as animações e clique em **Adicionar ao personagem**.

Os clipes entram na lista de animações como `Walking · RobotExpressive (CC0)`. Eles carregam a licença em `userData` e entram no histórico como uma única entrada (Ctrl+Z remove todos). São exportados no GLB do projeto como qualquer outra animação.

## Testes

| Comando | Cobertura |
|---|---|
| `node prototypes/studio/test/library.test.mjs` | 10 testes (lista abaixo) |
| `node prototypes/studio/test/library.browser.mjs` | 8 verificações no Edge, offline (lista abaixo) |

Os testes em Node cobrem:
- procedência e licença;
- integridade dos 14 clipes;
- extração reproduzível a partir do GLB (com `ARENAMON_ROBOT_GLB`);
- papéis em três convenções;
- identidade (converter para o próprio rig reproduz as rotações);
- fidelidade em todos os 14 clipes, no template com skin em T-pose (diferença de repouso de 45,7° corrigida) e num rig Mixamo (cm, `Armature` 0,01): membros apontam como na fonte e tronco/cabeça variam como na fonte, com desvio máximo 0,0000° (limite do teste: 0,5°);
- pulo proporcional à altura;
- translações não-raiz;
- trilhas válidas.

As verificações no navegador cobrem:
- o cartão, com licença e origem;
- o manequim feito pela aba Rigging;
- adicionar 3 clipes (trilhas ligadas, uma entrada no histórico);
- reprodução real no viewer: a coxa varia 55° durante Walking;
- desfazer e refazer;
- GLB exportado e reimportado;
- as 14 animações convertidas de uma vez;
- um personagem sem rig recusado.

## Outras fontes avaliadas

| Fonte | Licença | Situação |
|---|---|---|
| Quaternius *Universal Animation Library*, Standard (45 animações) | CC0 | Candidata natural para ampliar a biblioteca. O download é feito pelo itch.io e não foi baixado sem a sua confirmação. O formato do zip gratuito precisa ser conferido. |
| Mixamo | Licença Adobe: não permite redistribuir as animações em si | Descartada |
| Bandai Namco Research Motion Dataset | CC BY-NC-ND | Descartada (não comercial, sem derivados) |
