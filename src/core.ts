// Shared, renderer-independent driving and race rules. Units: metres / seconds.
export type V = { x: number; y: number; z: number }
export const v = (x = 0, y = 0, z = 0): V => ({ x, y, z })
export const add = (a: V, b: V) => v(a.x+b.x,a.y+b.y,a.z+b.z)
export const sub = (a: V, b: V) => v(a.x-b.x,a.y-b.y,a.z-b.z)
export const mul = (a: V, s: number) => v(a.x*s,a.y*s,a.z*s)
export const dot = (a: V, b: V) => a.x*b.x+a.y*b.y+a.z*b.z
export const cross = (a: V, b: V) => v(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x)
export const length = (a: V) => Math.sqrt(dot(a,a))
export const unit = (a: V) => mul(a,1/(length(a)||1))
export const lerp = (a: V,b: V,t: number) => add(a,mul(sub(b,a),t))
export const clamp = (x:number,a:number,b:number) => Math.max(a,Math.min(b,x))
export const mod = (x:number,m:number) => ((x%m)+m)%m
export const rotate = (a:V, axis:V, angle:number) => add(add(mul(a,Math.cos(angle)),mul(cross(axis,a),Math.sin(angle))),mul(axis,dot(axis,a)*(1-Math.cos(angle))))
export type Frame = { p:V; t:V; up:V; right:V; s:number }
const points: V[] = []
// Large circular vertical loop. Its 3.4m axial rise keeps the entry and exit road decks separated.
for(let i=0;i<=128;i++) {
 const t=i/128,a=t*Math.PI*2,r=4.25
 points.push(v(10+r*Math.sin(a),2.4+r*(1-Math.cos(a)),5.2+3.4*t))
}
// Smooth authored spline continues into an outer climb, upper hairpin and inner descent.
const controls = [
 v(7,2.4,8.4),v(10,2.4,8.6),v(16,2.5,9.2),v(24,2.8,8),v(27,3.6,12),v(27,4.7,22),
 v(23,5.9,27),v(12,7.1,27),v(6,8.3,23),v(4.8,9,19),v(4.8,9.7,15.5),v(6.5,10.4,13.5),
 v(10,11.2,12.8),v(16,12.1,13),v(21,12.7,13.5),v(23.5,13,15),v(24.5,13.1,17.5),v(23.5,13.1,20),
 v(19,12.8,23),v(13,11.7,22),v(11.5,10.8,20),v(11.5,9.8,17.5),v(13,9.1,15.5),
 v(16,8.3,15),v(18,7.6,15.5),v(20,7,17.5),v(20.5,6.4,20.5),
 v(17,5.2,24),v(10,4.1,23),v(7,3.2,17),v(3.5,2.7,13),v(2.5,2.4,9),v(3,2.4,6.5),
 v(5,2.4,5),v(7.3,2.4,4.86),v(10,2.4,5.2),v(13,2.4,5.58)
]
function catmull(a:V,b:V,c:V,d:V,t:number):V {
  const knot=(p:V,q:V,n:number)=>n+Math.sqrt(Math.max(1e-6,length(sub(q,p))))
  const t0=0,t1=knot(a,b,t0),t2=knot(b,c,t1),t3=knot(c,d,t2),u=t1+(t2-t1)*t
  const blend=(p:V,q:V,pa:number,pb:number)=>lerp(p,q,(u-pa)/(pb-pa))
  const a1=blend(a,b,t0,t1),a2=blend(b,c,t1,t2),a3=blend(c,d,t2,t3)
  const b1=lerp(a1,a2,(u-t0)/(t2-t0)),b2=lerp(a2,a3,(u-t1)/(t3-t1))
  return lerp(b1,b2,(u-t1)/(t2-t1))
}
for(let j=1;j<controls.length-2;j++) for(let i=1;i<=32;i++) points.push(catmull(controls[j-1],controls[j],controls[j+1],controls[j+2],i/32))
points.pop() // closing point is supplied by the periodic path
export const frames: Frame[]=[]
let distance=0, previousUp=v(0,1,0), previousT=unit(sub(points[1],points[0]))
for(let i=0;i<points.length;i++) {
 const t=unit(sub(points[(i+1)%points.length],points[mod(i-1,points.length)]))
 const axis=cross(previousT,t), sine=length(axis)
 if(sine>1e-8) previousUp=rotate(previousUp,unit(axis),Math.atan2(sine,dot(previousT,t)))
 const right=unit(cross(previousUp,t)), up=unit(cross(t,right))
 if(i) distance+=length(sub(points[i],points[i-1]))
 frames.push({p:points[i],t,up,right,s:distance}); previousT=t; previousUp=up
}
export const TRACK_LENGTH=distance+length(sub(points[0],points[points.length-1]))
// Explicit loop frame rotates upside down; normal road keeps a level cross-section.
for(let i=0;i<frames.length;i++) { const f=frames[i];f.right=i<=128?v(0,0,-1):unit(cross(v(0,1,0),f.t));f.up=unit(cross(f.t,f.right));f.right=unit(cross(f.up,f.t)) }
export const ROAD_WIDTH=2.5
export const RACE_START=20
export const TOP_SPEED_KMH=49
export const TOP_SPEED=TOP_SPEED_KMH/12
export function sample(s:number):Frame {
 const driveS=mod(s,TRACK_LENGTH),reverseS=mod(TRACK_LENGTH-driveS,TRACK_LENGTH);let lo=0,hi=frames.length-1
 while(lo<hi){const m=Math.ceil((lo+hi)/2);if(frames[m].s<=reverseS)lo=m;else hi=m-1}
 const a=frames[lo],b=frames[(lo+1)%frames.length],f=(reverseS-a.s)/((b.s||TRACK_LENGTH)-a.s)
 const forwardT=unit(lerp(a.t,b.t,f)),up=unit(lerp(a.up,b.up,f)),forwardRight=unit(cross(up,forwardT))
 return {p:lerp(a.p,b.p,f),t:mul(forwardT,-1),up:unit(cross(forwardT,forwardRight)),right:mul(forwardRight,-1),s:driveS}
}
export function pose(s:number,lane:number=0) { const f=sample(s); return {...f,p:add(add(f.p,mul(f.right,lane)),mul(f.up,.16))} }
export function orientation(f:Frame,heading=0){
 const forward=add(mul(f.t,Math.cos(heading)),mul(f.right,Math.sin(heading))),right=unit(cross(f.up,forward)),up=unit(cross(forward,right))
 const m00=right.x,m01=up.x,m02=forward.x,m10=right.y,m11=up.y,m12=forward.y,m20=right.z,m21=up.z,m22=forward.z,tr=m00+m11+m22
 let x=0,y=0,z=0,w=1
 if(tr>0){const s=Math.sqrt(tr+1)*2;w=.25*s;x=(m21-m12)/s;y=(m02-m20)/s;z=(m10-m01)/s}
 else if(m00>m11&&m00>m22){const s=Math.sqrt(1+m00-m11-m22)*2;w=(m21-m12)/s;x=.25*s;y=(m01+m10)/s;z=(m02+m20)/s}
 else if(m11>m22){const s=Math.sqrt(1+m11-m00-m22)*2;w=(m02-m20)/s;x=(m01+m10)/s;y=.25*s;z=(m12+m21)/s}
 else{const s=Math.sqrt(1+m22-m00-m11)*2;w=(m10-m01)/s;x=(m02+m20)/s;y=(m12+m21)/s;z=.25*s}
 return {x,y,z,w}
}
export type Part='motor'|'tires'|'battery'
export type Garage={credits:number; motor:number; tires:number; battery:number; color:number; metalColor:number; tireStyle:number; races:number}
export const freshGarage=():Garage=>({credits:0,motor:0,tires:0,battery:0,color:0,metalColor:3,tireStyle:0,races:0})
export const gain=(level:number)=>.10*(1-Math.exp(-Math.max(0,level)/35))
export const cost=(level:number)=>Math.round(80+level*18+level*level*1.5)
export function purchase(g:Garage,part:Part) { const n=cost(g[part]);if(g.credits<n)return false;g.credits-=n;g[part]++;return true }
export function reward(placement:number,count:number){return 100+Math.round(80*clamp((count-placement)/Math.max(1,count-1),0,1))}
export const PALETTE=['#1bded5','#ef3ba8','#f7c843','#9461ef','#ee7045','#67e59e']
export type Driver={s:number;startS:number;lane:number;speed:number;throttle:number;steer:number;braking:number;lateral:number;impact:number;heading:number;charge:number;boost:number;tier:number;drifting:boolean;driftSide:number;driftAngle:number;turnHold:number;driftRelease:number;lap:number;lapStart:number;best:number;elapsed:number;finished:boolean}
export const freshDriver=(s=0,lane=0):Driver=>({s,startS:s,lane,speed:0,throttle:0,steer:0,braking:0,lateral:0,impact:0,heading:0,charge:0,boost:0,tier:0,drifting:false,driftSide:0,driftAngle:0,turnHold:0,driftRelease:0,lap:0,lapStart:0,best:0,elapsed:0,finished:false})
export type Controls={throttle:number;steer:number;brake:boolean;drift:boolean;reverse?:boolean}
export function step(d:Driver,input:Controls,g:Garage,dt:number,laps=0) {
 if(d.finished)return
 dt=clamp(dt,0,1/30); d.elapsed+=dt;d.impact=Math.max(0,d.impact-dt)
 const canDrift=!input.brake&&input.throttle>.1&&d.speed>2.4&&d.impact===0
 const strongTurn=Math.abs(input.steer)>.68
 d.turnHold=canDrift&&strongTurn?d.turnHold+dt:0
 if(!d.drifting&&canDrift&&((input.drift&&Math.abs(input.steer)>.12)||d.turnHold>=.28)){
  d.drifting=true;d.driftSide=Math.sign(input.steer);d.driftRelease=0
 }
 if(d.drifting){
  const holding=input.drift||input.steer*d.driftSide>.28
  d.driftRelease=holding?0:d.driftRelease+dt
  if(!canDrift||d.driftRelease>=.1){
   // Brake, low speed and collisions cancel a drift; only a clean release earns turbo.
   if(canDrift&&d.tier)d.boost=Math.max(d.boost,(.35+d.tier*.32)*(1+gain(g.battery)))
   d.drifting=false;d.driftSide=0;d.turnHold=0;d.charge=0;d.tier=0
  }else{
   d.charge+=dt*(.9+.2*clamp(input.steer*d.driftSide,0,1))
   d.tier=d.charge>=2.6?3:d.charge>=1.5?2:d.charge>=.65?1:0
  }
 }
 const slipTarget=d.drifting?d.driftSide*(.16+.12*clamp(input.steer*d.driftSide,0,1)):0
 d.driftAngle+=(slipTarget-d.driftAngle)*(1-Math.exp(-dt*(d.drifting?12:18)))
 const boosted=d.boost>0;d.boost=Math.max(0,d.boost-dt)
 const max=TOP_SPEED*(1+gain(g.motor))*(boosted?1.28:1),reverseMax=TOP_SPEED*.28
 const reverseHeld=!!input.reverse,brakePower=input.brake||reverseHeld&&d.speed>.18?1:0
 const pedal=brakePower?0:clamp(input.throttle,0,1),reversePedal=!input.brake&&reverseHeld&&d.speed<.42?1:0
 d.throttle+=(pedal-d.throttle)*(1-Math.exp(-dt*(pedal?7:18)))
 d.braking+=(brakePower-d.braking)*(1-Math.exp(-dt*18))
 const reversing=input.steer*d.steer<0
 d.steer+=(clamp(input.steer,-1.2,1.2)-d.steer)*(1-Math.exp(-dt*(reversing?32:input.steer?22:28)))
 const absSpeed=Math.abs(d.speed),speedRatio=clamp(absSpeed/max,0,1),reverseRatio=clamp(absSpeed/reverseMax,0,1),direction=d.speed<-.08?-1:1
 // Immediate launch torque, a broad middle range, then a gentle approach to the cap.
 const engineForce=d.throttle*(2.9-2.1*Math.pow(speedRatio,1.4)+(boosted?4:0))-reversePedal*(1.55-.9*Math.pow(reverseRatio,1.2))
 const rollingLoss=d.speed===0?0:Math.sign(d.speed)*(.08+absSpeed*.055),engineBraking=d.speed===0||reversePedal?0:Math.sign(d.speed)*(1-d.throttle)*(2.2+absSpeed*.16)
 // Ease out of turbo instead of snapping speed to the unboosted cap in one frame.
 const overspeedLoss=d.speed>max?(d.speed-max)*3.5:d.speed<-reverseMax?(d.speed+reverseMax)*3.5:0,brakeLoss=brakePower&&absSpeed>.001?22*Math.sign(d.speed):0
 let nextSpeed=d.speed+(engineForce-brakeLoss-rollingLoss-engineBraking-overspeedLoss)*dt
 if((!pedal&&!reversePedal||brakePower)&&d.speed*nextSpeed<0)nextSpeed=0
 if(Math.abs(nextSpeed)<.0001)nextSpeed=0
 d.speed=d.speed>max?Math.min(d.speed,nextSpeed):d.speed<-reverseMax?Math.max(d.speed,nextSpeed):clamp(nextSpeed,-reverseMax,max)
 const f=sample(d.s),next=sample(d.s+.2)
 const curvature=dot(sub(next.t,f.t),f.right)/.2
 // Steering creates lateral momentum. Curves push the kart outward, so fast driving requires active correction.
 const forwardSpeed=d.speed*Math.max(.12,Math.cos(d.heading))
 const yawRate=(d.drifting?2.95:2.75)*(1-.24*speedRatio)*clamp(absSpeed/.85,0,1)*direction
 // A drift retains its side; steering adjusts the arc, including countersteering.
 const turn=d.drifting?d.driftSide*.3+d.steer*.7:d.steer
 d.heading+=(turn*yawRate*(1+gain(g.tires))-curvature*forwardSpeed)*dt
 d.heading=clamp(d.heading,-.9,.9)
 // Tires follow the direction the kart faces; no centering or road-following torque.
 // Sliding keeps momentum, while countersteering grips faster for a clean recovery.
 const lateralTarget=Math.sin(d.heading)*d.speed
 const grip=(d.drifting?4.2:14)*(1+gain(g.tires))
 d.lateral+=(lateralTarget-d.lateral)*(1-Math.exp(-dt*grip))
 d.lane+=d.lateral*dt
 const edge=ROAD_WIDTH/2-.07
 if(Math.abs(d.lane)>edge){
  const side=Math.sign(d.lane),hitSpeed=Math.abs(d.lateral);d.lane=side*edge
  if(d.lateral*side>0){d.lateral=-side*Math.max(.1,hitSpeed*.18);if(!d.impact){d.speed*=.62-.2*clamp(hitSpeed/Math.max(.5,d.speed),0,1);d.impact=.38}}
  d.heading*=.72;d.charge=0;d.tier=0;d.drifting=false;d.driftSide=0;d.turnHold=0;d.boost=0
 }
 const oldLap=Math.floor(Math.max(0,d.s-d.startS)/TRACK_LENGTH)
 d.s+=d.speed*Math.max(.12,Math.cos(d.heading))*dt
 const newLap=Math.floor(Math.max(0,d.s-d.startS)/TRACK_LENGTH)
 if(newLap>oldLap){const time=d.elapsed-d.lapStart;d.best=d.best?Math.min(d.best,time):time;d.lapStart=d.elapsed;d.lap++;if(laps&&d.lap>=laps)d.finished=true}
}
export function bump(a:Driver,b:{s:number;lane:number},dt:number){
 let ds=mod(a.s-b.s+TRACK_LENGTH/2,TRACK_LENGTH)-TRACK_LENGTH/2
 if(Math.abs(ds)<.32&&Math.abs(a.lane-b.lane)<.2){a.lane=clamp(a.lane+(a.lane>=b.lane?1:-1)*dt*.28,-1.03,1.03);a.speed*=1-dt*.12}
}
export function voteWinner(votes:number[]){const counts=[3,5,7].map(n=>({n,c:votes.filter(v=>v===n).length}));counts.sort((a,b)=>b.c-a.c||a.n-b.n);return counts[0].n}
export const timeText=(seconds:number)=>`${Math.floor(seconds/60)}:${(seconds%60).toFixed(2).padStart(5,'0')}`





