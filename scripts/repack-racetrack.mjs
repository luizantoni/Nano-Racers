import fs from 'node:fs'

const source = fs.readFileSync('assets/Models/racetrack.glb')
const jsonLength = source.readUInt32LE(12)
const document = JSON.parse(source.subarray(20, 20 + jsonLength).toString())
const binHeader = 20 + jsonLength
const binLength = source.readUInt32LE(binHeader)
const binary = source.subarray(binHeader + 8, binHeader + 8 + binLength)
const names = ['TRACK_ROAD', 'TRACK_WALLS', 'TRACK_TRIM']

function values(accessorIndex) {
  const accessor = document.accessors[accessorIndex], view = document.bufferViews[accessor.bufferView]
  const components = accessor.type === 'VEC3' ? 3 : 1
  const bytes = accessor.componentType === 5126 ? 4 : accessor.componentType === 5125 ? 4 : 2
  const stride = view.byteStride || components * bytes, start = (view.byteOffset || 0) + (accessor.byteOffset || 0)
  const out = []
  for (let i=0;i<accessor.count;i++) for(let c=0;c<components;c++) {
    const at=start+i*stride+c*bytes
    out.push(accessor.componentType===5126?binary.readFloatLE(at):accessor.componentType===5125?binary.readUInt32LE(at):binary.readUInt16LE(at))
  }
  return out
}

function writePart(file, name, material, primitive) {
  const positions=values(primitive.attributes.POSITION), normals=values(primitive.attributes.NORMAL), indices=values(primitive.indices)
  const expandedPositions=[],expandedNormals=[]
  for(const index of indices) for(let c=0;c<3;c++){expandedPositions.push(positions[index*3+c]);expandedNormals.push(normals[index*3+c])}
  const positionData=Buffer.from(new Float32Array(expandedPositions).buffer),normalData=Buffer.from(new Float32Array(expandedNormals).buffer)
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity]
  expandedPositions.forEach((n,i)=>{min[i%3]=Math.min(min[i%3],n);max[i%3]=Math.max(max[i%3],n)})
  const doc={
    asset:{version:'2.0',generator:'Mini RC Drift Decentraland repacker'},scene:0,scenes:[{nodes:[0]}],nodes:[{name,mesh:0}],
    meshes:[{name,primitives:[{attributes:{POSITION:0,NORMAL:1},material:0}]}],
    materials:[material],
    buffers:[{byteLength:positionData.length+normalData.length}],
    bufferViews:[{buffer:0,byteOffset:0,byteLength:positionData.length,target:34962},{buffer:0,byteOffset:positionData.length,byteLength:normalData.length,target:34962}],
    accessors:[{bufferView:0,componentType:5126,count:indices.length,type:'VEC3',min,max},{bufferView:1,componentType:5126,count:indices.length,type:'VEC3'}]
  }
  let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)])
  const bin=Buffer.concat([positionData,normalData]),header=Buffer.alloc(12),jh=Buffer.alloc(8),bh=Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+bin.length,8)
  jh.writeUInt32LE(json.length);jh.writeUInt32LE(0x4e4f534a,4);bh.writeUInt32LE(bin.length);bh.writeUInt32LE(0x004e4942,4)
  fs.writeFileSync(file,Buffer.concat([header,jh,json,bh,bin]))
  return indices.length/3
}

document.meshes[0].primitives.forEach((primitive,i)=>console.log(`${names[i]}: ${writePart(`assets/Models/racetrack-dcl-${i}.glb`,names[i],structuredClone(document.materials[primitive.material]),primitive)} triangles`))
