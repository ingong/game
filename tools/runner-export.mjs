import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { inspectPng } from './png-info.mjs'
import { compilePiskel } from './piskel.mjs'
export { packPixels, encodeIndexedPng } from './indexed-png.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)),'..')
export const RUNNER_EXPORT = {
  source:'assets/concepts/unicorn-runner.piskel',
  target:'assets/runtime/unicorn-chibi-atlas.png'
}

export function compileRunner() {
  return compilePiskel(readFileSync(resolve(root,RUNNER_EXPORT.source),'utf8'))
}
export function exportRunner({check=false}={}) {
  const png=compileRunner(), target=resolve(root,RUNNER_EXPORT.target)
  const current=existsSync(target)?readFileSync(target):null
  // zlib versions may encode identical pixels differently. Preserve the checked-in
  // compact file when its decoded dimensions and RGBA content still match.
  const expected=inspectPng(png,{pixels:true}),actual=current?inspectPng(current,{pixels:true}):null
  const fresh=actual&&actual.width===expected.width&&actual.height===expected.height&&actual.rgba.equals(expected.rgba)
  if(check) {
    if(!fresh) throw new Error('Runner export is stale. Run npm run assets:generate')
  } else if(!fresh) writeFileSync(target,png)
  return fresh?current.length:png.length
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2)
  if(args.some(arg=>arg!=='--check')) throw new Error('Usage: node tools/runner-export.mjs [--check]')
  console.log(`Runner PNG ${exportRunner({check:args.includes('--check')})} bytes`)
}
