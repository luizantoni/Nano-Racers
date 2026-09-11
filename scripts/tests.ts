import assert from 'node:assert/strict'
import {frames,TRACK_LENGTH,sample,pose,orientation,length,dot,sub,step,freshDriver,freshGarage,gain,purchase,reward,bump,voteWinner,TOP_SPEED,TOP_SPEED_KMH,RACE_START} from '../src/core'
import {Room,Packet} from '../src/room'
import {measureHud} from '../src/hud-layout'
let checks=0
function test(name:string,fn:()=>void){fn();checks++;console.log(`PASS ${name}`)}
test('Track frames stay orthonormal, finite, inverted and within 2x2 footprint',()=>{let inverted=false;for(let s=0;s<TRACK_LENGTH;s+=.05){const f=sample(s);assert.ok(f.p.x>1.5&&f.p.x<30.5&&f.p.z>1.5&&f.p.z<30.5);assert.ok(Math.abs(length(f.up)-1)<1e-6);assert.ok(Math.abs(dot(f.t,f.up))<1e-6);const q=orientation(f);assert.ok(Object.values(q).every(Number.isFinite));assert.ok(Math.abs(Math.hypot(q.x,q.y,q.z,q.w)-1)<1e-5);if(f.up.y<-.8)inverted=true}assert.ok(inverted);assert.ok(length(sub(sample(0).p,sample(TRACK_LENGTH-.001).p))<.01)})
test('Manual steering stays finite and inside the rail under sustained inputs',()=>{const d=freshDriver(),g=freshGarage();for(let i=0;i<12000;i++){step(d,{throttle:1,steer:Math.sin(i/87),brake:false,drift:i%400<170},g,1/60);assert.ok([d.s,d.heading,d.speed,d.lane].every(Number.isFinite));assert.ok(Math.abs(d.lane)<=1.18+1e-6)}assert.ok(d.s>TRACK_LENGTH)})
test('Lap counting finishes exactly at the selected distance',()=>{const d=freshDriver(),g=freshGarage();for(let lap=1;lap<=3;lap++){d.s=TRACK_LENGTH*lap-.01;d.speed=5;step(d,{throttle:1,steer:0,brake:false,drift:false},g,1/60,3);assert.equal(d.lap,lap)}assert.ok(d.finished)})
test('HUD leaves a road-view gap and finger-sized controls on phone layouts',()=>{
 for(const [w,h] of [[640,360],[844,390],[932,430],[390,844],[768,1024]]){
  const {unit,scale,controlHeight}=measureHud(w,h,true),hudBottom=h*.07+102*unit*scale,controlsTop=h*.92-(2*controlHeight+6*unit)*scale
  assert.ok(controlsTop>hudBottom,`${w}x${h}: HUD/control overlap`)
  assert.ok(controlHeight*scale>=44,`${w}x${h}: pedal target too small`)
  assert.ok(68*unit*scale>=44,`${w}x${h}: menu target too small`)
  assert.ok(336*unit*scale<=w*.84,`${w}x${h}: instruments exceed safe width`)
  assert.ok((2*controlHeight+10*unit)*scale<=w*.84*.4+.01,`${w}x${h}: control group overlaps the road-view gap`)
 }
})
test('Acceleration is gradual and stable at 30, 60 and 120 Hz',()=>{
 const outcomes=[]
 assert.equal(TOP_SPEED_KMH,49)
 for(const hz of [30,60,120]){const d=freshDriver(),g=freshGarage();let time95=0;for(let i=0;i<hz*20;i++){d.lane=0;d.lateral=0;d.heading=0;step(d,{throttle:1,steer:0,brake:false,drift:false},g,1/hz);if(!time95&&d.speed>=TOP_SPEED*.95)time95=(i+1)/hz}assert.ok(time95>2.2&&time95<5,`95% speed at ${time95}s`);assert.ok(Math.abs(d.speed*12-TOP_SPEED_KMH)<.01);outcomes.push(time95)}
 assert.ok(Math.max(...outcomes)-Math.min(...outcomes)<.12)
})
test('Brake overrides held gas and boost expiry does not snap the speed',()=>{
 const d=freshDriver(),g=freshGarage();d.speed=10;d.throttle=1
 for(let i=0;i<90;i++)step(d,{throttle:1,steer:0,brake:true,drift:false},g,1/60)
 assert.equal(d.speed,0);assert.ok(d.throttle<.001)
 d.speed=TOP_SPEED*1.25;d.boost=.001;d.s=0;d.lane=0;d.lateral=0;d.heading=0;d.braking=0;d.throttle=1
 step(d,{throttle:1,steer:0,brake:false,drift:false},g,1/60)
 const before=d.speed;step(d,{throttle:1,steer:0,brake:false,drift:false},g,1/60)
 assert.ok(before-d.speed<.3);assert.ok(d.speed>TOP_SPEED)
})
test('Short steering taps move promptly and countersteering changes yaw within 100ms',()=>{
 const g=freshGarage(),responses:number[]=[]
 for(const hz of [30,60,120]){
  const d=freshDriver(TRACK_LENGTH-10);d.speed=6;d.throttle=1
  for(let i=0;i<hz*.2;i++)step(d,{throttle:1,steer:1,brake:false,drift:false},g,1/hz)
  assert.ok(d.lane>.06&&d.lane<.5,`Delayed or excessive steering at ${hz} Hz: ${d.lane}`)
  responses.push(d.lane);const heading=d.heading
  for(let i=0;i<hz*.1;i++)step(d,{throttle:1,steer:-1,brake:false,drift:false},g,1/hz)
  assert.ok(d.heading<heading-.05,`Countersteering delayed at ${hz} Hz`)
 }
 assert.ok(Math.max(...responses)-Math.min(...responses)<.07)
})
test('Launch responds in the first second without reaching cruising speed immediately',()=>{
 const d=freshDriver(),g=freshGarage()
 for(let i=0;i<60;i++){d.s=0;d.lane=0;d.heading=0;d.lateral=0;step(d,{throttle:1,steer:0,brake:false,drift:false},g,1/60)}
 assert.ok(d.speed*12>18&&d.speed*12<30)
 for(let i=0;i<150;i++){d.s=0;d.lane=0;d.heading=0;d.lateral=0;step(d,{throttle:0,steer:0,brake:false,drift:false},g,1/60)}
 assert.equal(d.speed,0)
})
test('Reverse input brakes first, then moves the kart backward',()=>{
 const g=freshGarage(),d=freshDriver(20);d.speed=2.4
 for(let i=0;i<5;i++)step(d,{throttle:0,steer:0,brake:false,reverse:true,drift:false},g,1/60)
 assert.ok(d.speed>=0,'reverse should brake before moving backward')
 for(let i=0;i<90;i++)step(d,{throttle:0,steer:.35,brake:false,reverse:true,drift:false},g,1/60)
 assert.ok(d.speed<-.15,'kart should reverse after it slows down')
 assert.ok(d.s<20,'reverse should reduce track distance')
})
test('Drift reaches all three tiers and a clean release earns turbo',()=>{
 const d=freshDriver(),g=freshGarage();d.speed=6;const seen=new Set()
 for(let i=0;i<170;i++){d.lane=0;step(d,{throttle:1,steer:.2,brake:false,drift:true},g,1/60);seen.add(d.tier)}
 assert.ok([1,2,3].every(n=>seen.has(n)))
 for(let i=0;i<8;i++){d.lane=0;step(d,{throttle:1,steer:0,brake:false,drift:false},g,1/60)}
 assert.ok(d.boost>1);assert.equal(d.drifting,false)
})
test('Sustained steering starts drift, while taps and low speeds do not',()=>{
 for(const hz of [30,60,120]){
  const d=freshDriver(TRACK_LENGTH-10),g=freshGarage();d.speed=5;d.throttle=1
  for(let i=0;i<hz*.1;i++)step(d,{throttle:1,steer:1,brake:false,drift:false},g,1/hz)
  assert.equal(d.drifting,false)
  for(let i=0;i<hz*.23;i++){d.lane=0;step(d,{throttle:1,steer:1,brake:false,drift:false},g,1/hz)}
  assert.equal(d.drifting,true);assert.equal(d.driftSide,1)
  for(let i=0;i<hz*.2;i++){d.lane=0;step(d,{throttle:1,steer:0,brake:false,drift:false},g,1/hz)}
  assert.equal(d.drifting,false);assert.equal(d.boost,0)
  const slow=freshDriver()
  for(let i=0;i<hz;i++)step(slow,{throttle:0,steer:1,brake:false,drift:true},g,1/hz)
  assert.equal(slow.drifting,false)
 }
})
test('Countersteering widens a held drift, and braking or walls cancel its reward',()=>{
 const g=freshGarage()
 const charged=()=>{const d=freshDriver(TRACK_LENGTH-10);d.speed=5;d.throttle=1;d.drifting=true;d.driftSide=1;d.charge=2;d.tier=2;return d}
 const tight=charged(),wide=charged()
 for(let i=0;i<6;i++){step(tight,{throttle:1,steer:1,brake:false,drift:true},g,1/60);step(wide,{throttle:1,steer:-1,brake:false,drift:true},g,1/60)}
 assert.equal(wide.driftSide,1);assert.ok(wide.heading<tight.heading)
 const brake=charged();step(brake,{throttle:1,steer:1,brake:true,drift:true},g,1/60)
 assert.equal(brake.drifting,false);assert.equal(brake.boost,0);assert.equal(brake.tier,0)
 const wall=charged();wall.lane=1.179;wall.heading=.8;wall.lateral=4
 step(wall,{throttle:1,steer:1,brake:false,drift:true},g,1/60)
 assert.ok(wall.speed<3.1);assert.equal(wall.drifting,false);assert.equal(wall.boost,0);assert.equal(wall.tier,0);assert.ok(wall.lane<=1.18)
})
test('Upgrade returns diminish, never exceed 10%, and purchases require credits',()=>{assert.equal(gain(0),0);assert.ok(gain(1000)<=.1);assert.ok(gain(2)-gain(1)>gain(100)-gain(99));const g=freshGarage();assert.equal(purchase(g,'motor'),false);g.credits=80;assert.equal(purchase(g,'motor'),true);assert.equal(g.credits,0);assert.equal(g.motor,1);assert.equal(reward(20,20),100);assert.equal(reward(1,20),180)})
test('Light bumps remain bounded and vote ties select shorter races',()=>{const d=freshDriver(0,1);d.speed=7;for(let i=0;i<100;i++)bump(d,{s:0,lane:.9},1/60);assert.ok(d.lane<=1.03);assert.ok(d.speed>0);assert.equal(voteWinner([5,7,5,7]),5);assert.equal(voteWinner([]),3)})
test('Twenty ready peers start five laps without a vote; rewards pay once',()=>{
 let clock=1_000_000;const realNow=Date.now;Date.now=()=>clock
 try{const rooms:Room[]=[];for(let i=0;i<20;i++){const id=String(i).padStart(2,'0');const r=new Room(id,p=>rooms.forEach(other=>{if(other.id!==id)other.receive(structuredClone(p))}),freshGarage());rooms.push(r)}
 const tick=(n:number)=>{for(let i=0;i<n;i++){clock+=200;rooms.forEach(r=>r.update(clock))}}
 tick(2);rooms.forEach((r,i)=>{r.join(i);r.ready()});tick(3);assert.equal(rooms[0].round.phase,'intro');tick(31);assert.equal(rooms[0].round.phase,'countdown');tick(18);assert.ok(rooms.every(r=>r.round.phase==='race'&&r.round.laps===5&&r.round.roster.length===20));assert.ok(rooms.every(r=>!r.me.ready));
 rooms[0].driver.s=TRACK_LENGTH*5;rooms[0].driver.finished=true;tick(4);assert.equal(rooms[0].garage.credits,0);tick(6);assert.equal(rooms[0].garage.credits,0)
 rooms.slice(1).forEach(r=>r.leave());tick(4);assert.equal(rooms[0].round.phase,'results');assert.equal(rooms[0].garage.credits,180);tick(60);assert.equal(rooms[0].round.phase,'lobby');assert.equal(rooms[0].me.ready,false)
 }finally{Date.now=realNow}
})
test('Late arrivals cannot enter an active roster, and the last finisher earns completion credits',()=>{
 let clock=2_000_000;const realNow=Date.now;Date.now=()=>clock
 try{const rooms:Room[]=[];const create=(id:string)=>{const r=new Room(id,p=>rooms.forEach(o=>{if(o.id!==id)o.receive(structuredClone(p))}),freshGarage());rooms.push(r);return r};const a=create('a'),b=create('b');const tick=(n:number)=>{for(let i=0;i<n;i++){clock+=200;rooms.forEach(r=>r.update(clock))}};tick(2);a.join(0);b.join(1);a.ready();b.ready();tick(65);assert.equal(a.round.phase,'race');const c=create('c');tick(2);c.join(2);c.ready();tick(2);assert.ok(!a.round.roster.includes('c'));assert.equal(c.isRacing(),false);a.driver.s=TRACK_LENGTH*5;a.driver.finished=true;tick(3);b.driver.s=TRACK_LENGTH*5;b.driver.finished=true;tick(4);assert.equal(b.garage.credits,100);tick(4);assert.equal(b.garage.credits,100)
 }finally{Date.now=realNow}
})
test('Remote ready state appears on the other player before local ready',()=>{
 let clock=2_500_000;const realNow=Date.now;Date.now=()=>clock
 try{const rooms:Room[]=[];const a=new Room('a',p=>rooms.forEach(o=>{if(o.id!=='a')o.receive(structuredClone(p))}),freshGarage()),b=new Room('b',p=>rooms.forEach(o=>{if(o.id!=='b')o.receive(structuredClone(p))}),freshGarage());rooms.push(a,b);const tick=(n:number)=>{for(let i=0;i<n;i++){clock+=200;rooms.forEach(r=>r.update(clock))}};tick(2);a.join(0);b.join(1);tick(2);b.ready();tick(1);assert.equal(a.peers.get('b')?.ready,true);assert.equal(a.readyCount(),1);assert.match(a.message,/READY/)
 }finally{Date.now=realNow}
})
test('Final placement uses elapsed race time and pays only after results lock',()=>{
 let clock=2_750_000;const realNow=Date.now;Date.now=()=>clock
 try{const rooms:Room[]=[];const a=new Room('a',p=>rooms.forEach(o=>{if(o.id!=='a')o.receive(structuredClone(p))}),freshGarage()),b=new Room('b',p=>rooms.forEach(o=>{if(o.id!=='b')o.receive(structuredClone(p))}),freshGarage());rooms.push(a,b);const tick=(n:number)=>{for(let i=0;i<n;i++){clock+=200;rooms.forEach(r=>r.update(clock))}};tick(2);a.join(0);b.join(1);a.ready();b.ready();tick(65);assert.equal(a.round.phase,'race');b.driver.s=TRACK_LENGTH*5;b.driver.elapsed=120;b.driver.finished=true;tick(2);assert.equal(b.garage.credits,0);a.driver.s=TRACK_LENGTH*5;a.driver.elapsed=110;a.driver.finished=true;tick(4);assert.equal(a.round.phase,'results');assert.deepEqual(a.round.finished,['a','b']);assert.equal(a.garage.credits,180);assert.equal(b.garage.credits,100);assert.match(a.result,/FINISHED #1/);assert.match(b.result,/FINISHED #2/)
 }finally{Date.now=realNow}
})
test('Solo race starts with one player, ignores multiplayer round overrides, and pays first place',()=>{
 let clock=3_000_000;const realNow=Date.now;Date.now=()=>clock
 try{const sent:Packet[]=[];const r=new Room('solo',p=>sent.push(structuredClone(p)),freshGarage());r.join(0);r.solo();assert.equal(r.round.phase,'intro');assert.equal(r.round.solo,true);assert.deepEqual(r.round.roster,['solo']);r.receive({kind:'round',host:'host',round:{id:'remote',phase:'race',until:clock+1000,laps:5,roster:['host','solo'],finished:[],started:clock,winnerAt:0}});assert.equal(r.round.id.startsWith('solo-'),true);const tick=(n:number)=>{for(let i=0;i<n;i++){clock+=200;r.update(clock)}};tick(31);assert.equal(r.round.phase,'countdown');tick(18);assert.equal(r.round.phase,'race');assert.equal(sent.some(p=>p.kind==='round'&&(p.round as any).solo),false);r.driver.s=TRACK_LENGTH*5;r.driver.finished=true;tick(4);assert.equal(r.round.phase,'results');assert.equal(r.garage.credits,100);tick(60);assert.equal(r.round.phase,'lobby');assert.equal(r.round.solo,false)
 }finally{Date.now=realNow}
})
test('Joining supplies a stationary track pose before the first driving tick',()=>{
 const r=new Room('entry-test',()=>{},freshGarage());r.join()
 assert.ok(r.seated());assert.equal(r.driver.s,RACE_START);assert.equal(r.driver.speed,0);assert.equal(r.driver.elapsed,0)
 const f=pose(r.driver.s,r.driver.lane);assert.ok(Object.values(f.p).every(Number.isFinite));assert.ok(f.p.y>1)
})
console.log(`${checks} verification groups passed.`)






