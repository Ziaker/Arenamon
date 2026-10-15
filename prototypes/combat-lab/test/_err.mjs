import {chromium} from '@playwright/test';
import {pathToFileURL} from 'node:url';
const b = await chromium.launch({channel:'msedge',headless:true});const p = await b.newPage();
p.on('pageerror',e=>console.log('ERR',e.message, e.stack?.split('\n').slice(0,3).join(' | ')));p.on('console',m=>{if(m.type()==='error')console.log('CON',m.text())});
await p.goto(pathToFileURL(process.cwd()+'/dist/arenamon-combate-laboratorio.html').href);await p.waitForTimeout(2500);await b.close();
