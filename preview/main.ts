import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {Room,Packet} from '../src/room'
import {v,add,mul,pose,orientation,step,bump,freshGarage,PALETTE,purchase,cost,gain,timeText,Part,TRACK_LENGTH,freshDriver,clamp,sample,dot,sub} from '../src/core'
const $=(id:string)=>document.getElementById(id)!
const renderer=new THREE.WebGLRenderer({canvas:$('world') as HTMLCanvasElement,antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0
const scene=new THREE.Scene();scene.background=new THREE.Color('#101d2b');scene.fog=new THREE.Fog('#101d2b',65,135)
const camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.035,180);camera.position.set(55,30,-22)
const orbit=new OrbitControls(camera,renderer.domElement);orbit.target.set(28,4,22);orbit.enableDamping=true;orbit.minDistance=17;orbit.maxDistance=80;orbit.maxPolarAngle=Math.PI*.47;orbit.autoRotate=false;orbit.autoRotateSpeed=.22
scene.add(new THREE.HemisphereLight('#c8efff','#515568',2.1));const sun=new THREE.DirectionalLight('#fff0d6',4.5);sun.position.set(8,35,-10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-26,right:26,top:26,bottom:-26,near:1,far:90});sun.shadow.normalBias=.035;sun.target.position.set(16,4,16);scene.add(sun,sun.target)
const fill=new THREE.DirectionalLight('#93b9ff',1.8);fill.position.set(32,20,35);scene.add(fill)
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#112437',roughness:.85}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground)
const loader=new GLTFLoader(),models:THREE.Group[]=[]
const keys=new Set<string>();let audio:AudioContext|null=null,osc:OscillatorNode|null=null,amp:GainNode|null=null,sound=false,overview=false,loaded=false,garaging=false
function enableAudio(){audio??=new AudioContext();audio.resume();if(!osc){osc=audio.createOscillator();amp=audio.createGain();osc.type='sawtooth';amp.gain.value=0;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=440;osc.connect(filter);filter.connect(amp);amp.connect(audio.destination);osc.start()}sound=!sound;$('sound').textContent=sound?'SOUND ON':'SOUND OFF'}
$('sound').onclick=enableAudio
let garage=freshGarage();try{const data=JSON.parse(localStorage.getItem('mini-rc-garage-v1')||'null');if(data&&['credits','motor','tires','battery','color','races'].every(k=>Number.isFinite(data[k])&&data[k]>=0))garage={...garage,...data,color:Math.floor(data.color)%6}}catch{}
const save=()=>localStorage.setItem('mini-rc-garage-v1',JSON.stringify(garage))
const channel=new BroadcastChannel('mini-rc-playtest-v1');const bots:Room[]=[]
const room=new Room(crypto.randomUUID(),send,garage,save)
function send(p:Packet){channel.postMessage(p);for(const bot of bots)bot.receive(p)}
channel.onmessage=e=>{room.receive(e.data);bots.forEach(b=>b.receive(e.data))}
const meshes=new Map<string,THREE.Group>();const sparks=new THREE.Group();scene.add(sparks)
for(let i=0;i<14;i++){const m=new THREE.Mesh(new THREE.OctahedronGeometry(.025),new THREE.MeshBasicMaterial({color:'#46f2de'}));sparks.add(m)}
Promise.all([loader.loadAsync('/assets/Models/circuit.glb'),...PALETTE.map((_,i)=>loader.loadAsync(`/assets/Models/kart-${i}.glb`))]).then(([circuit,...karts])=>{
 circuit.scene.traverse((o:any)=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});scene.add(circuit.scene);karts.forEach(k=>models.push(k.scene));loaded=true;$('loading').textContent='CIRCUIT READY';
}).catch(e=>{$('loading').textContent='ASSET LOAD FAILED';console.error(e)})
function enter(){if(!loaded)return;room.join();document.body.classList.add('driving');$('landing').hidden=true;$('lobby').hidden=false;$('hud').hidden=false;$('touch').hidden=!matchMedia('(pointer:coarse)').matches;orbit.enabled=false;overview=false;keys.clear()}
$('enter').onclick=enter
$('leave').onclick=()=>{room.leave();keys.clear();$('landing').hidden=false;$('lobby').hidden=true;$('hud').hidden=true;$('touch').hidden=true;document.body.classList.remove('driving');orbit.enabled=true;camera.position.set(55,30,-22);orbit.target.set(28,4,22)}
$('ready').onclick=()=>room.ready();document.querySelectorAll<HTMLButtonElement>('[data-laps]').forEach(b=>b.onclick=()=>room.vote(Number(b.dataset.laps)))
$('watch').onclick=()=>{if(room.isRacing()||room.isGrid()){room.message='Finish this race before spectating.';return}room.spectating=!room.spectating;room.message=room.spectating?'Following the race leader.':'Ghost practice on the circuit.'}
function garageView(){garaging=!garaging;$('garage').hidden=!garaging;keys.clear();if(garaging)drawGarage()}
$('garageButton').onclick=garageView;$('closeGarage').onclick=garageView
function drawGarage(){ $('credits').textContent=garage.credits.toString();$('parts').replaceChildren();(['motor','tires','battery'] as Part[]).forEach((part,i)=>{const div=document.createElement('div');div.className='part';div.innerHTML=`<div><h3>${part.toUpperCase()} <small>LV ${garage[part]}</small></h3><small>${['TOP SPEED','HANDLING','BOOST DURATION'][i]} +${(gain(garage[part])*100).toFixed(2)}%</small></div>`;const b=document.createElement('button');b.textContent=`${cost(garage[part])} CR ↗`;b.disabled=garage.credits<cost(garage[part])||room.isRacing()||room.isGrid();b.onclick=()=>{if(!room.isRacing()&&!room.isGrid()&&purchase(garage,part)){save();drawGarage()}};div.append(b);$('parts').append(div)})
 $('paints').replaceChildren();PALETTE.forEach((c,i)=>{const b=document.createElement('button');b.style.background=c;b.className=i===garage.color?'selected':'';b.ariaLabel=`Paint color ${i+1}`;b.onclick=()=>{garage.color=i;save();drawGarage()};$('paints').append(b)})}
$('bots').onclick=()=>{if(bots.length)return;for(let i=0;i<3;i++){let b:Room;b=new Room(`bot-${room.id}-${i}`,p=>{room.receive(p);channel.postMessage(p);bots.forEach(other=>{if(other!==b)other.receive(p)})},freshGarage());b.me.name=['Mika / BOT','Rio / BOT','Nova / BOT'][i];b.garage.color=i+1;bots.push(b);b.receive({kind:'peer',peer:{...room.me}});b.join(i+1);b.me.ready=true;b.broadcast()}$('bots').textContent='3 BOTS ACTIVE';room.message='Three preview bots joined. Ready up to race.'}
addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(e.code==='KeyC'&&!e.repeat&&room.seated()){overview=!overview;orbit.enabled=overview;if(overview){camera.position.set(42,30,-24);orbit.target.set(16,6,16)}}keys.add(e.code)})
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>keys.clear())
document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach(b=>{b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);keys.add(b.dataset.key!)};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.key!)})
addEventListener('beforeunload',()=>{channel.postMessage({kind:'leave',id:room.id});bots.forEach(b=>channel.postMessage({kind:'leave',id:b.id}));save();channel.close()})
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)})
function showKart(id:string,d:any,color:number,ghost=false){if(!loaded)return;let m=meshes.get(id);if(m&&m.userData.color!==color){scene.remove(m);meshes.delete(id);m=undefined}if(!m){m=models[color].clone(true);m.userData.color=color;m.traverse((o:any)=>{if(o.isMesh){o.castShadow=true;o.material=o.material.clone()}});meshes.set(id,m);scene.add(m)}const f=pose(d.s,d.lane);m.position.set(f.p.x,f.p.y,f.p.z);const q=orientation(f,d.heading||0);m.quaternion.set(q.x,q.y,q.z,q.w);m.traverse((o:any)=>{if(o.isMesh){o.material.transparent=ghost;o.material.opacity=ghost?.42:1;o.material.depthWrite=!ghost}});m.visible=true}
function hud(){const d=room.driver,r=room.round;$('speed').textContent=Math.round(d.speed*12).toString().padStart(2,'0');$('timer').textContent=timeText(d.elapsed);$('best').textContent=d.best?`BEST ${timeText(d.best)}`:'BEST —';$('lap').textContent=`LAP ${Math.min(d.lap+1,r.laps)} / ${r.laps}`;$('mode').textContent=room.isRacing()?'RACING':room.spectating?'SPECTATING':'GHOST PRACTICE';$('status').textContent=r.phase==='lobby'?'Find your line.':r.phase==='vote'?'Choose the distance.':r.phase==='countdown'?'On the grid.':r.phase==='race'?'Race in progress.':'The finish line.';$('count').textContent=`${[...room.peers.values()].filter(p=>p.seat>=0).length} / 20`;$('message').textContent=room.message;$('ready').innerHTML=room.me.ready?'READY ✓':'READY UP <span>→</span>';$('ready').style.background=room.me.ready?'#f5ce62':'#48e3c8';$('watch').textContent=room.spectating?'BACK TO PRACTICE':'WATCH RACE';document.querySelectorAll<HTMLButtonElement>('[data-laps]').forEach(b=>b.classList.toggle('selected',Number(b.dataset.laps)===room.me.vote));document.querySelectorAll<HTMLElement>('.charge i').forEach((el,i)=>{el.classList.toggle('on',d.tier>i);el.style.background=d.tier>i?['#40e4d4','#f5ce62','#ef3ba8'][d.tier-1]:''});$('boostLabel').textContent=d.boost>0?'BOOST RELEASED':d.tier?`TIER ${d.tier} / RELEASE TO BOOST`:'HOLD SPACE TO DRIFT';$('countdown').hidden=r.phase!=='countdown'&&r.phase!=='vote';$('countdown').textContent=r.phase==='vote'?`VOTE ${Math.max(0,Math.ceil((r.until-Date.now())/1000))}`:`${Math.max(1,Math.ceil((r.until-Date.now())/1000))}`;$('countdown').style.fontSize=r.phase==='vote'?'40px':'110px';$('result').hidden=!room.result;$('result').textContent=room.result}
let last=performance.now(),acc=0,uiClock=0
function frame(now:number){requestAnimationFrame(frame);const dt=Math.min(.1,(now-last)/1000);last=now;room.update();bots.forEach(b=>{b.update();if(b.round.phase==='lobby')b.me.ready=true});acc+=dt
 while(acc>=1/60){
  if(room.seated()&&!room.isGrid()&&!room.spectating&&!garaging){const d=room.driver;step(d,{throttle:keys.has('KeyW')?1:0,brake:keys.has('KeyS'),steer:(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0),drift:keys.has('Space')},garage,1/60,room.isRacing()?room.round.laps:0);if(room.isRacing())for(const p of room.peers.values())if(p.id!==room.id&&room.round.roster.includes(p.id)&&!p.finished)bump(d,p,1/60)}
  bots.forEach((b,i)=>{if(b.isGrid()||b.driver.finished)return;const d=b.driver,f=sample(d.s),n=sample(d.s+.2),c=dot(sub(n.t,f.t),f.right)/.2;const target=(i-1)*.48;const steer=clamp((target-d.lane)*.9+c*d.speed*.08,-1,1);step(d,{throttle:.86+i*.04,steer,brake:false,drift:false},b.garage,1/60,b.isRacing()?b.round.laps:0)})
  acc-=1/60
 }
 meshes.forEach(m=>m.visible=false)
 if(!room.seated()){for(let i=0;i<8;i++)showKart(`demo${i}`,{s:now*.002+i*TRACK_LENGTH/8,lane:(i%3-1)*.4},i%6);orbit.update()}
 else{for(const p of room.peers.values())if(p.seat>=0){const d=p.id===room.id?room.driver:p;showKart(p.id,d,p.color,!(room.round.phase==='race'&&room.round.roster.includes(p.id)))}
  if(overview)orbit.update();else{const target=room.spectating?[...room.peers.values()].filter(p=>room.round.roster.includes(p.id)).sort((a,b)=>b.s-a.s)[0]:undefined,d=target??room.driver,f=pose(d.s,d.lane);const pos=add(add(f.p,mul(f.t,-1.7)),mul(f.up,.85));camera.position.set(pos.x,pos.y,pos.z);camera.up.set(f.up.x,f.up.y,f.up.z);const at=add(f.p,mul(f.t,2.2));camera.lookAt(at.x,at.y,at.z);camera.fov=room.driver.boost>0?66:60;camera.updateProjectionMatrix()}
 }
 sparks.visible=room.seated()&&room.driver.tier>0;const f=pose(room.driver.s,room.driver.lane);sparks.position.set(f.p.x,f.p.y,f.p.z);const q=orientation(f,room.driver.heading);sparks.quaternion.set(q.x,q.y,q.z,q.w);sparks.children.forEach((m:any,i)=>{m.position.set((i%2?1:-1)*(.27+(i%3)*.025),.03+Math.sin(now*.02+i)*.025,-.2-((now*.001+i*.08)%.5));m.material.color.set(['#40e4d4','#f5ce62','#ef3ba8'][Math.max(0,room.driver.tier-1)])})
 if(osc&&amp&&audio){osc.frequency.setTargetAtTime(45+room.driver.speed*22,audio.currentTime,.06);amp.gain.setTargetAtTime(sound&&room.seated()?.025:0,audio.currentTime,.1)}
 if((uiClock+=dt)>.1){hud();uiClock=0}renderer.render(scene,camera)
}
requestAnimationFrame(frame)
// Read-only counters for smoke verification; no control or reward bypass.
Object.defineProperty(window,'miniRCDiagnostics',{get:()=>({loaded,phase:room.round.phase,peers:room.peers.size,lap:room.driver.lap,speed:room.driver.speed,trackLength:TRACK_LENGTH,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles})})


