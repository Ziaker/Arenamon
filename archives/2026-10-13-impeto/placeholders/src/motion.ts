import {State,duration} from './states';
import {clamp,smooth} from './curves';
export const rules={dodge:.4,invulnerable:.2,recoil:.3,recoilFraction:.15,nominalDistance:1.6};
// Only this controller owns physical translation. Visual style is not an input.
export function motion(s:State,time:number){
 const t=Math.max(0,Math.min(time,duration(s))),u=clamp(t/.4),d=rules.nominalDistance*(1-(1-u)**2);
 const dodge=['front','side','back','tackle'].includes(s);
 const position:[number,number,number]=s==='side'?[d,0,0]:s==='back'?[0,0,-d]:s==='front'||s==='tackle'?[0,0,d]:s==='blocked'?[0,0,-rules.nominalDistance*.15*smooth(t/.3)]:s==='push'?[0,0,-.55*smooth(t/.65)]:[0,0,0];
 return {position,yaw:s==='turn'?Math.PI/2*smooth(t/1.2):0,invulnerable:dodge&&t<.2,offensive:(s==='front'||s==='tackle')&&t<.4,active:dodge&&t<.4,phase:dodge?(t<.2?'Esquiva · invulnerável':t<.4?'Esquiva · vulnerável':'Esquiva encerrada'):s==='blocked'?(t<.3?'Recuo cancelável · sem dano':'Recuo encerrado'):'Estudo de movimento'};
}
