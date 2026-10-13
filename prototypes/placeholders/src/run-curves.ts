/** Cubic Hermite keys: value and velocity are authored, including at the cycle seam. */
export type Key = readonly [time:number,value:number,velocity:number];
export function hermite(a:number,b:number,va:number,vb:number,u:number,d:number){
 const u2=u*u,u3=u2*u;
 return (2*u3-3*u2+1)*a+(u3-2*u2+u)*d*va+(-2*u3+3*u2)*b+(u3-u2)*d*vb;
}
export function curve(keys:readonly Key[],t:number){
 if(t<=keys[0][0])return keys[0][1];
 if(t>=keys[keys.length-1][0])return keys[keys.length-1][1];
 let i=0;while(t>keys[i+1][0])i++;
 const a=keys[i],b=keys[i+1],d=b[0]-a[0];
 return hermite(a[1],b[1],a[2],b[2],(t-a[0])/d,d);
}
export const wrap=(t:number,p:number)=>((t%p)+p)%p;
export const smoother=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
