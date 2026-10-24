// Controle de cada lutador por passo fixo: stamina, defesa, X (tackle) e C (esquiva), cancelamento C → X,
// salto da esquiva, recuo e locomoção.
//
// X e C são ações independentes: cada uma lê somente o próprio bloco de parâmetros (C.actions.tackle ou
// C.actions.dodge). As transições entre ações seguem estas regras, nesta ordem:
//   • C → X: sistema próprio (C.actions.cancel), com janela própria; não depende da janela genérica.
//   • Recuo → nova ação: permitido conforme `fromRecoil` da ação pedida (GDD 8.2: sem tackle durante o recuo).
//   • Guard stun → X: conforme `fromGuardStun`; com 0 o pedido fica guardado e o tackle sai quando o stun acaba (GDD 5).
//   • Demais encadeamentos (C → C, X → C, X → X e defesa): janela genérica `chainAfter` da ação em curso (GDD 7.3/7.4).
// Com os ajustes V6_COMPAT (config.js) o resultado é idêntico ao laboratório v6 (teste de paridade).



// Fachada: o conteúdo foi dividido em módulos menores (pasta controller/); os nomes exportados continuam os mesmos.
export * from './controller/ctrl-basico.js';
export * from './controller/ctrl-tackle.js';
export * from './controller/ctrl-update.js';
export * from './controller/ctrl-moves.js';

