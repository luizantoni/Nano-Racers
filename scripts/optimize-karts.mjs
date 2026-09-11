// Build runtime copies; preserve the authored karts for editing/regeneration.
import fs from 'node:fs'
import assert from 'node:assert/strict'

for(let color=0;color<6;color++){
 const input=fs.readFileSync(`assets/Models/kart-${color}.glb`)
 const jsonLength=input.readUInt32LE(12),doc=JSON.parse(input.subarray(20,20+jsonLength))
 const binary=input.subarray(28+jsonLength),groups=new Map()
 const read=(id)=>{
  const a=doc.accessors[id],view=doc.bufferViews[a.bufferView],n={SCALAR:1,VEC3:3,VEC4:4}[a.type]
  assert.equal(a.componentType,5126);assert.ok(n)
  const result=[],stride=view.byteStride||n*4,offset=(view.byteOffset||0)+(a.byteOffset||0)
  for(let i=0;i<a.count;i++)for(let j=0;j<n;j++)result.push(binary.readFloatLE(offset+i*stride+j*4))
  return result
 }
 let originalVertices=0,originalSlots=0
 for(const node of doc.nodes){
  assert.ok(!node.matrix&&!node.translation&&!node.rotation&&!node.scale&&!node.children)
  if(node.mesh===undefined)continue
  for(const primitive of doc.meshes[node.mesh].primitives){
   assert.equal(primitive.indices,undefined);assert.equal(primitive.mode??4,4)
   assert.deepEqual(Object.keys(primitive.attributes).sort(),['NORMAL','POSITION'])
   const material=structuredClone(doc.materials[primitive.material]),rgba=material.pbrMetallicRoughness.baseColorFactor??[1,1,1,1]
   delete material.name;material.pbrMetallicRoughness.baseColorFactor=[1,1,1,1]
   const key=JSON.stringify(material)
   if(!groups.has(key))groups.set(key,{material,positions:[],normals:[],colors:[]})
   const group=groups.get(key),positions=read(primitive.attributes.POSITION),normals=read(primitive.attributes.NORMAL)
   assert.equal(positions.length,normals.length)
   group.positions.push(...positions);group.normals.push(...normals)
   for(let i=0;i<positions.length/3;i++)group.colors.push(...rgba)
   originalVertices+=positions.length/3;originalSlots++
  }
 }
 const chunks=[],bufferViews=[],accessors=[],materials=[],primitives=[];let offset=0
 const attribute=(values,size,bounds=false)=>{
  const bytes=Buffer.from(new Float32Array(values).buffer),view=bufferViews.length
  chunks.push(bytes);bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target:34962});offset+=bytes.length
  const accessor={bufferView:view,componentType:5126,count:values.length/size,type:`VEC${size}`}
  if(bounds){accessor.min=Array(size).fill(Infinity);accessor.max=Array(size).fill(-Infinity);values.forEach((n,i)=>{accessor.min[i%size]=Math.min(accessor.min[i%size],n);accessor.max[i%size]=Math.max(accessor.max[i%size],n)})}
  accessors.push(accessor);return accessors.length-1
 }
 let outputVertices=0
 for(const group of groups.values()){
  const attributes={POSITION:attribute(group.positions,3,true),NORMAL:attribute(group.normals,3),COLOR_0:attribute(group.colors,4)}
  primitives.push({attributes,material:materials.length});materials.push(group.material);outputVertices+=group.positions.length/3
 }
 assert.equal(outputVertices,originalVertices);assert.ok(primitives.length<originalSlots)
 const output={asset:{version:'2.0',generator:'Mini RC material batching'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:'Kart'}],meshes:[{primitives}],materials,buffers:[{byteLength:offset}],bufferViews,accessors}
 let json=Buffer.from(JSON.stringify(output));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)])
 const header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8),bin=Buffer.concat(chunks)
 header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8)
 jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4)
 fs.writeFileSync(`assets/Models/kart-fast-${color}.glb`,Buffer.concat([header,jh,json,bh,bin]))
 console.log(`Kart ${color}: ${originalSlots} -> ${primitives.length} material slots; ${outputVertices/3} triangles retained; colors, normals and PBR factors preserved`)
}
