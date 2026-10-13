export const clamp=(x:number)=>Math.max(0,Math.min(1,x));
export const smooth=(x:number)=>{x=clamp(x);return x*x*(3-2*x);};
export const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export type Ease='smooth'|'snap'|'settle'|'linear';
export function ease(u:number,k:Ease='smooth'){u=clamp(u);return k==='snap'?1-(1-u)**3:k==='settle'?u*u*u:k==='linear'?u:smooth(u);}
export function pulse(t:number,start:number,end:number){return Math.sin(clamp((t-start)/(end-start))*Math.PI);}
