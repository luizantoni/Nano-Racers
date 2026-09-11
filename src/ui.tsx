import ReactEcs,{ReactEcsRenderer,UiEntity,Label} from '@dcl/sdk/react-ecs'
import {engine,UiCanvasInformation} from '@dcl/sdk/ecs'
import {isMobile} from '@dcl/sdk/platform'
import {Color4} from '@dcl/sdk/math'
import {room,leaveRace} from './index'
import {clamp,mod,TRACK_LENGTH,TOP_SPEED_KMH,PALETTE} from './core'
import {measureHud} from './hud-layout'
import {art,Art} from './ui-art'

let lastMessage='',messageUntil=0
let nextStandingsUpdate=0,place=1,ready=0
export const preferences={steering:1,shake:true}
export const mobileButtons={gas:false,reverse:false}
const c={ink:Color4.fromHexString('#080f1ef0'),card:Color4.fromHexString('#111f32f2'),line:Color4.fromHexString('#314860'),muted:Color4.fromHexString('#91a6ba'),white:Color4.fromHexString('#f3f6ff'),mint:Color4.fromHexString('#65dcf5'),gold:Color4.fromHexString('#ffac65'),pink:Color4.fromHexString('#ff6654')}
let u=1
function label(value:string,size=22,color=c.white,height=32){return <Label value={value} fontSize={size*u} color={color} uiTransform={{width:'100%',height:height*u,pointerFilter:'none',flexShrink:0}}/>}
const disc={src:'assets/UI/button-disc.png',filterMode:'bi-linear' as const,wrapMode:'clamp' as const}
function miniAction(value:string,run:()=>void,color=c.white){return <UiEntity uiTransform={{height:36*u,width:128*u,alignItems:'center',justifyContent:'center',margin:{top:2*u}}} onMouseDown={run}>{art('panel',color)}<Label value={value} fontSize={13*u} color={color} uiTransform={{width:'86%',height:'78%',pointerFilter:'none'}}/></UiEntity>}
function acelButton(size:number){const held=mobileButtons.gas;return <UiEntity uiTransform={{width:size,height:size*.62,alignItems:'center',justifyContent:'center'}} onMouseDown={()=>{mobileButtons.gas=true}} onMouseUp={()=>{mobileButtons.gas=false}} onMouseLeave={()=>{mobileButtons.gas=false}}>{art('panel',held?c.gold:c.mint)}<Label value={'ACEL'} fontSize={18*u} color={held?c.gold:c.mint} uiTransform={{width:'90%',height:'82%',pointerFilter:'none'}}/></UiEntity>}
function reverseButton(size:number){return <UiEntity uiTransform={{width:size,height:size*.44,alignItems:'center',justifyContent:'center',margin:{top:8*u}}} onMouseDown={()=>{mobileButtons.reverse=true}} onMouseUp={()=>{mobileButtons.reverse=false}} onMouseLeave={()=>{mobileButtons.reverse=false}}>{art('panel',mobileButtons.reverse?c.gold:c.mint)}<Label value={'REV'} fontSize={13*u} color={mobileButtons.reverse?c.gold:c.mint} uiTransform={{width:'90%',height:'80%',pointerFilter:'none'}}/></UiEntity>}
function minimapDot(p:any,left:number,top:number,size:number,isMe:boolean){return <UiEntity key={p.id} uiTransform={{positionType:'absolute',position:{left,top},width:size,height:size,alignItems:'center',justifyContent:'center',pointerFilter:'none'}} uiBackground={{texture:disc,textureMode:'stretch',color:Color4.fromHexString('#050914dd')}}><UiEntity uiTransform={{width:isMe?'86%':'76%',height:isMe?'86%':'76%',pointerFilter:'none'}} uiBackground={{avatarTexture:{userId:p.userId||p.id,filterMode:'bi-linear',wrapMode:'clamp'},textureMode:'stretch',color:Color4.fromHexString(PALETTE[clamp(Math.floor(p.color||0),0,PALETTE.length-1)])}}/></UiEntity>}
function minimap(){const racers=[...room.peers.values()].filter(p=>p.seat>=0),size=150*u,cx=size*.5,cy=size*.5,rx=size*.36,ry=size*.28;return <UiEntity uiTransform={{positionType:'absolute',position:{top:'5%',right:'4%'},width:size,height:size,alignItems:'center',justifyContent:'center',pointerFilter:'none'}}>{art('panel',Color4.fromHexString('#65dcf588'))}<UiEntity uiTransform={{positionType:'absolute',position:{left:size*.14,top:size*.2},width:size*.72,height:size*.56,pointerFilter:'none'}} uiBackground={{texture:disc,textureMode:'stretch',color:Color4.fromHexString('#081120cc')}}/>{racers.map(p=>{const s=p.id===room.id?room.driver.s:p.s,a=mod(s,TRACK_LENGTH)/TRACK_LENGTH*Math.PI*2-Math.PI/2,dot=22*u,left=cx+Math.cos(a)*rx-dot/2,top=cy+Math.sin(a)*ry-dot/2;return minimapDot(p,left,top,dot,p.id===room.id)})}<UiEntity uiTransform={{positionType:'absolute',position:{left:size*.5-1*u,top:size*.14},width:2*u,height:size*.72,pointerFilter:'none'}} uiBackground={{color:c.line}}/><Label value={'TRACK'} fontSize={9*u} color={c.muted} uiTransform={{positionType:'absolute',position:{left:0,top:size*.04},width:'100%',height:14*u,pointerFilter:'none'}}/></UiEntity>} 
function ui(){
 if(!room)return null
 const canvas=UiCanvasInformation.getOrNull(engine.RootEntity),mobile=isMobile(),w=canvas?.width||1920,h=canvas?.height||1080
 const layout=measureHud(w,h,mobile);u=layout.unit
 const r=room.round,d=room.driver,now=Date.now(),racing=room.isRacing(),seconds=Math.max(0,Math.ceil((r.until-now)/1000))
 if(lastMessage!==room.message){lastMessage=room.message;messageUntil=now+2600}
 if(now>=nextStandingsUpdate){
  nextStandingsUpdate=now+100
  const racers=[...room.peers.values()].filter(p=>r.roster.includes(p.id)).sort((a,b)=>{const ai=r.finished.indexOf(a.id),bi=r.finished.indexOf(b.id);if(ai>=0||bi>=0)return ai<0?1:bi<0?-1:ai-bi;return (b.id===room.id?d.s:b.s)-(a.id===room.id?d.s:a.s)})
  place=Math.max(1,racers.findIndex(p=>p.id===room.id)+1);ready=room.readyCount()
 }
 const controlH=layout.controlHeight
 const finishPlace=/FINISHED #(\d+)/.exec(room.result)?.[1]
 return <UiEntity uiTransform={{width:'100%',height:'100%',positionType:'absolute',pointerFilter:'none'}}>
  {room.seated()?minimap():null}
  <UiEntity uiTransform={{positionType:'absolute',position:{top:'7%',left:'8%'},width:'84%',alignItems:'center',flexDirection:'column',pointerFilter:'none'}}>
   <UiEntity uiTransform={{width:344*u,maxWidth:'100%',height:88*u,flexDirection:'row',alignItems:'center',justifyContent:'center',pointerFilter:'none'}}>
    <UiEntity uiTransform={{width:136*u,height:64*u,margin:{right:10*u},alignItems:'center',justifyContent:'center',flexDirection:'column',pointerFilter:'none'}}>
     {art('panel')}
     {label(racing?`POS  ${place}/${r.roster.length}`:room.spectating?'WATCHING':'PRACTICE',15,c.mint,21)}
     {label(racing?`LAP  ${Math.min(d.lap+1,r.laps)}/${r.laps}`:r.phase==='intro'?'TRACK INTRO':room.isGrid()?`START  ${seconds}s`:'5 LAPS',13,c.gold,19)}
     <UiEntity uiTransform={{width:'74%',height:2*u,pointerFilter:'none'}} uiBackground={{color:c.line}}><UiEntity uiTransform={{width:`${mod(d.s,TRACK_LENGTH)/TRACK_LENGTH*100}%`,height:'100%',pointerFilter:'none'}} uiBackground={{color:c.mint}}/></UiEntity>
    </UiEntity>
    <UiEntity uiTransform={{width:112*u,height:88*u,flexShrink:0,alignItems:'center',justifyContent:'center',flexDirection:'column',pointerFilter:'none'}}>
     {art('dial')}
     {label(String(Math.round(Math.abs(d.speed)*12)),22,d.boost>0?c.gold:c.mint,26)}
     {label('KM/H',8,c.white,11)}
     <UiEntity uiTransform={{positionType:'absolute',position:{left:`${48+28*Math.sin((-140+280*clamp(Math.abs(d.speed)*12/TOP_SPEED_KMH,0,1))*Math.PI/180)}%`,top:`${48-37*Math.cos((-140+280*clamp(Math.abs(d.speed)*12/TOP_SPEED_KMH,0,1))*Math.PI/180)}%`},width:4*u,height:4*u,pointerFilter:'none'}} uiBackground={{texture:disc,textureMode:'stretch',color:d.boost>0?c.gold:c.mint}}/>
     {d.boost>0||d.drifting?<UiEntity uiTransform={{positionType:'absolute',position:{top:'103%'},width:100*u,pointerFilter:'none'}}>{label(d.boost>0?'BOOST':d.tier?`TURBO ${d.tier}/3`:'DRIFT',10,d.tier===3?c.pink:d.tier===2?c.gold:c.mint,14)}<UiEntity uiTransform={{width:'90%',height:3*u,pointerFilter:'none'}} uiBackground={{color:c.line}}><UiEntity uiTransform={{width:`${100*clamp(d.boost>0?d.boost/1.31:d.charge/2.6,0,1)}%`,height:'100%',pointerFilter:'none'}} uiBackground={{color:d.tier===3?c.pink:d.tier===2?c.gold:c.mint}}/></UiEntity></UiEntity>:null}
    </UiEntity>
   </UiEntity>
   {room.seated()?<UiEntity uiTransform={{flexDirection:'row',alignItems:'center',pointerFilter:'none'}}>
    {r.phase==='lobby'||r.phase==='results'?<UiEntity uiTransform={{height:44*u,width:180*u,margin:{right:8*u},alignItems:'center',justifyContent:'center'}} onMouseDown={()=>room.ready()}>{art('panel',room.me.ready?c.gold:c.mint)}<Label value={room.me.ready?'READY / CANCEL':r.phase==='results'?'READY AGAIN':'READY TO RACE'} fontSize={13*u} color={room.me.ready?c.gold:c.mint} uiTransform={{width:'92%',height:'90%',pointerFilter:'none'}}/></UiEntity>:null}
    {r.phase==='lobby'||r.phase==='results'?<UiEntity uiTransform={{height:44*u,width:142*u,margin:{right:8*u},alignItems:'center',justifyContent:'center'}} onMouseDown={()=>room.solo()}>{art('panel',c.gold)}<Label value={'SOLO RACE'} fontSize={13*u} color={c.gold} uiTransform={{width:'92%',height:'90%',pointerFilter:'none'}}/></UiEntity>:null}
    {miniAction('LEAVE',leaveRace,c.pink)}
   </UiEntity>:null}
   {room.seated()&&r.phase==='lobby'&&ready>0?label(`${ready} READY / 2 TO START`,11,c.gold,18):null}
  </UiEntity>
  {room.isGrid()||r.phase==='race'&&now-r.started<1100?<UiEntity uiTransform={{positionType:'absolute',position:{top:'29%',left:'20%'},width:'60%',pointerFilter:'none'}}>{label(r.phase==='intro'?'READY':room.isGrid()?String(Math.max(1,Math.ceil((r.until-now)/1000))):'GO!',r.phase==='intro'?72:160,room.isGrid()?c.gold:c.mint,185)}{label(r.phase==='intro'?'GRID CINEMATIC':room.isGrid()?'HOLD YOUR LINE':'FULL THROTTLE',24,c.white,26)}</UiEntity>:null}
  {room.seated()&&!room.spectating?<UiEntity uiTransform={{positionType:'absolute',position:{bottom:'8%',left:'8%'},width:'84%',alignItems:'center',flexDirection:'column',pointerFilter:'none'}}>
   <UiEntity uiTransform={{width:'100%',maxWidth:1400*u,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-between',pointerFilter:'none'}}>
    <UiEntity uiTransform={{width:'42%',height:controlH,pointerFilter:'none'}}/>
    <UiEntity uiTransform={{width:'40%',flexDirection:'column',alignItems:'flex-end',pointerFilter:'none'}}>
     <UiEntity uiTransform={{flexDirection:'row',pointerFilter:'none'}}>{mobile?acelButton(controlH*1.55):null}</UiEntity>{mobile?reverseButton(controlH*.94):null}
    </UiEntity>
   </UiEntity>
  </UiEntity>:null}
  {now<messageUntil&&room.message!==''?<UiEntity uiTransform={{positionType:'absolute',position:{top:'19%',left:'24%'},width:'52%',pointerFilter:'none'}}>{label(room.message,13,c.gold,30)}</UiEntity>:null}
  {room.seated()&&finishPlace?<UiEntity uiTransform={{positionType:'absolute',position:{top:'31%',left:'30%'},width:'40%',height:190*u,alignItems:'center',justifyContent:'center',flexDirection:'column',pointerFilter:'none'}}>
   {art('panel',c.gold)}
   {label(`#${finishPlace}`,104,finishPlace==='1'?c.gold:c.mint,118)}
   {label(finishPlace==='1'?'WINNER':'FINISH POSITION',18,c.white,30)}
  </UiEntity>:null}
  {room.seated()&&r.phase==='results'?<UiEntity uiTransform={{positionType:'absolute',position:{top:'29%',left:'24%'},width:'52%',pointerFilter:'none'}}>{label(room.result||'RACE COMPLETE',20,c.gold,38)}</UiEntity>:null}
 </UiEntity>
}
export function setupUi(){ReactEcsRenderer.setUiRenderer(ui,{virtualWidth:1920,virtualHeight:1080,screenInset:'device'})}


