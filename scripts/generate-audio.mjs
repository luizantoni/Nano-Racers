import fs from 'node:fs'
fs.mkdirSync('assets/Audio',{recursive:true})
const rate=22050,count=Math.floor(rate*.48),data=Buffer.alloc(count*2)
for(let i=0;i<count;i++){const t=i/rate,envelope=Math.sin(Math.PI*i/count)**1.3;const signal=(Math.sin(2*Math.PI*(180*t+550*t*t))*.65+Math.sin(2*Math.PI*(360*t+1100*t*t))*.2)*envelope;data.writeInt16LE(Math.round(signal*15000),i*2)}
const h=Buffer.alloc(44);h.write('RIFF');h.writeUInt32LE(36+data.length,4);h.write('WAVEfmt ',8);h.writeUInt32LE(16,16);h.writeUInt16LE(1,20);h.writeUInt16LE(1,22);h.writeUInt32LE(rate,24);h.writeUInt32LE(rate*2,28);h.writeUInt16LE(2,32);h.writeUInt16LE(16,34);h.write('data',36);h.writeUInt32LE(data.length,40);fs.writeFileSync('assets/Audio/boost.wav',Buffer.concat([h,data]));console.log('Generated original boost sound.')
