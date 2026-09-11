import {engine,Transform,GltfContainer,Animator,MainCamera,VirtualCamera,InputAction,inputSystem,pointerEventsSystem,MeshRenderer,MeshCollider,Material,AudioSource,Entity,Composite,getCompositeProvider,TouchScreenControls,ColliderLayer,Billboard,BillboardMode,TextShape,TextAlignMode,AssetLoad,VisibilityComponent,MaterialTransparencyMode,ParticleSystem,PBParticleSystem_BlendMode,PBParticleSystem_PlaybackState,PBParticleSystem_SimulationSpace,Schemas,GltfNodeModifiers} from '@dcl/sdk/ecs'
import {syncEntity,isStateSyncronized} from '@dcl/sdk/network'
import {Color4,Quaternion} from '@dcl/sdk/math'
import {MessageBus} from '@dcl/sdk/message-bus'
import {getPlayer} from '@dcl/sdk/src/players'
import {isMobile} from '@dcl/sdk/platform'
import {Room,Packet} from './room'
import {v,add,mul,pose,orientation,step,bump,freshGarage,clamp,sample,ROAD_WIDTH,TRACK_LENGTH,RACE_START,mod,TOP_SPEED,gain,purchase,cost,PALETTE,Garage} from './core'
import {setupUi,preferences,mobileButtons} from './ui'
export let room:Room
const SyncPeer=engine.defineComponent('mini-rc::peer-v2',{id:Schemas.String,userId:Schemas.String,name:Schemas.String,seat:Schemas.Int,ready:Schemas.Boolean,color:Schemas.Int,metalColor:Schemas.Int,tireStyle:Schemas.Int,s:Schemas.Float,lane:Schemas.Float,speed:Schemas.Float,heading:Schemas.Float,driftAngle:Schemas.Float,tier:Schemas.Int,boost:Schemas.Float,finished:Schemas.Boolean,best:Schemas.Float,elapsed:Schemas.Float,stamp:Schemas.Int64})
const SyncRound=engine.defineComponent('mini-rc::round-v2',{id:Schemas.String,host:Schemas.String,phase:Schemas.String,until:Schemas.Int64,laps:Schemas.Int,roster:Schemas.Array(Schemas.String),finished:Schemas.Array(Schemas.String),started:Schemas.Int64,winnerAt:Schemas.Int64,stamp:Schemas.Int64})
type KartView={entity:Entity;model:Entity;tire:Entity;motorAudio?:Entity;portrait?:Entity;visualKey:string;portraitUserId:string;portraitShown:boolean;lastSeen:number;displayS:number;displayLane:number;displayHeading:number;materialRefresh:number}
const karts=new Map<string,KartView>()
type TrackItem={kind:'boost'|'oil'|'glue';s:number;lane:number;entity:Entity;rotation:Quaternion;cooldown:number}
const trackItems:TrackItem[]=[]
let mobileSeat=-2
let gantryState=-1,sparkTier=-1
let cameraHeading=0,cameraSpeed=0
let cam:Entity,activeSeat=-1,accumulator=0,sparks:Entity[]=[],gantryLights:Entity[]=[],layoutKey='',avatarBoundsActive=false
let avatarBounds:Entity[]=[]
let syncPeerEntity:Entity,syncRoundEntity:Entity,musicAudio:Entity,cueAudio:Entity,lastSyncWrite=0,lastSyncRead=0,lastRoundWrite=0,lastRoundRead=0,seenSyncRound=''
let workshopKart:Entity|undefined,workshopTire:Entity|undefined,workshopVisualKey='',workshopSpin=0,workshopMaterialRefresh=0
const tireNames=['SPEED','BIGFOOT','CROSS']
const tireSrc=(style:number)=>['assets/Models/player-kart-speedtire.glb','assets/Models/player-kart-bigfoot.glb','assets/Models/player-kart-crosstire.glb'][Math.floor(clamp(style,0,2))]
const bodySrc=()=>`assets/Models/player-kart-body.glb`
const carpaintPaths=['Cube','Cube.005','Cube.006','Cube.007','Cube.008','Cube.009','Cube.010','Cube.011','Cube.012','Cube.013','Cube.014','Cube.016','Cube.018','Cube.020','Cube.022']
const metalgridPaths=['Cube.025']
const colorMaterial=(color:number,metallic=.25,roughness=.32)=>{const c=Color4.fromHexString(PALETTE[Math.floor(clamp(color,0,PALETTE.length-1))]);return {material:{$case:'pbr' as const,pbr:{albedoColor:c,metallic,roughness,castShadows:false}}}}
function applyKartMaterials(entity:Entity,paint:number,metal:number){GltfNodeModifiers.createOrReplace(entity,{modifiers:[...carpaintPaths.map(path=>({path,material:colorMaterial(paint,.2,.28)})),...metalgridPaths.map(path=>({path,material:colorMaterial(metal,.55,.2)}))]})}
let confettiEmitters:Entity[]=[],lastCeremonyRound='',lastFinishBurst='',lastFinalLapBurst='',lastCountdownCue=-1,musicRound='',paradeS=RACE_START,cinemaPhase=0,driveInputReadyAt=0,reverseArmed=true
const garageKey='mini-rc-garage-v1'
const INTRO_MS=6000
export async function main(){
 const provider=getCompositeProvider()
 if(!engine.getEntityOrNullByName('Circuit')&&provider?.loadComposite){const resource=await provider.loadComposite('assets/scene/main.composite');Composite.instance(engine,resource,provider)}
 // Old seats are collider-only remnants of the replaced circuit model.
 // Clear them after either Creator Hub CRDT loading or composite loading.
 for(let i=1;i<=20;i++){
  const seat=engine.getEntityOrNullByName(`Seat${i}`)
  if(seat)MeshCollider.deleteFrom(seat)
 }
 // Creator Hub may preload an older main.crdt and skip the composite's GLB attachment.
 // Reassert the circuit container at runtime so the road is always visible.
 let circuit=engine.getEntityOrNullByName('Circuit')
 if(!circuit){circuit=engine.addEntity();Transform.create(circuit,{position:v(0,0,0),scale:v(-1,1,1)})}
 else Transform.createOrReplace(circuit,{position:v(0,0,0),scale:v(-1,1,1),rotation:Quaternion.Identity()})
 GltfContainer.createOrReplace(circuit,{src:'assets/Models/trackkart5.glb',visibleMeshesCollisionMask:ColliderLayer.CL_PHYSICS,invisibleMeshesCollisionMask:0})
 buildStartFinish()
 buildJoinStations()
 buildAvatarBounds()
 buildTrackItems()
 preloadKarts()
 const bus=new MessageBus();const id=`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,9)}`
 room=new Room(id,p=>bus.emit('mini-rc-v1',p),loadGarage(),saveGarage);bus.on('mini-rc-v1',(p:Packet)=>room.receive(p))
 syncPeerEntity=engine.addEntity();writeSyncedPeer(true);syncEntity(syncPeerEntity,[SyncPeer.componentId])
 syncRoundEntity=engine.addEntity();SyncRound.create(syncRoundEntity,{id:'',host:'',phase:'lobby',until:0,laps:5,roster:[],finished:[],started:0,winnerAt:0,stamp:0});syncEntity(syncRoundEntity,[SyncRound.componentId],73021)
 buildWorkshop()
 randomizeTrackItems(`practice-${id}`)
 const player=getPlayer();if(player){room.me.name=player.name.slice(0,24);room.me.userId=player.userId||room.id}
 // Build the actual local renderer before joining, and retain it between drives.
 updateWorkshopKart()
 buildConfetti()
 musicAudio=engine.addEntity();Transform.create(musicAudio,{position:v(16,2,16)});AudioSource.create(musicAudio,{audioClipUrl:'assets/Audio/racemusic.mp3',playing:false,loop:true,volume:0,global:true})
 cueAudio=engine.addEntity();Transform.create(cueAudio,{position:v(16,2,16)})
 const parked=kart(room.id,room.garage.color,room.me.userId,room.garage.tireStyle,room.garage.metalColor),start=pose(RACE_START)
 Transform.createOrReplace(parked.entity,{position:start.p,rotation:orientation(start),scale:v(.096,.096,.096)})
 const found=engine.getEntityOrNullByName('RaceCamera');cam=found??engine.addEntity()
 Transform.createOrReplace(cam,{position:add(add(start.p,mul(start.t,-.258)),mul(start.up,.123)),rotation:Quaternion.multiply(orientation(start),Quaternion.fromEulerDegrees(13,0,0))})
 VirtualCamera.createOrReplace(cam,{defaultTransition:{transitionMode:VirtualCamera.Transition.Time(0)}})
 setupUi();engine.addSystem(update)
}
function storage(){try{return (globalThis as unknown as {localStorage?:{getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void}}).localStorage}catch{return undefined}}
function loadGarage(){
 const g=freshGarage(),store=storage();if(!store)return g
 try{
  const raw=store.getItem(garageKey),data=raw?JSON.parse(raw):{}
  if(Number.isFinite(data?.credits))g.credits=Math.max(0,Math.floor(data.credits))
  if(Number.isFinite(data?.motor))g.motor=Math.max(0,Math.floor(data.motor))
  if(Number.isFinite(data?.tires))g.tires=Math.max(0,Math.floor(data.tires))
  if(Number.isFinite(data?.battery))g.battery=Math.max(0,Math.floor(data.battery))
  if(Number.isFinite(data?.color))g.color=Math.floor(clamp(data.color,0,PALETTE.length-1))
  if(Number.isFinite(data?.metalColor))g.metalColor=Math.floor(clamp(data.metalColor,0,PALETTE.length-1))
  if(Number.isFinite(data?.tireStyle))g.tireStyle=Math.floor(clamp(data.tireStyle,0,2))
  if(Number.isFinite(data?.races))g.races=Math.max(0,Math.floor(data.races))
 }catch{}
 return g
}
function saveGarage(){const store=storage();if(store)try{store.setItem(garageKey,JSON.stringify(room.garage))}catch{}}
function writeSyncedPeer(force=false){
 if(!syncPeerEntity||!room)return
 const now=Date.now();if(!force&&now-lastSyncWrite<100)return;lastSyncWrite=now
 const p=room.me,d=room.driver
 SyncPeer.createOrReplace(syncPeerEntity,{id:room.id,userId:p.userId||room.id,name:p.name||'Racer',seat:room.seat,ready:!!p.ready,color:room.garage.color,metalColor:room.garage.metalColor,tireStyle:room.garage.tireStyle,s:d.s,lane:d.lane,speed:d.speed,heading:d.heading,driftAngle:d.driftAngle||0,tier:d.tier,boost:d.boost,finished:d.finished,best:d.best,elapsed:d.elapsed,stamp:now})
}
function readSyncedPeers(){
 if(!isStateSyncronized()||!room)return
 const now=Date.now();if(now-lastSyncRead<80)return;lastSyncRead=now
 for(const [,p]of engine.getEntitiesWith(SyncPeer)){
  if(!p.id||p.id===room.id)continue
  room.receive({kind:'peer',peer:{id:p.id,userId:p.userId,name:p.name,seat:p.seat,ready:p.ready,color:p.color,metalColor:p.metalColor,tireStyle:p.tireStyle,s:p.s,lane:p.lane,speed:p.speed,heading:p.heading,driftAngle:p.driftAngle,tier:p.tier,boost:p.boost,finished:p.finished,best:p.best,elapsed:p.elapsed,seen:now}})
 }
}
function writeSyncedRound(force=false){
 if(!syncRoundEntity||!room||room.round.solo)return
 const now=Date.now();if(!force&&now-lastRoundWrite<100)return;lastRoundWrite=now
 const r=room.round
 SyncRound.createOrReplace(syncRoundEntity,{id:r.id,host:room.id,phase:r.phase,until:r.until,laps:r.laps,roster:r.roster,finished:r.finished,started:r.started,winnerAt:r.winnerAt,stamp:now})
}
function readSyncedRound(){
 if(!syncRoundEntity||!isStateSyncronized()||!room)return
 const now=Date.now();if(now-lastRoundRead<80)return;lastRoundRead=now
 const r=SyncRound.getOrNull(syncRoundEntity);if(!r||!r.id||r.stamp<=0)return
 const key=`${r.id}:${r.phase}:${r.until}:${r.finished.join(',')}`;if(key===seenSyncRound)return;seenSyncRound=key
 room.receive({kind:'round',host:r.host,round:{id:r.id,phase:r.phase as typeof room.round.phase,until:r.until,laps:r.laps,roster:[...r.roster],finished:[...r.finished],started:r.started,winnerAt:r.winnerAt,solo:false}})
}
function enterRace(seat?:number){
 room.join(seat)
 if(room.seated()){mobileButtons.gas=false;mobileButtons.reverse=false;reverseArmed=false;driveInputReadyAt=Date.now()+700;paradeS=room.driver.s;activateDrivingCamera();room.message='Seat locked. Practice until the next race.'}
}
function activateDrivingCamera(){
 const d=room.driver,f=pose(d.s,d.lane),own=kart(room.id,room.garage.color,room.me.userId,room.garage.tireStyle,room.garage.metalColor)
 Transform.createOrReplace(own.entity,{position:f.p,rotation:orientation(f,d.heading),scale:v(.096,.096,.096)})
 if(own.motorAudio){const kmh=Math.abs(d.speed)*12,pitch=clamp(1+(kmh-20)/50,.65,2.15),volume=room.seat>=0?clamp(.28+d.throttle*.38+kmh/140,.18,1):0;AudioSource.createOrReplace(own.motorAudio,{audioClipUrl:'assets/Audio/motorloop.mp3',playing:true,loop:true,volume:Math.max(volume,.55),pitch,global:true,currentTime:0})}
 cameraHeading=d.heading*.7;cameraSpeed=clamp(d.speed/TOP_SPEED,0,1);accumulator=0
 const forward=add(mul(f.t,Math.cos(cameraHeading)),mul(f.right,Math.sin(cameraHeading)))
 Transform.createOrReplace(cam,{position:add(add(f.p,mul(forward,-.258-.018*cameraSpeed)),mul(f.up,.123)),rotation:Quaternion.multiply(orientation(f,cameraHeading),Quaternion.fromEulerDegrees(13,0,0))})
 VirtualCamera.createOrReplace(cam,{defaultTransition:{transitionMode:VirtualCamera.Transition.Time(0)}})
 MainCamera.createOrReplace(engine.CameraEntity,{virtualCameraEntity:cam})
 activeSeat=room.seat
}
function kart(id:string,color:number,userId=id,tireStyle=0,metalColor=3){let k=karts.get(id);if(!k){
 const entity=engine.addEntity(),model=engine.addEntity(),tire=engine.addEntity(),motorAudio=id===room.id?engine.addEntity():undefined,portrait=id!==room.id?engine.addEntity():undefined
 Transform.create(entity,{scale:v(.096,.096,.096)});Transform.create(model,{parent:entity,position:v(0,0,-.06)});Transform.create(tire,{parent:entity,position:v(0,0,-.06)});if(motorAudio){Transform.create(motorAudio,{parent:entity});AudioSource.create(motorAudio,{audioClipUrl:'assets/Audio/motorloop.mp3',playing:false,loop:true,volume:0,pitch:1,global:true})}
 if(portrait!==undefined){
 Transform.create(portrait,{parent:entity,position:v(0,1.75,0),scale:v(1.4,1.4,1.4)})
 MeshRenderer.setPlane(portrait);Billboard.create(portrait,{billboardMode:BillboardMode.BM_ALL})
 }
 k={entity,model,tire,motorAudio,portrait,visualKey:'',portraitUserId:'',portraitShown:true,lastSeen:0,displayS:0,displayLane:0,displayHeading:0,materialRefresh:0};karts.set(id,k)
 }
 const key=`${Math.floor(clamp(color,0,PALETTE.length-1))}:${Math.floor(clamp(metalColor,0,PALETTE.length-1))}:${Math.floor(clamp(tireStyle,0,2))}`
 if(k.visualKey!==key){GltfContainer.createOrReplace(k.model,{src:bodySrc(),visibleMeshesCollisionMask:0,invisibleMeshesCollisionMask:0});applyKartMaterials(k.model,color,metalColor);GltfContainer.createOrReplace(k.tire,{src:tireSrc(tireStyle),visibleMeshesCollisionMask:0,invisibleMeshesCollisionMask:0});k.visualKey=key;k.materialRefresh=10}
 if(k.portrait!==undefined&&k.portraitUserId!==userId){Material.setPbrMaterial(k.portrait,{texture:Material.Texture.Avatar({userId}),metallic:.05,roughness:.25,emissiveColor:{r:.15,g:.55,b:.65},emissiveIntensity:.22,castShadows:false});k.portraitUserId=userId}
 return k
}
function preloadKarts(){AssetLoad.createOrReplace(engine.RootEntity,{assets:['assets/Models/player-kart-body.glb','assets/Models/player-kart-speedtire.glb','assets/Models/player-kart-bigfoot.glb','assets/Models/player-kart-crosstire.glb','assets/Audio/motorloop.mp3','assets/Audio/racemusic.mp3','assets/Audio/firstnumbers.mp3','assets/Audio/go.mp3','assets/Models/racepad.glb']})}
function sceneBox(position:{x:number;y:number;z:number},scale:{x:number;y:number;z:number},color:string,rotation=Quaternion.Identity(),emissive=0){
 const e=engine.addEntity(),c=Color4.fromHexString(color);Transform.create(e,{position,scale,rotation});MeshRenderer.setBox(e);Material.setPbrMaterial(e,{albedoColor:c,castShadows:false,metallic:.12,roughness:.38,...(emissive?{emissiveColor:{r:c.r,g:c.g,b:c.b},emissiveIntensity:emissive}:{})});return e
}
function buildStartFinish(){
 const f=sample(RACE_START),q=orientation(f),lift=.155,base=add(f.p,mul(f.up,lift))
 const line=engine.addEntity()
 Transform.create(line,{position:base,rotation:Quaternion.multiply(q,Quaternion.fromEulerDegrees(0,90,0)),scale:v(1,1,1)})
 GltfContainer.createOrReplace(line,{src:'assets/Models/startline2.glb',visibleMeshesCollisionMask:0,invisibleMeshesCollisionMask:0})
 for(let i=0;i<5;i++){const e=engine.addEntity();Transform.create(e,{position:add(add(add(base,mul(f.right,(i-2)*.26)),mul(f.up,1.76)),mul(f.t,-.18)),rotation:q,scale:v(.13,.13,.13)});MeshRenderer.setPlane(e);gantryLights.push(e)}
}
function buildConfetti(){
 const spots=[{frame:sample(RACE_START),height:1.98,wide:ROAD_WIDTH/2+.36,count:36,speed:5.2},{frame:sample(RACE_START+10),height:1.43,wide:.8,count:44,speed:4.6}]
 for(const spot of spots)for(const side of [-1,1]){
  const e=engine.addEntity()
  Transform.create(e,{position:add(add(spot.frame.p,mul(spot.frame.right,side*spot.wide)),mul(spot.frame.up,spot.height)),rotation:Quaternion.multiply(orientation(spot.frame),Quaternion.fromEulerDegrees(-32,side*18,0))})
  ParticleSystem.create(e,{
   active:false,rate:0,maxParticles:80,lifetime:2,gravity:.48,initialSize:{start:.05,end:.1},sizeOverTime:{start:1,end:.12},
   initialVelocitySpeed:{start:2.4,end:spot.speed},blendMode:PBParticleSystem_BlendMode.PSB_ALPHA,billboard:false,simulationSpace:PBParticleSystem_SimulationSpace.PSS_WORLD,
   rotationOverTime:Quaternion.fromEulerDegrees(160,240,110),
   colorOverTime:{start:Color4.fromHexString(side>0?'#ff3c93ff':'#18e7f0ff'),end:Color4.fromHexString('#ffca5300')},
   bursts:{values:[{time:0,count:spot.count,cycles:1,interval:.01,probability:1}]},
   shape:ParticleSystem.Shape.Cone({angle:22,radius:.28}),
   playbackState:PBParticleSystem_PlaybackState.PS_STOPPED
  })
  confettiEmitters.push(e)
 }
}
function confettiBurst(){
 for(const e of confettiEmitters){
  const ps=ParticleSystem.getMutable(e)
  ps.playbackState=PBParticleSystem_PlaybackState.PS_STOPPED
  ps.active=true
  ps.playbackState=PBParticleSystem_PlaybackState.PS_PLAYING
 }
}
function stationBox(parent:Entity,position:{x:number;y:number;z:number},scale:{x:number;y:number;z:number},color:string,emissive=0){
 const e=engine.addEntity(),c=Color4.fromHexString(color);Transform.create(e,{parent,position,scale});MeshRenderer.setBox(e);Material.setPbrMaterial(e,{albedoColor:c,castShadows:false,metallic:.18,roughness:.28,...(emissive?{emissiveColor:{r:c.r,g:c.g,b:c.b},emissiveIntensity:emissive}:{})});return e
}
function stationText(parent:Entity,text:string,position:{x:number;y:number;z:number},size:number,color:Color4){
 const e=engine.addEntity();Transform.create(e,{parent,position,scale:v(size,size,size)});TextShape.create(e,{text,fontSize:14,textColor:color,outlineColor:Color4.fromHexString('#050a16'),outlineWidth:.16,textAlign:TextAlignMode.TAM_MIDDLE_CENTER});Billboard.create(e,{billboardMode:BillboardMode.BM_Y});return e
}
function buildJoinStations(){
 const stations=[v(29.5,.08,27),v(2.5,.08,27)]
 for(const position of stations)buildJoinStation(position)
}
function buildJoinStation(position:{x:number;y:number;z:number}){
 const root=engine.addEntity();Transform.create(root,{position})
 const pad=engine.addEntity();Transform.create(pad,{parent:root,position:v(0,.19,0),scale:v(.88,.88,.88)})
 GltfContainer.createOrReplace(pad,{src:'assets/Models/racepad.glb',visibleMeshesCollisionMask:0,invisibleMeshesCollisionMask:0})
 Animator.createOrReplace(pad,{states:[{clip:'Animation',playing:true,loop:true,speed:1,weight:1}]})
 const padCollider=engine.addEntity();Transform.create(padCollider,{position:add(position,v(0,.18,0)),scale:v(3.65,.32,3.25)});MeshCollider.setBox(padCollider,ColliderLayer.CL_PHYSICS)
 const clicker=engine.addEntity();Transform.create(clicker,{position:add(position,v(0,.38,0)),scale:v(3.75,.7,3.2)});MeshCollider.setBox(clicker,ColliderLayer.CL_POINTER)
 pointerEventsSystem.onPointerDown({entity:clicker,opts:{button:InputAction.IA_POINTER,hoverText:'Join race',maxDistance:12,showFeedback:true,showHighlight:true}},()=>enterRace())
}
function buildAvatarBounds(){
 const specs=[
  {position:v(-.38,2,16),scale:v(.76,4,34)},
  {position:v(32.38,2,16),scale:v(.76,4,34)},
  {position:v(16,2,-.38),scale:v(34,4,.76)},
  {position:v(16,2,32.38),scale:v(34,4,.76)}
 ]
 for(const spec of specs){const e=engine.addEntity();Transform.create(e,spec);avatarBounds.push(e)}
 setAvatarBounds(false)
}
function setAvatarBounds(active:boolean){
 if(avatarBoundsActive===active)return
 avatarBoundsActive=active
 for(const e of avatarBounds)active?MeshCollider.setBox(e,ColliderLayer.CL_PHYSICS):MeshCollider.deleteFrom(e)
}
function workshopButton(parent:Entity,label:string,position:{x:number;y:number;z:number},run:()=>void){
 const pad=engine.addEntity(),c=Color4.fromHexString('#8e929b')
 Transform.create(pad,{parent,position,scale:v(.92,.12,.92)})
 MeshRenderer.setCylinder(pad,.5,.5)
 MeshCollider.setCylinder(pad,.5,.5,ColliderLayer.CL_POINTER)
 Material.setPbrMaterial(pad,{albedoColor:c,metallic:.38,roughness:.34,emissiveColor:{r:.08,g:.09,b:.1},emissiveIntensity:.25,castShadows:false})
 stationText(parent,label,add(position,v(0,.22,0)),.045,Color4.fromHexString('#f8fbff'))
 pointerEventsSystem.onPointerDown({entity:pad,opts:{button:InputAction.IA_POINTER,hoverText:label,maxDistance:8,showFeedback:true,showHighlight:true}},run)
}
function buildWorkshop(){
 const root=engine.addEntity();Transform.create(root,{position:v(16,.02,16)})
 stationText(root,'RC WORKSHOP',v(0,1.22,-1.36),.075,Color4.fromHexString('#eafcff'))
 const paint=()=>{room.garage.color=(room.garage.color+1)%PALETTE.length;room.me.color=room.garage.color;room.message=`PAINT ${room.garage.color+1}`;saveGarage();updateWorkshopKart();room.broadcast();writeSyncedPeer(true)}
 workshopButton(root,'COLOR',v(-1.2,.18,1.62),paint)
 workshopButton(root,'TIRES',v(0,.18,1.62),()=>cycleTires())
 workshopButton(root,'METAL',v(1.2,.18,1.62),()=>cycleMetal())
}
function buyPart(part:'motor'|'tires'|'battery'){
 const price=cost(room.garage[part])
 if(purchase(room.garage,part)){room.message=`${part.toUpperCase()} UPGRADE  -${price} CREDITS`;saveGarage();room.broadcast()}
 else room.message=`NEED ${price} CREDITS`
}
function cycleTires(){room.garage.tireStyle=(room.garage.tireStyle+1)%3;room.me.tireStyle=room.garage.tireStyle;room.message=`TIRES ${tireNames[room.garage.tireStyle]}`;saveGarage();updateWorkshopKart();room.broadcast();writeSyncedPeer(true)}
function cycleMetal(){room.garage.metalColor=(room.garage.metalColor+1)%PALETTE.length;room.me.metalColor=room.garage.metalColor;room.message=`METAL ${room.garage.metalColor+1}`;saveGarage();updateWorkshopKart();room.broadcast();writeSyncedPeer(true)}
function updateWorkshopKart(){
 if(!workshopKart){workshopKart=engine.addEntity();workshopTire=engine.addEntity();Transform.create(workshopKart,{position:v(16,1.08,16),rotation:Quaternion.fromEulerDegrees(0,35,0),scale:v(2.94,2.94,2.94)});Transform.create(workshopTire,{parent:workshopKart})}
 const key=`${room.garage.color}:${room.garage.metalColor}:${room.garage.tireStyle}`
 if(workshopVisualKey!==key){GltfContainer.createOrReplace(workshopKart,{src:bodySrc(),visibleMeshesCollisionMask:0,invisibleMeshesCollisionMask:0});applyKartMaterials(workshopKart,room.garage.color,room.garage.metalColor);if(workshopTire)GltfContainer.createOrReplace(workshopTire,{src:tireSrc(room.garage.tireStyle),visibleMeshesCollisionMask:0,invisibleMeshesCollisionMask:0});workshopVisualKey=key;workshopMaterialRefresh=10}
}
function trackItemSrc(kind:TrackItem['kind']){return kind==='boost'?'assets/Models/boost.glb':kind==='oil'?'assets/Models/oilspill.glb':'assets/Models/stikyglue.glb'}
function buildTrackItems(){
 const kinds:TrackItem['kind'][]=['boost','boost','boost','boost','boost','boost','oil','oil','oil','glue','glue','glue']
 for(const kind of kinds){
  const entity=engine.addEntity();Transform.create(entity)
  GltfContainer.createOrReplace(entity,{src:trackItemSrc(kind),visibleMeshesCollisionMask:0,invisibleMeshesCollisionMask:0})
  trackItems.push({kind,s:0,lane:0,entity,rotation:Quaternion.Identity(),cooldown:0})
 }
}
function itemBox(parent:Entity,position:{x:number;y:number;z:number},scale:{x:number;y:number;z:number},color:string,emissive=0){const e=engine.addEntity(),c=Color4.fromHexString(color);Transform.create(e,{parent,position,scale});MeshRenderer.setBox(e);Material.setPbrMaterial(e,{albedoColor:c,castShadows:false,metallic:.1,roughness:.32,...(emissive?{emissiveColor:{r:c.r,g:c.g,b:c.b},emissiveIntensity:emissive}:{})});return e}
function seeded(seed:string){let state=2166136261;for(let i=0;i<seed.length;i++){state^=seed.charCodeAt(i);state=Math.imul(state,16777619)}return()=>{state+=0x6d2b79f5;let x=state;x=Math.imul(x^x>>>15,x|1);x^=x+Math.imul(x^x>>>7,x|61);return((x^x>>>14)>>>0)/4294967296}}
function randomizeTrackItems(seed:string){
 layoutKey=seed;const random=seeded(seed),spacing=(TRACK_LENGTH-24)/trackItems.length,slots=trackItems.map((_,i)=>12+(i+.5)*spacing+(random()-.5)*spacing*.45)
 for(let i=slots.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]]}
 trackItems.forEach((item,i)=>{item.s=slots[i];item.lane=(random()*1.5)-.75;item.cooldown=0;const f=sample(item.s);item.rotation=orientation(f);Transform.createOrReplace(item.entity,{position:add(add(f.p,mul(f.right,item.lane)),mul(f.up,.16)),rotation:item.kind==='boost'?Quaternion.multiply(item.rotation,Quaternion.fromEulerDegrees(0,90,0)):item.rotation,scale:v(1,1,1)})})
}
function updateTrackItems(){
 const now=Date.now(),d=room.driver,here=mod(d.s,TRACK_LENGTH)
 for(const item of trackItems){
  const distance=Math.abs(mod(here-item.s+TRACK_LENGTH/2,TRACK_LENGTH)-TRACK_LENGTH/2)
  if(now<item.cooldown||distance>.42||Math.abs(d.lane-item.lane)>.34)continue
  if(item.kind==='boost'){d.boost=Math.max(d.boost,1.2);d.speed=Math.min(TOP_SPEED*(1+gain(room.garage.motor))*1.28,d.speed*1.12+.45);room.message='TURBO PAD';item.cooldown=now+900}
  else if(item.kind==='oil'){const side=Math.sin(item.s*7)>0?1:-1;d.speed*=.62;d.lateral+=side*1.15;d.heading=clamp(d.heading+side*.22,-.9,.9);room.message='OIL SPILL';item.cooldown=now+1400}
  else{d.speed*=.42;d.throttle*=.25;d.lateral*=.35;room.message='STICKY GLUE';item.cooldown=now+1600}
 }
}
function updateGantryLights(){
 const now=Date.now(),count=room.round.phase==='countdown'?Math.min(5,Math.max(0,Math.floor((3500-(room.round.until-now))/650)+1)):0,go=room.round.phase==='race'&&now-room.round.started<1500
 const flash=go&&Math.floor((now-room.round.started)/110)%2===0
 const state=go?(flash?7:6):count;if(state===gantryState)return;gantryState=state
 for(let i=0;i<gantryLights.length;i++){
  const active=go||i<count,pulse=room.round.phase==='countdown'&&active?.65+.35*Math.sin(now*.014+i):1
  const c=Color4.fromHexString(go?(flash?'#eaffffff':'#54ff8bff'):active?'#ff314fff':'#2b2035ff')
  Material.setPbrMaterial(gantryLights[i],{texture:Material.Texture.Common({src:'assets/UI/button-disc.png'}),transparencyMode:MaterialTransparencyMode.MTM_ALPHA_TEST,alphaTest:.1,albedoColor:c,emissiveColor:{r:c.r,g:c.g,b:c.b},emissiveIntensity:active?5.5*pulse:.12,roughness:.25,castShadows:false})
 }
}
function update(dt:number){
 if(!room)return;
 setAvatarBounds(room.seated())
 readSyncedPeers();readSyncedRound();room.update();if(room.leader()===room.id)writeSyncedRound();const nextLayout=room.round.id||`practice-${room.id}`;if(nextLayout!==layoutKey)randomizeTrackItems(nextLayout);updateGantryLights();updateCeremony(dt)
 if(workshopKart){workshopSpin+=dt*28;Transform.getMutable(workshopKart).rotation=Quaternion.fromEulerDegrees(0,35+workshopSpin,0);if(workshopMaterialRefresh>0){workshopMaterialRefresh--;applyKartMaterials(workshopKart,room.garage.color,room.garage.metalColor)}}
 if(activeSeat!==room.seat){activeSeat=room.seat;if(activeSeat>=0){mobileButtons.gas=false;mobileButtons.reverse=false;reverseArmed=false;driveInputReadyAt=Date.now()+700;activateDrivingCamera()}else{MainCamera.createOrReplace(engine.CameraEntity,{virtualCameraEntity:undefined});sparks.forEach(e=>engine.removeEntity(e));sparks=[]}}
 if(activeSeat!==mobileSeat){mobileSeat=activeSeat;if(activeSeat>=0){TouchScreenControls.hideAll();TouchScreenControls.showJoystick();TouchScreenControls.hideCrosshair()}else{mobileButtons.gas=false;mobileButtons.reverse=false;TouchScreenControls.deleteFrom(engine.RootEntity)}}
 const pressed=(key:InputAction)=>inputSystem.isPressed(key)
 const steer=((pressed(InputAction.IA_RIGHT)?1:0)-(pressed(InputAction.IA_LEFT)?1:0))*preferences.steering
 const rawReverse=isMobile()?mobileButtons.reverse:pressed(InputAction.IA_BACKWARD)
  if(!rawReverse)reverseArmed=true
  const reverse=Date.now()>=driveInputReadyAt&&reverseArmed&&rawReverse
 const input={throttle:isMobile()?(mobileButtons.gas?1:0):(pressed(InputAction.IA_FORWARD)?1:0),brake:false,reverse,steer,drift:pressed(InputAction.IA_JUMP)}
 accumulator=Math.min(.15,accumulator+dt)
 while(accumulator>=1/60){
  if(room.seated()&&!room.isGrid()&&!room.spectating){
   const was=room.driver.boost
   if(room.driver.finished)runParade(1/60)
   else {step(room.driver,input,room.garage,1/60,room.isRacing()?room.round.laps:0);updateTrackItems()}
   if(room.driver.boost>was){const own=karts.get(room.id);if(own)AudioSource.createOrReplace(own.entity,{audioClipUrl:'assets/Audio/boost.wav',playing:true,volume:.35})}
   if(room.isRacing())for(const p of room.peers.values())if(p.id!==room.id&&p.seat>=0&&room.round.roster.includes(p.id)&&!p.finished)bump(room.driver,p,1/60)
  }
  accumulator-=1/60
 }
 writeSyncedPeer()
 const localPose=room.seated()?displayPoseForLocal():undefined
 for(const p of room.peers.values()){
  if(p.seat<0)continue
 const local=p.id===room.id,d=local?room.driver:p,k=kart(p.id,p.color,p.userId||p.id,p.tireStyle,p.metalColor)
  // Remote motion arrives at network tick rate; do not resend unchanged transforms.
  if(local||k.lastSeen!==p.seen){
   if(local){const f=localPose!,t=Transform.getMutable(k.entity),heading=room.driver.finished?cinemaHeading():d.heading;t.position=f.p;t.rotation=orientation(f,heading);k.displayS=d.s;k.displayLane=d.lane;k.displayHeading=heading}
   else if(!k.lastSeen){k.displayS=d.s;k.displayLane=d.lane;k.displayHeading=d.heading}
   k.lastSeen=p.seen
   const body=Transform.getMutable(k.model),tire=Transform.getMutable(k.tire),ratio=clamp(Math.abs(d.speed)/TOP_SPEED,0,1)
   const pitch=local?room.driver.braking*3-room.driver.throttle*(1-ratio)*2:0
   const lean=local?-room.driver.steer*ratio*4:-(p.driftAngle||0)*12
   body.rotation=Quaternion.fromEulerDegrees(pitch,(d.driftAngle||0)*180/Math.PI,lean);tire.rotation=body.rotation
   if(k.materialRefresh>0){k.materialRefresh--;applyKartMaterials(k.model,p.color,p.metalColor)}
   if(local&&k.motorAudio){const kmh=Math.abs(room.driver.speed)*12,audioPitch=clamp(1+(kmh-20)/50,.65,2.15),audioVolume=clamp(.28+(room.driver.throttle+(room.driver.speed<0?.35:0))*.38+kmh/140,.18,1);AudioSource.createOrReplace(k.motorAudio,{audioClipUrl:'assets/Audio/motorloop.mp3',playing:room.seated(),loop:true,volume:room.seated()?audioVolume:0,pitch:audioPitch,global:true})}
  }
  if(!local){
   const sDelta=mod(d.s-k.displayS+TRACK_LENGTH/2,TRACK_LENGTH)-TRACK_LENGTH/2
   const blend=1-Math.exp(-dt*14)
   k.displayS+=sDelta*blend
   k.displayLane+=(d.lane-k.displayLane)*blend
   k.displayHeading+=(d.heading-k.displayHeading)*blend
   const f=pose(k.displayS,k.displayLane),t=Transform.getMutable(k.entity)
   t.position=f.p;t.rotation=orientation(f,k.displayHeading)
  }
  const position=Transform.get(k.entity).position
  const dx=(localPose?.p.x??position.x)-position.x,dy=(localPose?.p.y??position.y)-position.y,dz=(localPose?.p.z??position.z)-position.z
  const showPortrait=p.id!==room.id&&(!room.seated()||dx*dx+dy*dy+dz*dz<196)
  if(k.portrait!==undefined&&k.portraitShown!==showPortrait){VisibilityComponent.createOrReplace(k.portrait,{visible:showPortrait});k.portraitShown=showPortrait}
 }
 for(const[id,k]of karts)if(id!==room.id&&(!room.peers.has(id)||room.peers.get(id)!.seat<0)){if(k.portrait!==undefined)engine.removeEntity(k.portrait);if(k.motorAudio!==undefined)engine.removeEntity(k.motorAudio);engine.removeEntity(k.tire);engine.removeEntity(k.model);engine.removeEntity(k.entity);karts.delete(id)}
 if(!room.seated())return
 if(room.round.phase==='intro'){updateIntroCamera();return}
 const target=room.spectating?[...room.peers.values()].filter(p=>room.round.roster.includes(p.id)&&p.seat>=0).sort((a,b)=>b.s-a.s)[0]:undefined
 const d=target??room.driver,f=target?pose(d.s,d.lane):localPose!,t=Transform.getMutable(cam),shake=preferences.shake?clamp((d.speed/TOP_SPEED-.8)/.48,0,1):0,phase=room.driver.elapsed*52
 const parade=room.driver.finished&&!target
 cameraHeading+=((parade?cinemaHeading():d.heading*.7)-cameraHeading)*(1-Math.exp(-dt*(parade?6:16)))
 cameraSpeed+=(clamp((parade?TOP_SPEED*.55:d.speed)/TOP_SPEED,0,1.28)-cameraSpeed)*(1-Math.exp(-dt*5))
 const cameraForward=add(mul(f.t,Math.cos(cameraHeading)),mul(f.right,Math.sin(cameraHeading)))
 const shakeX=(Math.sin(phase*1.7)+Math.sin(phase*.63)*.35)*.00069*shake,shakeY=Math.sin(phase*2.27)*.00051*shake
 if(parade){
  const cut=Math.floor(cinemaPhase/1.65)%3,p=(cinemaPhase%1.65)/1.65,orbit=Math.sin(p*Math.PI*2),sweep=Math.cos(p*Math.PI*2)
  if(cut===0){
   t.position=add(add(add(f.p,mul(cameraForward,-.56-.08*sweep)),mul(f.right,orbit*.54)),mul(f.up,.34+.06*Math.sin(p*Math.PI)))
   t.rotation=Quaternion.multiply(orientation(f,cameraHeading+.18*orbit),Quaternion.fromEulerDegrees(11,0,-9*orbit))
  }else if(cut===1){
   t.position=add(add(add(f.p,mul(cameraForward,-.34+.12*sweep)),mul(f.right,.62-.25*p)),mul(f.up,.24+.08*sweep))
   t.rotation=Quaternion.multiply(orientation(f,cameraHeading-.28+.12*p),Quaternion.fromEulerDegrees(8+4*p,0,10-12*p))
  }else{
   t.position=add(add(add(f.p,mul(cameraForward,-.88-.12*sweep)),mul(f.right,orbit*.78)),mul(f.up,.62+.1*Math.sin(p*Math.PI)))
   t.rotation=Quaternion.multiply(orientation(f,cameraHeading+.1*orbit),Quaternion.fromEulerDegrees(22+5*Math.sin(p*Math.PI),0,6*orbit))
  }
 }else{
  t.position=add(add(add(add(f.p,mul(cameraForward,-.43-.03*cameraSpeed)),mul(f.up,.18)),mul(f.right,shakeX*.32-(d.driftAngle||0)*.007)),mul(f.up,shakeY*.32))
  t.rotation=Quaternion.multiply(orientation(f,cameraHeading),Quaternion.fromEulerDegrees(13+Math.sin(phase*1.31)*.06*shake,Math.sin(phase*.91)*.08*shake,Math.sin(phase*1.83)*.12*shake))
 }
 const own=karts.get(room.id)
 if(own&&sparks.length===0){sparkTier=-1;for(const x of [-.29,.29]){const e=engine.addEntity();Transform.create(e,{parent:own.entity,position:v(x,.04,-.25),scale:v(.04,.04,.04)});MeshRenderer.setBox(e);sparks.push(e)}}
 if(sparkTier===room.driver.tier)return;sparkTier=room.driver.tier
 for(const e of sparks){const tier=room.driver.tier,scale=tier?.07+tier*.025:0;Transform.getMutable(e).scale=v(scale,scale,scale*2);Material.setPbrMaterial(e,{albedoColor:Color4.fromHexString(tier===3?'#ef3ba8':tier===2?'#f7c843':'#1bded5'),emissiveColor:{r:tier===1?0:1,g:tier===3?0:1,b:tier===2?0:1},emissiveIntensity:3,castShadows:false})}
}
function updateCeremony(dt:number){
 const r=room.round,now=Date.now(),musicOn=!!r.id&&(r.phase==='intro'||r.phase==='countdown'||r.phase==='race')
 if(musicAudio)AudioSource.createOrReplace(musicAudio,{audioClipUrl:'assets/Audio/racemusic.mp3',playing:musicOn,loop:true,volume:musicOn?.42:0,global:true})
 if(r.phase==='intro'&&r.id&&lastCeremonyRound!==r.id){lastCeremonyRound=r.id;lastFinishBurst='';lastFinalLapBurst='';lastCountdownCue=-1;musicRound=r.id;paradeS=RACE_START;cinemaPhase=0;room.message='TRACK INTRO'}
 if(r.phase==='countdown'&&r.id){room.message='KARTS TO THE GRID';const n=Math.max(1,Math.ceil((r.until-now)/1000));if(n!==lastCountdownCue){lastCountdownCue=n;if(cueAudio)AudioSource.createOrReplace(cueAudio,{audioClipUrl:'assets/Audio/firstnumbers.mp3',playing:true,loop:false,volume:1,global:true,currentTime:0})}}
 if(r.phase==='race'&&r.id&&now-r.started<250&&lastFinishBurst!==`${r.id}:start`){lastFinishBurst=`${r.id}:start`;lastCountdownCue=-1;confettiBurst();room.message='GO!';if(cueAudio)AudioSource.createOrReplace(cueAudio,{audioClipUrl:'assets/Audio/go.mp3',playing:true,loop:false,volume:2,global:true,currentTime:0})}
 if(r.phase==='race'&&r.id&&r.finished.length<3&&room.driver.lap>=r.laps-1&&!room.driver.finished&&lastFinalLapBurst!==r.id){lastFinalLapBurst=r.id;confettiBurst();room.message='FINAL LAP'}
 if(room.driver.finished&&r.id&&lastFinishBurst!==`${r.id}:finish`){lastFinishBurst=`${r.id}:finish`;confettiBurst();room.message=room.result||'FINISH!'}
 if(r.phase==='race'&&!room.driver.finished)paradeS=room.driver.s
 if((r.phase==='results'||room.driver.finished)&&r.id){paradeS=mod(paradeS+dt*2.4,TRACK_LENGTH)}
}
function gridFrame(row:number){return pose(RACE_START-.8-Math.floor(row/4)*.75,(row%4-1.5)*.5)}
function updateIntroCamera(){
 const elapsed=clamp(INTRO_MS-(room.round.until-Date.now()),0,INTRO_MS)/1000
 const cut=elapsed<1.35?0:elapsed<2.7?1:elapsed<4.25?2:3
 const progress=cut===0?elapsed/1.35:cut===1?(elapsed-1.35)/1.35:cut===2?(elapsed-2.7)/1.55:(elapsed-4.25)/1.75
 const t=Transform.getMutable(cam)
 if(cut===0){
  const row=Math.max(0,room.round.roster.indexOf(room.id)),f=gridFrame(row),angle=-.8+progress*1.65,side=mul(f.right,Math.sin(angle)*.62),back=mul(f.t,-.54+.1*Math.cos(angle))
  t.position=add(add(add(f.p,back),side),mul(f.up,.38+.08*Math.sin(progress*Math.PI)))
  t.rotation=Quaternion.multiply(orientation(f,.22*Math.sin(angle)),Quaternion.fromEulerDegrees(10,0,-7+14*progress))
 }else if(cut===1){
  const own=Math.max(0,room.round.roster.indexOf(room.id)),other=room.round.roster.length>1?(own+1)%room.round.roster.length:own,f=gridFrame(other),angle=1.15-progress*1.9
  t.position=add(add(add(f.p,mul(f.t,-.48+.08*Math.sin(progress*Math.PI))),mul(f.right,Math.sin(angle)*.68)),mul(f.up,.44+.05*Math.cos(progress*Math.PI*2)))
  t.rotation=Quaternion.multiply(orientation(f,-.28*Math.sin(angle)),Quaternion.fromEulerDegrees(11,0,8-16*progress))
 }else if(cut===2){
  const f=sample(RACE_START+30+progress*20)
  t.position=add(add(add(f.p,mul(f.t,-1.9+Math.sin(progress*Math.PI)*.28)),mul(f.right,.65-1.3*progress)),mul(f.up,1.02))
  t.rotation=Quaternion.multiply(orientation(f,-.08+.16*progress),Quaternion.fromEulerDegrees(16,0,-4+8*progress))
 }else{
  const row=Math.max(0,room.round.roster.indexOf(room.id)),f=gridFrame(row)
  t.position=add(add(add(f.p,mul(f.t,-1.15+progress*.42)),mul(f.right,(row%4-1.5)*.11)),mul(f.up,.58+.08*Math.sin(progress*Math.PI)))
  t.rotation=Quaternion.multiply(orientation(f,.015*Math.sin(progress*Math.PI*2)),Quaternion.fromEulerDegrees(14-5*progress,0,0))
 }
 VirtualCamera.createOrReplace(cam,{defaultTransition:{transitionMode:VirtualCamera.Transition.Time(.12)}})
 MainCamera.createOrReplace(engine.CameraEntity,{virtualCameraEntity:cam})
}
function runParade(dt:number){
 paradeS+=TOP_SPEED*.48*dt
 room.driver.s=paradeS
 room.driver.lane=Math.sin(cinemaPhase*.75)*.42
 room.driver.heading=Math.sin(cinemaPhase*.65)*.22
 room.driver.speed=TOP_SPEED*.48
}
function displayPoseForLocal(){return room.driver.finished?pose(paradeS,room.driver.lane):pose(room.driver.s,room.driver.lane)}
function cinemaHeading(){return room.driver.heading+Math.sin(cinemaPhase*.58)*.42}























