export const SOURCE = Object.freeze({
  id:'quaternius-ual1-v3', author:'Quaternius', name:'Universal Animation Library', version:'Standard v3.0',
  url:'https://quaternius.itch.io/universal-animation-library', license:'CC0 1.0 Universal', format:'GLB 2.0',
  skeleton:'Quaternius Universal Humanoid · 65 bones', fps:30,
  notes:'Pacote oficial gratuito. A variante _RM contém deslocamento de raiz; a variante padrão é in-place.'
});
const e=(id,name,category,duration,loop,requirements,description)=>Object.freeze({
  id,clip:id,name,category,duration,frames:Math.round(duration*SOURCE.fps)+1,loop,requirements,
  rootMotionAvailable:true,sourceId:SOURCE.id,description
});
export const CATALOG=Object.freeze([
  e('Idle_Loop','Idle','Locomoção',2.5,true,['hips','spine','head'],'Respiração e balanço neutro em pé.'),
  e('Walk_Loop','Caminhada','Locomoção',1.333333,true,['hips','lUpperLeg','rUpperLeg','lKnee','rKnee'],'Caminhada frontal cíclica.'),
  e('Jog_Fwd_Loop','Corrida leve','Locomoção',.933333,true,['hips','lUpperLeg','rUpperLeg','lKnee','rKnee'],'Corrida frontal moderada.'),
  e('Sprint_Loop','Arrancada / sprint','Locomoção',.666667,true,['hips','spine','lUpperLeg','rUpperLeg'],'Corrida rápida; use apenas como referência de investida.'),
  e('Crouch_Fwd_Loop','Caminhada agachada','Locomoção',2,true,['hips','lUpperLeg','rUpperLeg','lKnee','rKnee'],'Locomoção frontal em postura baixa.'),
  e('Crouch_Idle_Loop','Agachamento parado','Genéricas',2.933333,true,['hips','lUpperLeg','rUpperLeg','lKnee','rKnee'],'Postura baixa cíclica.'),
  e('Roll','Rolamento / esquiva frontal','Combate',1.466667,false,['hips','spine','head','lUpperLeg','rUpperLeg'],'Rolamento corporal completo; não concede invulnerabilidade.'),
  e('Punch_Jab','Soco direto','Combate',.866667,false,['spine','lUpperArm','rUpperArm','lElbow','rElbow'],'Golpe curto de braço, sem hitbox autoritativa.'),
  e('Punch_Cross','Soco cruzado','Combate',1,false,['spine','lUpperArm','rUpperArm','lElbow','rElbow'],'Golpe cruzado com rotação do tronco.'),
  e('Sword_Attack','Ataque amplo','Combate',1.533333,false,['spine','lUpperArm','rUpperArm','lElbow','rElbow'],'Movimento amplo de ataque; não inclui arma.'),
  e('Hit_Chest','Impacto no tronco','Combate',.333333,false,['hips','spine','head'],'Reação curta a impacto no peito.'),
  e('Hit_Head','Impacto na cabeça','Combate',.433333,false,['spine','neck','head'],'Reação curta a impacto alto.'),
  e('Death01','Queda','Combate',2.4,false,['hips','spine','head','lUpperLeg','rUpperLeg'],'Queda completa. Não altera física ou estado de combate.'),
  e('Jump_Start','Início do salto','Genéricas',1.333333,false,['hips','lUpperLeg','rUpperLeg','lKnee','rKnee'],'Preparação e impulso visual.'),
  e('Jump_Loop','Salto / voo','Genéricas',2.5,true,['hips','spine','lUpperLeg','rUpperLeg'],'Pose aérea cíclica; a física continua externa.'),
  e('Jump_Land','Aterrissagem','Genéricas',1.266667,false,['hips','lUpperLeg','rUpperLeg','lKnee','rKnee'],'Recepção do salto e recuperação visual.'),
  e('Interact','Interação','Genéricas',2,false,['spine','lUpperArm','rUpperArm'],'Interação genérica com as mãos.'),
  e('Push_Loop','Empurrar','Genéricas',2.666667,true,['spine','lUpperArm','rUpperArm','lElbow','rElbow'],'Esforço cíclico de empurrão.'),
  e('Dance_Loop','Giro e dança','Genéricas',1,true,['hips','spine','lUpperLeg','rUpperLeg'],'Movimento cíclico para validar torções e ritmo.'),
  e('Fixing_Kneeling','Ajoelhar e interagir','Genéricas',5.2,false,['hips','spine','lUpperLeg','rUpperLeg','lUpperArm','rUpperArm'],'Sequência longa de ajoelhar e manipular objeto imaginário.')
]);
export const categories=()=>[...new Set(CATALOG.map(x=>x.category))];
