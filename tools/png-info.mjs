import { inflateSync } from 'node:zlib'

const signature = Buffer.from([137,80,78,71,13,10,26,10])
const crcTable = Array.from({ length:256 }, (_, n) => {
  for (let bit = 0; bit < 8; bit++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1
  return n >>> 0
})
const crc32 = bytes => {
  let crc = 0xffffffff
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}
function paeth(a, b, c) {
  const p = a + b - c
  const pa = Math.abs(p-a), pb = Math.abs(p-b), pc = Math.abs(p-c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

// Read-only inspector for the project's 8-bit, non-interlaced PNG sources.
// Unsupported encodings fail explicitly instead of producing misleading metrics.
export function inspectPng(bytes, { pixels = false } = {}) {
  if (!bytes.subarray(0,8).equals(signature)) throw new Error('Invalid PNG signature')
  let header, palette, alpha, ended = false
  const imageData = []
  for (let offset = 8; offset < bytes.length;) {
    if (offset+12 > bytes.length) throw new Error('Truncated PNG chunk')
    const length = bytes.readUInt32BE(offset)
    const end = offset+8+length
    if (end+4 > bytes.length) throw new Error('Truncated PNG data')
    const type = bytes.toString('ascii', offset+4, offset+8)
    if (crc32(bytes.subarray(offset+4,end)) !== bytes.readUInt32BE(end)) throw new Error(`PNG CRC mismatch: ${type}`)
    const data = bytes.subarray(offset+8,end)
    if (offset === 8 && type !== 'IHDR') throw new Error('PNG must start with IHDR')
    if (type === 'IHDR') {
      if (header || length !== 13) throw new Error('Invalid PNG IHDR')
      header = data
    }
    if (type === 'PLTE') palette = data
    if (type === 'tRNS') alpha = data
    if (type === 'IDAT') imageData.push(data)
    offset = end+4
    if (type === 'IEND') {
      if (length || offset !== bytes.length) throw new Error('Invalid PNG ending')
      ended = true
      break
    }
  }
  if (!header || !ended || !imageData.length) throw new Error('Incomplete PNG')
  const width = header.readUInt32BE(0), height = header.readUInt32BE(4)
  const bitDepth = header[8], colorType = header[9]
  const channels = { 0:1, 2:3, 3:1, 4:2, 6:4 }[colorType]
  if (bitDepth !== 8 || !channels || header[10] || header[11] || header[12]) {
    throw new Error('PNG inspector supports only 8-bit, non-interlaced images')
  }
  if (colorType === 3 && (!palette || palette.length % 3 || palette.length > 768)) throw new Error('Invalid PNG palette')
  if (alpha && ((colorType === 0 && alpha.length !== 2) || (colorType === 2 && alpha.length !== 6) ||
    (colorType === 3 && alpha.length > palette.length/3) || colorType === 4 || colorType === 6)) throw new Error('Invalid PNG transparency')
  const stride = width*channels, expected = (stride+1)*height
  if (!width || !height || expected > 64*1024*1024) throw new Error('PNG decoded size exceeds inspection limit')
  const raw = inflateSync(Buffer.concat(imageData), { maxOutputLength:expected })
  if (raw.length !== expected) throw new Error('PNG decoded size mismatch')
  let previous = Buffer.alloc(stride), transparentPixels = 0, partialAlphaPixels = 0
  const rgba = pixels ? Buffer.alloc(width*height*4) : null
  let minAlpha = 255, maxAlpha = 0
  for (let y = 0; y < height; y++) {
    const filter = raw[y*(stride+1)]
    if (filter > 4) throw new Error('Invalid PNG row filter')
    const row = Buffer.allocUnsafe(stride)
    for (let x = 0; x < stride; x++) {
      const left = x < channels ? 0 : row[x-channels], up = previous[x], upperLeft = x < channels ? 0 : previous[x-channels]
      const predictor = [0,left,up,Math.floor((left+up)/2),paeth(left,up,upperLeft)][filter]
      row[x] = (raw[y*(stride+1)+1+x]+predictor) & 255
    }
    for (let x = 0; x < stride; x += channels) {
      let opacity = 255
      if (colorType === 3) {
        if (row[x] >= palette.length/3) throw new Error('Invalid PNG palette index')
        opacity = alpha?.[row[x]] ?? 255
      } else if (colorType === 4 || colorType === 6) opacity = row[x+channels-1]
      else if (alpha && colorType === 0 && row[x] === alpha.readUInt16BE(0)) opacity = 0
      else if (alpha && colorType === 2 && [0,1,2].every(i => row[x+i] === alpha.readUInt16BE(i*2))) opacity = 0
      if (opacity === 0) transparentPixels++
      else if (opacity < 255) partialAlphaPixels++
      minAlpha = Math.min(minAlpha,opacity)
      maxAlpha = Math.max(maxAlpha,opacity)
      if (rgba) {
        const dest = (y*width+x/channels)*4
        for (let c = 0; c < 3; c++) rgba[dest+c] = colorType === 3 ? palette[row[x]*3+c]
          : colorType === 0 || colorType === 4 ? row[x] : row[x+c]
        rgba[dest+3] = opacity
      }
    }
    previous = row
  }
  return { width, height, bitDepth, colorType, paletteColors:palette ? palette.length/3 : null,
    transparentPixels, partialAlphaPixels, opaquePixels:width*height-transparentPixels-partialAlphaPixels, minAlpha, maxAlpha,
    ...(rgba ? { rgba } : {}) }
}
