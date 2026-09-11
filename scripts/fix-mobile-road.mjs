import fs from 'node:fs'

const input = 'assets/Models/racetrack-dcl-0.glb'
const output = 'assets/Models/racetrack-road-mobile.glb'
const source = fs.readFileSync(input)

if (source.toString('utf8', 0, 4) !== 'glTF') throw new Error('Input is not a GLB file')
const version = source.readUInt32LE(4)
if (version !== 2) throw new Error(`Unsupported GLB version ${version}`)

const jsonLength = source.readUInt32LE(12)
const jsonType = source.readUInt32LE(16)
if (jsonType !== 0x4e4f534a) throw new Error('Missing GLB JSON chunk')
const jsonStart = 20
const jsonEnd = jsonStart + jsonLength
const document = JSON.parse(source.subarray(jsonStart, jsonEnd).toString('utf8'))

document.materials = [
  {
    name: 'MobileOpaqueRoad',
    doubleSided: false,
    alphaMode: 'OPAQUE',
    pbrMetallicRoughness: {
      baseColorFactor: [0.0, 0.76, 0.88, 1],
      metallicFactor: 0,
      roughnessFactor: 0.42
    },
    emissiveFactor: [0.0, 0.05, 0.06]
  }
]

for (const mesh of document.meshes || []) {
  for (const primitive of mesh.primitives || []) primitive.material = 0
}

const nextJson = Buffer.from(JSON.stringify(document))
const paddedJsonLength = Math.ceil(nextJson.length / 4) * 4
const jsonPadding = Buffer.alloc(paddedJsonLength - nextJson.length, 0x20)
const jsonChunk = Buffer.concat([nextJson, jsonPadding])

const chunks = []
let cursor = jsonEnd
while (cursor < source.length) {
  const chunkLength = source.readUInt32LE(cursor)
  const chunkType = source.readUInt32LE(cursor + 4)
  chunks.push({ length: chunkLength, type: chunkType, data: source.subarray(cursor + 8, cursor + 8 + chunkLength) })
  cursor += 8 + chunkLength
}

const totalLength = 12 + 8 + jsonChunk.length + chunks.reduce((sum, chunk) => sum + 8 + chunk.length, 0)
const header = Buffer.alloc(12)
header.write('glTF', 0, 'utf8')
header.writeUInt32LE(2, 4)
header.writeUInt32LE(totalLength, 8)

const jsonHeader = Buffer.alloc(8)
jsonHeader.writeUInt32LE(jsonChunk.length, 0)
jsonHeader.writeUInt32LE(0x4e4f534a, 4)

const body = [header, jsonHeader, jsonChunk]
for (const chunk of chunks) {
  const chunkHeader = Buffer.alloc(8)
  chunkHeader.writeUInt32LE(chunk.length, 0)
  chunkHeader.writeUInt32LE(chunk.type, 4)
  body.push(chunkHeader, chunk.data)
}

fs.writeFileSync(output, Buffer.concat(body))
console.log(`Wrote ${output}`)
