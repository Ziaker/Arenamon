import {readFileSync} from 'node:fs';import {parse} from 'acorn';
const f=process.argv[2];const src=readFileSync(f,'utf8');const ast=parse(src,{ecmaVersion:'latest',sourceType:'module',locations:true});
for(const st of ast.body){if(st.type==='ImportDeclaration')continue;const d=st.declaration??st;let n=d.id?.name??(d.declarations?.map(x=>x.id.name||'{..}').join(','))??st.type;console.log(`${st.loc.start.line}-${st.loc.end.line}\t${n}${st.type.startsWith('Export')?' *':''}`);}
