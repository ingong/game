import { deflateSync } from 'node:zlib'

export function packPixels(source, options) {
  const { width, height, palette, matteMin = 256 } = options
  const [left,top,cropWidth,cropHeight] = options.crop ?? [0,0,source.width,source.height]
  if (![width,height,cropWidth,cropHeight].every(value => Number.isInteger(value) && value > 0) ||
    ![left,top].every(value => Number.isInteger(value) && value >= 0) || left+cropWidth > source.width || top+cropHeight > source.height) throw new Error('Invalid export crop or dimensions')
  if (source.rgba.length !== source.width*source.height*4) throw new Error('Invalid decoded pixel count')
  if (!Array.isArray(palette) || !palette.length || palette.length > 255 || !palette.every(color => /^#[\da-f]{6}$/i.test(color))) throw new Error('Invalid export palette')
  const colors = palette.map(color => [1,3,5].map(i => Number.parseInt(color.slice(i,i+2),16)))
  const indices = Buffer.alloc(width*height)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const sx = left+Math.floor((x+.5)*cropWidth/width), sy = top+Math.floor((y+.5)*cropHeight/height)
    const offset = (sy*source.width+sx)*4
    const [r,g,b,a] = source.rgba.subarray(offset,offset+4)
    if (a < 128 || Math.min(r,g,b) >= matteMin) continue
    let best = 0, distance = Infinity
    colors.forEach(([cr,cg,cb],index) => {
      const score = (r-cr)**2+(g-cg)**2+(b-cb)**2
      if (score < distance) { distance = score; best = index }
    })
    indices[y*width+x] = best+1
  }
  return { width,height,indices,palette:[[0,0,0,0],...colors.map(rgb => [...rgb,255])] }
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type),data])
  let crc = 0xffffffff
  for (const byte of body) {
    crc ^= byte
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  const out = Buffer.alloc(body.length+8)
  out.writeUInt32BE(data.length)
  body.copy(out,4)
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0,out.length-4)
  return out
}

export function encodeIndexedPng({width,height,indices,palette}) {
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0 ||
    indices.length !== width*height || !palette.length || palette.length > 256 ||
    !palette.every(color => color.length === 4 && color.every(v => Number.isInteger(v) && v >= 0 && v <= 255)) ||
    !indices.every(index => Number.isInteger(index) && index >= 0 && index < palette.length)) throw new Error('Invalid indexed PNG data')
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width,0); header.writeUInt32BE(height,4); header[8] = 8; header[9] = 3
  const scanlines = Buffer.alloc((width+1)*height)
  for (let y=0; y<height; y++) scanlines.set(indices.subarray(y*width,(y+1)*width),y*(width+1)+1)
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR',header),
    chunk('PLTE',Buffer.from(palette.flatMap(color => color.slice(0,3)))),
    chunk('tRNS',Buffer.from(palette.map(color => color[3]))),
    chunk('IDAT',deflateSync(scanlines,{level:9})), chunk('IEND',Buffer.alloc(0))
  ])
}
