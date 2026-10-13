export type Species='a';
export interface Anatomy {id:Species;name:string;role:string;color:number;dark:number;height:number;body:[number,number,number];head:[number,number,number];hipWidth:number;upper:number;lower:number;arm:number;forearm:number;stride:number;cadence:number;neck:number;}
export const anatomies:Anatomy[]=[
 {id:'a',name:'Ímpeto',role:'Ágil · bípede saltador',color:0x41d9c5,dark:0x167c83,height:1.24,body:[.40,.56,.30],head:[.29,.25,.32],hipWidth:.24,upper:.65,lower:.69,arm:.53,forearm:.55,stride:.59,cadence:.60,neck:.20}
];
