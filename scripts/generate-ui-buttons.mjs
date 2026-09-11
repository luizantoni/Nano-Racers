import fs from 'node:fs'
import {deflateSync} from 'node:zlib'
const size=128
function crc(data){let c=0xffffffff;for(const byte of data){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}
function chunk(name,data){const tag=Buffer.from(name),length=Buffer.alloc(4),checksum=Buffer.alloc(4);length.writeUInt32BE(data.length);checksum.writeUInt32BE(crc(Buffer.concat([tag,data])));return Buffer.concat([length,tag,data,checksum])}
fs.mkdirSync('assets/UI',{recursive:true})
for(const ring of [false,true]){
 const pixels=Buffer.alloc((size*4+1)*size)
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const r=Math.hypot(x+.5-size/2,y+.5-size/2),outer=Math.max(0,Math.min(1,63-r)),inner=ring?Math.max(0,Math.min(1,r-60)):1,offset=y*(size*4+1)+1+x*4
  pixels[offset]=pixels[offset+1]=pixels[offset+2]=255;pixels[offset+3]=Math.round(255*outer*inner)
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6
 fs.writeFileSync(`assets/UI/button-${ring?'ring':'disc'}.png`,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]))
}
