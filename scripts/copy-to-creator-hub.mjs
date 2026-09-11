import fs from 'node:fs'
import path from 'node:path'
const source=process.cwd()
const target=path.resolve('C:/Users/Antonio/AppData/Roaming/creator-hub/Scenes/kart')
const backup=path.join(target,'.kart-import-backup',new Date().toISOString().replace(/[:.]/g,'-'))
const read=(base,file)=>JSON.parse(fs.readFileSync(path.join(base,file),'utf8'))
const writes=new Map()
function stage(file,data){const dest=path.resolve(target,file);if(!dest.startsWith(target+path.sep))throw Error('Invalid destination');writes.set(file,data)}
for(const file of ['src/index.ts','src/core.ts','src/room.ts','src/ui.tsx','tsconfig.json'])stage(file,fs.readFileSync(path.join(source,file)))
for(const folder of ['assets/Models','assets/Audio'])for(const name of fs.readdirSync(path.join(source,folder)))stage(`${folder}/${name}`,fs.readFileSync(path.join(source,folder,name)))
const scene=read(target,'scene.json'),incoming=read(source,'scene.json')
scene.display.description=incoming.display.description;scene.scene=incoming.scene;scene.spawnPoints=incoming.spawnPoints;scene.requiredPermissions=incoming.requiredPermissions;scene.tags=incoming.tags
stage('scene.json',JSON.stringify(scene,null,2))
const composite=read(target,'assets/scene/main.composite'),authored=read(source,'assets/scene/main.composite')
for(const c of authored.components){let existing=composite.components.find(n=>n.name===c.name);if(existing){Object.assign(existing.data,c.data);if(c.jsonSchema)existing.jsonSchema=c.jsonSchema}else composite.components.push(c)}
const ids=Object.keys(authored.components.find(c=>c.name==='core::Transform').data).map(Number)
const nodes=composite.components.find(c=>c.name==='inspector::Nodes').data['0'].json.value
const root=nodes.find(n=>n.entity===0);root.children=[...new Set([...root.children,...ids])]
for(const id of ids)if(!nodes.some(n=>n.entity===id))nodes.push({entity:id,children:[]})
const metadata=composite.components.find(c=>c.name.startsWith('inspector::SceneMetadata')).data['0'].json
metadata.description=scene.display.description;metadata.categories=scene.tags;metadata.layout={parcels:scene.scene.parcels.map(p=>{const[x,y]=p.split(',').map(Number);return{x,y}}),base:{x:0,y:0}}
metadata.spawnPoints=scene.spawnPoints.map(s=>({...s,position:Object.fromEntries(Object.entries(s.position).map(([axis,n])=>[axis,{$case:'single',value:n}]))}))
stage('assets/scene/main.composite',JSON.stringify(composite,null,2))
const pkg=read(target,'package.json');pkg.description='Mini RC Drift Club — 2x2 arcade kart scene';stage('package.json',JSON.stringify(pkg,null,2))
for(const[file,data]of writes){const dest=path.join(target,file);if(fs.existsSync(dest)){const old=path.join(backup,file+'.bak');fs.mkdirSync(path.dirname(old),{recursive:true});fs.copyFileSync(dest,old)}fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,data)}
const manifest=[...writes.keys()].map(file=>({file,bytes:fs.statSync(path.join(target,file)).size}))
fs.writeFileSync(path.join(backup,'manifest.json'),JSON.stringify({target,files:manifest},null,2))
console.log(JSON.stringify({target,backup,files:manifest.length,projectId:scene.source?.projectId,parcels:scene.scene.parcels,editorEntities:ids.length},null,2))
