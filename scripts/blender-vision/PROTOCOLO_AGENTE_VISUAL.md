# Protocolo do agente para analisar uma animação 3D (percepção ativa)

Obrigatório para qualquer IA que for opinar sobre pose, movimento ou qualidade de uma animação no Arenamon. O objetivo é impedir
que texto genérico ("está fluida", "o impacto está forte") seja apresentado como se fosse observação.

## Ordem de trabalho

1. **Origem somente leitura.** O `.blend`/GLB/FBX original nunca é aberto para gravação. Se o clipe estiver num FBX/GLB, gere uma cópia
   derivada e descartável com `prep_source.py` (registra hashes; confere a origem antes/depois).
2. **Medir o movimento** (`perception.py motion`). Produz `motion_report.json` (fases candidatas, sequência do corpo com sensibilidade ao
   limiar, antecipação, snap × rápido, arco, apoio dos pés, deformação) e `questions.json` (as 12 perguntas visuais dos princípios, com os
   frames sugeridos). **As medidas orientam onde olhar; não respondem a pergunta.**
3. **Observar** (`perception.py investigate`). Para cada região (tronco/quadril, cabeça, ombros/braços, mãos, pernas/pés, corpo todo) o
   sistema pede vistas, mede a visibilidade da malha deformada real, e **pede novas vistas** quando a região está oculta ou cortada, até
   haver **2 vistas independentes (≥ 35°) por frame** ou o freio (limite de rodadas, nenhum ganho). Saída: folhas PNG com um **código de
   leitura** no canto, passes geométricos (profundidade, normais, ids) e `investigation.json`.
4. **Abrir as folhas com a ferramenta `Read`.** Nada vale sem isso. Cada folha tem um código de 5 caracteres ("LEITURA XXXXX") que o
   diagnóstico precisa citar. O código prova que a folha foi aberta, **não** que foi compreendida.
5. **Contatos e atravessamentos** (`perception.py contacts`), sempre com `--baseline-action` (uma action em pé, p.ex. `idle`): a costura
   ombro/tronco já parece "dentro" em repouso. O resultado é **hipótese** até ser confirmado em imagem onde a interseção é visível.
6. **Diagnosticar** (`perception.py diagnose-template` gera o esqueleto; preencha depois de olhar) e **validar**
   (`perception.py validate-diagnosis`). Cada entrada responde A–G:
   - **A** o que está visível (frames, membro, câmera/folha);  **B** o que isso significa para a ação;
   - **C** que dados sustentam (folhas lidas, medidas citadas por caminho, geometria);  **D** interpretações alternativas;
   - **E** o que falta observar;  **F** correção sugerida (**nunca aplicada**);  **G** grau de sustentação:
     `fato_geometrico` · `observacao_visual` · `hipotese_coreografica` · `preferencia_artistica`.
7. **Relatar** separando: fato geométrico, observação visual, hipótese coreográfica, preferência artística (só com referência aprovada).

## O que o validador recusa

- folha citada sem o código de leitura correto, ou que não consta no índice de evidências;
- afirmação sobre uma região em frame/vista onde ela **não foi observada** (visibilidade < 60 %, ou cortada pelo quadro);
- afirmação visual com menos de **2 vistas independentes** (frente e frente-elevada contam como uma só);
- fato geométrico sem medida citada que resolva nos relatórios;
- aprovação/preferência artística sem referência **aprovada por uma pessoa** e com escopo que cubra o aspecto;
- texto genérico sem observação específica; alternativas ausentes; correção marcada como aplicada.

## Regras que não mudam

- **Não escolher o frame de contato.** Sem alvo geométrico autorizado, o frame de contato é `null`. Pico de velocidade ≠ impacto.
- **Não atribuir aprovação artística.** Sem referência aprovada pelo diretor, só observações fundamentadas e riscos.
- **Não modificar animações, rigs, `.blend`.** Nada aqui altera o jogo, o Combat Lab ou o Animation Studio.
- Regiões ocultas **não são "corretas"**: são `NAO_OBSERVAVEL`/`OBSERVADO_PARCIAL`, com os frames que faltam.
- Duas imagens quase iguais **não** são duas evidências.
- Se o modelo não conseguir interpretar uma folha (resolução, oclusão), dizer isso em E em vez de supor.

## Limites conhecidos

Workbench headless (não é o viewport do jogo); ids por pixel usam o rótulo dominante de pesos por triângulo; a visibilidade é geométrica
(raio na malha), não percepção humana; "cercado por raios" e "normal assinada" falham em malha vizinha aberta; o chapéu do cogumelo está
ponderado ao osso `Head`, então o rótulo `head` inclui o chapéu inteiro; o rig do Mosh tem centroide de malha como proxy de massa.
