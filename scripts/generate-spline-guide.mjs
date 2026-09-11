import fs from 'node:fs'
import { frames, ROAD_WIDTH, TRACK_LENGTH, v, add, mul } from '../src/core.ts'

const paths = [
  { name: 'SPLINE_CENTERLINE', offset: 0, width: 0.055, color: [1, 0.08, 0.55, 1] },
  { name: 'SPLINE_LEFT_EDGE', offset: -ROAD_WIDTH / 2, width: 0.035, color: [0.05, 0.95, 1, 1] },
  { name: 'SPLINE_RIGHT_EDGE', offset: ROAD_WIDTH / 2, width: 0.035, color: [1, 0.78, 0.05, 1] }
]

const chunks = [], bufferViews = [], accessors = [], meshes = [], nodes = [], materials = []
let byteOffset = 0

function accessor(values) {
  const data = Buffer.from(new Float32Array(values).buffer)
  chunks.push(data)
  bufferViews.push({ buffer: 0, byteOffset, byteLength: data.length, target: 34962 })
  byteOffset += data.length
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  values.forEach((n, i) => { min[i % 3] = Math.min(min[i % 3], n); max[i % 3] = Math.max(max[i % 3], n) })
  accessors.push({ bufferView: bufferViews.length - 1, componentType: 5126, count: values.length / 3, type: 'VEC3', min, max })
  return accessors.length - 1
}

function point(frame, across, lift = 0.035) {
  return add(add(frame.p, mul(frame.right, across)), mul(frame.up, lift))
}

for (const path of paths) {
  const positions = [], normals = []
  for (let i = 0; i < frames.length; i++) {
    const a = frames[i], b = frames[(i + 1) % frames.length]
    const a0 = point(a, path.offset - path.width), a1 = point(a, path.offset + path.width)
    const b0 = point(b, path.offset - path.width), b1 = point(b, path.offset + path.width)
    for (const p of [a0, b0, b1, a0, b1, a1]) positions.push(p.x, p.y, p.z)
    for (let n = 0; n < 6; n++) normals.push(a.up.x, a.up.y, a.up.z)
  }
  const material = materials.length
  materials.push({
    name: `${path.name}_MATERIAL`,
    doubleSided: true,
    pbrMetallicRoughness: { baseColorFactor: path.color, metallicFactor: 0, roughnessFactor: 0.35 },
    emissiveFactor: path.color.slice(0, 3).map(x => x * 0.7)
  })
  const mesh = meshes.length
  meshes.push({ name: path.name, primitives: [{ attributes: { POSITION: accessor(positions), NORMAL: accessor(normals) }, material }] })
  nodes.push({ name: path.name, mesh })
}

const document = {
  asset: { version: '2.0', generator: 'Mini RC Drift spline exporter', extras: { trackLengthMeters: TRACK_LENGTH, roadWidthMeters: ROAD_WIDTH } },
  scene: 0,
  scenes: [{ name: 'MINI_RC_TRACK_SPLINE', nodes: nodes.map((_, i) => i) }],
  nodes,
  meshes,
  materials,
  buffers: [{ byteLength: byteOffset }],
  bufferViews,
  accessors
}

let json = Buffer.from(JSON.stringify(document))
json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)])
const bin = Buffer.concat(chunks)
const header = Buffer.alloc(12), jsonHeader = Buffer.alloc(8), binHeader = Buffer.alloc(8)
header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + bin.length, 8)
jsonHeader.writeUInt32LE(json.length, 0); jsonHeader.writeUInt32LE(0x4e4f534a, 4)
binHeader.writeUInt32LE(bin.length, 0); binHeader.writeUInt32LE(0x004e4942, 4)
fs.mkdirSync('deliverables', { recursive: true })
fs.writeFileSync('deliverables/mini-rc-track-spline.glb', Buffer.concat([header, jsonHeader, json, binHeader, bin]))
console.log(`Exported ${frames.length} spline frames, ${TRACK_LENGTH.toFixed(2)}m loop, ${ROAD_WIDTH.toFixed(2)}m road width.`)
