// Temporary lab controller. Combat motion.ts and its rules are intentionally untouched.
export const runTiming={cycle:.8,step:.4,stance:.27,speed:2.4,landing:.40};
export type RunMode='treadmill'|'travel';
export function runMotion(t:number,mode:RunMode){
 const distance=runTiming.speed*t;
 return {distance,rootZ:mode==='travel'?distance:0,groundZ:mode==='treadmill'?-distance:0};
}
