import fs from 'node:fs'
import {frames,TRACK_LENGTH,ROAD_WIDTH,sample,v,add,sub,mul,cross,unit,PALETTE} from '../src/core.ts'
fs.mkdirSync('assets/Models',{recursive:true});fs.mkdirSync('assets/scene',{recursive:true})
const colors=['#123142','#244b60','#20c8cf','#d83c9b','#754bb4','#f5c944','#f7f4e9','#101726','#57f7e3','#ff73d3','#fcdd77']
const rgb=h=>[1,3,5].map(i=>{const s=parseInt(h.slice(i,i+2),16)/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4})
let groups=[]
function reset(){groups=colors.map(()=>({p:[],n:[]}))}
function tri(a,b,c,m){const n=unit(cross(sub(b,a),sub(c,a)));for(const q of [a,b,c]){groups[m].p.push(q.x,q.y,q.z);groups[m].n.push(n.x,n.y,n.z)}}
function quad(a,b,c,d,m){tri(a,b,c,m);tri(a,c,d,m)}
function box(p,s,m){const q=[v(-1,-1,-1),v(1,-1,-1),v(1,1,-1),v(-1,1,-1),v(-1,-1,1),v(1,-1,1),v(1,1,1),v(-1,1,1)].map(a=>add(p,v(a.x*s.x/2,a.y*s.y/2,a.z*s.z/2)));for(const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(...f.map(i=>q[i]),m)}
function beam(a,b,r,m){const t=unit(sub(b,a)),right=unit(cross(Math.abs(t.y)>.9?v(1,0,0):v(0,1,0),t)),up=unit(cross(t,right));const corners=p=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>add(p,add(mul(right,x*r),mul(up,y*r))));let x=corners(a),y=corners(b);quad(x[3],x[2],x[1],x[0],m);quad(...y,m);for(let i=0;i<4;i++)quad(x[i],x[(i+1)%4],y[(i+1)%4],y[i],m)}
function writeGlb(file,only=null){const chunks=[],views=[],accessors=[],primitives=[];let offset=0
 const accessor=(arr)=>{const data=Buffer.from(new Float32Array(arr).buffer);chunks.push(data);views.push({buffer:0,byteOffset:offset,byteLength:data.length,target:34962});offset+=data.length;const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];arr.forEach((n,i)=>{min[i%3]=Math.min(min[i%3],n);max[i%3]=Math.max(max[i%3],n)});accessors.push({bufferView:views.length-1,componentType:5126,count:arr.length/3,type:'VEC3',min,max});return accessors.length-1}
 groups.forEach((g,i)=>{if(g.p.length&&(!only||only.includes(i)))primitives.push({attributes:{POSITION:accessor(g.p),NORMAL:accessor(g.n)},material:i})})
 const meshes=primitives.map((primitive,i)=>({name:`track-material-${i}`,primitives:[primitive]})),nodes=meshes.map((_,i)=>({name:`track-part-${i}`,mesh:i}))
 const doc={asset:{version:'2.0',generator:'Mini RC Kart procedural asset pipeline'},scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes,materials:colors.map((h,i)=>({name:`palette-${i}`,pbrMetallicRoughness:{baseColorFactor:[...rgb(h),1],metallicFactor:i<2?.25:.08,roughnessFactor:.48},...(i>=8?{emissiveFactor:rgb(h).map(n=>n*.8)}:{})})),buffers:[{byteLength:offset}],bufferViews:views,accessors}
 let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);const bin=Buffer.concat(chunks),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8);jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4);fs.writeFileSync(file,Buffer.concat([header,jh,json,bh,bin]));return groups.reduce((n,g)=>n+g.p.length/9,0)
}
reset()
box(v(16,.32,16),v(30,.55,30),7);box(v(16,.64,16),v(29.6,.1,29.6),0)
for(let i=0;i<4;i++){const p=i%2? v(i===1?1.4:30.6,.72,16):v(16,.72,i===0?1.4:30.6);box(p,i%2?v(.08,.08,28):v(28,.08,.08),8)}
const surface=(f,l,h=0)=>add(add(f.p,mul(f.right,l)),mul(f.up,h))
for(let i=0;i<frames.length;i++){
 const a=frames[i],b=frames[(i+1)%frames.length],w=ROAD_WIDTH/2,m=[2,4,3,4,2,5][Math.floor(a.s/7)%6]
 quad(surface(a,-w),surface(b,-w),surface(b,w),surface(a,w),m)
 quad(surface(a,w,-.14),surface(b,w,-.14),surface(b,-w,-.14),surface(a,-w,-.14),4)
 for(const side of [-1,1]){
  const x=side*w;quad(surface(a,x,-.14),surface(b,x,-.14),surface(b,x,.17),surface(a,x,.17),4)
  quad(surface(a,x-.045,.17),surface(b,x-.045,.17),surface(b,x+.045,.17),surface(a,x+.045,.17),side<0?8:9)
 }
 if(i%10===0){for(const side of [-1,1])beam(surface(a,side*w,.16),surface(a,side*w,.39),.025,6)}
 if(i%3===0){for(const side of [-1,1])beam(surface(a,side*w,.39),surface(b,side*w,.39),.018,1)}
 if(i%48===0){const c=surface(a,0,.012),t=mul(a.t,.42),r=mul(a.right,.32);beam(add(c,mul(r,-1)),add(c,t),.025,10);beam(add(c,r),add(c,t),.025,10)}
}
for(let s=32;s<TRACK_LENGTH-7;s+=9){const f=sample(s);if(f.up.y<.6)continue;for(const side of [-1,1]){const p=surface(f,side*1.05,-.2);beam(v(p.x,.72,p.z),p,.13,[3,4,5][Math.floor(s)%3]);box(v(p.x,.84,p.z),v(.6,.2,.6),4)}}
// Two checker gantries framing the low straight and summit.
for(const s of [0,TRACK_LENGTH*.48]){const f=sample(s);for(const side of [-1,1])beam(surface(f,side*1.5,0),surface(f,side*1.5,1.7),.07,1);beam(surface(f,-1.5,1.7),surface(f,1.5,1.7),.12,4);for(let i=0;i<10;i++)for(let j=0;j<2;j++){const x=-1.2+i*.24;const a=surface(f,x,.012),b=add(a,mul(f.t,.16));quad(a,b,add(b,mul(f.right,.24)),add(a,mul(f.right,.24)),(i+j)%2?7:6);f.p=add(f.p,mul(f.t,j*.16))}}
// Twenty RC control stations around the perimeter, outside the circuit footprint.
const seats=[]
for(let i=0;i<20;i++){const edge=Math.floor(i/5),n=i%5,along=5+n*5.5;const p=edge===0?v(along,0,2.7):edge===1?v(29.3,0,along):edge===2?v(32-along,0,29.3):v(2.7,0,32-along);seats.push(p);box(add(p,v(0,1.1,0)),v(1.15,.14,.7),4);box(add(p,v(0,.8,0)),v(.22,.65,.22),1);box(add(p,v(0,1.22,0)),v(.52,.12,.32),7);box(add(p,v(0,1.3,0)),v(.31,.03,.15),2);box(add(p,v(0,.8,-.62)),v(.66,.16,.6),3);box(add(p,v(0,1.1,-.88)),v(.66,.7,.12),4)}
const triangles=writeGlb('assets/Models/circuit-aaa.glb')
for(let i=0;i<groups.length;i++)if(groups[i].p.length)writeGlb(`assets/Models/circuit-part-${i}.glb`,[i])
for(let color=0;color<PALETTE.length;color++){
 reset();colors[2]=PALETTE[color]
 box(v(0,.06,0),v(.42,.1,.65),7);box(v(0,.14,.11),v(.36,.12,.37),2);box(v(0,.12,-.21),v(.4,.1,.12),2);box(v(0,.25,-.1),v(.23,.2,.2),7);box(v(0,.3,-.14),v(.26,.05,.08),2);box(v(0,.27,-.28),v(.55,.055,.1),2)
 for(const x of [-.25,.25])for(const z of [-.2,.2]){box(v(x,.08,z),v(.13,.19,.18),7);box(v(x*1.12,.08,z),v(.025,.1,.1),6)}
 box(v(0,.2,.17),v(.055,.01,.22),6);beam(v(.09,.25,-.19),v(.09,.55,-.19),.009,1);writeGlb(`assets/Models/kart-${color}.glb`)
}
const components=new Map();const put=(name,id,data)=>{if(!components.has(name))components.set(name,{});components.get(name)[id]={json:data}}
function entity(id,name,position,scale=v(1,1,1)){put('core-schema::Name',id,{value:name});put('core::Transform',id,{position,scale,rotation:{x:0,y:0,z:0,w:1},parent:0})}
entity(512,'Circuit',v());put('core::GltfContainer',512,{src:'assets/Models/circuit-aaa.glb',visibleMeshesCollisionMask:0,invisibleMeshesCollisionMask:0})
seats.forEach((p,i)=>{const id=513+i;entity(id,`Seat${i+1}`,add(p,v(0,1.25,0)),v(1,.2,.6));put('core::MeshCollider',id,{mesh:{$case:'box',box:{}},collisionMask:2})})
entity(540,'RaceCamera',v(16,16,-4));put('core::VirtualCamera',540,{})
entity(541,'Title',v(16,4,3));put('core::TextShape',541,{text:'MINI RC\nDRIFT CLUB',fontSize:5,textColor:{r:1,g:.85,b:.25},font:2})
fs.writeFileSync('assets/scene/main.composite',JSON.stringify({version:1,components:[...components].map(([name,data])=>({name,data,...(name==='core-schema::Name'?{jsonSchema:{type:'object',properties:{value:{type:'string',serializationType:'utf8-string'}},serializationType:'map'}}:{})}))},null,2))
fs.writeFileSync('assets/scene/seats.json',JSON.stringify(seats))
fs.writeFileSync('assets/asset-report.json',JSON.stringify({triangles,trackLength:TRACK_LENGTH,roadWidth:ROAD_WIDTH,seatCount:20,bounds:{min:frames.reduce((a,f)=>v(Math.min(a.x,f.p.x),Math.min(a.y,f.p.y),Math.min(a.z,f.p.z)),v(100,100,100)),max:frames.reduce((a,f)=>v(Math.max(a.x,f.p.x),Math.max(a.y,f.p.y),Math.max(a.z,f.p.z)),v())}},null,2))
console.log(`Generated circuit: ${triangles} triangles, ${TRACK_LENGTH.toFixed(1)}m road, 20 control seats and 6 kart liveries.`)
