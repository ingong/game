import { inspectPng } from './png-info.mjs'
import { encodeIndexedPng, packPixels } from './indexed-png.mjs'
import { RUNNER_PALETTE } from '../src/palette.mjs'

const MAX_TEXT = 2*1024*1024
const MAX_DIMENSION = 1024
const MAX_PIXELS = 16*1024*1024
const MAX_FRAMES = 1024
const MAX_LAYERS = 64
const MAX_CHUNKS = 1024
const RUNNER_COMPILE_PALETTE = [...RUNNER_PALETTE,'#c1b3cf','#ac3a68']
const PNG_SIGNATURE = Buffer.from([137,80,78,71,13,10,26,10])

const integer = (value,min,max) => Number.isInteger(value) && value >= min && value <= max

function pngDimensions(bytes) {
  if (bytes.length < 24 || !bytes.subarray(0,8).equals(PNG_SIGNATURE) || bytes.readUInt32BE(8) !== 13 || bytes.toString('ascii',12,16) !== 'IHDR') throw new Error('Invalid Piskel chunk PNG')
  return {width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)}
}

function parse(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_TEXT) throw new Error('Piskel project exceeds size limit')
  let model
  try { model = JSON.parse(text) } catch { throw new Error('Invalid Piskel JSON') }
  if (!model || model.modelVersion !== 2 || !model.piskel || typeof model.piskel !== 'object') throw new Error('Unsupported Piskel modelVersion')
  const p = model.piskel
  if (!integer(p.width,1,MAX_DIMENSION) || !integer(p.height,1,MAX_DIMENSION)) throw new Error('Invalid Piskel dimensions or dimension limit exceeded')
  if (!Number.isFinite(p.fps) || p.fps <= 0 || p.fps > 240) throw new Error('Invalid Piskel fps')
  if (!Array.isArray(p.hiddenFrames) || p.hiddenFrames.length) throw new Error('Hidden Piskel frames are unsupported')
  if (!Array.isArray(p.layers) || !p.layers.length || p.layers.length > MAX_LAYERS) throw new Error('Invalid Piskel layers or layer limit exceeded')
  const layers = p.layers.map((value,index) => {
    let layer
    if (typeof value !== 'string') throw new Error(`Invalid Piskel layer ${index}`)
    try { layer = JSON.parse(value) } catch { throw new Error(`Invalid Piskel layer ${index}`) }
    if (!layer || !integer(layer.frameCount,1,MAX_FRAMES) || !Array.isArray(layer.chunks) || !layer.chunks.length || layer.chunks.length > MAX_CHUNKS ||
      typeof layer.opacity !== 'number' || layer.opacity < 0 || layer.opacity > 1) throw new Error(`Invalid Piskel layer ${index}`)
    return layer
  })
  const frameCount = layers[0].frameCount
  if (layers.some(layer => layer.frameCount !== frameCount) || p.width*p.height*frameCount > MAX_PIXELS) throw new Error('Inconsistent Piskel frame count or pixel limit exceeded')
  return {p,layers,frameCount}
}

export function encodePiskel(png, {name,width,height,frameCount,fps}) {
  if (!Buffer.isBuffer(png)) throw new Error('Piskel source must be a PNG Buffer')
  if (!integer(width,1,MAX_DIMENSION) || !integer(height,1,MAX_DIMENSION) || !integer(frameCount,1,MAX_FRAMES) ||
    !Number.isFinite(fps) || fps <= 0 || fps > 240 || typeof name !== 'string' || !name.trim() || name.length > 200) throw new Error('Invalid Piskel metadata')
  const info = inspectPng(png)
  if (info.width !== width*frameCount || info.height !== height || width*height*frameCount > MAX_PIXELS) throw new Error('PNG atlas does not match Piskel frame dimensions')
  const layer = {name:'Layer 1',opacity:1,frameCount,chunks:[{layout:Array.from({length:frameCount},(_,i) => [i]),base64PNG:`data:image/png;base64,${png.toString('base64')}`}]}
  return JSON.stringify({modelVersion:2,piskel:{name:name.trim(),description:'',width,height,fps,layers:[JSON.stringify(layer)],hiddenFrames:[]}})
}

export function decodePiskel(text) {
  const {p,layers,frameCount} = parse(text)
  const rgba = Buffer.alloc(p.width*p.height*frameCount*4)
  for (const [layerIndex,layer] of layers.entries()) {
    const frames = Array(frameCount).fill(null)
    const seen = new Set()
    for (const chunk of layer.chunks) {
      if (!chunk || !Array.isArray(chunk.layout) || !chunk.layout.length) throw new Error(`Invalid Piskel chunk in layer ${layerIndex}`)
      const rows = chunk.layout[0]?.length
      if (!rows || !chunk.layout.every(column => Array.isArray(column) && column.length === rows)) throw new Error('Piskel chunk layout must have nonempty rectangular columns')
      for (const column of chunk.layout) for (const frame of column) {
        if (frame === null || frame === undefined) throw new Error('Piskel chunk layout contains null or unused padding')
        if (!integer(frame,0,frameCount-1)) throw new Error('Invalid Piskel frame index')
        if (seen.has(frame)) throw new Error(`Duplicate Piskel frame ${frame}`)
        seen.add(frame)
      }
    }
    const missing = Array.from({length:frameCount},(_,frame) => frame).find(frame => !seen.has(frame))
    if (missing !== undefined) throw new Error(`Missing Piskel frame ${missing}`)
    for (const chunk of layer.chunks) {
      if (typeof chunk.base64PNG !== 'string' ||
        !chunk.base64PNG.startsWith('data:image/png;base64,')) throw new Error(`Invalid Piskel chunk in layer ${layerIndex}`)
      const encoded = chunk.base64PNG.slice(22)
      if (!encoded.length || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw new Error('Invalid Piskel chunk PNG')
      const png = Buffer.from(encoded,'base64')
      if (!png.length || png.length > MAX_TEXT) throw new Error('Invalid Piskel chunk PNG or size limit exceeded')
      const rows = chunk.layout[0].length
      const dimensions = pngDimensions(png)
      if (dimensions.width !== chunk.layout.length*p.width || dimensions.height !== rows*p.height) throw new Error('Piskel chunk PNG dimensions do not match its frame grid')
      const image = inspectPng(png,{pixels:true})
      for (let x=0; x<chunk.layout.length; x++) {
        const column = chunk.layout[x]
        for (let y=0; y<column.length; y++) {
          const frame = column[y]
          const pixels = Buffer.alloc(p.width*p.height*4)
          for (let row=0; row<p.height; row++) image.rgba.copy(pixels,row*p.width*4,((y*p.height+row)*image.width+x*p.width)*4,((y*p.height+row)*image.width+(x+1)*p.width)*4)
          frames[frame] = pixels
        }
      }
    }
    for (let frame=0; frame<frameCount; frame++) for (let pixel=0; pixel<p.width*p.height; pixel++) {
      const srcOffset = pixel*4
      const x = pixel%p.width, y = Math.floor(pixel/p.width)
      const destOffset = (y*p.width*frameCount+frame*p.width+x)*4
      const sourceAlpha = frames[frame][srcOffset+3]/255*layer.opacity
      const destAlpha = rgba[destOffset+3]/255
      const outAlpha = sourceAlpha+destAlpha*(1-sourceAlpha)
      if (!outAlpha) continue
      for (let channel=0; channel<3; channel++) rgba[destOffset+channel] = Math.round((frames[frame][srcOffset+channel]*sourceAlpha+rgba[destOffset+channel]*destAlpha*(1-sourceAlpha))/outAlpha)
      rgba[destOffset+3] = Math.round(outAlpha*255)
    }
  }
  return {width:p.width,height:p.height,frameCount,fps:p.fps,rgba}
}

export function compilePiskel(text) {
  const metadata = parse(text)
  if (metadata.p.width !== 32 || metadata.p.height !== 56 || metadata.frameCount !== 5) throw new Error('Runner Piskel must contain 5 frames of 32x56 pixels')
  const decoded = decodePiskel(text)
  return encodeIndexedPng(packPixels({width:160,height:56,rgba:decoded.rgba},{width:160,height:56,palette:RUNNER_COMPILE_PALETTE}))
}
