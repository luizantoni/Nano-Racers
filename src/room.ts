import {Driver,Garage,freshDriver,reward,TRACK_LENGTH,RACE_START,clamp} from './core'
export const RACE_LAPS=5
export type Peer={id:string;userId:string;name:string;seat:number;ready:boolean;color:number;metalColor:number;tireStyle:number;s:number;lane:number;speed:number;heading:number;driftAngle?:number;tier:number;boost:number;finished:boolean;best:number;elapsed:number;seen:number}
export type Round={id:string;phase:'lobby'|'intro'|'countdown'|'race'|'results';until:number;laps:number;roster:string[];finished:string[];started:number;winnerAt:number;solo?:boolean}
export type Packet={kind:'peer';peer:Peer}|{kind:'round';host:string;round:Round}|{kind:'leave';id:string}
export type LeaderRecord={id:string;userId:string;name:string;best:number;wins:number;races:number;updated:number}
const boardKey='nano-rc-leaderboard-v1'
const memoryBoard:LeaderRecord[]=[]
function storage(){try{return (globalThis as unknown as {localStorage?:{getItem:(key:string)=>string|null;setItem:(key:string,value:string)=>void}}).localStorage}catch{return undefined}}
function readBoard(){const store=storage();if(!store)return memoryBoard.slice();try{const raw=store.getItem(boardKey),data=raw?JSON.parse(raw):[];return Array.isArray(data)?data.filter(r=>r&&typeof r.id==='string'&&Number.isFinite(r.best)).slice(0,20):[]}catch{return memoryBoard.slice()}}
function writeBoard(records:LeaderRecord[]){memoryBoard.length=0;memoryBoard.push(...records.slice(0,20));const store=storage();if(store)try{store.setItem(boardKey,JSON.stringify(memoryBoard))}catch{}}
export class Room {
 peers=new Map<string,Peer>();round:Round={id:'',phase:'lobby',until:0,laps:RACE_LAPS,roster:[],finished:[],started:0,winnerAt:0}
 leaderboard:LeaderRecord[]=readBoard()
 me:Peer;driver=freshDriver();garage:Garage;lastBeat=0;seenRound='';paidRound='';message='Choose a table seat to drive.';spectating=false;result='';seat=-1
 constructor(public id:string,public send:(p:Packet)=>void,g:Garage,public save:()=>void=()=>{}){this.garage=g;this.me={id,userId:id,name:`Racer ${id.slice(-4)}`,seat:-1,ready:false,color:g.color,metalColor:g.metalColor,tireStyle:g.tireStyle,s:0,lane:0,speed:0,heading:0,tier:0,boost:0,finished:false,best:0,elapsed:0,seen:Date.now()};this.peers.set(id,this.me)}
 receive(data:Packet){const now=Date.now();if(!data||typeof data!=='object')return
  if(data.kind==='peer'){const p=data.peer;if(!p||p.id===this.id||typeof p.id!=='string'||p.id.length>100||!Number.isFinite(p.s)||!Number.isFinite(p.lane)||!Number.isFinite(p.speed))return;if(!this.peers.has(p.id)&&this.peers.size>=40)return;const old=this.peers.get(p.id),name=String(p.name||'Racer').slice(0,24);this.peers.set(p.id,{...p,userId:String(p.userId||p.id).slice(0,100),seat:Math.floor(clamp(p.seat,-1,19)),ready:!!p.ready,color:Math.floor(clamp(p.color,0,5)),metalColor:Math.floor(clamp(Number.isFinite(p.metalColor)?p.metalColor:3,0,5)),tireStyle:Math.floor(clamp(Number.isFinite(p.tireStyle)?p.tireStyle:0,0,2)),lane:clamp(p.lane,-1.1,1.1),speed:clamp(p.speed,-8,24),driftAngle:Number.isFinite(p.driftAngle)?clamp(p.driftAngle!,-.4,.4):0,name,best:Number.isFinite(p.best)?p.best:0,elapsed:Number.isFinite(p.elapsed)?p.elapsed:0,seen:now});if(p.ready&&!old?.ready&&p.seat>=0&&this.round.phase==='lobby')this.message=`${name} READY`}
  if(data.kind==='leave'&&data.id!==this.id)this.peers.delete(data.id)
  if(data.kind==='round'&&this.round.solo&&this.round.phase!=='lobby'&&this.round.phase!=='results')return
  if(data.kind==='round'&&data.host===this.leader()&&data.round&&['lobby','intro','countdown','race','results'].includes(data.round.phase)&&data.round.laps===RACE_LAPS&&Array.isArray(data.round.roster)&&data.round.roster.length<=20){this.round={...data.round,solo:false}}
 }
 leader(){return [...this.peers.keys()].sort()[0]||this.id}
 seated(){return this.seat>=0}
 readyCount(){let n=0;for(const peer of this.peers.values())if(peer.ready&&peer.seat>=0)n++;return n}
 join(seat?:number){if(this.isRacing())return;const occupied=new Set([...this.peers.values()].filter(p=>p.id!==this.id).map(p=>p.seat));const target=seat??Array.from({length:20},(_,i)=>i).find(n=>!occupied.has(n));if(target===undefined||occupied.has(target)){this.message='That seat is occupied.';return}this.seat=target;this.me.seat=target;if(!this.driver.elapsed)this.driver=freshDriver(RACE_START,0);this.spectating=false;this.message='Practice on the ghost circuit. Ready when you are.';this.broadcast()}
 leave(){this.seat=-1;this.me.seat=-1;this.me.ready=false;this.spectating=false;this.broadcast()}
 ready(){if(!this.seated()){this.message='Use the JOIN RACE sign first.';return}if(this.round.phase!=='lobby'&&this.round.phase!=='results')return;this.me.ready=!this.me.ready;this.message=this.me.ready?'Ready for the next race.':'Practice until you are ready.';this.broadcast()}
 solo(){if(!this.seated())this.join();if(!this.seated())return;if(this.round.phase!=='lobby'&&this.round.phase!=='results')return;const now=Date.now();this.me.ready=false;this.spectating=false;this.result='';this.round={id:`solo-${now}-${this.id}`,phase:'intro',until:now+6000,laps:RACE_LAPS,roster:[this.id],finished:[],started:0,winnerAt:0,solo:true};this.message='SOLO RACE';this.broadcast()}
 isRacing(){return this.round.phase==='race'&&this.round.roster.includes(this.id)&&!this.driver.finished}
 isGrid(){return (this.round.phase==='intro'||this.round.phase==='countdown')&&this.round.roster.includes(this.id)}
 broadcast(){Object.assign(this.me,{seat:this.seat,color:this.garage.color,metalColor:this.garage.metalColor,tireStyle:this.garage.tireStyle,s:this.driver.s,lane:this.driver.lane,speed:this.driver.speed,heading:this.driver.heading,driftAngle:this.driver.driftAngle,tier:this.driver.tier,boost:this.driver.boost,finished:this.driver.finished,best:this.driver.best,elapsed:this.driver.elapsed,seen:Date.now()});this.send({kind:'peer',peer:{...this.me}})}
 update(now=Date.now()){
  for(const [id,p]of this.peers)if(id!==this.id&&now-p.seen>6000)this.peers.delete(id)
  // Resolve a simultaneous seat claim deterministically.
  if(this.seat>=0&&[...this.peers.values()].some(p=>p.id<this.id&&p.seat===this.seat)){this.leave();this.message='Seat taken by another racer. Choose another.'}
  if(now-this.lastBeat>100){this.broadcast();this.lastBeat=now;const solo=!!this.round.solo&&this.round.roster.length===1&&this.round.roster[0]===this.id;if(this.leader()===this.id||solo){this.advance(now);if(!solo)this.send({kind:'round',host:this.id,round:{...this.round,solo:false}})}}
  const r=this.round
  if((r.phase==='intro'||r.phase==='countdown'||r.phase==='race')&&r.id!==this.seenRound&&r.roster.includes(this.id)){
   this.seenRound=r.id;const grid=r.roster.indexOf(this.id);this.driver=freshDriver(RACE_START-.8-Math.floor(grid/4)*.75,(grid%4-1.5)*.5);this.me.ready=false;this.spectating=false;this.result=''
  }
  if(r.phase==='results'&&this.driver.finished&&r.roster.includes(this.id)&&this.paidRound!==r.id){const place=r.finished.indexOf(this.id);if(place>=0){const credits=reward(place+1,r.roster.length);this.garage.credits+=credits;this.garage.races++;this.paidRound=r.id;this.result=`FINISHED #${place+1}  +${credits} credits`;this.recordResult(place+1);this.save()}}
  if(r.phase==='results'&&this.seenRound===r.id&&!this.result&&r.roster.includes(this.id))this.result='Race ended • unfinished races earn no credits.'
  if(r.phase==='lobby'&&this.driver.finished){this.driver=freshDriver();this.me.finished=false}
 }
 recordResult(place:number){const now=Date.now(),time=this.driver.best||this.driver.elapsed;if(!time)return
  const records=readBoard(),found=records.find(r=>r.id===this.id)||{id:this.id,userId:this.me.userId||this.id,name:this.me.name,best:time,wins:0,races:0,updated:now}
  found.userId=this.me.userId||this.id;found.name=this.me.name;found.best=Math.min(found.best||time,time);found.wins+=place===1?1:0;found.races++;found.updated=now
  const next=[found,...records.filter(r=>r.id!==this.id)].sort((a,b)=>a.best-b.best||b.wins-a.wins||b.updated-a.updated).slice(0,20)
  this.leaderboard=next;writeBoard(next)
 }
 advance(now:number){const r=this.round,ready=[...this.peers.values()].filter(p=>p.ready&&p.seat>=0).sort((a,b)=>a.id.localeCompare(b.id)).slice(0,20)
  if(r.phase==='lobby'&&ready.length>=2){this.round={id:`${now}-${this.id}`,phase:'intro',until:now+6000,laps:RACE_LAPS,roster:ready.map(p=>p.id),finished:[],started:0,winnerAt:0};return}
  if(r.phase==='intro'&&now>=r.until){r.phase='countdown';r.until=now+3500}
  if(r.phase==='countdown'&&now>=r.until){r.phase='race';r.started=now;r.until=now+(r.laps*120+90)*1000}
  if(r.phase==='race'){
   const done=r.roster.map(id=>this.peers.get(id)).filter(p=>p?.finished&&p.s>=TRACK_LENGTH*r.laps) as Peer[]
   if(done.length){r.finished=done.sort((a,b)=>(a.elapsed||999999)-(b.elapsed||999999)||a.id.localeCompare(b.id)).map(p=>p.id);if(!r.winnerAt)r.winnerAt=now}
   const active=r.roster.filter(id=>this.peers.has(id)&&this.peers.get(id)!.seat>=0)
   if(now>=r.until||(r.winnerAt&&now-r.winnerAt>45000)||active.every(id=>r.finished.includes(id))){r.phase='results';r.until=now+10000}
  }
  if(r.phase==='results'&&now>=r.until){r.phase='lobby';r.roster=[];r.finished=[];r.solo=false}
 }
}


