export type Species='a'|'b'|'c';
export interface Anatomy {id:Species;name:string;role:string;color:number;dark:number;height:number;body:[number,number,number];head:[number,number,number];hipWidth:number;upper:number;lower:number;arm:number;forearm:number;stride:number;cadence:number;neck:number;}
export const anatomies:Anatomy[]=[
 {id:'a',name:'Ímpeto',role:'Ágil · bípede saltador',color:0x41d9c5,dark:0x167c83,height:1.24,body:[.40,.56,.30],head:[.29,.25,.32],hipWidth:.24,upper:.65,lower:.69,arm:.53,forearm:.55,stride:.59,cadence:.60,neck:.20},
 {id:'b',name:'Lastro',role:'Pesado · bípede de apoio largo',color:0xf0a34e,dark:0x975833,height:.84,body:[.83,.68,.48],head:[.38,.27,.34],hipWidth:.48,upper:.43,lower:.43,arm:.58,forearm:.54,stride:.29,cadence:1.2,neck:.10},
 {id:'c',name:'Vésper',role:'Incomum · quadrúpede de pescoço móvel',color:0xa397f3,dark:0x62539f,height:.79,body:[.41,.32,.89],head:[.22,.21,.43],hipWidth:.39,upper:.42,lower:.46,arm:.35,forearm:.53,stride:.44,cadence:.8,neck:.66}
];
