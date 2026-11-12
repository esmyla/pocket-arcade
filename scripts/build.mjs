import {cp,mkdir,rm,readdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
execFileSync('npm',['run','build'],{cwd:root+'../CrackRunner',stdio:'inherit'});
await rm(root+'dist',{recursive:true,force:true});await mkdir(root+'dist',{recursive:true});
await cp(root+'app',root+'dist',{recursive:true});await cp(root+'../CrackRunner/dist',root+'dist/games/crack',{recursive:true});
async function walk(dir,prefix=''){let files=[];for(const e of await readdir(dir,{withFileTypes:true})){if(e.isDirectory())files.push(...await walk(dir+'/'+e.name,prefix+e.name+'/'));else files.push(prefix+e.name);}return files;}
const paths=(await walk(root+'dist')).map(x=>'./'+x);
const version='pocket-'+Date.now();
await writeFile(root+'dist/sw.js',`const CACHE=${JSON.stringify(version)};const ASSETS=${JSON.stringify(['./',...paths])};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('pocket-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).origin!==self.location.origin)return;const u=new URL(e.request.url);const key=u.pathname.endsWith('/')?new URL('index.html',u).href:e.request;e.respondWith(caches.match(key,{ignoreSearch:true}).then(c=>c||fetch(e.request)));});`);
console.log('Built Pocket Arcade with '+paths.length+' offline assets.');
